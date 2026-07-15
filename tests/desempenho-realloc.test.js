// Testes para T4 — Realocação de blocos por desempenho
// Executar: node tests/desempenho-realloc.test.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ── Shims mínimos ────────────────────────────────────────────────────────────
global.configuracoes = { duracaoBloco: 60 };
global.materiasSelecionadas = [];
global.blocosAtivos = [];
global.alert = () => {};

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

const variaveisCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'variaveis.js'), 'utf8');
vm.runInThisContext(extrairBloco(variaveisCode, 'calcularFatoresDesempenho'));
vm.runInThisContext(extrairBloco(variaveisCode, '_alocarBlocosLargestRemainder'));

let passed = 0, failed = 0;
function test(nome, fn) {
    try {
        fn();
        console.log('  ✓ ' + nome);
        passed++;
    } catch (e) {
        console.log('  ✗ ' + nome + ': ' + e.message);
        failed++;
    }
}

// ── calcularFatoresDesempenho ────────────────────────────────────────────────
console.log('\ncalcularFatoresDesempenho:');

test('sem blocos ativos: retorna objeto vazio', () => {
    blocosAtivos = [];
    const f = calcularFatoresDesempenho();
    assert.deepStrictEqual(f, {});
});

test('blocos sem questões: retorna vazio', () => {
    blocosAtivos = [
        { legenda: 'DC', concluido: true, questoes: null },
        { legenda: 'DA', concluido: true, questoes: null }
    ];
    const f = calcularFatoresDesempenho();
    assert.deepStrictEqual(f, {});
});

test('matéria com menos de 5 questões: ignorada', () => {
    blocosAtivos = [
        { legenda: 'DC', concluido: true, questoes: { feitas: 3, corretas: 2 } }
    ];
    const f = calcularFatoresDesempenho();
    assert.deepStrictEqual(f, {});
});

test('matéria com baixo acerto: fator > 1', () => {
    blocosAtivos = [
        { legenda: 'DC', concluido: true, questoes: { feitas: 20, corretas: 6 } },   // 30%
        { legenda: 'DA', concluido: true, questoes: { feitas: 20, corretas: 14 } }   // 70%
    ];
    // média global: 20/40 = 50%
    const f = calcularFatoresDesempenho();
    assert.ok(f['DC'] > 1, `DC (30% acerto) deve ter fator > 1, obteve ${f['DC']}`);
    assert.ok(f['DA'] < 1, `DA (70% acerto) deve ter fator < 1, obteve ${f['DA']}`);
});

test('fator clamped a [0.7, 1.5]', () => {
    blocosAtivos = [
        { legenda: 'DC', concluido: true, questoes: { feitas: 20, corretas: 0 } },   // 0%
        { legenda: 'DA', concluido: true, questoes: { feitas: 20, corretas: 20 } }   // 100%
    ];
    // média: 50%. DC: 1 + (0.5 - 0) = 1.5. DA: 1 + (0.5 - 1) = 0.5 → clamped 0.7
    const f = calcularFatoresDesempenho();
    assert.strictEqual(f['DC'], 1.5);
    assert.strictEqual(f['DA'], 0.7);
});

test('todas matérias com mesmo acerto: fator = 1 para todas', () => {
    blocosAtivos = [
        { legenda: 'DC', concluido: true, questoes: { feitas: 10, corretas: 7 } },
        { legenda: 'DA', concluido: true, questoes: { feitas: 10, corretas: 7 } }
    ];
    const f = calcularFatoresDesempenho();
    assert.strictEqual(f['DC'], 1);
    assert.strictEqual(f['DA'], 1);
});

test('blocos não concluídos são ignorados', () => {
    blocosAtivos = [
        { legenda: 'DC', concluido: false, questoes: { feitas: 20, corretas: 5 } },
        { legenda: 'DA', concluido: true, questoes: { feitas: 10, corretas: 8 } }
    ];
    const f = calcularFatoresDesempenho();
    assert.ok(!('DC' in f), 'DC não concluído não deve gerar fator');
});

test('agrega múltiplos blocos da mesma matéria', () => {
    blocosAtivos = [
        { legenda: 'DC', concluido: true, questoes: { feitas: 5, corretas: 2 } },
        { legenda: 'DC', concluido: true, questoes: { feitas: 5, corretas: 2 } },
        { legenda: 'DA', concluido: true, questoes: { feitas: 10, corretas: 8 } }
    ];
    // DC: 10 feitas, 4 corretas = 40%. DA: 10 feitas, 8 corretas = 80%
    // média global: 12/20 = 60%
    const f = calcularFatoresDesempenho();
    // DC: 1 + (0.6 - 0.4) = 1.2
    // DA: 1 + (0.6 - 0.8) = 0.8
    assert.ok(Math.abs(f['DC'] - 1.2) < 0.01, `DC esperado ~1.2, obteve ${f['DC']}`);
    assert.ok(Math.abs(f['DA'] - 0.8) < 0.01, `DA esperado ~0.8, obteve ${f['DA']}`);
});

// ── Integração: alocação com desempenho ──────────────────────────────────────
console.log('\nAlocação com fator de desempenho:');

test('matéria com pior desempenho recebe mais blocos', () => {
    // Setup: DC baixo acerto, DA alto acerto
    blocosAtivos = [
        { legenda: 'DC', concluido: true, questoes: { feitas: 20, corretas: 4 } },   // 20%
        { legenda: 'DA', concluido: true, questoes: { feitas: 20, corretas: 16 } }   // 80%
    ];

    const fatores = calcularFatoresDesempenho();

    // 2 matérias com peso base 5 cada
    const vpBase = 5;
    const blocos = [
        { legenda: 'DC', valorPonderado: vpBase * (fatores['DC'] || 1), meioBloco: false },
        { legenda: 'DA', valorPonderado: vpBase * (fatores['DA'] || 1), meioBloco: false }
    ];
    const totalP = blocos.reduce((s, b) => s + b.valorPonderado, 0);
    materiasSelecionadas = blocos.map(b => ({ legenda: b.legenda }));

    _alocarBlocosLargestRemainder(blocos, 10, totalP, 60);

    const blocosDC = blocos.find(b => b.legenda === 'DC').quantidadeBlocos;
    const blocosDA = blocos.find(b => b.legenda === 'DA').quantidadeBlocos;

    assert.ok(blocosDC > blocosDA,
        `DC (pior desempenho) deve ter mais blocos: DC=${blocosDC}, DA=${blocosDA}`);
    assert.strictEqual(blocosDC + blocosDA, 10, 'Total deve ser 10');
});

test('sem dados de desempenho: distribuição igual com pesos iguais', () => {
    blocosAtivos = [];
    const fatores = calcularFatoresDesempenho();

    const blocos = [
        { legenda: 'DC', valorPonderado: 5 * (fatores['DC'] || 1), meioBloco: false },
        { legenda: 'DA', valorPonderado: 5 * (fatores['DA'] || 1), meioBloco: false }
    ];
    const totalP = blocos.reduce((s, b) => s + b.valorPonderado, 0);
    materiasSelecionadas = blocos.map(b => ({ legenda: b.legenda }));

    _alocarBlocosLargestRemainder(blocos, 10, totalP, 60);

    assert.strictEqual(blocos[0].quantidadeBlocos, 5);
    assert.strictEqual(blocos[1].quantidadeBlocos, 5);
});

// ── Resultado ────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
