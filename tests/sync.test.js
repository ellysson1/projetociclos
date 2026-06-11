// Testes das regras de merge da sincronização multi-dispositivo (Fase 2 / T1.3)
// Executar com: node tests/sync.test.js
// Sem dependências — carrega js/sync-engine.js puro via eval com shims mínimos.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Shims de browser para carregar o módulo fora do navegador
global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] ?? null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
};
global.navigator = { onLine: false };

const codigo = fs.readFileSync(path.join(__dirname, '..', 'js', 'sync-engine.js'), 'utf8');
eval(codigo);

let passou = 0;
function teste(nome, fn) {
    fn();
    passou++;
    console.log(`  ✓ ${nome}`);
}

function estadoBase(extra) {
    return Object.assign({
        materiasList: [{ nome: 'Português', legenda: 'PRT' }],
        materiasSelecionadas: [{ nome: 'Português', legenda: 'PRT' }],
        blocosAtivos: [],
        configuracoes: { duracaoBloco: 60 },
        faseAtual: 1,
        revisoesContador: {},
        horasSemanais: '20',
        atualizadoEm: '2026-06-01T10:00:00Z'
    }, extra);
}

console.log('garantirIdsBlocos:');

teste('atribui ids determinísticos a blocos legados', () => {
    const a = [{ legenda: 'PRT' }, { legenda: 'MAT' }];
    const b = [{ legenda: 'PRT' }, { legenda: 'MAT' }];
    garantirIdsBlocos(a);
    garantirIdsBlocos(b);
    assert.deepStrictEqual(a.map(x => x.id), b.map(x => x.id));
});

teste('não sobrescreve ids existentes e evita colisão', () => {
    const blocos = [{ id: 'b1-PRT', legenda: 'PRT' }, { legenda: 'PRT' }];
    garantirIdsBlocos(blocos);
    assert.strictEqual(blocos[0].id, 'b1-PRT');
    assert.notStrictEqual(blocos[1].id, 'b1-PRT');
    assert.ok(blocos[1].id);
});

console.log('mesclarEstados:');

teste('cenário principal: dispositivo B antigo não desfaz conclusões do servidor', () => {
    // A concluiu 3 blocos (servidor, versão 5); B tem estado de ontem (versão 3)
    const servidor = estadoBase({
        blocosAtivos: [
            { id: 'b0-PRT', legenda: 'PRT', concluido: true, assunto: 'Crase' },
            { id: 'b1-PRT', legenda: 'PRT', concluido: true, assunto: 'Verbos' },
            { id: 'b2-MAT', legenda: 'MAT', concluido: true, assunto: 'Juros' },
            { id: 'b3-MAT', legenda: 'MAT', concluido: false }
        ]
    });
    const local = estadoBase({
        blocosAtivos: [
            { id: 'b0-PRT', legenda: 'PRT', concluido: false },
            { id: 'b1-PRT', legenda: 'PRT', concluido: false },
            { id: 'b2-MAT', legenda: 'MAT', concluido: false },
            { id: 'b3-MAT', legenda: 'MAT', concluido: false }
        ]
    });
    const m = mesclarEstados(local, servidor, 3, 5);
    assert.strictEqual(m.blocosAtivos.filter(b => b.concluido).length, 3);
    assert.strictEqual(m.blocosAtivos.find(b => b.id === 'b0-PRT').assunto, 'Crase');
});

teste('união: conclusões offline locais sobrevivem ao pull do servidor', () => {
    // B estudou offline (concluiu b3) enquanto o servidor avançou em b0
    const servidor = estadoBase({
        blocosAtivos: [
            { id: 'b0-PRT', legenda: 'PRT', concluido: true },
            { id: 'b3-MAT', legenda: 'MAT', concluido: false }
        ]
    });
    const local = estadoBase({
        blocosAtivos: [
            { id: 'b0-PRT', legenda: 'PRT', concluido: false },
            { id: 'b3-MAT', legenda: 'MAT', concluido: true, assunto: 'Porcentagem', questoes: { feitas: 10, corretas: 8 } }
        ]
    });
    const m = mesclarEstados(local, servidor, 3, 5);
    const b3 = m.blocosAtivos.find(b => b.id === 'b3-MAT');
    assert.strictEqual(b3.concluido, true);
    assert.strictEqual(b3.assunto, 'Porcentagem');
    assert.deepStrictEqual(b3.questoes, { feitas: 10, corretas: 8 });
    assert.strictEqual(m.blocosAtivos.find(b => b.id === 'b0-PRT').concluido, true);
});

