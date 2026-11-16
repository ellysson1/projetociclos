-- ============================================================================
-- FASE 6 — Endurecimento de segurança
--
-- Execute este script no SQL Editor do Supabase.
-- Idempotente: pode ser executado mais de uma vez sem efeito colateral.
-- S1, S2 e S3 já aplicados em produção em 2026-11-16 (migração fase6_seguranca).
-- Nenhum comando é destrutivo para dados de alunos.
--
-- Contexto: o app é 100% client-side (HTML/JS estático + Supabase). A anon key
-- é pública por design — TODA a segurança real vive na RLS. Qualquer tabela
-- sem policy correta é uma tabela aberta.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- S1 — `role` não pode ser auto-atribuído (CRÍTICO)
--
-- Hoje o código de professor (`CODIGO_PROFESSOR`) está em texto puro no
-- JavaScript do navegador e é validado no client: qualquer visitante abre o
-- DevTools, lê a constante e cria conta com role='professor', ganhando acesso
-- de leitura aos dados de alunos.
--
-- Esta trigger fecha o buraco no ponto que importa (o banco): o usuário pode
-- criar/editar o próprio profile, mas NUNCA definir ou alterar o próprio
-- `role`. Promoção a professor passa a exigir service_role (painel do Supabase
-- ou Edge Function), fora do alcance do navegador.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.impedir_auto_promocao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims text := nullif(current_setting('request.jwt.claims', true), '');
BEGIN
  -- Sem JWT (SQL Editor / conexão direta ao banco) ou service_role: passe livre.
  -- Requisições do navegador sempre chegam com JWT de anon/authenticated.
  IF claims IS NULL OR claims::jsonb ->> 'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Toda conta criada pelo navegador nasce como aluno
    NEW.role := 'aluno';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Alterações de role vindas do client são ignoradas (mantém o valor atual)
    NEW.role := OLD.role;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_impedir_auto_promocao ON public.profiles;
CREATE TRIGGER trg_impedir_auto_promocao
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.impedir_auto_promocao();

-- Para promover alguém a professor, rode no SQL Editor (service_role):
--   UPDATE public.profiles SET role = 'professor' WHERE user_id = '<uuid>';

-- ────────────────────────────────────────────────────────────────────────────
-- S2 — Revogar EXECUTE público de rls_auto_enable()
--
-- O advisor do Supabase aponta esta função SECURITY DEFINER como executável
-- por `anon` via API REST (RPC).
-- ────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon';
    EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM authenticated';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- S3 — Ajustes de RLS
--
-- Estado encontrado no banco em 2026-11-16 (policies criadas fora do repo):
--   profiles          : leitura por qualquer autenticado; insert/update do próprio
--   planos            : professor gerencia os seus; aluno lê os públicos
--   plano_atribuicoes : professors_manage (ALL), students_read (SELECT)
--   notificacoes      : leitura/update do destinatário; insert por autenticado
--   videos            : professor gerencia os seus; leitura livre
--   videos_assistidos : cada um gerencia os seus
-- Só o que estava errado é alterado aqui; o restante fica como está.
-- ────────────────────────────────────────────────────────────────────────────

-- plano_atribuicoes ---------------------------------------------------------
-- Tabela-pivô de TODA a autorização do professor: as policies de progresso,
-- edital_progresso, questoes e eventos_estudo fazem EXISTS contra ela.
-- A policy antiga (professors_manage) só exigia professor_id = auth.uid():
-- qualquer aluno podia criar uma atribuição apontando para outro aluno e,
-- com isso, ler o progresso dele. A nova exige role = 'professor'.
DROP POLICY IF EXISTS professors_manage ON public.plano_atribuicoes;
DROP POLICY IF EXISTS atribuicoes_professor_dono ON public.plano_atribuicoes;
CREATE POLICY atribuicoes_professor_dono ON public.plano_atribuicoes
  FOR ALL
  USING (professor_id = (SELECT auth.uid()))
  WITH CHECK (
    professor_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.role = 'professor'
    )
  );

-- planos --------------------------------------------------------------------
-- Aluno só lia planos públicos: um plano PRIVADO atribuído a ele vinha vazio
-- e a atribuição era ignorada em silêncio.
DROP POLICY IF EXISTS planos_leitura_aluno ON public.planos;
CREATE POLICY planos_leitura_aluno ON public.planos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.plano_atribuicoes pa
      WHERE pa.plano_id = planos.id AND pa.aluno_id = (SELECT auth.uid())
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- S4 — Limpeza de tabelas mortas
--
-- Confirmado por inspeção: 0 linhas e nenhuma referência no código (js/).
-- Descomente para remover. Mantidas comentadas por segurança — confira antes.
-- ────────────────────────────────────────────────────────────────────────────

-- DROP TABLE IF EXISTS public.progresso_backup;
-- DROP TABLE IF EXISTS public.edital_progresso_backup;
-- DROP TABLE IF EXISTS public.questoes_backup;

-- ────────────────────────────────────────────────────────────────────────────
-- Verificação pós-execução
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Toda tabela do schema public deve ter rowsecurity = true:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' ORDER BY rowsecurity, tablename;

-- 2. Listar as policies criadas:
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public' ORDER BY tablename, policyname;

-- 3. Teste da trigger S1 (logado como aluno comum, deve continuar 'aluno'):
-- UPDATE public.profiles SET role = 'professor' WHERE user_id = auth.uid();
-- SELECT role FROM public.profiles WHERE user_id = auth.uid();

-- ────────────────────────────────────────────────────────────────────────────
-- Pendências que NÃO são resolvidas por SQL (fazer no painel do Supabase)
-- ────────────────────────────────────────────────────────────────────────────
-- [ ] Authentication → Providers → habilitar "Leaked password protection"
--     (checagem contra HaveIBeenPwned; hoje está desativada).
-- [ ] Authentication → URL Configuration → conferir a allowlist de Redirect
--     URLs (evita open-redirect no fluxo de recuperação de senha).
-- [ ] Remover CODIGO_PROFESSOR do client (js/profile.js, criar-professor.html).
--     Com a trigger S1 ativa o código já não concede nada, mas mantê-lo passa
--     a falsa impressão de ser um segredo.
