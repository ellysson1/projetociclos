// Testes para T6 — Revisão cíclica (baseada em ciclos, não datas)
// Executar: node tests/revisao-ciclica.test.js

const fs = require('fs');
const vm = require('vm');
const path = require('path');

// ── Shims mínimos ─────────────────────────────────────────────────────────────
global.editalProgresso = {};
global.planoAdotado = null;
global.materiasSelecionadas = [];
global.cicloNumero = 1;
global.faseAtual = 1;
global.blocosAtivos = [];
global.modosMateria = {};
global.supabaseClient = null;
global.document = { getElementById: () => ({ value: '0' }) };
global.alert = () => {};
global.salvarEstado = () => {};
global.salvarEditalProgressoItem = () => {};
global.registrarEvento = () => {};

// ── Carregar matcher.js ──────────────────────────────────────────────────────
const matcherCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'matcher.js'), 'utf8');
vm.runInThisContext(matcherCode);

// ── Extrair funções ──────────────────────────────────────────────────────────
function extrairBloco(codigo, nomeFuncao) {
    const pos = codigo.indexOf('function ' + nomeFuncao + '(');
    if (pos === -1) throw new Error('Função não encontrada: ' + nomeFuncao);
    let depth = 0, i = pos, started = false;
    while (i < codigo.length) {
        if (codigo[i] === '{') { depth++; started = true; }
        else if (codigo[i] === '}') { depth--; if (started && depth === 0) return codigo.slice(pos, i + 1); }
        i++;
    }
    throw new Error('Bloco não fechado: ' + nomeFuncao);
}

const editalCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'edital.js'), 'utf8');
const blocosCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'blocos.js'), 'utf8');

const editalFuncs = [
    'gerarChaveEdital', 'normalizarTexto', 'calcularSimilaridade',
    '_encontrarMateriaEditalPorId', '_encontrarMateriaEditalFuzzy',
    '_encontrarItemRevisaoPendente', 'obterSugestaoDetalhada', 'obterAssuntoSugerido',
    '_matchesExatosEdital', 'atualizarProgressoEdital', 'encontrarMatchEdital'
];
editalFuncs.forEach(fn => vm.runInThisContext(extrairBloco(editalCode, fn)));
vm.runInThisContext(extrairBloco(blocosCode, 'contarItensRevisaoPendente'));

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✓ ' + msg); passed++; }
    else { console.log('  ✗ ' + msg); failed++; }
}

function resetState() {
    editalProgresso = {};
    cicloNumero = 1;
    modosMateria = {};
}

const planoTeste = {
    id: 'test-1',
    nome: 'Plano Teste',
    maxFase: 1,
    materias: [
        { nome: 'Direito Constitucional', legenda: 'DC', fase: 1, materia_edital_id: 'mat-dc' }
    ],
    edital: [{
        materia: 'Direito Constitucional',
        id: 'mat-dc',
        topicos: [
            { nome: 'Princípios', subtopicos: ['Legalidade', 'Igualdade'] },
            { nome: 'Direitos Fundamentais', subtopicos: ['Vida', 'Liberdade'] }
        ]
    }]
};

// ── contarItensRevisaoPendente ──────────────────────────────────────────────
console.log('\ncontarItensRevisaoPendente:');

resetState();
assert(contarItensRevisaoPendente() === 0, 'sem progresso: 0 pendentes');

editalProgresso['Direito Constitucional|Princípios|Legalidade'] = {
    status: 'visto', ciclo_visto: 1, ultimo_ciclo_revisado: 1
};
cicloNumero = 2;
assert(contarItensRevisaoPendente() === 0, 'distância 1: não pendente');

cicloNumero = 3;
assert(contarItensRevisaoPendente() === 1, 'distância 2: 1 pendente');

editalProgresso['Direito Constitucional|Princípios|Igualdade'] = {
    status: 'visto', ciclo_visto: 1, ultimo_ciclo_revisado: 1
};
cicloNumero = 4;
assert(contarItensRevisaoPendente() === 2, 'distância 3: 2 pendentes');

editalProgresso['Direito Constitucional|Princípios|Legalidade'].ultimo_ciclo_revisado = 3;
assert(contarItensRevisaoPendente() === 1, 'após revisão de 1 item: 1 pendente');

// item em_andamento não conta
resetState();
editalProgresso['Direito Constitucional|Princípios|Legalidade'] = {
    status: 'em_andamento', ciclo_visto: 1, ultimo_ciclo_revisado: 1
};
cicloNumero = 5;
assert(contarItensRevisaoPendente() === 0, 'em_andamento não conta como pendente');

