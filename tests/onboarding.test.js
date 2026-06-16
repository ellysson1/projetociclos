// Testes para onboarding — _calcularFasesMaterias e _simularBlocos
// Executar: node tests/onboarding.test.js

const fs = require('fs');
const vm = require('vm');
const path = require('path');

// ── Shims mínimos ─────────────────────────────────────────────────────────────
global.configuracoes = { duracaoBloco: 60 };
global._onboardingDados = { limitarMaterias: false, materiasIniciais: 6, materiasPorCiclo: 2 };

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

const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'onboarding.js'), 'utf8');
vm.runInThisContext(extrairBloco(code, 'nivelParaPeso'));
vm.runInThisContext(extrairBloco(code, '_calcularFasesMaterias'));
vm.runInThisContext(extrairBloco(code, '_simularBlocos'));

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✓ ' + msg); passed++; }
    else { console.log('  ✗ ' + msg); failed++; }
}

const materias = [
    { nome: 'Português', legenda: 'POR', importancia: 'muito', extensao: 'muito', dificuldade: 'medio' },
    { nome: 'Matemática', legenda: 'MAT', importancia: 'muito', extensao: 'medio', dificuldade: 'muito' },
    { nome: 'Direito Const.', legenda: 'DC', importancia: 'medio', extensao: 'medio', dificuldade: 'medio' },
    { nome: 'Direito Admin.', legenda: 'DA', importancia: 'medio', extensao: 'medio', dificuldade: 'pouco' },
    { nome: 'Informática', legenda: 'INF', importancia: 'pouco', extensao: 'pouco', dificuldade: 'pouco' },
    { nome: 'Inglês', legenda: 'ING', importancia: 'pouco', extensao: 'pouco', dificuldade: 'medio' },
    { nome: 'Economia', legenda: 'ECO', importancia: 'pouco', extensao: 'medio', dificuldade: 'muito' },
    { nome: 'AFO', legenda: 'AFO', importancia: 'medio', extensao: 'medio', dificuldade: 'medio' }
];

// ── _calcularFasesMaterias: sem limitação ───────────────────────────────────
console.log('\n_calcularFasesMaterias — sem limitação:');

_onboardingDados.limitarMaterias = false;
let result = _calcularFasesMaterias(materias);
assert(result.every(m => m.fase === 1), 'sem limitar: todas na fase 1');
assert(result.length === 8, 'preserva todas as 8 matérias');

// ── _calcularFasesMaterias: com limitação ───────────────────────────────────
console.log('\n_calcularFasesMaterias — com limitação:');

_onboardingDados.limitarMaterias = true;
_onboardingDados.materiasIniciais = 3;
_onboardingDados.materiasPorCiclo = 2;
result = _calcularFasesMaterias(materias);

const fase1 = result.filter(m => m.fase === 1);
assert(fase1.length === 3, `3 matérias na fase 1 (obteve ${fase1.length})`);

const fase2 = result.filter(m => m.fase === 2);
assert(fase2.length === 2, `2 matérias na fase 2 (obteve ${fase2.length})`);

const fase3 = result.filter(m => m.fase === 3);
assert(fase3.length === 2, `2 matérias na fase 3 (obteve ${fase3.length})`);

const fase4 = result.filter(m => m.fase === 4);
assert(fase4.length === 1, `1 matéria na fase 4 (obteve ${fase4.length})`);

// ── Priorização por importância ─────────────────────────────────────────────
console.log('\n_calcularFasesMaterias — priorização:');

const primeiras = fase1.map(m => m.legenda);
assert(primeiras.includes('POR') || primeiras.includes('MAT'),
    'matérias "muito" importantes estão na fase 1');

const ultimas = result.filter(m => m.fase >= 3).map(m => m.legenda);
assert(ultimas.includes('INF') || ultimas.includes('ING'),
    'matérias "pouco" importantes ficam nas fases posteriores');

// ── _calcularFasesMaterias: incremento de 1 ─────────────────────────────────
console.log('\n_calcularFasesMaterias — incremento 1:');

_onboardingDados.materiasPorCiclo = 1;
_onboardingDados.materiasIniciais = 2;
result = _calcularFasesMaterias(materias);

const fases = new Set(result.map(m => m.fase));
assert(fases.size === 7, `com 2 iniciais e +1/ciclo em 8 matérias: 7 fases (obteve ${fases.size})`);

// ── _calcularFasesMaterias: limite >= total ──────────────────────────────────
console.log('\n_calcularFasesMaterias — limite >= total:');

_onboardingDados.materiasIniciais = 10;
result = _calcularFasesMaterias(materias);
assert(result.every(m => m.fase === 1), 'limite >= total: todas na fase 1');

// ── _simularBlocos ──────────────────────────────────────────────────────────
console.log('\n_simularBlocos:');

const matAtivas = [
    { legenda: 'POR', importancia: 'muito', extensao: 'muito', dificuldade: 'medio' },
    { legenda: 'MAT', importancia: 'muito', extensao: 'medio', dificuldade: 'muito' },
    { legenda: 'INF', importancia: 'pouco', extensao: 'pouco', dificuldade: 'pouco' }
];

let blocos = _simularBlocos(matAtivas, 10);
const totalAlocado = blocos.reduce((s, b) => s + b.qtd, 0);
assert(totalAlocado === 10, `soma dos blocos = 10 (obteve ${totalAlocado})`);

const por = blocos.find(b => b.legenda === 'POR');
const inf = blocos.find(b => b.legenda === 'INF');
assert(por.qtd > inf.qtd, `POR (muito) tem mais blocos que INF (pouco): ${por.qtd} vs ${inf.qtd}`);

blocos = _simularBlocos([], 10);
assert(blocos.length === 0, 'sem matérias: retorna vazio');

blocos = _simularBlocos(matAtivas, 0);
assert(blocos.every(b => b.qtd === 0), '0 blocos: todos com 0');

// ── Resultado ────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
