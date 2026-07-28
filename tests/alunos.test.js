// Testes para alunos.js — aba do professor: perfil de acesso e nível por aluno
// Executar: node tests/alunos.test.js

const fs = require('fs');
const vm = require('vm');
const path = require('path');

// ── Extratores ───────────────────────────────────────────────────────────────
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

function extrairConstArray(codigo, nome) {
    const pos = codigo.indexOf('const ' + nome + ' =');
    if (pos === -1) throw new Error('Const nao encontrada: ' + nome);
    const start = codigo.indexOf('[', pos);
    let depth = 0, i = start;
    while (i < codigo.length) {
        if (codigo[i] === '[') depth++;
        else if (codigo[i] === ']') { depth--; if (depth === 0) return 'var ' + nome + ' = ' + codigo.slice(start, i + 1); }
        i++;
    }
    throw new Error('Array nao fechado: ' + nome);
}

const alunosCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'alunos.js'), 'utf8');

vm.runInThisContext(extrairConstArray(alunosCode, 'PERFIS_ALUNO'));
vm.runInThisContext(extrairConstArray(alunosCode, 'NIVEIS_CONTEUDO'));
vm.runInThisContext(extrairBloco(alunosCode, '_rotuloPerfil'));
vm.runInThisContext(extrairBloco(alunosCode, '_mesclarConfigPerfil'));

// ── Harness ──────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { passed++; console.log('  ✓ ' + msg); }
    else { failed++; console.error('  ✗ ' + msg); }
}

// ── PERFIS_ALUNO ─────────────────────────────────────────────────────────────
console.log('\nPERFIS_ALUNO:');

assert(Array.isArray(PERFIS_ALUNO) && PERFIS_ALUNO.length === 3, 'tem exatamente 3 perfis');

// Os valores DEVEM bater com tipoPerfil em state.js e com data-perfil-oculto
// no index.html — divergência aqui quebra aplicarVisibilidadePerfil.
const valoresPerfil = PERFIS_ALUNO.map(p => p.valor);
assert(valoresPerfil.includes('autodidata'), 'inclui autodidata');
assert(valoresPerfil.includes('curso'), 'inclui curso');
assert(valoresPerfil.includes('mentoria'), 'inclui mentoria');
assert(new Set(valoresPerfil).size === 3, 'valores unicos');
PERFIS_ALUNO.forEach(p => {
    assert(!!p.rotulo && p.rotulo.length > 0, `${p.valor}: tem rotulo`);
    assert(!!p.desc && p.desc.length > 0, `${p.valor}: tem descricao`);
});

// Contrato com o state.js: os valores aqui precisam existir no comentario
// que documenta tipoPerfil (guarda contra renomeacao de um lado so).
const stateCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'state.js'), 'utf8');
const linhaTipoPerfil = stateCode.split('\n').find(l => l.includes('let tipoPerfil'));
valoresPerfil.forEach(v => {
    assert(linhaTipoPerfil.includes(`'${v}'`), `state.js documenta o perfil "${v}"`);
});

// ── NIVEIS_CONTEUDO ──────────────────────────────────────────────────────────
console.log('\nNIVEIS_CONTEUDO:');

const valoresNivel = NIVEIS_CONTEUDO.map(n => n.valor);
assert(valoresNivel.length === 3, 'tem exatamente 3 niveis');
assert(valoresNivel.includes('basico'), 'inclui basico');
assert(valoresNivel.includes('intermediario'), 'inclui intermediario');
assert(valoresNivel.includes('avancado'), 'inclui avancado');

// Contrato com NIVEL_MATERIAS em onboarding.js
const onbCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'onboarding.js'), 'utf8');
const nivelMatch = onbCode.match(/const NIVEL_MATERIAS\s*=\s*\{[^}]+\}/);
vm.runInThisContext(nivelMatch[0].replace('const ', 'var '));
valoresNivel.forEach(v => {
    assert(NIVEL_MATERIAS[v] !== undefined, `NIVEL_MATERIAS define "${v}"`);
});

// ── _rotuloPerfil ────────────────────────────────────────────────────────────
console.log('\n_rotuloPerfil:');

assert(_rotuloPerfil('mentoria') === 'Mentoria', 'mentoria -> Mentoria');
assert(_rotuloPerfil('autodidata') === 'Autodidata', 'autodidata -> Autodidata');
assert(_rotuloPerfil(null) === 'Não definido', 'null -> Nao definido');
assert(_rotuloPerfil(undefined) === 'Não definido', 'undefined -> Nao definido');
assert(_rotuloPerfil('inexistente') === 'Não definido', 'valor desconhecido -> Nao definido');

// ── _mesclarConfigPerfil ─────────────────────────────────────────────────────
console.log('\n_mesclarConfigPerfil:');

// O ponto critico: salvar o perfil NAO pode apagar a configuracao de blocos,
// horas e duracao que o professor definiu ao atribuir o plano.
const cfgExistente = {
    duracaoBloco: 50,
    intervaloEntreBlocos: 10,
    blocosPorSessao: 3,
    horasSemanais: 20,
    blocos_por_materia: { POR: 4, MAT: 3 },
    meio_bloco_legendas: ['INF'],
    nivel_conteudo: 'basico'
};

const merged = _mesclarConfigPerfil(cfgExistente, 'mentoria', 'intermediario');
assert(merged.tipo_perfil === 'mentoria', 'grava o novo tipo_perfil');
assert(merged.nivel_conteudo === 'intermediario', 'sobrescreve o nivel_conteudo');
assert(merged.duracaoBloco === 50, 'preserva duracaoBloco');
assert(merged.intervaloEntreBlocos === 10, 'preserva intervaloEntreBlocos');
assert(merged.blocosPorSessao === 3, 'preserva blocosPorSessao');
assert(merged.horasSemanais === 20, 'preserva horasSemanais');
assert(merged.blocos_por_materia.POR === 4, 'preserva blocos_por_materia');
assert(merged.meio_bloco_legendas[0] === 'INF', 'preserva meio_bloco_legendas');

// Nao muta o objeto original
assert(cfgExistente.tipo_perfil === undefined, 'nao muta a config original');

// Casos vazios
const vazio = _mesclarConfigPerfil(null, 'curso', 'avancado');
assert(vazio.tipo_perfil === 'curso' && vazio.nivel_conteudo === 'avancado',
    'config null: cria objeto novo com os dois campos');
assert(Object.keys(vazio).length === 2, 'config null: nao inventa outras chaves');

const semCfg = _mesclarConfigPerfil(undefined, 'autodidata', 'basico');
assert(semCfg.tipo_perfil === 'autodidata', 'config undefined: funciona');

// ── Resumo ───────────────────────────────────────────────────────────────────
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
