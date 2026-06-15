// Testes para edital.js — gerarChaveEdital, normalizarTexto, calcularSimilaridade,
//   _encontrarMateriaEditalPorId, _encontrarMateriaEditalFuzzy, calcularProgressoTopico
// Executar: node tests/edital.test.js

const fs = require('fs');
const vm = require('vm');
const path = require('path');

// ── Shims mínimos ─────────────────────────────────────────────────────────────
global.editalProgresso = {};
global.planoAdotado = null;
global.materiasSelecionadas = [];

// ── Carregar matcher.js (fornece nomeSubtopico, garantirIdsEdital, etc.) ──────
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

const editalCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'edital.js'), 'utf8');

// Cada eval no escopo do módulo expõe a função como variável local
eval(extrairBloco(editalCode, 'gerarChaveEdital'));
eval(extrairBloco(editalCode, 'normalizarTexto'));
eval(extrairBloco(editalCode, 'calcularSimilaridade'));
eval(extrairBloco(editalCode, '_encontrarMateriaEditalPorId'));
eval(extrairBloco(editalCode, '_encontrarMateriaEditalFuzzy'));
eval(extrairBloco(editalCode, 'calcularProgressoTopico'));

// ── Harness ──────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { passed++; console.log('  ✓ ' + msg); }
    else { failed++; console.error('  ✗ ' + msg); }
}

// ── gerarChaveEdital ─────────────────────────────────────────────────────────
console.log('\ngerarChaveEdital:');

assert(
    gerarChaveEdital('Direito', 'Princípios', 'Isonomia') === 'Direito|Princípios|Isonomia',
    'com subtopico: une os três campos'
);
assert(
    gerarChaveEdital('Direito', 'Princípios', null) === 'Direito|Princípios|',
    'subtopico null vira string vazia'
);
assert(
    gerarChaveEdital('Direito', 'Princípios', '') === 'Direito|Princípios|',
    'subtopico vazio mantém pipe'
);
assert(
    gerarChaveEdital('A', 'B', 'C').split('|').length === 3,
    'resultado sempre tem exatamente 3 segmentos'
);

// ── normalizarTexto ──────────────────────────────────────────────────────────
console.log('\nnormalizarTexto:');

assert(
    normalizarTexto('Direito Constitucional') === 'direito constitucional',
    'converte para minúsculas'
);
assert(
    normalizarTexto('Ação Civil Pública') === 'acao civil publica',
    'remove acentos'
);
assert(normalizarTexto('') === '', 'string vazia retorna vazia');
assert(normalizarTexto(null) === '', 'null retorna vazio');
assert(normalizarTexto(undefined) === '', 'undefined retorna vazio');
assert(
    !normalizarTexto('AFO: Orçamento (2024)').includes('('),
    'remove pontuação especial'
);

// ── calcularSimilaridade ─────────────────────────────────────────────────────
console.log('\ncalcularSimilaridade:');

assert(
    calcularSimilaridade('direito constitucional', 'direito constitucional') === 1,
    'strings idênticas = 1'
);
assert(
    calcularSimilaridade('direito constitucional', 'direito') > 0.5,
    'containment retorna score > 0.5'
);
assert(
    calcularSimilaridade('matematica', 'portugues') < 0.3,
    'sem palavras comuns = score baixo'
);
assert(calcularSimilaridade('', 'direito') === 0, 'vazio vs texto = 0');
assert(calcularSimilaridade(null, 'direito') === 0, 'null vs texto = 0');
assert(
    calcularSimilaridade('direito administrativo', 'matematica financeira') <
    calcularSimilaridade('direito administrativo', 'direito constitucional'),
    'par relacionado score maior que par não relacionado'
);

// ── _encontrarMateriaEditalPorId ─────────────────────────────────────────────
console.log('\n_encontrarMateriaEditalPorId:');

const editalMock = [
    { id: 'mat-1', materia: 'Direito Constitucional', topicos: [] },
    { id: 'mat-2', materia: 'Matemática', topicos: [] },
];
global.planoAdotado = { edital: editalMock };
global.materiasSelecionadas = [
    { nome: 'Direito Constitucional', legenda: 'DIR', materia_edital_id: 'mat-1' },
    { nome: 'Matemática', legenda: 'MAT', materia_edital_id: 'mat-2' },
    { nome: 'Português', legenda: 'PRT' },
];

