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
    '_encontrarItemRevisaoPendente', 'obterAssuntoSugerido',
    'atualizarProgressoEdital', 'encontrarMatchEdital'
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

// ── Resultado ────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
