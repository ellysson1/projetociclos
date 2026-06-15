// Testes para T5 — Critérios de avanço de fase configuráveis
// Executar: node tests/evolucao.test.js

const fs = require('fs');
const vm = require('vm');
const path = require('path');

// ── Shims mínimos ─────────────────────────────────────────────────────────────
global.editalProgresso = {};
global.planoAdotado = null;
global.materiasSelecionadas = [];
global.faseAtual = 1;
global.blocosAtivos = [];
global.materiasList = [];
global.coresUsadas = [];
global.configuracoes = { duracaoBloco: 60 };
global.supabaseClient = null;
global.document = { getElementById: () => ({ value: '0', addEventListener: () => {} }) };
global.alert = () => {};
global.gerarCorUnica = () => '#000';
global.inicializarSelecaoMaterias = () => {};
global.exibirCicloVisual = () => {};
global.salvarEstado = () => {};
global.notificarAvancoFase = () => {};
global.registrarEvento = () => {};

// ── Carregar matcher.js ──────────────────────────────────────────────────────
const matcherCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'matcher.js'), 'utf8');
vm.runInThisContext(matcherCode);

// ── Extrator de funções por contagem de chaves ──────────────────────────────
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

// Carregar funções necessárias
const funcs = [
    'gerarChaveEdital', 'normalizarTexto', 'calcularSimilaridade',
    'obterRegraFase', 'calcularQuestoesFase', 'calcularPercentualPorLegendasEdital',
    'verificarProgressoFase'
];
funcs.forEach(fn => {
    const bloco = extrairBloco(editalCode, fn);
    vm.runInThisContext(bloco);
});

// ── Helpers ──────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✓ ' + msg); passed++; }
    else { console.log('  ✗ ' + msg); failed++; }
}

function resetState() {
    editalProgresso = {};
    faseAtual = 1;
    blocosAtivos = [];
    materiasList = [];
    materiasSelecionadas = [];
    coresUsadas = [];
}

function criarPlanoTeste(regras) {
    return {
        id: 'test-1',
        nome: 'Plano Teste',
        maxFase: 3,
        regras_evolucao: regras || [],
        materias: [
            { nome: 'Direito Constitucional', legenda: 'DC', fase: 1, peso: 5, extensao: 5, dificuldade: 5 },
            { nome: 'Direito Administrativo', legenda: 'DA', fase: 2, peso: 5, extensao: 5, dificuldade: 5 },
            { nome: 'Direito Penal', legenda: 'DP', fase: 3, peso: 5, extensao: 5, dificuldade: 5 }
        ],
        edital: [
            {
                materia: 'Direito Constitucional',
                id: 'mat-dc',
                topicos: [
                    { nome: 'Princípios', subtopicos: ['Legalidade', 'Igualdade'] },
                    { nome: 'Direitos Fundamentais', subtopicos: ['Vida', 'Liberdade'] }
                ]
            },
            {
                materia: 'Direito Administrativo',
                id: 'mat-da',
                topicos: [
                    { nome: 'Atos Administrativos', subtopicos: ['Conceito', 'Espécies'] }
                ]
            }
        ]
    };
}

function marcarTodosVisto(plano) {
    plano.edital.forEach(mat => {
        (mat.topicos || []).forEach(top => {
            (top.subtopicos || []).forEach(sub => {
                const chave = gerarChaveEdital(mat.materia, top.nome, nomeSubtopico(sub));
                editalProgresso[chave] = { status: 'visto', questoes_feitas: 0, questoes_corretas: 0 };
            });
        });
    });
}

// ── obterRegraFase ──────────────────────────────────────────────────────────
console.log('\nobterRegraFase:');

resetState();
planoAdotado = criarPlanoTeste([]);
assert(obterRegraFase(1) === null, 'sem regras: retorna null');

planoAdotado = criarPlanoTeste([{ fase: 1, pct_edital: 70 }]);
assert(obterRegraFase(1)?.pct_edital === 70, 'fase 1 com regra: retorna regra correta');
assert(obterRegraFase(2) === null, 'fase 2 sem regra: retorna null');

planoAdotado = criarPlanoTeste([
    { fase: 1, pct_edital: 80 },
    { fase: 2, pct_edital: 90, questoes_minimas: 50 }
]);
assert(obterRegraFase(2)?.questoes_minimas === 50, 'fase 2 com questoes_minimas: retorna valor');

