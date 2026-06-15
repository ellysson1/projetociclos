// Testes para reconciliacao.js — verificarReconciliacaoPendente, confirmarRetificacao
// Executar: node tests/reconciliacao.test.js

const fs = require('fs');
const vm = require('vm');
const path = require('path');

// ── Shims ─────────────────────────────────────────────────────────────────────
global.planoAdotado = null;
global.materiasSelecionadas = [];
global.salvarEstado = () => {};
global.renderizarEdital = () => {};
global.atualizarSugestoesBlocos = () => {};
global.fecharModal = () => {};
global.alert = () => {};
global._salvarEditalRetificadoNuvem = () => Promise.resolve();

// Rastrear chamadas a abrirModalReconciliacao
let modalChamado = false;
let modalItens = null;
global.abrirModalReconciliacao = (itens) => { modalChamado = true; modalItens = itens; };

// Mock mínimo de document para confirmarRetificacao
let mockSelects = [];
global.document = {
    querySelectorAll: (sel) => {
        if (sel === '.retificacao-select') return mockSelects;
        return [];
    }
};

// ── Carregar matcher.js (fornece rankCandidatas, autoVinculavel, garantirIdsEdital, nomeSubtopico) ──
const matcherCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'matcher.js'), 'utf8');
vm.runInThisContext(matcherCode);

// ── Extrator por contagem de chaves ──────────────────────────────────────────
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

const reconCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'reconciliacao.js'), 'utf8');

// Declarar _retificacaoEditalNovo no escopo antes de carregar confirmarRetificacao
let _retificacaoEditalNovo = null;

eval(extrairBloco(reconCode, 'verificarReconciliacaoPendente'));
eval(extrairBloco(reconCode, 'confirmarRetificacao'));

// ── Harness ──────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { passed++; console.log('  ✓ ' + msg); }
    else { failed++; console.error('  ✗ ' + msg); }
}
function reset() {
    modalChamado = false;
    modalItens = null;
    mockSelects = [];
    _retificacaoEditalNovo = null;
}

// ── verificarReconciliacaoPendente ────────────────────────────────────────────
console.log('\nverificarReconciliacaoPendente:');

// Sem edital → retorna sem erro
reset();
global.planoAdotado = null;
global.materiasSelecionadas = [{ nome: 'Direito', legenda: 'DIR' }];
verificarReconciliacaoPendente();
assert(!modalChamado, 'sem edital: não abre modal');

// Sem materias → retorna sem erro
reset();
global.planoAdotado = { edital: [{ id: 'mat-1', materia: 'Direito', topicos: [] }] };
global.materiasSelecionadas = [];
verificarReconciliacaoPendente();
assert(!modalChamado, 'sem materias: não abre modal');

// Todas já vinculadas → não abre modal, não precisa salvar via modal
reset();
global.planoAdotado = { edital: [{ id: 'mat-1', materia: 'Direito', topicos: [] }] };
global.materiasSelecionadas = [
    { nome: 'Direito', legenda: 'DIR', materia_edital_id: 'mat-1' }
];
verificarReconciliacaoPendente();
assert(!modalChamado, 'todas vinculadas: não abre modal');

// Auto-link: match exato → seta materia_edital_id diretamente
reset();
global.planoAdotado = {
    edital: [
        { id: 'mat-1', materia: 'Direito Constitucional', topicos: [] },
        { id: 'mat-2', materia: 'Matemática', topicos: [] },
    ]
};
global.materiasSelecionadas = [
    { nome: 'Direito Constitucional', legenda: 'DIR' }
];
verificarReconciliacaoPendente();
assert(!modalChamado, 'auto-link exato: não abre modal');
assert(
    global.materiasSelecionadas[0].materia_edital_id === 'mat-1',
    'auto-link exato: materia_edital_id definido corretamente'
);

