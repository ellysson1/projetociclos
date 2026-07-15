// Tests for matcher.js — normalization, scoring, auto-link, IDs

const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync(__dirname + '/../js/matcher.js', 'utf8');
vm.runInThisContext(code);

let passed = 0;
let failed = 0;
function assert(condition, msg) {
    if (condition) { passed++; console.log(`  ✓ ${msg}`); }
    else { failed++; console.error(`  ✗ ${msg}`); }
}

// ── normalizarParaMatch ─────────────────────────────────────────────────────

console.log('\nnormalizarParaMatch:');

assert(
    normalizarParaMatch('Direito Constitucional').join(' ') === 'direito constitucional',
    'basic normalization'
);

assert(
    normalizarParaMatch('Dir. Const.').join(' ') === 'direito constitucional',
    'abbreviation expansion'
);

assert(
    normalizarParaMatch('Noções de Legislação Aplicada').length === 0,
    'all-stopword input returns empty'
);

assert(
    normalizarParaMatch('Administração Financeira e Orçamentária').join(' ').includes('administracao'),
    'accent removal'
);

assert(
    normalizarParaMatch('AFO').join(' ') === 'administracao financeira orcamentaria',
    'AFO abbreviation expansion'
);

assert(
    normalizarParaMatch('RLM').join(' ') === 'raciocinio logico matematico',
    'RLM abbreviation expansion'
);

assert(
    normalizarParaMatch('').length === 0,
    'empty string returns empty'
);

assert(
    normalizarParaMatch(null).length === 0,
    'null returns empty'
);

// ── scoreMatcher ────────────────────────────────────────────────────────────

console.log('\nscoreMatcher:');

assert(
    scoreMatcher('Direito Constitucional', 'Direito Constitucional') === 1,
    'identical strings score 1'
);

assert(
    scoreMatcher('Dir Const', 'Direito Constitucional') > 0.8,
    'abbreviated vs full scores high'
);

assert(
    scoreMatcher('Direito Penal', 'Contabilidade Pública') < 0.3,
    'unrelated subjects score low'
);

assert(
    scoreMatcher('', 'Direito') === 0,
    'empty vs non-empty scores 0'
);

const scoreRelated = scoreMatcher('Direito Administrativo', 'Dir Adm');
const scoreUnrelated = scoreMatcher('Direito Administrativo', 'Matemática Financeira');
assert(
    scoreRelated > scoreUnrelated,
    'related pair scores higher than unrelated'
);

// ── rankCandidatas ──────────────────────────────────────────────────────────

console.log('\nrankCandidatas:');

const candidatas = [
    { id: '1', nome: 'Direito Constitucional' },
    { id: '2', nome: 'Direito Administrativo' },
    { id: '3', nome: 'Contabilidade Geral' }
];

const ranked = rankCandidatas('Dir Const', candidatas);
assert(ranked[0].candidata.id === '1', 'best match is ranked first');
assert(ranked[0].gap > 0, 'gap is positive for first');
assert(ranked.length === 3, 'all candidates returned');

// ── autoVinculavel ──────────────────────────────────────────────────────────

console.log('\nautoVinculavel:');

const ranked2 = rankCandidatas('Direito Constitucional', candidatas);
assert(autoVinculavel(ranked2) === true, 'exact match is auto-linkable');

const ranked3 = rankCandidatas('Direito', candidatas);
assert(autoVinculavel(ranked3) === false, 'ambiguous match is not auto-linkable');

assert(autoVinculavel([]) === false, 'empty array is not auto-linkable');

// ── garantirIdsEdital ───────────────────────────────────────────────────────

console.log('\ngarantirIdsEdital:');

// Mock gerarUUID if not available
if (typeof gerarUUID === 'undefined') {
    global.gerarUUID = _fallbackUUID;
}

const edital = [
    {
        materia: 'Direito Constitucional',
        topicos: [
            {
                nome: 'Princípios Fundamentais',
                subtopicos: ['Soberania', 'Cidadania']
            }
        ]
    }
];

garantirIdsEdital(edital);

assert(typeof edital[0].id === 'string' && edital[0].id.length > 0, 'materia gets id');
assert(typeof edital[0].topicos[0].id === 'string', 'topico gets id');
assert(typeof edital[0].topicos[0].subtopicos[0] === 'object', 'string subtopico converted to object');
assert(edital[0].topicos[0].subtopicos[0].nome === 'Soberania', 'subtopico nome preserved');
assert(typeof edital[0].topicos[0].subtopicos[0].id === 'string', 'subtopico gets id');

// Idempotent: running again should not change IDs
const id1 = edital[0].id;
garantirIdsEdital(edital);
assert(edital[0].id === id1, 'idempotent: id not changed on second call');

// ── nomeSubtopico ───────────────────────────────────────────────────────────

console.log('\nnomeSubtopico:');

assert(nomeSubtopico('Soberania') === 'Soberania', 'string returns itself');
assert(nomeSubtopico({ id: 'x', nome: 'Cidadania' }) === 'Cidadania', 'object returns .nome');
assert(nomeSubtopico(null) === '', 'null returns empty string');
assert(nomeSubtopico(undefined) === '', 'undefined returns empty string');

// ── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
