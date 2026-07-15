// Testes: T7 (meio-bloco), T8 (round-robin) e T9 (redimensionamento)
// Executar: node tests/alocacao.test.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// ── Shims mínimos ────────────────────────────────────────────────────────────
global.configuracoes = { duracaoBloco: 60 };
global.materiasSelecionadas = [];
global.alert = (msg) => {};

// Extrair funções puras dos arquivos sem executar o código DOM-dependente
function extrairFuncao(codigo, nome) {
    const regex = new RegExp(`(function ${nome}[\\s\\S]*?)\\nfunction `, 'm');
    const match = codigo.match(regex);
    if (match) return match[1];
    const regex2 = new RegExp(`(function ${nome}[\\s\\S]*)$`, 'm');
    const match2 = codigo.match(regex2);
    return match2 ? match2[1] : null;
}

const blocosCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'blocos.js'), 'utf8');
eval(extrairFuncao(blocosCode, '_calcularRedistribuicaoPorDesempenho'));
eval(extrairFuncao(blocosCode, '_distribuirPorDeficit'));

const variaveisCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'variaveis.js'), 'utf8');
eval(extrairFuncao(variaveisCode, '_alocarBlocosLargestRemainder'));

// distribuirBlocosAleatoriamente precisa de _distribuirPorDeficit (já carregada)
eval(extrairFuncao(blocosCode, 'distribuirBlocosAleatoriamente'));

let passou = 0;
function teste(nome, fn) {
    fn();
    passou++;
    console.log(`  ✓ ${nome}`);
}

// ── T8: Distribuição round-robin ──────────────────────────────────────────────

console.log('T8 — Round-robin ponderado:');

teste('sem 3 consecutivos quando matematicamente evitável', () => {
    for (let run = 0; run < 50; run++) {
        const materias = [
            { legenda: 'A', qtdBlocos: 5 },
            { legenda: 'B', qtdBlocos: 3 },
            { legenda: 'C', qtdBlocos: 2 }
        ];
        const seq = _distribuirPorDeficit(materias);
        assert.strictEqual(seq.length, 10);
        for (let i = 2; i < seq.length; i++) {
            assert.ok(!(seq[i] === seq[i-1] && seq[i] === seq[i-2]),
                `3 consecutivos de ${seq[i]} na posição ${i}: ${seq.join(',')}`);
        }
    }
});

teste('distribuição extrema (1 matéria com 80%) termina sem laço infinito', () => {
    const seq = _distribuirPorDeficit([
        { legenda: 'X', qtdBlocos: 16 },
        { legenda: 'Y', qtdBlocos: 2 },
        { legenda: 'Z', qtdBlocos: 2 }
    ]);
    assert.strictEqual(seq.length, 20);
    assert.strictEqual(seq.filter(s => s === 'X').length, 16);
    assert.strictEqual(seq.filter(s => s === 'Y').length, 2);
    assert.strictEqual(seq.filter(s => s === 'Z').length, 2);
});

teste('1 matéria sozinha funciona (sem regra de consecutivos)', () => {
    const seq = _distribuirPorDeficit([{ legenda: 'A', qtdBlocos: 5 }]);
    assert.strictEqual(seq.length, 5);
    assert.ok(seq.every(s => s === 'A'));
});

teste('0 blocos retorna vazio', () => {
    assert.deepStrictEqual(_distribuirPorDeficit([{ legenda: 'A', qtdBlocos: 0 }]), []);
    assert.deepStrictEqual(_distribuirPorDeficit([]), []);
});

teste('soma dos blocos distribuídos = total exato (30 rodadas aleatórias)', () => {
    for (let run = 0; run < 30; run++) {
        const materias = [
            { legenda: 'A', qtdBlocos: 1 + Math.floor(Math.random() * 10) },
            { legenda: 'B', qtdBlocos: 1 + Math.floor(Math.random() * 10) },
            { legenda: 'C', qtdBlocos: 1 + Math.floor(Math.random() * 5) }
        ];
        const total = materias.reduce((s, m) => s + m.qtdBlocos, 0);
        const seq = _distribuirPorDeficit(materias);
        assert.strictEqual(seq.length, total, `Esperado ${total}, obteve ${seq.length}`);
        materias.forEach(m => {
            assert.strictEqual(seq.filter(s => s === m.legenda).length, m.qtdBlocos,
                `${m.legenda}: esperado ${m.qtdBlocos}`);
        });
    }
});

