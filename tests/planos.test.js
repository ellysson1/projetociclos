// Testes para a sincronização de planos e a troca segura de plano
//   _remapearVinculosEdital, _mesclarMateriasDoPlano (planos.js)
//   _rebalancearPendentes (blocos.js), _indiceItensEditalPorId, _idItemEdital (edital.js)
// Executar: node tests/planos.test.js

const fs = require('fs');
const vm = require('vm');
const path = require('path');

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
const ler = f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');

global.planoAdotado = null;
const planosCode = ler('planos.js');
const blocosCode = ler('blocos.js');
const editalCode = ler('edital.js');
vm.runInThisContext(extrairBloco(planosCode, '_remapearVinculosEdital'));
vm.runInThisContext(extrairBloco(planosCode, '_mesclarMateriasDoPlano'));
vm.runInThisContext(extrairBloco(blocosCode, '_rebalancearPendentes'));
vm.runInThisContext(extrairBloco(editalCode, '_indiceItensEditalPorId'));
vm.runInThisContext(extrairBloco(editalCode, '_idItemEdital'));

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { passed++; console.log('  ✓ ' + msg); }
    else { failed++; console.error('  ✗ ' + msg); }
}

// ── _remapearVinculosEdital ──────────────────────────────────────────────────
console.log('\n_remapearVinculosEdital:');

// Aluno antigo: ids gerados localmente; o plano no banco ganhou ids próprios.
const editalAluno = [{ id: 'local-1', materia: 'Direito Constitucional' }, { id: 'local-2', materia: 'AFO' }, { id: 'local-3', materia: 'Removida' }];
const editalPlano = [{ id: 'db-1', materia: 'Direito Constitucional' }, { id: 'db-2', materia: 'AFO' }];
const sel = [
    { legenda: 'DC', materia_edital_id: 'local-1' },
    { legenda: 'AFO', materia_edital_id: 'local-2' },
    { legenda: 'REM', materia_edital_id: 'local-3' },
    { legenda: 'SEM' }
];
_remapearVinculosEdital(editalAluno, editalPlano, [sel]);
assert(sel[0].materia_edital_id === 'db-1', 'vinculo migra para o id do plano (mesmo nome de materia)');
assert(sel[1].materia_edital_id === 'db-2', 'segunda materia tambem migra');
assert(!('materia_edital_id' in sel[2]), 'materia que saiu do edital perde o vinculo (reconciliacao pergunta de novo)');
assert(!('materia_edital_id' in sel[3]), 'materia sem vinculo continua sem vinculo');

const jaCerto = [{ legenda: 'DC', materia_edital_id: 'db-1' }];
_remapearVinculosEdital(editalAluno, editalPlano, [jaCerto]);
assert(jaCerto[0].materia_edital_id === 'db-1', 'vinculo que ja aponta para id valido nao e alterado');

_remapearVinculosEdital(null, null, [null, undefined]);
assert(true, 'entradas nulas nao lancam erro');

// ── _mesclarMateriasDoPlano ──────────────────────────────────────────────────
console.log('\n_mesclarMateriasDoPlano:');

const doAluno = [
    { nome: 'Portugues', legenda: 'POR', peso: 5, extensao: 5, dificuldade: 5, fase: 2, materia_edital_id: 'x1' },
    { nome: 'Antiga', legenda: 'ANT', peso: 3, fase: 1 }
];
const doPlano = [
    { nome: 'Língua Portuguesa', legenda: 'POR', peso: 9, extensao: 7, dificuldade: 4, fase: 1 },
    { nome: 'Nova Materia', legenda: 'NOV', peso: 6, extensao: 6, dificuldade: 6 }
];
const mescladas = _mesclarMateriasDoPlano(doAluno, doPlano);
const por = mescladas.find(m => m.legenda === 'POR');
assert(por.nome === 'Língua Portuguesa' && por.peso === 9, 'nome e pesos vem do plano atualizado');
assert(por.fase === 2, 'fase do aluno e preservada (nao volta para a do plano)');
assert(por.materia_edital_id === 'x1', 'vinculo com o edital e preservado');
assert(mescladas.some(m => m.legenda === 'ANT'), 'materia removida do plano NAO e removida do aluno');
const nova = mescladas.find(m => m.legenda === 'NOV');
assert(nova && nova.fase === 1, 'materia nova entra com fase padrao 1');
assert(doAluno[0].nome === 'Portugues', 'nao muta a lista original');
assert(_mesclarMateriasDoPlano(null, null).length === 0, 'listas nulas: vazio');

// ── _rebalancearPendentes ────────────────────────────────────────────────────
console.log('\n_rebalancearPendentes:');

const b = (leg, concluido, extra = {}) => ({ id: `${leg}-${Math.random()}`, legenda: leg, nome: leg, concluido, assunto: concluido ? 'X' : null, ...extra });
const ciclo = [b('POR', true), b('POR', true), b('POR', false), b('POR', false), b('MAT', false), b('INF', true), b('FORA', false)];

