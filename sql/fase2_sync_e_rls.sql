-- ============================================================================
-- FASE 2 — Segurança dos dados
-- T1: Sincronização robusta multi-dispositivo
-- T10: Auditoria de RLS (professor vê apenas alunos atribuídos a ele)
--
-- Execute este script no SQL Editor do Supabase.
-- O script é idempotente: pode ser executado mais de uma vez sem efeito
-- colateral. Nenhum comando é destrutivo (apenas ADD COLUMN / CREATE).
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- T1.1 — Versionamento do estado (relógio lógico)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE progresso
  ADD COLUMN IF NOT EXISTS versao bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS device_id text;

-- ────────────────────────────────────────────────────────────────────────────
-- T1.2 — Eventos imutáveis (append-only)
-- Conclusões de bloco, questões, status de tópico e avanços de fase
-- passam a ser gravados como eventos. O client_event_id (gerado no
-- cliente) garante idempotência: reenvio do mesmo evento não duplica.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS eventos_estudo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('bloco_concluido','questoes_registradas','topico_status','fase_avancada')),
  payload jsonb NOT NULL,
  client_event_id uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_event_id)
);

CREATE INDEX IF NOT EXISTS eventos_estudo_user_idx ON eventos_estudo (user_id, criado_em DESC);

ALTER TABLE eventos_estudo ENABLE ROW LEVEL SECURITY;

-- Idempotência também na tabela questoes (reenvio offline não duplica linhas)
ALTER TABLE questoes ADD COLUMN IF NOT EXISTS client_event_id uuid;
UPDATE questoes SET client_event_id = gen_random_uuid() WHERE client_event_id IS NULL;
ALTER TABLE questoes ALTER COLUMN client_event_id SET NOT NULL;
ALTER TABLE questoes ALTER COLUMN client_event_id SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS questoes_client_event_id_idx ON questoes (client_event_id);

-- ────────────────────────────────────────────────────────────────────────────
-- T10 — RLS
-- Padrão: aluno tem acesso total às próprias linhas; professor tem
-- SELECT (somente leitura) sobre dados de alunos com atribuição dele.
-- Professores NÃO têm INSERT/UPDATE/DELETE em dados de alunos.
-- ────────────────────────────────────────────────────────────────────────────

-- eventos_estudo: aluno gerencia as próprias linhas
DROP POLICY IF EXISTS eventos_aluno_proprio ON eventos_estudo;
CREATE POLICY eventos_aluno_proprio ON eventos_estudo
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- eventos_estudo: professor lê eventos de alunos atribuídos a ele
DROP POLICY IF EXISTS eventos_professor_atribuidos ON eventos_estudo;
CREATE POLICY eventos_professor_atribuidos ON eventos_estudo
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plano_atribuicoes pa
      WHERE pa.aluno_id = eventos_estudo.user_id
        AND pa.professor_id = auth.uid()
    )
  );

-- progresso: professor lê o estado do ciclo de alunos atribuídos
DROP POLICY IF EXISTS progresso_professor_atribuidos ON progresso;
CREATE POLICY progresso_professor_atribuidos ON progresso
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plano_atribuicoes pa
      WHERE pa.aluno_id = progresso.user_id
        AND pa.professor_id = auth.uid()
    )
  );

-- edital_progresso: professor lê o progresso de edital de alunos atribuídos
DROP POLICY IF EXISTS edital_professor_atribuidos ON edital_progresso;
CREATE POLICY edital_professor_atribuidos ON edital_progresso
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plano_atribuicoes pa
      WHERE pa.aluno_id = edital_progresso.user_id
        AND pa.professor_id = auth.uid()
    )
  );

-- questoes: professor lê o histórico de questões de alunos atribuídos
DROP POLICY IF EXISTS questoes_professor_atribuidos ON questoes;
CREATE POLICY questoes_professor_atribuidos ON questoes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plano_atribuicoes pa
      WHERE pa.aluno_id = questoes.user_id
        AND pa.professor_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- Verificação pós-execução
-- ────────────────────────────────────────────────────────────────────────────

-- Listar todas as policies das tabelas envolvidas:
-- SELECT tablename, policyname, cmd, qual FROM pg_policies
-- WHERE tablename IN ('progresso','edital_progresso','questoes','eventos_estudo','notificacoes')
-- ORDER BY tablename, policyname;

-- ────────────────────────────────────────────────────────────────────────────
-- Teste adversarial (executar manualmente com dois usuários de teste)
-- ────────────────────────────────────────────────────────────────────────────
-- [ ] Professor A não lê dados de aluno atribuído apenas ao professor B.
-- [ ] Aluno não lê `progresso` de outro aluno.
-- [ ] Usuário anônimo (sem login) não lê nenhuma das tabelas.
-- [ ] Professor não consegue UPDATE/DELETE em `edital_progresso` de aluno.
-- [ ] Reenvio do mesmo evento (mesmo client_event_id) não cria linha nova.
