# Ciclo de Estudos - Documentacao da Plataforma

## O que e a plataforma

O **Ciclo de Estudos** e uma plataforma web de gestao de estudos que gera ciclos de estudo personalizados e adaptativos para alunos em preparacao para concursos publicos. A plataforma conecta **professores** (que montam planos e acompanham alunos) e **alunos** (que estudam seguindo ciclos individualizados que se ajustam automaticamente ao seu desempenho).

A proposta central e: **o aluno nao precisa decidir o que estudar nem quando**. A plataforma faz isso por ele, considerando o peso de cada materia, a extensao do conteudo, a dificuldade percebida e o progresso real do aluno.

---

## Arquitetura tecnica

- **Frontend**: HTML, CSS e JavaScript puro (sem frameworks)
- **Backend**: Supabase (autenticacao, banco Postgres com RLS, sincronizacao em nuvem)
- **Hospedagem**: Hostinger (profellysson.com.br)
- **Persistencia**: localStorage (offline) + Supabase (nuvem, sincronizado a cada 30s e ao fechar)

---

## Papeis

| Papel | O que faz |
|---|---|
| **Professor** | Cria planos de estudo com materias, pesos, fases e edital. Atribui planos a alunos com configuracoes personalizadas. Monitora progresso pelo painel. |
| **Aluno** | Recebe ou escolhe um plano. Estuda seguindo o ciclo gerado. Registra questoes e progresso. O ciclo se adapta conforme ele avanca. |

---

## Fluxo completo do aluno

### 1. Primeiro acesso - Onboarding

Ao fazer login pela primeira vez, o aluno ve o botao **"Comecar Configuracao"** que abre um wizard interativo de 5 etapas:

| Etapa | O que captura | Como captura |
|---|---|---|
| **1. Objetivo** | Qual concurso/prova | Cards selecionaveis: planos atribuidos pelo professor, planos publicos, ou objetivo livre |
| **2. Horas** | Quantas horas por semana | Botoes visuais (5h a 40h) + campo customizado |
| **3. Materias** | Quais materias estudar | Chips com adicionar/remover. Se veio de um plano, ja vem preenchido |
| **4. Familiaridade** | Peso, extensao e dificuldade de cada materia | 3 perguntas por materia em linguagem natural: "Quanto cai na prova?" (Pouco/Medio/Muito), "Extensao do conteudo?" (Curto/Medio/Extenso), "Sua dificuldade?" (Facil/OK/Dificil) |
| **5. Resumo** | Confirmacao | Exibe total de blocos, horas, materias. Botao "Gerar Meu Ciclo" |

As respostas intuitivas sao convertidas internamente em valores numericos (Pouco=3, Medio=5, Muito=8) que alimentam o algoritmo de alocacao.

Se o aluno ja tem um plano atribuido pelo professor, o wizard vem pre-preenchido com as materias e configuracoes do plano, mas o aluno pode ajustar tudo.

### 2. Geracao do ciclo

Apos o onboarding, o sistema gera automaticamente o ciclo de estudos usando o **algoritmo de alocacao ponderada**:

```
valorPonderado = peso * 0.5 + extensao * 0.25 + dificuldade * 0.25
```

- **Peso** (quanto cai na prova) vale **50%** da formula
- **Extensao** (tamanho do conteudo) vale **25%**
- **Dificuldade** (percepcao do aluno) vale **25%**

O numero de blocos de cada materia e proporcional ao seu valor ponderado em relacao ao total:

```
blocos_materia = (valorPonderado / somaTodosValores) * totalBlocos
```

O total de blocos e calculado a partir das horas semanais e da duracao de cada bloco (padrao: 60 minutos).

#### Meios-blocos

Quando uma materia tem importancia relativa muito baixa (entre 0 e 1 bloco inteiro), o sistema cria um **meio-bloco** com metade da duracao. Isso so acontece quando ha pelo menos 2 materias nessa situacao, evitando que materias menores sejam simplesmente ignoradas.

#### Distribuicao inteligente

Os blocos sao embaralhados aleatoriamente (Fisher-Yates), mas com uma restricao: **nunca mais de 2 blocos consecutivos da mesma materia**. Se detecta 3 seguidos, troca de posicao com o proximo bloco diferente.

### 3. Tela do ciclo ativo

O aluno ve seu ciclo como uma sequencia de **cards coloridos**, cada cor representando uma materia. Cada card mostra:

- Nome e sigla da materia
- Modo de estudo (se definido): "So Questoes" ou "So Revisao"
- **Sugestao de assunto**: o proximo topico pendente no edital, selecionado automaticamente
- Status: pendente ou concluido

Se o plano tem fases progressivas, um **banner** no topo mostra "Fase X de Y".

### 4. Estudando um bloco

