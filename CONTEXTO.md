# Contexto do Projeto - Ciclo de Estudos

> Arquivo gerado automaticamente para continuar o desenvolvimento em outro computador.
> Cole este conteúdo no início de uma nova conversa com o Claude.

---

## O que é o projeto

Aplicativo web de gerenciamento de ciclo de estudos para concurseiros.
- **Stack**: Vanilla HTML/CSS/JS + Supabase (auth + banco)
- **Hospedagem**: Hostinger (arquivos estáticos)
- **Domínio**: https://profellysson.com.br
- **Pasta local**: `OneDrive - Tribunal de Contas da União\Documentos\Projeto ciclo guiado\`

---

## Estrutura de arquivos atual

```
/
├── index.html              ← Shell HTML (~220 linhas), carrega os CSS/JS
├── login.html
├── criar-conta.html        ← Cria apenas alunos (não mudar)
├── criar-professor.html    ← PÁGINA SECRETA - cadastro de professor
│                             Código de acesso: prof2026@ciclo
├── esqueci-senha.html
├── redefinir-senha.html
├── vsl.html                ← Landing page de vendas (não mexer)
├── server.js               ← Servidor Node.js para preview local (porta 8080)
│
├── css/
│   ├── variables.css       ← :root vars + reset
│   ├── layout.css          ← container, tabs, tab-content
│   ├── forms.css           ← inputs, buttons, tables
│   ├── blocks.css          ← .bloco-card (novo design minimalista) + legacy .bloco
│   └── modals.css          ← modais overlay/card com animação
│
├── js/
│   ├── config.js           ← SUPABASE_URL, SUPABASE_ANON_KEY, supabaseClient
│   ├── state.js            ← variáveis globais (materiasList, blocosAtivos, etc), salvarEstado
│   ├── tabs.js             ← alternarAba()
│   ├── supabase-auth.js    ← getUsuarioLogado, sair, atualizarUIAuth
│   ├── supabase-sync.js    ← salvarEstadoNuvem, carregarEstadoNuvem
│   ├── profile.js          ← getProfile, isTeacher, ensureProfile, atualizarUIRole
│   ├── materias.js         ← gerarCorUnica, inicializarSelecaoMaterias, avancarSelecaoMaterias
│   ├── variaveis.js        ← preencherTabelaVariaveis, calcularBlocos, ajustarBlocos
│   ├── blocos.js           ← distribuirBlocosAleatoriamente, exibirCicloVisual, criarCardBloco
│   ├── questoes.js         ← fluxo de conclusão 3 etapas (assunto → questões feitas?)
│   ├── planos.js           ← CRUD planos professor, renderizarPlanosDisponiveis, adotarPlano
│   ├── edital.js           ← aba Edital: accordion, progresso, match, editor professor, import Excel
│   ├── batch-upload.js     ← upload Excel/CSV matérias, baixarModeloExcel
│   ├── timer.js            ← cronômetro / timer
│   ├── notes.js            ← anotações + salvarConfiguracoes
│   ├── export.js           ← gerarPDF, exportarParaExcel
│   └── app.js              ← DOMContentLoaded, todos os event listeners
│
└── .claude/
    └── launch.json         ← config do servidor preview (Node.js porta 8080)
```

---

## Supabase

- **URL**: `https://znkxhacjuejmxhgcaqvz.supabase.co`
- **ANON KEY**: `sb_publishable_ULAmkcVfbsAzJ6tRCQJarQ_WGMbMaTo`

### Tabelas existentes
- `progresso` — estado do ciclo por usuário (já existia)
  - `user_id`, `estado` (JSON), `anotacoes`, `updated_at`

### Tabelas que PRECISAM ser criadas no Supabase

```sql
-- Fase 1: Perfis de usuário
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('professor', 'aluno')) DEFAULT 'aluno',
  nome TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);

-- Fase 2: Planos de professores
CREATE TABLE planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  materias JSONB NOT NULL DEFAULT '[]',
  configuracoes JSONB NOT NULL DEFAULT '{}',
  edital JSONB DEFAULT NULL,
  regras_evolucao JSONB DEFAULT '[]',
  publico BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE planos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage own plans" ON planos FOR ALL USING (auth.uid() = professor_id);
CREATE POLICY "Students read public plans" ON planos FOR SELECT USING (publico = true);

-- Fase 3: Registro de questões por bloco
CREATE TABLE questoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bloco_index INTEGER NOT NULL,
  ciclo_numero INTEGER DEFAULT 1,
  materia TEXT NOT NULL,
  assunto TEXT,
  questoes_feitas INTEGER NOT NULL DEFAULT 0,
  questoes_corretas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE questoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own questoes" ON questoes FOR ALL USING (auth.uid() = user_id);
```

---

## O que foi implementado (Fases 0, 1, 2, 3, 5)

### Fase 0 - Divisão do monolito
- index.html era 1360 linhas com tudo junto
- Agora é um shell de ~220 linhas que carrega 5 CSS + 14 JS externos

### Fase 1 - Sistema Professor/Aluno
- `js/profile.js`: getProfile, isTeacher, ensureProfile, atualizarUIRole
- `criar-professor.html`: página secreta com código `prof2026@ciclo`, ao validar cria conta e seta role='professor'
- UI branching: professor vê aba "Planos", aluno vê seção "Escolher Plano" na Home
- Migração automática de usuários existentes como 'aluno'

### Fase 2 - Planos de Professor + Upload em Lote
- `js/planos.js`: CRUD completo (criar/editar/excluir/listar planos)
- Editor de planos com nome, descrição, público/privado, configs (horas semanais, duração bloco, intervalo, blocos/sessão) e tabela de matérias com pesos
- Aluno pode adotar plano público: importa matérias + pesos + configs e calcula blocos automaticamente
- `js/batch-upload.js`: importa Excel/CSV (.xlsx/.xls/.csv), detecta colunas automaticamente, preview antes de confirmar, botão "Baixar Modelo"
- Botão de upload tanto na aba Matérias (aluno) quanto no editor de planos (professor)