assert(
    _encontrarMateriaEditalPorId('Direito Constitucional')?.id === 'mat-1',
    'encontra por nome exato'
);
assert(
    _encontrarMateriaEditalPorId('DIR')?.id === 'mat-1',
    'encontra por legenda'
);
assert(
    _encontrarMateriaEditalPorId('Português') === null,
    'retorna null quando matéria não tem materia_edital_id'
);
assert(
    _encontrarMateriaEditalPorId('Inexistente') === null,
    'retorna null quando matéria não está na lista'
);

global.planoAdotado = null;
assert(
    _encontrarMateriaEditalPorId('Direito Constitucional') === null,
    'sem edital retorna null'
);
global.planoAdotado = { edital: editalMock };

// ── _encontrarMateriaEditalFuzzy ─────────────────────────────────────────────
console.log('\n_encontrarMateriaEditalFuzzy:');

assert(
    _encontrarMateriaEditalFuzzy('Direito Constitucional')?.id === 'mat-1',
    'match exato'
);
assert(
    _encontrarMateriaEditalFuzzy('Matematica')?.id === 'mat-2',
    'match sem acento (score >= 0.4)'
);
assert(
    _encontrarMateriaEditalFuzzy('xyzwq123') === null,
    'sem match suficiente retorna null'
);

global.planoAdotado = null;
assert(
    _encontrarMateriaEditalFuzzy('Direito') === null,
    'sem edital retorna null'
);
global.planoAdotado = { edital: editalMock };

// ── calcularProgressoTopico ───────────────────────────────────────────────────
console.log('\ncalcularProgressoTopico:');

// Subtópicos como strings
global.editalProgresso = {
    'Matemática|Aritmética|Frações': { status: 'visto' },
    'Matemática|Aritmética|Porcentagem': { status: 'pendente' },
};
const r1 = calcularProgressoTopico('Matemática', 'Aritmética', ['Frações', 'Porcentagem', 'Juros']);
assert(r1.total === 3, 'subtopicos string: total = 3');
assert(r1.concluidos === 1, 'subtopicos string: "visto" conta como concluido');
assert(r1.pct === 33, 'subtopicos string: pct = 33%');

// Subtópicos como objetos
global.editalProgresso = {
    'Direito|Princípios|Isonomia': { status: 'concluido' },
    'Direito|Princípios|Legalidade': { status: 'visto' },
};
const r2 = calcularProgressoTopico('Direito', 'Princípios', [
    { id: 'sub-1', nome: 'Isonomia' },
    { id: 'sub-2', nome: 'Legalidade' },
    { id: 'sub-3', nome: 'Proporcionalidade' },
]);
assert(r2.total === 3, 'subtopicos objeto: total = 3');
assert(r2.concluidos === 2, 'subtopicos objeto: concluido + visto = 2');
assert(r2.pct === 67, 'subtopicos objeto: pct = 67%');

// Lista vazia
const r3 = calcularProgressoTopico('Matemática', 'Álgebra', []);
assert(r3.total === 0 && r3.pct === 0, 'sem subtopicos: total=0, pct=0');

// Todos concluídos
global.editalProgresso = {
    'DIR|T1|S1': { status: 'concluido' },
    'DIR|T1|S2': { status: 'visto' },
};
const r4 = calcularProgressoTopico('DIR', 'T1', ['S1', 'S2']);
assert(r4.pct === 100, 'todos visto/concluido: pct = 100%');
assert(r4.concluidos === 2, 'todos visto/concluido: concluidos = 2');

// Nenhum no progresso
global.editalProgresso = {};
const r5 = calcularProgressoTopico('DIR', 'T1', ['S1', 'S2', 'S3']);
assert(r5.concluidos === 0 && r5.pct === 0, 'nenhum no progresso: 0 concluidos');

// ── Resumo ───────────────────────────────────────────────────────────────────
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