Ao clicar em um bloco, o **cronometro** inicia (contagem regressiva ou progressiva, configuravel). Quando o tempo termina ou o aluno encerra manualmente, inicia-se o **fluxo de conclusao**:

| Etapa | Pergunta | O que registra |
|---|---|---|
| 1 | "Qual assunto voce estudou?" | Texto livre (pre-preenchido com sugestao do edital) |
| 2 | "Concluiu esse assunto?" | Sim/Nao → define status no edital |
| 3 | "Fez questoes?" | Sim/Nao |
| 4 | Se sim: "Quantas fez? Quantas acertou?" | Numeros → salvos por materia e por topico |

Esses dados alimentam **todos os mecanismos adaptativos** descritos abaixo.

---

## Como a plataforma individualiza os estudos

### Mecanismo 1: Sugestao automatica de assunto

**O que faz**: Para cada bloco pendente, a plataforma sugere automaticamente o proximo topico que o aluno deve estudar.

**Como funciona**:
1. O sistema percorre o edital na ordem definida pelo professor
2. Para cada materia, busca o primeiro topico (ou subtopico) com status `pendente`
3. Exibe como sugestao no card do bloco

**Efeito**: O aluno nao precisa pensar "o que estudar agora" — a plataforma ja indica. Conforme ele conclui topicos, a sugestao avanca automaticamente para o proximo.

### Mecanismo 2: Progresso no edital com match inteligente

**O que faz**: Quando o aluno diz o que estudou, o sistema encontra automaticamente o topico correspondente no edital e atualiza o progresso.

**Como funciona**:
1. O aluno digita o assunto (ex: "Princípios da Administração Pública")
2. O sistema normaliza o texto e calcula a **similaridade** com cada topico do edital (sobreposicao de palavras)
3. Se a similaridade for >= 40%, marca o topico no edital como `visto` ou `em_andamento`

**Status possiveis de cada topico**:
- `pendente` → nunca estudado
- `em_andamento` → estudou mas nao concluiu
- `visto` → estudou e concluiu o assunto
- `concluido` → marcacao manual de finalizacao total

**Efeito**: O edital se preenche automaticamente conforme o aluno estuda, sem ele precisar marcar item por item.

### Mecanismo 3: Ciclos progressivos (fases)

**O que faz**: As materias sao introduzidas gradualmente. O aluno comeca com as mais importantes e, conforme avanca, novas materias entram automaticamente no ciclo.

**Como funciona**:
1. O professor define **fases** (1, 2, 3...) para cada materia ao criar o plano
2. O aluno comeca apenas com as materias da Fase 1
3. Apos **cada bloco concluido**, o sistema verifica:
   - Calcula o percentual de topicos `visto` no edital para as materias da fase atual
   - Se o percentual atingir **60%**, avanca para a proxima fase
4. Ao avancar de fase:
   - Novas materias sao adicionadas ao ciclo ativo
   - Novos blocos sao gerados proporcionalmente ao peso das novas materias
   - O aluno recebe **notificacao** informando as novas materias
   - O professor tambem recebe notificacao

**Efeito**: O aluno nao fica sobrecarregado com todas as materias desde o inicio. O sistema dosifica a carga conforme o progresso real.

### Mecanismo 4: Rastreamento de questoes por materia

**O que faz**: Acumula estatisticas de questoes feitas e acertadas, por materia e por topico do edital.

**Como funciona**:
1. Ao concluir um bloco, o aluno informa quantas questoes fez e quantas acertou
2. Os dados sao salvos no bloco, no edital e na tabela de questoes na nuvem
3. A aba **Desempenho** agrega tudo e mostra:
   - Total de questoes feitas por materia
   - Percentual de acerto por materia
   - Barras visuais de progresso

**Efeito**: O aluno (e o professor) conseguem ver em quais materias o desempenho esta fraco, orientando ajustes no ciclo.

### Mecanismo 5: Modos de estudo por materia

**O que faz**: Cada materia pode ter um modo de estudo especifico, definido pelo professor ou pelo aluno.

**Modos disponiveis**:
- **Normal**: estudo teorico + questoes (padrao)
- **So Questoes**: a materia ja foi estudada, agora e so praticar
- **So Revisao**: foco em revisar conteudo ja visto

**Como funciona**: O modo aparece como badge no card do bloco ("So Questoes" / "So Revisao"), orientando o aluno sobre como abordar aquele tempo de estudo.

**Efeito**: Permite diferenciar a abordagem por materia conforme a fase de preparacao do aluno.

### Mecanismo 6: Redimensionamento proporcional

**O que faz**: Se o aluno muda a quantidade de horas semanais, o ciclo se ajusta mantendo as proporcoes.

**Como funciona**:
1. Calcula o fator de escala: `novasHoras / horasAntigas`
2. Blocos ja concluidos sao preservados intactos
3. Blocos pendentes sao recalculados proporcionalmente
4. Reembaralha mantendo a regra de nao repetir 3x seguidas