// Múltiplas materias: auto-link e vinculação independente
reset();
global.planoAdotado = {
    edital: [
        { id: 'mat-1', materia: 'Direito Constitucional', topicos: [] },
        { id: 'mat-2', materia: 'Matemática', topicos: [] },
    ]
};
global.materiasSelecionadas = [
    { nome: 'Direito Constitucional', legenda: 'DIR' },
    { nome: 'Matemática', legenda: 'MAT' },
];
verificarReconciliacaoPendente();
assert(
    global.materiasSelecionadas[0].materia_edital_id === 'mat-1',
    'auto-link múltiplas: primeira matéria vinculada'
);
assert(
    global.materiasSelecionadas[1].materia_edital_id === 'mat-2',
    'auto-link múltiplas: segunda matéria vinculada'
);

// Ambíguo (nome parcial) → abre modal
reset();
global.planoAdotado = {
    edital: [
        { id: 'mat-1', materia: 'Direito Constitucional', topicos: [] },
        { id: 'mat-2', materia: 'Direito Administrativo', topicos: [] },
    ]
};
global.materiasSelecionadas = [
    { nome: 'Direito', legenda: 'DIR' }
];
verificarReconciliacaoPendente();
assert(modalChamado, 'ambíguo: abre modal de reconciliação');
assert(Array.isArray(modalItens) && modalItens.length > 0, 'modal recebe itens para confirmar');

// ── confirmarRetificacao ──────────────────────────────────────────────────────
console.log('\nconfirmarRetificacao:');

// Sem _retificacaoEditalNovo → retorna sem erro
reset();
global.planoAdotado = { edital: [{ id: 'mat-1', materia: 'Direito', topicos: [] }] };
_retificacaoEditalNovo = null;
confirmarRetificacao();
assert(true, 'sem _retificacaoEditalNovo: retorna sem erro');

// Mapeamento de ID: materia nova recebe o ID da antiga via select
reset();
const editalAntigo = [
    { id: 'id-antigo-1', materia: 'Direito Constitucional', topicos: [
        { id: 'top-1', nome: 'Princípios', subtopicos: [] }
    ]},
];
const novoEdital = [
    { materia: 'Direito Constitucional', topicos: [
        { nome: 'Princípios Fundamentais', subtopicos: [] }
    ]},
];
_retificacaoEditalNovo = JSON.parse(JSON.stringify(novoEdital));
global.planoAdotado = { edital: editalAntigo };

// Simular DOM: select apontando id-antigo-1 para índice 0
mockSelects = [{
    dataset: { novoIdx: '0' },
    value: 'id-antigo-1',
}];
confirmarRetificacao();
assert(
    global.planoAdotado.edital[0].id === 'id-antigo-1',
    'confirmarRetificacao: materia nova herda ID da antiga'
);
assert(
    global.planoAdotado.edital !== editalAntigo,
    'confirmarRetificacao: planoAdotado.edital é substituído pelo novo'
);

// Materia marcada como __novo__ não herda ID
reset();
_retificacaoEditalNovo = [{ materia: 'Nova Matéria', topicos: [] }];
global.planoAdotado = { edital: editalAntigo };
mockSelects = [{
    dataset: { novoIdx: '0' },
    value: '__novo__',
}];
confirmarRetificacao();
assert(
    global.planoAdotado.edital[0].id !== 'id-antigo-1',
    '__novo__: materia não herda ID da antiga'
);

// Garante IDs em todo o novo edital após confirmar
reset();
_retificacaoEditalNovo = [{ materia: 'Direito', topicos: [] }];
global.planoAdotado = { edital: editalAntigo };
mockSelects = [{ dataset: { novoIdx: '0' }, value: '__novo__' }];
confirmarRetificacao();
assert(
    typeof global.planoAdotado.edital[0].id === 'string' && global.planoAdotado.edital[0].id.length > 0,
    'confirmarRetificacao: garantirIdsEdital aplicado — materia tem id'
);

// ── Resumo ───────────────────────────────────────────────────────────────────
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
