-- ============================================================================
-- FASE 8 — Fechamento das policies abertas
--
-- Idempotente. Nenhum dado é alterado ou removido — só regras de acesso.
-- Já aplicada em produção em 2026-11-16 (migração fase8_seguranca_rls).
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- R1 — Função auxiliar: o usuário logado é professor?
--
-- SECURITY DEFINER porque é usada dentro de policies da própria tabela
-- profiles (uma subconsulta comum ali causaria recursão de RLS). Só responde
-- sobre quem está chamando.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.eh_professor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role = 'professor'
  );
$$;

REVOKE ALL ON FUNCTION public.eh_professor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eh_professor() TO authenticated;

REVOKE ALL ON FUNCTION public.tocar_updated_at() FROM PUBLIC, anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- R2 — profiles: fim da leitura irrestrita
--
-- Antes, qualquer usuário logado lia nome e papel de TODOS os outros.
-- Agora: cada um lê o próprio; professor lê todos (precisa listar alunos
-- para atribuir plano); qualquer logado lê os perfis de professores (o nome
-- do autor aparece nos planos públicos).
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;

DROP POLICY IF EXISTS profiles_professor_le_todos ON public.profiles;
CREATE POLICY profiles_professor_le_todos ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT public.eh_professor()));

DROP POLICY IF EXISTS profiles_le_professores ON public.profiles;
CREATE POLICY profiles_le_professores ON public.profiles
  FOR SELECT TO authenticated
  USING (role = 'professor');

-- ────────────────────────────────────────────────────────────────────────────
-- R3 — notificacoes: fim do envio para qualquer pessoa
--
-- Antes, qualquer logado criava notificação para qualquer usuário (spam ou
-- phishing dentro do app). Agora só para si mesmo ou entre professor e
-- aluno ligados por uma atribuição de plano.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can insert" ON public.notificacoes;
DROP POLICY IF EXISTS notificacoes_insere_vinculados ON public.notificacoes;
CREATE POLICY notificacoes_insere_vinculados ON public.notificacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.plano_atribuicoes pa
      WHERE (pa.aluno_id = (SELECT auth.uid()) AND pa.professor_id = notificacoes.user_id)
         OR (pa.professor_id = (SELECT auth.uid()) AND pa.aluno_id = notificacoes.user_id)
    )
  );

ALTER TABLE public.notificacoes DROP CONSTRAINT IF EXISTS notificacoes_mensagem_tamanho;
ALTER TABLE public.notificacoes ADD CONSTRAINT notificacoes_mensagem_tamanho
  CHECK (char_length(mensagem) <= 500);

-- ────────────────────────────────────────────────────────────────────────────
-- R4 — planos e videos: só professor publica
--
-- Antes, qualquer logado criava plano público ou vídeo visível a todos,
-- bastando pôr o próprio id como professor_id.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Teachers insert own plans" ON public.planos;
CREATE POLICY "Teachers insert own plans" ON public.planos
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = professor_id AND (SELECT public.eh_professor()));

DROP POLICY IF EXISTS "Teachers update own plans" ON public.planos;
CREATE POLICY "Teachers update own plans" ON public.planos
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = professor_id)
  WITH CHECK ((SELECT auth.uid()) = professor_id AND (SELECT public.eh_professor()));

DROP POLICY IF EXISTS manage_own_videos ON public.videos;
CREATE POLICY manage_own_videos ON public.videos
  FOR ALL TO authenticated
  USING (professor_id = (SELECT auth.uid()))
  WITH CHECK (professor_id = (SELECT auth.uid()) AND (SELECT public.eh_professor()));

-- ────────────────────────────────────────────────────────────────────────────
-- Pendência que só existe no painel do Supabase
-- ────────────────────────────────────────────────────────────────────────────
-- [ ] Authentication → Sign In / Providers → Email → "Prevent use of leaked
--     passwords" (checagem no HaveIBeenPwned). Disponível a partir do plano Pro.
