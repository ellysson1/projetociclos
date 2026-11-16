-- ============================================================================
-- FASE 7 — Robustez de planos, atribuições e progresso do edital
--
-- Idempotente e aditiva: nenhum dado de aluno é removido.
-- Já aplicada em produção em 2026-11-16 (migração fase7_planos_e_progresso).
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- P1 — Status 'visto' era rejeitado pelo banco
--
-- O app grava 'visto' quando o aluno conclui o estudo de um assunto, mas a
-- CHECK só aceitava pendente/em_andamento/concluido. Todo salvamento de
-- 'visto' falhava em silêncio: o item voltava a "em andamento" no reload e
-- o avanço de fase nunca era persistido.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.edital_progresso DROP CONSTRAINT IF EXISTS edital_progresso_status_check;
ALTER TABLE public.edital_progresso ADD CONSTRAINT edital_progresso_status_check
  CHECK (status IN ('pendente', 'em_andamento', 'visto', 'concluido'));

-- ────────────────────────────────────────────────────────────────────────────
-- P2 — plano_atribuicoes.updated_at
--
-- O app usa o carimbo da atribuição para saber se o professor mudou algo.
-- A coluna não existia: a aba Alunos falhava e reatribuir o mesmo plano
-- nunca chegava ao aluno (created_at não muda em upsert).
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.plano_atribuicoes ADD COLUMN IF NOT EXISTS updated_at timestamptz;
UPDATE public.plano_atribuicoes SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE public.plano_atribuicoes ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.plano_atribuicoes ALTER COLUMN updated_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.tocar_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atribuicoes_updated_at ON public.plano_atribuicoes;
CREATE TRIGGER trg_atribuicoes_updated_at
  BEFORE UPDATE ON public.plano_atribuicoes
  FOR EACH ROW EXECUTE FUNCTION public.tocar_updated_at();

DROP TRIGGER IF EXISTS trg_planos_updated_at ON public.planos;
CREATE TRIGGER trg_planos_updated_at
  BEFORE UPDATE ON public.planos
  FOR EACH ROW EXECUTE FUNCTION public.tocar_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- P3 — Unicidade com subtópico nulo
--
-- NULLs são distintos em UNIQUE comum: itens sem subtópico podiam ser
-- duplicados a cada upsert.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.edital_progresso
  DROP CONSTRAINT IF EXISTS edital_progresso_user_id_plano_id_materia_topico_subtopico_key;
ALTER TABLE public.edital_progresso
  ADD CONSTRAINT edital_progresso_user_id_plano_id_materia_topico_subtopico_key
  UNIQUE NULLS NOT DISTINCT (user_id, plano_id, materia, topico, subtopico);

-- ────────────────────────────────────────────────────────────────────────────
-- P4 — IDs estáveis em todos os itens de edital dos planos
--
-- Planos antigos não tinham id nos itens; cada aluno gerava ids próprios na
-- cópia local. Backup em planos_backup_fase7 antes da alteração.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.planos_backup_fase7 AS SELECT * FROM public.planos;
ALTER TABLE public.planos_backup_fase7 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.planos DISABLE TRIGGER trg_planos_updated_at;

UPDATE public.planos p SET edital = (
  SELECT jsonb_agg(
    (CASE WHEN m ? 'id' THEN m ELSE m || jsonb_build_object('id', gen_random_uuid()) END)
    || jsonb_build_object('topicos', COALESCE((
      SELECT jsonb_agg(
        (CASE WHEN t ? 'id' THEN t ELSE t || jsonb_build_object('id', gen_random_uuid()) END)
        || CASE WHEN jsonb_typeof(t->'subtopicos') = 'array' THEN jsonb_build_object('subtopicos', COALESCE((
             SELECT jsonb_agg(
               CASE
                 WHEN jsonb_typeof(s) = 'string' THEN jsonb_build_object('id', gen_random_uuid(), 'nome', s #>> '{}')
                 WHEN s ? 'id' THEN s
                 ELSE s || jsonb_build_object('id', gen_random_uuid())
               END ORDER BY so)
             FROM jsonb_array_elements(t->'subtopicos') WITH ORDINALITY AS ss(s, so)), '[]'::jsonb))
           ELSE '{}'::jsonb END
        ORDER BY tord)
      FROM jsonb_array_elements(COALESCE(m->'topicos', '[]'::jsonb)) WITH ORDINALITY AS tt(t, tord)), '[]'::jsonb))
    ORDER BY mo)
  FROM jsonb_array_elements(p.edital) WITH ORDINALITY AS mm(m, mo))
WHERE jsonb_typeof(p.edital) = 'array' AND jsonb_array_length(p.edital) > 0
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(p.edital) m
    WHERE NOT (m ? 'id')
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(m->'topicos', '[]'::jsonb)) t
                  WHERE NOT (t ? 'id')
                     OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(t->'subtopicos', '[]'::jsonb)) s
                                WHERE jsonb_typeof(s) = 'string' OR NOT (s ? 'id')))
  );

ALTER TABLE public.planos ENABLE TRIGGER trg_planos_updated_at;

-- ────────────────────────────────────────────────────────────────────────────
-- P5 — Progresso do edital indexado pelo id estável do item
--
-- A chave por nomes continua existindo (compatibilidade), mas o item_id
-- permite que o progresso sobreviva à renomeação de um tópico.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.edital_progresso ADD COLUMN IF NOT EXISTS item_id uuid;
CREATE INDEX IF NOT EXISTS edital_progresso_item_idx
  ON public.edital_progresso (user_id, plano_id, item_id);

-- Backfill: casa cada linha com o item do plano pelo nome exato
UPDATE public.edital_progresso ep SET item_id = achado.item_id
FROM (
  SELECT ep2.id AS ep_id,
         COALESCE((s.value->>'id')::uuid, (t.value->>'id')::uuid) AS item_id
  FROM public.edital_progresso ep2
  JOIN public.planos p ON p.id = ep2.plano_id
  JOIN LATERAL jsonb_array_elements(p.edital) m(value) ON m.value->>'materia' = ep2.materia
  JOIN LATERAL jsonb_array_elements(COALESCE(m.value->'topicos', '[]'::jsonb)) t(value) ON t.value->>'nome' = ep2.topico
  LEFT JOIN LATERAL jsonb_array_elements(COALESCE(t.value->'subtopicos', '[]'::jsonb)) s(value)
    ON ep2.subtopico IS NOT NULL AND s.value->>'nome' = ep2.subtopico
  WHERE (ep2.subtopico IS NULL OR s.value IS NOT NULL)
) achado
WHERE ep.id = achado.ep_id AND ep.item_id IS NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- P6 — Snapshots do estado do aluno antes de trocas de plano
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.progresso_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  motivo text NOT NULL,
  plano_id uuid,
  estado jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS progresso_snapshots_user_idx
  ON public.progresso_snapshots (user_id, created_at DESC);

ALTER TABLE public.progresso_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS snapshots_aluno_proprio ON public.progresso_snapshots;
CREATE POLICY snapshots_aluno_proprio ON public.progresso_snapshots
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS snapshots_professor_atribuidos ON public.progresso_snapshots;
CREATE POLICY snapshots_professor_atribuidos ON public.progresso_snapshots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.plano_atribuicoes pa
      WHERE pa.aluno_id = progresso_snapshots.user_id
        AND pa.professor_id = (SELECT auth.uid())
    )
  );