### Fase 3 - Cards Minimalistas + Fluxo de Conclusão
- Novo design de bloco: card com borda teal (#26A69A), barra colorida no topo, sigla/nome/duração, checkbox "Concluir", botão Cronômetro
- Grid responsivo (auto-fill minmax 200px)
- Sessões agrupadas com headers e separadores de intervalo
- Drag-and-drop mantido nos cards
- **Fluxo de conclusão em 3 etapas via modais**:
  1. Registrar Estudo → informar assunto estudado
  2. "Você fez questões?" → [Sim] / [Não, apenas estudei]
  3. (se Sim) Registrar questões → feitas + corretas
- Card concluído fica verde e mostra assunto + % acertos
- `js/questoes.js`: salva no Supabase tabela `questoes`

### Fase 5 - Aba Edital
- `js/edital.js`: módulo completo com ~400 linhas
  - `renderizarEdital()`: árvore accordion (matéria → tópico → subtópico) com barras de progresso
  - `atualizarProgressoEdital(materia, assunto, questoes)`: chamada quando bloco é concluído
  - Match automático assunto → tópico do edital por similaridade (normalizaTexto + palavras em comum)
  - `preencherDatalistEdital(materiaBloco)`: autocomplete no modal de assunto com tópicos disponíveis
  - `atualizarVisibilidadeEdital()`: mostra/oculta aba Edital conforme plano adotado
  - Editor de edital para professor: add/remove matérias → tópicos → subtópicos manualmente
  - Import/export edital via Excel/CSV (colunas: Materia, Topico, Subtopico) com preview
  - `baixarModeloEdital()`: gera modelo Excel de exemplo
- Filtros na aba: por status (pendente/em_andamento/concluido) e busca por texto
- Alteração manual de status por item (select dropdown)
- Progresso calculado e exibido em cada nível (geral, matéria, tópico)
- `state.js`: novo `planoAdotado = { id, nome, edital }` persistido no estado
- `planos.js`: `adotarPlano()` salva referência ao plano + edital; `coletarDadosPlano()` coleta edital do editor
- `questoes.js`: `iniciarFluxoConclusao()` preenche datalist; `finalizarConclusao()` atualiza edital
- `profile.js`: `atualizarUIRole()` chama `atualizarVisibilidadeEdital()`
- `index.html`: aba "Edital" com resumo+filtros+árvore; seção "Edital" no editor de planos; datalist no modal assunto
- CSS em `blocks.css`: estilos para accordion, barras de progresso, status com cores

**Tabela Supabase a criar (edital_progresso)**:
```sql
CREATE TABLE edital_progresso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plano_id UUID REFERENCES planos(id) ON DELETE CASCADE,
  materia TEXT NOT NULL,
  topico TEXT NOT NULL,
  subtopico TEXT,
  status TEXT CHECK (status IN ('pendente','em_andamento','concluido')) DEFAULT 'pendente',
  questoes_feitas INTEGER DEFAULT 0,
  questoes_corretas INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, plano_id, materia, topico, subtopico)
);
ALTER TABLE edital_progresso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own edital" ON edital_progresso FOR ALL USING (auth.uid() = user_id);
```

---

## O que falta implementar (Fase 6)

### Fase 6 - Evolução Automática do Ciclo
**Objetivo**: o ciclo se adapta automaticamente com base em gatilhos.

**Schema Supabase a criar**:
```sql
CREATE TABLE ciclo_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plano_id UUID REFERENCES planos(id) ON DELETE SET NULL,
  numero_ciclo INTEGER NOT NULL DEFAULT 1,
  blocos JSONB NOT NULL DEFAULT '[]',
  questoes_resumo JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE ciclo_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own historico" ON ciclo_historico FOR ALL USING (auth.uid() = user_id);
```

**O que construir**:
1. `js/evolucao.js` com:
   - `avaliarRegras(regras)`: avalia todas as regras ao completar um ciclo
   - Tipos de gatilho: `ciclos_completos` | `progresso_edital` | `prerequisito`
   - Tipos de ação: `adicionar_materia` | `alterar_peso` | `desbloquear_materia` | `remover_materia`
2. No editor de planos do professor, seção "Regras de Evolução" para configurar os gatilhos
3. Modificar `verificarConclusao()` em `blocos.js` para:
   - Salvar snapshot em `ciclo_historico`
   - Rodar `avaliarRegras()`
   - Mostrar modal de "Ciclo Completo!" com regras ativadas
   - Gerar próximo ciclo com alterações aplicadas

---

## Como rodar localmente

O Node.js portátil está em `C:\Users\araujor\node\node-v22.16.0-win-x64\`

```bash
# Na pasta do projeto:
C:\Users\araujor\node\node-v22.16.0-win-x64\node.exe server.js
# Abre http://localhost:8080
```

O `.claude/launch.json` já está configurado para o Claude Code fazer isso automaticamente com `preview_start`.

---

## Observações importantes

- `criar-conta.html` deve permanecer criando apenas alunos (não adicionar seleção de role)
- `criar-professor.html` é a página secreta — código `prof2026@ciclo` — não linkar em nenhum lugar do site
- Os erros "AuthSessionMissingError" no console são normais quando não está logado
- O app usa o mesmo servidor Supabase em produção e local (dev)
- A tabela `progresso` é a tabela histórica — não alterar schema, apenas adicionar coluna `plano_id UUID REFERENCES planos(id) ON DELETE SET NULL`