teste('distribuirBlocosAleatoriamente aplica meioBloco e usa round-robin', () => {
    global.configuracoes = { duracaoBloco: 60 };
    const blocos = [
        { nome: 'Português', legenda: 'PRT', cor: '#f00', quantidadeBlocos: 3, meioBloco: false },
        { nome: 'Matemática', legenda: 'MAT', cor: '#0f0', quantidadeBlocos: 2, meioBloco: true }
    ];
    const result = distribuirBlocosAleatoriamente(blocos);
    assert.strictEqual(result.length, 5);
    const mats = result.filter(b => b.legenda === 'MAT');
    assert.ok(mats.every(b => b.duracaoEspecifica === 30), 'Meio-bloco deve ter metade da duração');
    const prts = result.filter(b => b.legenda === 'PRT');
    assert.ok(prts.every(b => !b.duracaoEspecifica), 'Blocos normais sem duracaoEspecifica');
});

// ── T7: Meio-bloco ───────────────────────────────────────────────────────────

console.log('T7 — Meio-bloco:');

teste('2+ matérias na faixa (0,1): meio-bloco para todas', () => {
    const blocos = [
        { legenda: 'A', valorPonderado: 8 },
        { legenda: 'B', valorPonderado: 2 },
        { legenda: 'C', valorPonderado: 1 },
        { legenda: 'D', valorPonderado: 1 },
    ];
    const totalP = blocos.reduce((s, b) => s + b.valorPonderado, 0);
    global.materiasSelecionadas = blocos.map(b => ({ legenda: b.legenda }));
    _alocarBlocosLargestRemainder(blocos, 5, totalP, 60);
    const meios = blocos.filter(b => b.meioBloco);
    assert.ok(meios.length >= 2, `Esperado ≥2 meios-blocos, obteve ${meios.length}`);
    meios.forEach(b => assert.strictEqual(b.quantidadeBlocos, 1));
});

teste('exatamente 1 matéria na faixa: promover para 1 bloco inteiro', () => {
    const blocos = [
        { legenda: 'A', valorPonderado: 8 },
        { legenda: 'B', valorPonderado: 5 },
        { legenda: 'C', valorPonderado: 0.3 },
    ];
    const totalP = blocos.reduce((s, b) => s + b.valorPonderado, 0);
    global.materiasSelecionadas = blocos.map(b => ({ legenda: b.legenda }));
    _alocarBlocosLargestRemainder(blocos, 5, totalP, 60);
    const c = blocos.find(b => b.legenda === 'C');
    assert.strictEqual(c.quantidadeBlocos, 1, 'Matéria C deve ter 1 bloco');
    assert.strictEqual(c.meioBloco, false, 'Com só 1 candidata, não usa meio-bloco');
});

teste('nenhuma matéria ativa termina com 0 blocos (invariante T7)', () => {
    for (let run = 0; run < 20; run++) {
        const blocos = [
            { legenda: 'A', valorPonderado: 9 },
            { legenda: 'B', valorPonderado: 0.5 },
            { legenda: 'C', valorPonderado: 0.5 },
        ];
        const totalP = blocos.reduce((s, b) => s + b.valorPonderado, 0);
        global.materiasSelecionadas = blocos.map(b => ({ legenda: b.legenda }));
        _alocarBlocosLargestRemainder(blocos, 4, totalP, 60);
        blocos.filter(b => b.valorPonderado > 0).forEach(b => {
            assert.ok(b.quantidadeBlocos >= 1 || b.meioBloco,
                `${b.legenda} ficou com 0 blocos`);
        });
    }
});

// ── T9: Redimensionamento ─────────────────────────────────────────────────────

console.log('T9 — Redimensionamento:');

teste('soma de blocos após redimensionamento = total alvo (sem off-by-one)', () => {
    const materias = [
        { legenda: 'A', totalAtual: 8 },
        { legenda: 'B', totalAtual: 6 },
        { legenda: 'C', totalAtual: 4 },
        { legenda: 'D', totalAtual: 2 }
    ];
    const totalAtual = 20;
    const totalNovo = 10;
    const fator = totalNovo / totalAtual;

    materias.forEach(m => {
        m._ideal = m.totalAtual * fator;
        m.novoTotal = Math.max(1, Math.floor(m._ideal));
    });

    let slotsUsados = materias.reduce((s, m) => s + m.novoTotal, 0);
    const restos = materias.map(m => ({ m, resto: m._ideal - Math.floor(m._ideal) }))
        .sort((a, b) => b.resto - a.resto);

    let i = 0;
    while (slotsUsados < totalNovo && restos.length > 0) {
        restos[i % restos.length].m.novoTotal++;
        slotsUsados++;
        i++;
    }

    assert.strictEqual(slotsUsados, totalNovo);
    materias.forEach(m => assert.ok(m.novoTotal >= 1, `${m.legenda} com 0`));
});

