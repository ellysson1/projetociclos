// Testes para T11 — LGPD (exportar dados, excluir conta)
// Executar: node tests/lgpd.test.js

const fs = require('fs');
const vm = require('vm');
const path = require('path');

// ── Shims mínimos ─────────────────────────────────────────────────────────────
let alertMsg = null;
let confirmResult = true;
let promptResult = 'test@test.com';
let deletedTables = [];
let selectedTables = [];
let signedOut = false;
let removedKeys = [];

global.alert = (msg) => { alertMsg = msg; };
global.confirm = () => confirmResult;
global.prompt = () => promptResult;
global.URL = { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} };
global.Blob = class { constructor(parts, opts) { this.parts = parts; this.opts = opts; } };
global.setTimeout = (fn) => fn();

global.document = {
    getElementById: (id) => {
        if (id === 'lgpdStatus') return { style: {}, textContent: '' };
        return null;
    },
    createElement: () => ({ click: () => {}, href: '', download: '' })
};

global.location = { reload: () => {} };
global.localStorage = {
    _store: {},
    removeItem(key) { removedKeys.push(key); delete this._store[key]; },
    getItem(key) { return this._store[key] || null; },
    setItem(key, val) { this._store[key] = val; }
};

global.supabaseConfigurado = () => true;
global.getUsuarioLogado = async () => ({ id: 'user-123', email: 'test@test.com' });
global.montarEstadoLocal = () => ({ blocosAtivos: [], materiasList: [] });

global.supabaseClient = {
    from: (tabela) => ({
        select: () => ({
            eq: () => {
                selectedTables.push(tabela);
                return Promise.resolve({ data: [{ id: 1 }], error: null });
            }
        }),
        delete: () => ({
            eq: () => {
                deletedTables.push(tabela);
                return Promise.resolve({ error: null });
            }
        })
    }),
    auth: { signOut: async () => { signedOut = true; return { error: null }; } }
};

// ── Carregar lgpd.js ─────────────────────────────────────────────────────────
const lgpdCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'lgpd.js'), 'utf8');
vm.runInThisContext(lgpdCode);

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✓ ' + msg); passed++; }
    else { console.log('  ✗ ' + msg); failed++; }
}

function resetMocks() {
    alertMsg = null;
    confirmResult = true;
    promptResult = 'test@test.com';
    deletedTables = [];
    selectedTables = [];
    signedOut = false;
    removedKeys = [];
}

// ── exportarDadosPessoais ───────────────────────────────────────────────────
console.log('\nexportarDadosPessoais:');

(async () => {
    resetMocks();
    await exportarDadosPessoais();

    assert(selectedTables.includes('profiles'), 'consulta profiles');
    assert(selectedTables.includes('progresso'), 'consulta progresso');
    assert(selectedTables.includes('edital_progresso'), 'consulta edital_progresso');
    assert(selectedTables.includes('questoes'), 'consulta questoes');
    assert(selectedTables.includes('notificacoes'), 'consulta notificacoes');
    assert(selectedTables.includes('videos_assistidos'), 'consulta videos_assistidos');
    assert(selectedTables.includes('eventos_estudo'), 'consulta eventos_estudo');
    assert(selectedTables.includes('planos'), 'consulta planos criados');
    assert(selectedTables.length >= 9, `consulta pelo menos 9 tabelas (obteve ${selectedTables.length})`);

    // ── excluirConta: cancelar na 1ª confirmação ────────────────────────────
    console.log('\nexcluirConta — cancelamentos:');

    resetMocks();
    confirmResult = false;
    await excluirConta();
    assert(deletedTables.length === 0, 'cancelar confirm: nenhuma tabela excluída');

    resetMocks();
    confirmResult = true;
    promptResult = 'wrong@email.com';
    await excluirConta();
    assert(deletedTables.length === 0, 'email errado: nenhuma tabela excluída');
    assert(alertMsg === 'Email não confere. Exclusão cancelada.', 'alerta de email incorreto');

    // ── excluirConta: sucesso ───────────────────────────────────────────────
    console.log('\nexcluirConta — sucesso:');

    resetMocks();
    await excluirConta();

    assert(deletedTables.includes('profiles'), 'exclui profiles');
    assert(deletedTables.includes('progresso'), 'exclui progresso');
    assert(deletedTables.includes('edital_progresso'), 'exclui edital_progresso');
    assert(deletedTables.includes('questoes'), 'exclui questoes');
    assert(deletedTables.includes('notificacoes'), 'exclui notificacoes');
    assert(deletedTables.includes('videos_assistidos'), 'exclui videos_assistidos');
    assert(deletedTables.includes('eventos_estudo'), 'exclui eventos_estudo');
    assert(deletedTables.includes('plano_atribuicoes'), 'exclui plano_atribuicoes');
    assert(deletedTables.includes('planos'), 'exclui planos');
    assert(signedOut, 'faz signOut');
    assert(removedKeys.includes('cicloEstudosEstado'), 'limpa localStorage: cicloEstudosEstado');
    assert(removedKeys.includes('cicloSyncVersao'), 'limpa localStorage: cicloSyncVersao');
    assert(removedKeys.includes('cicloDeviceId'), 'limpa localStorage: cicloDeviceId');

    // ── excluirConta: sem login ─────────────────────────────────────────────
    console.log('\nexcluirConta — sem login:');

    resetMocks();
    global.getUsuarioLogado = async () => null;
    await excluirConta();
    assert(deletedTables.length === 0, 'sem login: nenhuma exclusão');
    assert(alertMsg === 'Faça login para excluir sua conta.', 'alerta de login necessário');

    // Restore
    global.getUsuarioLogado = async () => ({ id: 'user-123', email: 'test@test.com' });

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
})();