// ── _encontrarItemRevisaoPendente ───────────────────────────────────────────
console.log('\n_encontrarItemRevisaoPendente:');

resetState();
planoAdotado = planoTeste;
const matObj = planoTeste.edital[0];

assert(_encontrarItemRevisaoPendente(matObj, 1) === null, 'sem progresso: null');

editalProgresso[gerarChaveEdital('Direito Constitucional', 'Princípios', 'Legalidade')] = {
    status: 'visto', ciclo_visto: 1, ultimo_ciclo_revisado: 1
};
assert(_encontrarItemRevisaoPendente(matObj, 2) === null, 'distância 1: null');
assert(_encontrarItemRevisaoPendente(matObj, 3) === 'Legalidade', 'distância 2: retorna Legalidade');

editalProgresso[gerarChaveEdital('Direito Constitucional', 'Direitos Fundamentais', 'Vida')] = {
    status: 'visto', ciclo_visto: 1, ultimo_ciclo_revisado: 1
};
editalProgresso[gerarChaveEdital('Direito Constitucional', 'Princípios', 'Legalidade')].ultimo_ciclo_revisado = 2;
// Legalidade: dist=1, Vida: dist=2
const resultado = _encontrarItemRevisaoPendente(matObj, 3);
assert(resultado === 'Vida', 'prioriza item com maior distância: Vida');

// ── obterAssuntoSugerido com revisão ────────────────────────────────────────
console.log('\nobterAssuntoSugerido com revisão cíclica:');

resetState();
planoAdotado = planoTeste;
materiasSelecionadas = [{ ...planoTeste.materias[0], cor: '#000' }];

// Todos pendentes → sugere primeiro da lista
let sugestao = obterAssuntoSugerido('Direito Constitucional');
assert(sugestao === 'Legalidade', 'todos pendentes: sugere Legalidade');

// Marcar todos como vistos no ciclo 1
['Legalidade', 'Igualdade'].forEach(sub => {
    editalProgresso[gerarChaveEdital('Direito Constitucional', 'Princípios', sub)] = {
        status: 'visto', ciclo_visto: 1, ultimo_ciclo_revisado: 1
    };
});
['Vida', 'Liberdade'].forEach(sub => {
    editalProgresso[gerarChaveEdital('Direito Constitucional', 'Direitos Fundamentais', sub)] = {
        status: 'visto', ciclo_visto: 1, ultimo_ciclo_revisado: 1
    };
});

cicloNumero = 2;
sugestao = obterAssuntoSugerido('Direito Constitucional');
assert(sugestao === null, 'distância 1: sem sugestão de revisão');

cicloNumero = 3;
sugestao = obterAssuntoSugerido('Direito Constitucional');
assert(sugestao !== null && sugestao.startsWith('⟳'), 'distância 2: sugere revisão com prefixo ⟳');

// Em modo revisão, prioriza revisão sobre itens pendentes
resetState();
planoAdotado = planoTeste;
materiasSelecionadas = [{ ...planoTeste.materias[0], cor: '#000' }];
modosMateria = { DC: 'revisao' };
cicloNumero = 5;
editalProgresso[gerarChaveEdital('Direito Constitucional', 'Princípios', 'Legalidade')] = {
    status: 'visto', ciclo_visto: 1, ultimo_ciclo_revisado: 1
};
sugestao = obterAssuntoSugerido('Direito Constitucional');
assert(sugestao === 'Legalidade', 'modo revisão: prioriza revisão pendente sobre itens novos');

// ── ciclo_visto stamping via atualizarProgressoEdital ───────────────────────
console.log('\natualizarProgressoEdital — stamping ciclo:');

resetState();
planoAdotado = planoTeste;
cicloNumero = 3;

atualizarProgressoEdital('Direito Constitucional', 'Legalidade', null, 'visto');
const chave = gerarChaveEdital('Direito Constitucional', 'Princípios', 'Legalidade');
assert(editalProgresso[chave]?.ciclo_visto === 3, 'ciclo_visto = cicloNumero na primeira vez');
assert(editalProgresso[chave]?.ultimo_ciclo_revisado === 3, 'ultimo_ciclo_revisado = cicloNumero');

// Revisitar no ciclo 5 — ciclo_visto não muda, ultimo_ciclo_revisado atualiza
cicloNumero = 5;
atualizarProgressoEdital('Direito Constitucional', 'Legalidade', null, 'visto');
assert(editalProgresso[chave]?.ciclo_visto === 3, 'ciclo_visto preservado');
assert(editalProgresso[chave]?.ultimo_ciclo_revisado === 5, 'ultimo_ciclo_revisado atualizado para 5');