teste('bloco concluído ausente na base é anexado (nunca se perde)', () => {
    const servidor = estadoBase({
        blocosAtivos: [{ id: 'b0-PRT', legenda: 'PRT', concluido: false }]
    });
    const local = estadoBase({
        blocosAtivos: [
            { id: 'b0-PRT', legenda: 'PRT', concluido: false },
            { id: 'extra-1', legenda: 'MAT', concluido: true }
        ]
    });
    const m = mesclarEstados(local, servidor, 1, 2);
    assert.ok(m.blocosAtivos.some(b => b.id === 'extra-1' && b.concluido));
});

teste('fase: vence a maior', () => {
    const servidor = estadoBase({ faseAtual: 2 });
    const local = estadoBase({ faseAtual: 3 });
    assert.strictEqual(mesclarEstados(local, servidor, 1, 5).faseAtual, 3);
    assert.strictEqual(mesclarEstados(servidor, local, 5, 1).faseAtual, 3);
});

teste('revisões: maior contador por chave', () => {
    const servidor = estadoBase({ revisoesContador: { 'PRT|Crase|': 2, 'MAT|Juros|': 1 } });
    const local = estadoBase({ revisoesContador: { 'PRT|Crase|': 1, 'MAT|Juros|': 3 } });
    const m = mesclarEstados(local, servidor, 1, 2);
    assert.strictEqual(m.revisoesContador['PRT|Crase|'], 2);
    assert.strictEqual(m.revisoesContador['MAT|Juros|'], 3);
});

teste('configurações: vence o salvamento mais recente, mesmo com versão menor', () => {
    const servidor = estadoBase({
        configuracoes: { duracaoBloco: 60 },
        horasSemanais: '20',
        atualizadoEm: '2026-06-01T10:00:00Z'
    });
    const local = estadoBase({
        configuracoes: { duracaoBloco: 45 },
        horasSemanais: '15',
        atualizadoEm: '2026-06-02T08:00:00Z'
    });
    const m = mesclarEstados(local, servidor, 1, 5); // servidor é a base (versão maior)
    assert.strictEqual(m.configuracoes.duracaoBloco, 45);
    assert.strictEqual(m.horasSemanais, '15');
});

teste('estrutura do ciclo: vence a versão mais alta', () => {
    const servidor = estadoBase({
        materiasSelecionadas: [{ nome: 'Português', legenda: 'PRT' }, { nome: 'Matemática', legenda: 'MAT' }]
    });
    const local = estadoBase();
    const m = mesclarEstados(local, servidor, 1, 5);
    assert.strictEqual(m.materiasSelecionadas.length, 2);
});

teste('lados ausentes: retorna o existente sem erro', () => {
    const e = estadoBase();
    assert.strictEqual(mesclarEstados(e, null, 1, 0), e);
    assert.strictEqual(mesclarEstados(null, e, 0, 1), e);
});

teste('merge é idempotente (aplicar duas vezes não muda nada)', () => {
    const servidor = estadoBase({
        blocosAtivos: [{ id: 'b0-PRT', legenda: 'PRT', concluido: true }]
    });
    const local = estadoBase({
        blocosAtivos: [{ id: 'b0-PRT', legenda: 'PRT', concluido: false }, { id: 'x', legenda: 'MAT', concluido: true }]
    });
    const m1 = mesclarEstados(local, servidor, 1, 2);
    const m2 = mesclarEstados(m1, servidor, 3, 2);
    assert.strictEqual(m2.blocosAtivos.filter(b => b.concluido).length, 2);
    assert.strictEqual(m2.blocosAtivos.length, m1.blocosAtivos.length);
});

console.log('fila de eventos:');

teste('registrarEvento enfileira com client_event_id único (offline)', () => {
    global.localStorage._data = {};
    const id1 = registrarEvento('bloco_concluido', { bloco_id: 'b0-PRT' });
    const id2 = registrarEvento('questoes_registradas', { feitas: 5 });
    const fila = JSON.parse(global.localStorage.getItem('cicloFilaEventos'));
    assert.strictEqual(fila.length, 2);
    assert.notStrictEqual(id1, id2);
    assert.strictEqual(fila[0].tipo, 'bloco_concluido');
    assert.ok(fila[0].client_event_id);
});

teste('fila respeita o teto de segurança', () => {
    global.localStorage._data = {};
    for (let i = 0; i < 600; i++) registrarEvento('topico_status', { i });
    const fila = JSON.parse(global.localStorage.getItem('cicloFilaEventos'));
    assert.ok(fila.length <= 500);
});

console.log(`\n${passou} testes passaram.`);