// ── calcularQuestoesFase ────────────────────────────────────────────────────
console.log('\ncalcularQuestoesFase:');

resetState();
planoAdotado = criarPlanoTeste([]);
planoAdotado.materias[0].materia_edital_id = 'mat-dc';

const legendasDC = new Set(['DC']);
let result = calcularQuestoesFase(legendasDC);
assert(result.feitas === 0 && result.corretas === 0, 'sem progresso: 0 feitas, 0 corretas');

editalProgresso[gerarChaveEdital('Direito Constitucional', 'Princípios', 'Legalidade')] =
    { status: 'visto', questoes_feitas: 10, questoes_corretas: 7 };
editalProgresso[gerarChaveEdital('Direito Constitucional', 'Princípios', 'Igualdade')] =
    { status: 'visto', questoes_feitas: 5, questoes_corretas: 4 };

result = calcularQuestoesFase(legendasDC);
assert(result.feitas === 15, 'soma feitas: 10+5 = 15');
assert(result.corretas === 11, 'soma corretas: 7+4 = 11');

const legendasDA = new Set(['DA']);
planoAdotado.materias[1].materia_edital_id = 'mat-da';
result = calcularQuestoesFase(legendasDA);
assert(result.feitas === 0, 'DA sem progresso: 0 feitas');

// ── verificarProgressoFase: default 60% (sem regras) ────────────────────────
console.log('\nverificarProgressoFase — default 60%:');

resetState();
planoAdotado = criarPlanoTeste([]);
planoAdotado.materias[0].materia_edital_id = 'mat-dc';
materiasSelecionadas = [{ ...planoAdotado.materias[0], cor: '#000' }];

const chaves = [];
planoAdotado.edital[0].topicos.forEach(t => {
    t.subtopicos.forEach(s => {
        chaves.push(gerarChaveEdital('Direito Constitucional', t.nome, s));
    });
});

// Marcar 2 de 4 (50%) — não deve avançar
chaves.slice(0, 2).forEach(c => {
    editalProgresso[c] = { status: 'visto', questoes_feitas: 0, questoes_corretas: 0 };
});
verificarProgressoFase();
assert(faseAtual === 1, '50% visto: não avança (default 60%)');

// Marcar 3 de 4 (75%) — deve avançar
chaves[2] && (editalProgresso[chaves[2]] = { status: 'visto', questoes_feitas: 0, questoes_corretas: 0 });
verificarProgressoFase();
assert(faseAtual === 2, '75% visto: avança para fase 2');

// ── verificarProgressoFase: regra customizada (80%) ─────────────────────────
console.log('\nverificarProgressoFase — regra customizada 80%:');

resetState();
planoAdotado = criarPlanoTeste([{ fase: 1, pct_edital: 80 }]);
planoAdotado.materias[0].materia_edital_id = 'mat-dc';
materiasSelecionadas = [{ ...planoAdotado.materias[0], cor: '#000' }];

// Marcar 3 de 4 (75%) — não deve avançar com regra de 80%
chaves.forEach((c, i) => {
    if (i < 3) editalProgresso[c] = { status: 'visto', questoes_feitas: 0, questoes_corretas: 0 };
});
verificarProgressoFase();
assert(faseAtual === 1, '75% visto com regra 80%: não avança');

// Marcar 4 de 4 (100%) — deve avançar
editalProgresso[chaves[3]] = { status: 'visto', questoes_feitas: 0, questoes_corretas: 0 };
verificarProgressoFase();
assert(faseAtual === 2, '100% visto com regra 80%: avança');

// ── verificarProgressoFase: questoes_minimas ────────────────────────────────
console.log('\nverificarProgressoFase — questoes_minimas:');

resetState();
planoAdotado = criarPlanoTeste([{ fase: 1, pct_edital: 50, questoes_minimas: 20 }]);
planoAdotado.materias[0].materia_edital_id = 'mat-dc';
materiasSelecionadas = [{ ...planoAdotado.materias[0], cor: '#000' }];

// Marcar 3 de 4 visto (75%) mas com poucas questões
chaves.forEach((c, i) => {
    if (i < 3) editalProgresso[c] = { status: 'visto', questoes_feitas: 3, questoes_corretas: 2 };
});
verificarProgressoFase();
assert(faseAtual === 1, '75% visto mas apenas 9 questões (min 20): não avança');