// ── obterSugestaoDetalhada — correlação curso/edital/TEC ────────────────────
console.log('\nobterSugestaoDetalhada:');

const planoComCurso = {
    id: 'test-2',
    nome: 'Plano Curso',
    maxFase: 1,
    materias: [
        { nome: 'Contabilidade', legenda: 'CTB', fase: 1, materia_edital_id: 'mat-ctb' }
    ],
    edital: [{
        materia: 'Contabilidade',
        id: 'mat-ctb',
        topicos: [
            {
                nome: 'Demonstrações',
                subtopicos: [
                    { nome: 'Balanço Patrimonial', curso_nome: 'Aula 01 - Balanço', tec_assunto: 'Balanço Patrimonial (BP)' },
                    'DRE'
                ]
            },
            { nome: 'Provisões', curso_nome: 'Aula 07 - Provisões', subtopicos: [] }
        ]
    }]
};

resetState();
planoAdotado = planoComCurso;
materiasSelecionadas = [{ ...planoComCurso.materias[0], cor: '#000' }];

let det = obterSugestaoDetalhada('Contabilidade');
assert(det !== null, 'com edital: retorna detalhe');
assert(det.exibicao === 'Aula 01 - Balanço', 'exibicao prioriza o nome da aula no curso');
assert(det.nomeOficial === 'Balanço Patrimonial', 'nomeOficial mantém o nome do edital');
assert(det.cursoNome === 'Aula 01 - Balanço', 'cursoNome preenchido');
assert(det.tecAssunto === 'Balanço Patrimonial (BP)', 'tecAssunto preenchido');
assert(det.materiaEdital === 'Contabilidade', 'materiaEdital correta');
assert(det.topicoOficial === 'Demonstrações', 'topicoOficial correto');
assert(det.revisao === false, 'item pendente: não é revisão');

// obterAssuntoSugerido (wrapper) exibe o nome do curso
assert(obterAssuntoSugerido('Contabilidade') === 'Aula 01 - Balanço',
    'obterAssuntoSugerido exibe o nome da aula no curso');

// Concluído o primeiro, sugere o próximo (subtópico string, sem mapeamento)
editalProgresso[gerarChaveEdital('Contabilidade', 'Demonstrações', 'Balanço Patrimonial')] = {
    status: 'visto', ciclo_visto: 1, ultimo_ciclo_revisado: 1
};
det = obterSugestaoDetalhada('Contabilidade');
assert(det.exibicao === 'DRE', 'subtópico sem mapeamento: exibicao = nome oficial');
assert(det.cursoNome === null, 'subtópico string: cursoNome null');
assert(det.tecAssunto === null, 'subtópico string: tecAssunto null');

// Próximo: tópico sem subtópicos com curso_nome no próprio tópico
editalProgresso[gerarChaveEdital('Contabilidade', 'Demonstrações', 'DRE')] = {
    status: 'visto', ciclo_visto: 1, ultimo_ciclo_revisado: 1
};
det = obterSugestaoDetalhada('Contabilidade');
assert(det.exibicao === 'Aula 07 - Provisões', 'tópico sem subtópicos: usa curso_nome do tópico');
assert(det.nomeOficial === 'Provisões', 'tópico sem subtópicos: nomeOficial = nome do tópico');

// Revisão cíclica carrega a correlação
editalProgresso[gerarChaveEdital('Contabilidade', 'Provisões', '')] = {
    status: 'visto', ciclo_visto: 1, ultimo_ciclo_revisado: 1
};
cicloNumero = 4;
det = obterSugestaoDetalhada('Contabilidade');
assert(det !== null && det.revisao === true, 'todos vistos + distância >= 2: sugestão de revisão');
assert(det.origem === 'revisao_ciclo', 'origem = revisao_ciclo');
assert(det.cursoNome !== null || det.nomeOficial !== null, 'revisão mantém correlação');
assert(obterAssuntoSugerido('Contabilidade').startsWith('⟳ '), 'wrapper mantém prefixo ⟳ na revisão cíclica');

// ── _matchesExatosEdital ─────────────────────────────────────────────────────
console.log('\n_matchesExatosEdital:');

resetState();
planoAdotado = planoComCurso;

let ms = _matchesExatosEdital('Contabilidade', 'Aula 01 - Balanço');
assert(ms.length === 1 && ms[0].subtopico === 'Balanço Patrimonial',
    'match exato por curso_nome resolve para o nome oficial');