// Reduzir POR de 4 para 3; aumentar MAT de 1 para 3; INF alvo 0 com 1 concluido
let r = _rebalancearPendentes(ciclo, { POR: 3, MAT: 3, INF: 0 }, {});
const conta = (arr, leg, c) => arr.filter(x => x.legenda === leg && (c === undefined || x.concluido === c)).length;
assert(conta(r, 'POR', true) === 2, 'concluidos de POR intactos');
assert(conta(r, 'POR') === 3, 'POR reduzido para o alvo removendo so pendente');
assert(conta(r, 'MAT') === 3, 'MAT ampliado para o alvo');
assert(conta(r, 'INF', true) === 1, 'bloco concluido NUNCA e removido, mesmo com alvo 0');
assert(conta(r, 'FORA') === 1, 'materia fora do alvo fica como esta');
ciclo.filter(x => x.concluido).forEach(orig => {
    assert(r.includes(orig), `concluido ${orig.legenda} e o MESMO objeto (assunto/questoes preservados)`);
});

// Alvo menor que os concluidos: nenhum concluido sai
r = _rebalancearPendentes(ciclo, { POR: 1 }, {});
assert(conta(r, 'POR', true) === 2 && conta(r, 'POR', false) === 0, 'alvo abaixo dos concluidos: so os pendentes saem');

// Materia nova, sem bloco existente: usa o template
r = _rebalancearPendentes(ciclo, { NOVA: 2 }, { NOVA: { nome: 'Nova', legenda: 'NOVA', cor: '#fff' } });
const novos = r.filter(x => x.legenda === 'NOVA');
assert(novos.length === 2 && novos.every(x => x.concluido === false && x.cor === '#fff'), 'materia nova criada a partir do template');
assert(novos.every(x => !('id' in x)), 'blocos novos nao herdam id');

// Blocos novos clonados de um existente nao herdam id nem conclusao
r = _rebalancearPendentes([b('POR', true)], { POR: 3 }, {});
const novosPor = r.filter(x => !x.concluido);
assert(novosPor.length === 2 && novosPor.every(x => !x.id && x.assunto === null), 'clones de bloco concluido nascem pendentes e sem id');

// Sem template e sem bloco: ignora sem erro
r = _rebalancearPendentes([], { X: 2 }, {});
assert(r.length === 0, 'sem modelo para a materia: nada e criado');

assert(ciclo.length === 7, 'nao muta o array original');

// ── Ids estáveis do edital ───────────────────────────────────────────────────
console.log('\nIds estaveis do edital:');

global.planoAdotado = { edital: [{
    id: 'm1', materia: 'Contabilidade',
    topicos: [
        { id: 't1', nome: 'Demonstrações', subtopicos: [{ id: 's1', nome: 'Balanço' }, 'DRE'] },
        { id: 't2', nome: 'Provisões', subtopicos: [] }
    ]
}] };

assert(_idItemEdital('Contabilidade', 'Demonstrações', 'Balanço') === 's1', 'id do subtopico');
assert(_idItemEdital('Contabilidade', 'Provisões', null) === 't2', 'id do topico sem subtopicos');
assert(_idItemEdital('Contabilidade', 'Demonstrações', 'DRE') === null, 'subtopico string (sem id): null');
assert(_idItemEdital('Outra', 'X', null) === null, 'materia inexistente: null');

const idx = _indiceItensEditalPorId();
assert(idx.s1.subtopico === 'Balanço' && idx.s1.topico === 'Demonstrações', 'indice devolve os nomes atuais do item');
assert(idx.t2.subtopico === null, 'topico sem subtopicos indexado com subtopico null');
assert(!idx.t1, 'topico COM subtopicos nao e item (so os subtopicos sao)');

// Renomeação: o mesmo id passa a apontar para o nome novo
planoAdotado.edital[0].topicos[0].subtopicos[0].nome = 'Balanço Patrimonial';
assert(_indiceItensEditalPorId().s1.subtopico === 'Balanço Patrimonial', 'apos renomear, o id resolve para o nome novo');

// ── Guardas de regressão ─────────────────────────────────────────────────────
console.log('\nGuardas de regressao:');

assert(planosCode.includes(".order('updated_at', { ascending: false })"),
    'atribuicao mais recente e escolhida por updated_at');
assert(/upsert\(\{[\s\S]{0,300}updated_at: new Date\(\)\.toISOString\(\)[\s\S]{0,80}onConflict: 'plano_id,aluno_id'/.test(planosCode),
    'reatribuir grava updated_at (senao o aluno nunca recebe a mudanca)');
assert(planosCode.includes("_salvarSnapshotEstado('troca_de_plano')"),
    'troca de plano salva snapshot antes de descartar o ciclo');
assert(ler('app.js').split('sincronizarPlanoAdotado()').length - 1 === 2,
    'plano e sincronizado nos dois caminhos de login');
assert(editalCode.includes('registro.item_id = itemId'),
    'progresso do edital grava o id estavel do item');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