**Efeito**: O aluno pode mudar sua disponibilidade a qualquer momento sem perder o progresso. Se diminuir de 20h para 10h, cada materia perde blocos proporcionalmente ao seu peso relativo, nao aleatoriamente.

### Mecanismo 7: Controle de revisoes

**O que faz**: Permite ao aluno rastrear quantas vezes revisou cada topico do edital.

**Como funciona**: Na aba Revisao, cada topico ja estudado (status `visto` ou `concluido`) aparece com um contador de revisoes (0 a 10). O aluno ajusta manualmente conforme revisa.

**Efeito**: Garante que o aluno nao esqueca de revisitar conteudos ja vistos, especialmente os mais antigos.

---

## Fluxo do professor

### Criar plano

1. Define nome do plano e lista de materias
2. Para cada materia: nome, sigla, peso, extensao, dificuldade e **fase** (progressiva)
3. Pode importar materias via planilha Excel
4. Pode anexar um **edital** (lista de topicos por materia)

### Atribuir plano a aluno

Fluxo de 3 etapas:

| Etapa | Acao |
|---|---|
| **1. Selecionar aluno** | Lista de alunos cadastrados na plataforma |
| **2. Configurar** | Duracao do bloco, intervalo, blocos por sessao, modo por materia (questoes/revisao/normal) |
| **3. Ajustar blocos** | Tabela editavel com quantidade de blocos por materia, pre-calculada pelo algoritmo. O professor pode alterar manualmente. |

O aluno recebe o ciclo pronto, mas pode ajustar depois.

### Painel de acompanhamento

Para cada plano, o professor ve um card por aluno com:

- **Fase atual** (badge colorido)
- **Blocos concluidos** / total
- **Percentual do edital** coberto
- **Ultima atividade** (ex: "ha 2 horas")
- **Detalhes expandiveis**: blocos por materia, materias da proxima fase

---

## Notificacoes

O sistema envia notificacoes em dois canais:

| Canal | Quando |
|---|---|
| **In-app** (badge no sino) | Avanco de fase, novas materias incluidas |
| **Email** (Resend via Supabase Edge Function) | Mesmos eventos, entregue na caixa de entrada |

O aluno e o professor recebem notificacao quando ha avanco de fase.

---

## Persistencia e sincronizacao

| Dado | Onde salva | Frequencia |
|---|---|---|
| Ciclo ativo, materias, configuracoes | localStorage + Supabase | A cada 30s + ao fechar pagina |
| Progresso do edital | Supabase (edital_progresso) | A cada topico concluido |
| Questoes | Supabase (questoes) | A cada bloco concluido |
| Fase atual | localStorage + Supabase | A cada mudanca de fase |
| Notificacoes | Supabase (notificacoes) | Ao criar notificacao |

---

## Resumo visual do fluxo adaptativo

```
Aluno faz login
    |
    v
[Tem plano atribuido?] --Sim--> Carrega ciclo do professor (ajustavel)
    |                              |
    Nao                            v
    |                     [Tem fases progressivas?]
    v                         |           |
[Onboarding wizard]         Sim          Nao
    |                         |           |
    v                         v           v
[Gera ciclo]           [Mostra so      [Mostra
 personalizado]         Fase 1]        tudo]
    |                     |
    v                     v
[Estuda bloco] <---------+
    |
    v
[Registra assunto + questoes]
    |
    +---> Atualiza edital (match inteligente)
    +---> Acumula estatisticas de questoes
    +---> Avanca sugestao para proximo topico
    +---> Verifica se atingiu 60% da fase
              |
              v
         [Atingiu 60%?]
           |        |
          Sim      Nao
           |        |
           v        v
    [Avanca fase]  [Continua]
    [Adiciona materias]
    [Notifica aluno + professor]
    [Gera novos blocos]
           |
           v
    [Ciclo atualizado automaticamente]
```

---

## Tabelas no Supabase

| Tabela | Funcao |
|---|---|
| `profiles` | Nome, papel (aluno/professor), user_id |
| `progresso` | Ciclo ativo, materias, configuracoes (JSON) |
| `edital_progresso` | Status de cada topico do edital por aluno |
| `questoes` | Historico de questoes por materia e assunto |
| `planos` | Planos criados por professores |
| `plano_atribuicoes` | Vinculo professor → aluno com configuracoes |
| `notificacoes` | Notificacoes in-app (tipo, mensagem, lido) |

---

## Tecnologias e bibliotecas

- **Supabase JS SDK** (auth + banco + RLS)
- **SheetJS (xlsx)** para importar/exportar planilhas
- **jsPDF** para gerar PDF do ciclo
- **Cronometro** nativo (setInterval com contagem regressiva/progressiva)
- **Sem frameworks** — DOM manipulation direta