teste('20h→10h com 8 matérias: todas permanecem com ≥1 bloco', () => {
    const materias = [];
    for (let i = 0; i < 8; i++) {
        materias.push({ legenda: String.fromCharCode(65 + i), totalAtual: 2 + i });
    }
    const totalAtual = materias.reduce((s, m) => s + m.totalAtual, 0); // 44
    const totalNovo = Math.floor(totalAtual / 2); // 22
    const fator = totalNovo / totalAtual;

    materias.forEach(m => {
        m._ideal = m.totalAtual * fator;
        m.novoTotal = Math.max(1, Math.floor(m._ideal));
    });

    let slotsUsados = materias.reduce((s, m) => s + m.novoTotal, 0);
    const restos = materias.map(m => ({ m, resto: m._ideal - Math.floor(m._ideal) }))
        .sort((a, b) => b.resto - a.resto);

    let i = 0;
    while (slotsUsados < totalNovo && restos.length > 0) {
        restos[i % restos.length].m.novoTotal++;
        slotsUsados++;
        i++;
    }

    materias.forEach(m => assert.ok(m.novoTotal >= 1, `${m.legenda} com 0`));
    assert.strictEqual(slotsUsados, totalNovo);
});

// ── Próximo Ciclo — redistribuição por desempenho ─────────────────────────────

console.log('\nPróximo Ciclo — _calcularRedistribuicaoPorDesempenho:');

teste('sem fatores de desempenho: mantém a distribuição original', () => {
    const totais = { A: 5, B: 3, C: 2 };
    const novo = _calcularRedistribuicaoPorDesempenho(totais, {});
    assert.strictEqual(novo.A, 5);
    assert.strictEqual(novo.B, 3);
    assert.strictEqual(novo.C, 2);
});

teste('soma total sempre igual à soma de entrada', () => {
    const casos = [
        [{ A: 5, B: 3, C: 2 }, { A: 0.7, B: 1.5 }],
        [{ A: 10, B: 1 }, { A: 1.5, B: 0.7 }],
        [{ A: 1, B: 1, C: 1, D: 1 }, { A: 1.5 }],
        [{ A: 17, B: 4, C: 9 }, { A: 0.7, B: 1.5, C: 1 }],
    ];
    casos.forEach(([totais, fatores]) => {
        const novo = _calcularRedistribuicaoPorDesempenho(totais, fatores);
        const totalIn = Object.values(totais).reduce((s, v) => s + v, 0);
        const totalOut = Object.values(novo).reduce((s, v) => s + v, 0);
        assert.strictEqual(totalOut, totalIn, `entrada ${JSON.stringify(totais)}`);
    });
});

teste('matéria com pior desempenho (fator > 1) recebe mais blocos', () => {
    const totais = { A: 5, B: 5 };
    // A: 70% de acerto (fator ~1.3, abaixo da média), B: acima da média (fator 0.7)
    const novo = _calcularRedistribuicaoPorDesempenho(totais, { A: 1.3, B: 0.7 });
    assert.ok(novo.A > novo.B, `A deveria ganhar mais blocos que B (A=${novo.A}, B=${novo.B})`);
});

teste('nenhuma matéria fica com 0 blocos mesmo com fator muito baixo', () => {
    const totais = { A: 20, B: 1, C: 1 };
    const novo = _calcularRedistribuicaoPorDesempenho(totais, { A: 0.7, B: 0.7, C: 0.7 });
    Object.values(novo).forEach(qtd => assert.ok(qtd >= 1, 'matéria com 0 blocos'));
});

teste('total vazio: retorna objeto vazio sem lançar erro', () => {
    const novo = _calcularRedistribuicaoPorDesempenho({}, {});
    assert.deepStrictEqual(novo, {});
});

teste('matéria única: recebe todos os blocos', () => {
    const novo = _calcularRedistribuicaoPorDesempenho({ A: 7 }, { A: 1.5 });
    assert.strictEqual(novo.A, 7);
});

console.log(`\n${passou} testes passaram.`);
