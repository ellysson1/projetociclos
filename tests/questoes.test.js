// Testes para questoes.js — encontrarChaveParaTexto
// Executar: node tests/questoes.test.js

const fs = require('fs');
const vm = require('vm');
const path = require('path');

// ── Shims ─────────────────────────────────────────────────────────────────────
global.planoAdotado = null;
global.blocosAtivos = [];
global.blocoEmConclusao = null;

// ── Carregar matcher.js (fornece nomeSubtopico) ───────────────────────────────
const matcherCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'matcher.js'), 'utf8');
vm.runInThisContext(matcherCode);

// ── Carregar gerarChaveEdital de edital.js ────────────────────────────────────
const editalCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'edital.js'), 'utf8');

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

eval(extrairBloco(editalCode, 'gerarChaveEdital'));

// ── Carregar encontrarChaveParaTexto de questoes.js ───────────────────────────
const questoesCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'questoes.js'), 'utf8');
eval(extrairBloco(questoesCode, 'encontrarChaveParaTexto'));

// ── Harness ──────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { passed++; console.log('  ✓ ' + msg); }
    else { failed++; console.error('  ✗ ' + msg); }
}

const editalComSubtopicos = {
    edital: [
        {
            materia: 'Direito Constitucional',
            topicos: [
                {
                    nome: 'Princípios Fundamentais',
                    subtopicos: ['Isonomia', 'Legalidade', 'Moralidade']
                },
                {
                    nome: 'Direitos Fundamentais',
                    subtopicos: [
                        { id: 'sub-obj-1', nome: 'Direito à Vida' },
                        { id: 'sub-obj-2', nome: 'Liberdade de Expressão' },
                    ]
                }
            ]
        },
        {
            materia: 'Matemática',
            topicos: [
                { nome: 'Aritmética', subtopicos: [] },
                { nome: 'Álgebra', subtopicos: [] },
            ]
        }
    ]
};

// ── encontrarChaveParaTexto ───────────────────────────────────────────────────
console.log('\nencontrarChaveParaTexto:');

// Sem edital
global.planoAdotado = null;
assert(
    encontrarChaveParaTexto('Isonomia') === null,
    'sem edital: retorna null'
);

global.planoAdotado = editalComSubtopicos;

// Match subtopico string
assert(
    encontrarChaveParaTexto('Isonomia') === 'Direito Constitucional|Princípios Fundamentais|Isonomia',
    'subtopico string: retorna chave correta'
);
assert(
    encontrarChaveParaTexto('Legalidade') === 'Direito Constitucional|Princípios Fundamentais|Legalidade',
    'subtopico string: segundo subtopico na lista'
);
assert(
    encontrarChaveParaTexto('Moralidade') === 'Direito Constitucional|Princípios Fundamentais|Moralidade',
    'subtopico string: último subtopico na lista'
);

// Match subtopico objeto
assert(
    encontrarChaveParaTexto('Direito à Vida') === 'Direito Constitucional|Direitos Fundamentais|Direito à Vida',
    'subtopico objeto: retorna chave correta usando .nome'
);
assert(
    encontrarChaveParaTexto('Liberdade de Expressão') === 'Direito Constitucional|Direitos Fundamentais|Liberdade de Expressão',
    'subtopico objeto: segundo subtopico objeto'
);

// Match topico sem subtopicos
assert(
    encontrarChaveParaTexto('Aritmética') === 'Matemática|Aritmética|',
    'topico sem subtopicos: retorna chave com subtopico vazio'
);
assert(
    encontrarChaveParaTexto('Álgebra') === 'Matemática|Álgebra|',
    'topico sem subtopicos: segundo topico'
);

// Sem match
assert(
    encontrarChaveParaTexto('Direito Penal') === null,
    'sem match: retorna null'
);
assert(
    encontrarChaveParaTexto('') === null,
    'texto vazio: retorna null'
);

// Case-sensitive: não encontra com capitalização diferente
assert(
    encontrarChaveParaTexto('isonomia') === null,
    'case-sensitive: "isonomia" minúsculo não encontra "Isonomia"'
);

// Múltiplas materias: encontra na segunda
const editalDuasMaterias = {
    edital: [
        { materia: 'Direito', topicos: [{ nome: 'T1', subtopicos: ['Sub-Direito'] }] },
        { materia: 'Contabilidade', topicos: [{ nome: 'T2', subtopicos: ['Balanço'] }] },
    ]
};
global.planoAdotado = editalDuasMaterias;
assert(
    encontrarChaveParaTexto('Balanço') === 'Contabilidade|T2|Balanço',
    'múltiplas materias: encontra na segunda materia'
);

// ── Resolução por nome da aula no curso (curso_nome) ─────────────────────────
console.log('\nencontrarChaveParaTexto — curso_nome:');

global.planoAdotado = {
    edital: [
        {
            materia: 'Contabilidade',
            topicos: [
                {
                    nome: 'Demonstrações Contábeis',
                    curso_nome: 'Aula 03 - DFC e DRE',
                    subtopicos: [
                        { nome: 'Balanço Patrimonial', curso_nome: 'Aula 01 - Balanço (Estratégia)' },
                        'DRE'
                    ]
                },
                { nome: 'Provisões', curso_nome: 'Aula 07 - Provisões e Passivos', subtopicos: [] }
            ]
        }
    ]
};

assert(
    encontrarChaveParaTexto('Aula 01 - Balanço (Estratégia)') === 'Contabilidade|Demonstrações Contábeis|Balanço Patrimonial',
    'subtópico por curso_nome: chave usa o nome OFICIAL'
);
assert(
    encontrarChaveParaTexto('Balanço Patrimonial') === 'Contabilidade|Demonstrações Contábeis|Balanço Patrimonial',
    'subtópico por nome oficial continua funcionando'
);
assert(
    encontrarChaveParaTexto('Aula 07 - Provisões e Passivos') === 'Contabilidade|Provisões|',
    'tópico sem subtópicos por curso_nome: chave oficial'
);
assert(
    encontrarChaveParaTexto('DRE') === 'Contabilidade|Demonstrações Contábeis|DRE',
    'subtópico string (sem mapeamento) inalterado'
);

// ── Resumo ───────────────────────────────────────────────────────────────────
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
