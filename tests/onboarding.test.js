// Testes para onboarding — perfil, nivel, _calcularFasesMaterias e _simularBlocos
// Executar: node tests/onboarding.test.js

const fs = require('fs');
const vm = require('vm');
const path = require('path');

// ── Shims minimos ─────────────────────────────────────────────────────────────
global.configuracoes = { duracaoBloco: 60 };
global._onboardingDados = { limitarMaterias: false, materiasIniciais: 6, materiasPorCiclo: 2 };

// ── Extrair funcoes ──────────────────────────────────────────────────────────
function extrairBloco(codigo, nomeFuncao) {
    const pos = codigo.indexOf('function ' + nomeFuncao + '(');
    if (pos === -1) throw new Error('Funcao nao encontrada: ' + nomeFuncao);
    let depth = 0, i = pos, started = false;
    while (i < codigo.length) {
        if (codigo[i] === '{') { depth++; started = true; }
        else if (codigo[i] === '}') { depth--; if (started && depth === 0) return codigo.slice(pos, i + 1); }
        i++;
    }
    throw new Error('Bloco nao fechado: ' + nomeFuncao);
}

const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'onboarding.js'), 'utf8');

// Extract NIVEL_MATERIAS constant
const nivelMatch = code.match(/const NIVEL_MATERIAS\s*=\s*\{[^}]+\}/);
if (nivelMatch) vm.runInThisContext(nivelMatch[0].replace('const ', 'var '));

// Extract TEMPLATES_AREA constant (deep object — use brace matching)
function extrairConst(codigo, nome) {
    const pos = codigo.indexOf('const ' + nome + ' =');
    if (pos === -1) return null;
    const start = codigo.indexOf('{', pos);
    let depth = 0, i = start;
    while (i < codigo.length) {
        if (codigo[i] === '{') depth++;
        else if (codigo[i] === '}') { depth--; if (depth === 0) return 'var ' + nome + ' = ' + codigo.slice(start, i + 1); }
        i++;
    }
    return null;
}
const templatesCode = extrairConst(code, 'TEMPLATES_AREA');
if (templatesCode) vm.runInThisContext(templatesCode);

vm.runInThisContext(extrairBloco(code, 'nivelParaPeso'));
vm.runInThisContext(extrairBloco(code, '_calcularFasesMaterias'));
vm.runInThisContext(extrairBloco(code, '_simularBlocos'));
vm.runInThisContext(extrairBloco(code, '_definirStepsParaPerfil'));

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✓ ' + msg); passed++; }
    else { console.log('  ✗ ' + msg); failed++; }
}

const materias = [
    { nome: 'Portugues', legenda: 'POR', importancia: 'muito', extensao: 'muito', dificuldade: 'medio' },
    { nome: 'Matematica', legenda: 'MAT', importancia: 'muito', extensao: 'medio', dificuldade: 'muito' },
    { nome: 'Direito Const.', legenda: 'DC', importancia: 'medio', extensao: 'medio', dificuldade: 'medio' },
    { nome: 'Direito Admin.', legenda: 'DA', importancia: 'medio', extensao: 'medio', dificuldade: 'pouco' },
    { nome: 'Informatica', legenda: 'INF', importancia: 'pouco', extensao: 'pouco', dificuldade: 'pouco' },
    { nome: 'Ingles', legenda: 'ING', importancia: 'pouco', extensao: 'pouco', dificuldade: 'medio' },
    { nome: 'Economia', legenda: 'ECO', importancia: 'pouco', extensao: 'medio', dificuldade: 'muito' },
    { nome: 'AFO', legenda: 'AFO', importancia: 'medio', extensao: 'medio', dificuldade: 'medio' }
];

// ── _definirStepsParaPerfil ────────────────────────────────────────────────
console.log('\n_definirStepsParaPerfil:');

let steps = _definirStepsParaPerfil('autodidata');
assert(steps[0] === 'perfil', 'autodidata: comeca com perfil');
assert(steps.includes('materias'), 'autodidata: inclui materias');
assert(steps.includes('familiaridade'), 'autodidata: inclui familiaridade');
assert(steps.includes('limite'), 'autodidata: inclui limite');
assert(steps.length === 7, `autodidata: 7 etapas (obteve ${steps.length})`);

steps = _definirStepsParaPerfil('curso');
assert(steps.includes('nivel'), 'curso: inclui nivel');
assert(!steps.includes('materias'), 'curso: nao inclui materias');
assert(!steps.includes('familiaridade'), 'curso: nao inclui familiaridade');
assert(!steps.includes('limite'), 'curso: nao inclui limite');
assert(steps.length === 5, `curso: 5 etapas (obteve ${steps.length})`);

steps = _definirStepsParaPerfil('mentoria');
assert(!steps.includes('horas'), 'mentoria: nao inclui horas');
assert(!steps.includes('nivel'), 'mentoria: nao inclui nivel');
assert(steps.length === 3, `mentoria: 3 etapas (obteve ${steps.length})`);

steps = _definirStepsParaPerfil(null);
assert(steps.length === 1 && steps[0] === 'perfil', 'null: so perfil');

// ── NIVEL_MATERIAS ─────────────────────────────────────────────────────────
console.log('\nNIVEL_MATERIAS:');

assert(NIVEL_MATERIAS.basico === 6, 'basico = 6');
assert(NIVEL_MATERIAS.intermediario === 12, 'intermediario = 12');
assert(NIVEL_MATERIAS.avancado === Infinity, 'avancado = Infinity');