ms = _matchesExatosEdital('Contabilidade', 'Balanço Patrimonial');
assert(ms.length === 1 && ms[0].topico === 'Demonstrações', 'match exato por nome oficial');

ms = _matchesExatosEdital('Contabilidade', 'Aula 07 - Provisões');
assert(ms.length === 1 && ms[0].topico === 'Provisões' && ms[0].subtopico === null,
    'tópico sem subtópicos por curso_nome');

ms = _matchesExatosEdital('Contabilidade', 'Aula inexistente XYZ');
assert(ms.length === 0, 'sem correspondência exata: array vazio (cai no fuzzy)');

// atualizarProgressoEdital com nome do curso marca o item OFICIAL correto
resetState();
planoAdotado = planoComCurso;
cicloNumero = 2;
atualizarProgressoEdital('Contabilidade', 'Aula 01 - Balanço', { feitas: 10, corretas: 8 }, 'visto');
const chaveBP = gerarChaveEdital('Contabilidade', 'Demonstrações', 'Balanço Patrimonial');
assert(editalProgresso[chaveBP]?.status === 'visto',
    'conclusão com nome do curso marca a chave oficial como vista');
assert(editalProgresso[chaveBP]?.questoes_feitas === 10, 'questões somadas na chave oficial');

// ── Uma aula cobrindo múltiplos itens do edital (curso_nome repetido) ───────
console.log('\ncurso_nome cobrindo múltiplos itens do edital:');

const planoAulaMultipla = {
    id: 'test-3',
    nome: 'Plano Aula Múltipla',
    maxFase: 1,
    materias: [
        { nome: 'Direito Administrativo', legenda: 'DADM', fase: 1, materia_edital_id: 'mat-dadm' }
    ],
    edital: [{
        materia: 'Direito Administrativo',
        id: 'mat-dadm',
        topicos: [
            {
                nome: 'Poderes Administrativos',
                subtopicos: [
                    { nome: 'Poder Vinculado', curso_nome: 'Aula 05 - Poderes da Administração' },
                    { nome: 'Poder Discricionário', curso_nome: 'Aula 05 - Poderes da Administração' },
                    { nome: 'Poder Hierárquico', curso_nome: 'Aula 05 - Poderes da Administração' }
                ]
            }
        ]
    }]
};

resetState();
planoAdotado = planoAulaMultipla;

ms = _matchesExatosEdital('Direito Administrativo', 'Aula 05 - Poderes da Administração');
assert(ms.length === 3, `aula cobrindo 3 subtópicos: retorna os 3 matches (obteve ${ms.length})`);

cicloNumero = 1;
atualizarProgressoEdital('Direito Administrativo', 'Aula 05 - Poderes da Administração', { feitas: 6, corretas: 5 }, 'visto');

const chaveVinc = gerarChaveEdital('Direito Administrativo', 'Poderes Administrativos', 'Poder Vinculado');
const chaveDisc = gerarChaveEdital('Direito Administrativo', 'Poderes Administrativos', 'Poder Discricionário');
const chaveHier = gerarChaveEdital('Direito Administrativo', 'Poderes Administrativos', 'Poder Hierárquico');

assert(editalProgresso[chaveVinc]?.status === 'visto', 'conclui a aula: 1º subtópico marcado visto');
assert(editalProgresso[chaveDisc]?.status === 'visto', 'conclui a aula: 2º subtópico marcado visto');
assert(editalProgresso[chaveHier]?.status === 'visto', 'conclui a aula: 3º subtópico marcado visto');

assert(editalProgresso[chaveVinc].questoes_feitas === 6, 'questões somadas apenas no 1º item');
assert((editalProgresso[chaveDisc].questoes_feitas || 0) === 0, '2º item não duplica a contagem de questões');
assert((editalProgresso[chaveHier].questoes_feitas || 0) === 0, '3º item não duplica a contagem de questões');

// Nunca faz downgrade de 'concluido' (nem de 'visto' para 'em_andamento) em
// nenhum dos itens agrupados — a mesma regra anti-downgrade do item único
// se aplica a cada item do grupo individualmente.
editalProgresso[chaveDisc].status = 'concluido';
atualizarProgressoEdital('Direito Administrativo', 'Aula 05 - Poderes da Administração', null, 'em_andamento');
assert(editalProgresso[chaveDisc].status === 'concluido', 'item já concluído manualmente não é rebaixado pelo grupo');
assert(editalProgresso[chaveVinc].status === 'visto', 'item já visto não é rebaixado para em_andamento pelo grupo');

// ── Resultado ────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