// Aumentar questões para atingir mínimo
chaves.forEach((c, i) => {
    if (i < 3) editalProgresso[c] = { status: 'visto', questoes_feitas: 10, questoes_corretas: 7 };
});
verificarProgressoFase();
assert(faseAtual === 2, '75% visto com 30 questões (min 20): avança');

// ── verificarProgressoFase: pct_acerto_minimo ───────────────────────────────
console.log('\nverificarProgressoFase — pct_acerto_minimo:');

resetState();
planoAdotado = criarPlanoTeste([{ fase: 1, pct_edital: 50, pct_acerto_minimo: 70 }]);
planoAdotado.materias[0].materia_edital_id = 'mat-dc';
materiasSelecionadas = [{ ...planoAdotado.materias[0], cor: '#000' }];

// 75% visto, mas acerto = 40%
chaves.forEach((c, i) => {
    if (i < 3) editalProgresso[c] = { status: 'visto', questoes_feitas: 10, questoes_corretas: 4 };
});
verificarProgressoFase();
assert(faseAtual === 1, '40% acerto (min 70%): não avança');

// Aumentar acerto para 80%
chaves.forEach((c, i) => {
    if (i < 3) editalProgresso[c] = { status: 'visto', questoes_feitas: 10, questoes_corretas: 8 };
});
verificarProgressoFase();
assert(faseAtual === 2, '80% acerto (min 70%): avança');

// ── verificarProgressoFase: regra com todos os critérios ────────────────────
console.log('\nverificarProgressoFase — todos critérios combinados:');

resetState();
planoAdotado = criarPlanoTeste([{ fase: 1, pct_edital: 50, questoes_minimas: 10, pct_acerto_minimo: 60 }]);
planoAdotado.materias[0].materia_edital_id = 'mat-dc';
materiasSelecionadas = [{ ...planoAdotado.materias[0], cor: '#000' }];

// Edital OK, questões insuficientes
chaves.forEach((c, i) => {
    if (i < 3) editalProgresso[c] = { status: 'visto', questoes_feitas: 2, questoes_corretas: 2 };
});
verificarProgressoFase();
assert(faseAtual === 1, 'edital OK mas questões < 10: não avança');

// Questões OK, acerto insuficiente
chaves.forEach((c, i) => {
    if (i < 3) editalProgresso[c] = { status: 'visto', questoes_feitas: 5, questoes_corretas: 2 };
});
verificarProgressoFase();
assert(faseAtual === 1, 'questões >= 10 mas acerto 40% < 60%: não avança');

// Tudo OK
chaves.forEach((c, i) => {
    if (i < 3) editalProgresso[c] = { status: 'visto', questoes_feitas: 5, questoes_corretas: 4 };
});
verificarProgressoFase();
assert(faseAtual === 2, 'todos critérios atendidos: avança');

// ── verificarProgressoFase: pct_edital = 0 permite avanço sem edital ────────
console.log('\nverificarProgressoFase — pct_edital 0:');

resetState();
planoAdotado = criarPlanoTeste([{ fase: 1, pct_edital: 0, questoes_minimas: 5 }]);
planoAdotado.materias[0].materia_edital_id = 'mat-dc';
materiasSelecionadas = [{ ...planoAdotado.materias[0], cor: '#000' }];

// Nenhum item visto, mas pct_edital = 0 → edital não bloqueia
chaves.forEach((c, i) => {
    if (i < 3) editalProgresso[c] = { status: 'pendente', questoes_feitas: 1, questoes_corretas: 1 };
});
verificarProgressoFase();
assert(faseAtual === 1, 'pct_edital 0 mas questões 3 < 5: não avança');

chaves.forEach((c, i) => {
    if (i < 3) editalProgresso[c] = { status: 'pendente', questoes_feitas: 2, questoes_corretas: 2 };
});
editalProgresso[chaves[3]] = { status: 'pendente', questoes_feitas: 1, questoes_corretas: 1 };
verificarProgressoFase();
assert(faseAtual === 2, 'pct_edital 0 com questões 7 >= 5: avança mesmo sem edital visto');

// ── Resultado final ─────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