// ── Nivel auto-configura limite ────────────────────────────────────────────
console.log('\nNivel auto-configura limite:');

_onboardingDados.limitarMaterias = true;
_onboardingDados.materiasIniciais = 6;
_onboardingDados.materiasPorCiclo = 2;
let result = _calcularFasesMaterias(materias);
const fase1 = result.filter(m => m.fase === 1);
assert(fase1.length === 6, `basico (6 iniciais): 6 materias na fase 1 (obteve ${fase1.length})`);

_onboardingDados.materiasIniciais = 12;
_onboardingDados.materiasPorCiclo = 3;
result = _calcularFasesMaterias(materias);
assert(result.every(m => m.fase === 1), 'intermediario (12 iniciais, 8 materias): todas na fase 1');

_onboardingDados.limitarMaterias = false;
result = _calcularFasesMaterias(materias);
assert(result.every(m => m.fase === 1), 'avancado (sem limitar): todas na fase 1');

// ── _calcularFasesMaterias: sem limitacao ───────────────────────────────────
console.log('\n_calcularFasesMaterias — sem limitacao:');

_onboardingDados.limitarMaterias = false;
result = _calcularFasesMaterias(materias);
assert(result.every(m => m.fase === 1), 'sem limitar: todas na fase 1');
assert(result.length === 8, 'preserva todas as 8 materias');

// ── _calcularFasesMaterias: com limitacao ───────────────────────────────────
console.log('\n_calcularFasesMaterias — com limitacao:');

_onboardingDados.limitarMaterias = true;
_onboardingDados.materiasIniciais = 3;
_onboardingDados.materiasPorCiclo = 2;
result = _calcularFasesMaterias(materias);

const f1 = result.filter(m => m.fase === 1);
assert(f1.length === 3, `3 materias na fase 1 (obteve ${f1.length})`);

const f2 = result.filter(m => m.fase === 2);
assert(f2.length === 2, `2 materias na fase 2 (obteve ${f2.length})`);

const f3 = result.filter(m => m.fase === 3);
assert(f3.length === 2, `2 materias na fase 3 (obteve ${f3.length})`);

const f4 = result.filter(m => m.fase === 4);
assert(f4.length === 1, `1 materia na fase 4 (obteve ${f4.length})`);

// ── Priorizacao por importancia ─────────────────────────────────────────────
console.log('\n_calcularFasesMaterias — priorizacao:');

const primeiras = f1.map(m => m.legenda);
assert(primeiras.includes('POR') || primeiras.includes('MAT'),
    'materias "muito" importantes estao na fase 1');

const ultimas = result.filter(m => m.fase >= 3).map(m => m.legenda);
assert(ultimas.includes('INF') || ultimas.includes('ING'),
    'materias "pouco" importantes ficam nas fases posteriores');

// ── _calcularFasesMaterias: incremento de 1 ─────────────────────────────────
console.log('\n_calcularFasesMaterias — incremento 1:');

_onboardingDados.materiasPorCiclo = 1;
_onboardingDados.materiasIniciais = 2;
result = _calcularFasesMaterias(materias);

const fases = new Set(result.map(m => m.fase));
assert(fases.size === 7, `com 2 iniciais e +1/ciclo em 8 materias: 7 fases (obteve ${fases.size})`);

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
assert(blocos.length === 0, 'sem materias: retorna vazio');

blocos = _simularBlocos(matAtivas, 0);
assert(blocos.every(b => b.qtd === 0), '0 blocos: todos com 0');

// ── TEMPLATES_AREA ──────────────────────────────────────────────────────────
console.log('\nTEMPLATES_AREA:');

assert(typeof TEMPLATES_AREA === 'object', 'TEMPLATES_AREA existe');

const areas = Object.keys(TEMPLATES_AREA);
assert(areas.length >= 5, `pelo menos 5 areas (obteve ${areas.length})`);
assert(areas.includes('fiscal'), 'inclui fiscal');
assert(areas.includes('tribunais'), 'inclui tribunais');
assert(areas.includes('policial'), 'inclui policial');
assert(areas.includes('controle'), 'inclui controle');
assert(areas.includes('gestao'), 'inclui gestao');

areas.forEach(area => {
    const t = TEMPLATES_AREA[area];
    assert(t.nome && t.nome.length > 0, `${area}: tem nome`);
    assert(t.descricao && t.descricao.length > 0, `${area}: tem descricao`);
    assert(Array.isArray(t.materias) && t.materias.length >= 5, `${area}: tem >= 5 materias (${t.materias.length})`);

    const legendas = t.materias.map(m => m.legenda);
    const unicas = new Set(legendas);
    assert(unicas.size === legendas.length, `${area}: legendas unicas`);

    t.materias.forEach(m => {
        assert(m.nome && m.legenda, `${area}/${m.legenda}: tem nome e legenda`);
        assert(['pouco', 'medio', 'muito'].includes(m.importancia), `${area}/${m.legenda}: importancia valida`);
        assert(['pouco', 'medio', 'muito'].includes(m.extensao), `${area}/${m.legenda}: extensao valida`);
        assert(['pouco', 'medio', 'muito'].includes(m.dificuldade), `${area}/${m.legenda}: dificuldade valida`);
    });
});

// ── Resultado ────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
