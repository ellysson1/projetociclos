// Testes de segurança e correções de corretude (Lote 2)
//   escapeHtml / escapeJsString, merge de cicloNumero, import Excel numérico
// Executar: node tests/seguranca.test.js

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

const configCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'config.js'), 'utf8');
vm.runInThisContext(extrairBloco(configCode, 'escapeHtml'));
vm.runInThisContext(extrairBloco(configCode, 'escapeJsString'));

const syncCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'sync-engine.js'), 'utf8');
vm.runInThisContext(extrairBloco(syncCode, 'garantirIdsBlocos'));
vm.runInThisContext(extrairBloco(syncCode, 'mesclarEstados'));

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { passed++; console.log('  ✓ ' + msg); }
    else { failed++; console.error('  ✗ ' + msg); }
}

// ── escapeHtml ───────────────────────────────────────────────────────────────
console.log('\nescapeHtml:');

assert(escapeHtml('<script>alert(1)</script>') === '&lt;script&gt;alert(1)&lt;/script&gt;',
    'neutraliza tag <script>');
assert(escapeHtml('<img src=x onerror=alert(1)>') === '&lt;img src=x onerror=alert(1)&gt;',
    'neutraliza <img onerror> (vetor do audit)');
assert(escapeHtml('a"b') === 'a&quot;b', 'escapa aspas duplas (quebra de atributo)');
assert(escapeHtml("a'b") === 'a&#39;b', 'escapa aspas simples');
assert(escapeHtml('a&b') === 'a&amp;b', 'escapa & primeiro (sem dupla codificacao)');
assert(escapeHtml('&lt;') === '&amp;lt;', '& ja escapado vira &amp;lt; (sem loop)');
assert(escapeHtml(null) === '', 'null vira string vazia');
assert(escapeHtml(undefined) === '', 'undefined vira string vazia');
assert(escapeHtml(0) === '0', 'numero 0 preservado (nao vira vazio)');
assert(escapeHtml('Direito Constitucional') === 'Direito Constitucional',
    'texto normal passa intacto');
assert(escapeHtml('Lei d’Água') === 'Lei d’Água',
    'acentos e apostrofo tipografico intactos');

// ── escapeJsString ───────────────────────────────────────────────────────────
console.log('\nescapeJsString:');

assert(escapeJsString("Lei d'Água") === "Lei d\\'Água", 'escapa aspa simples (BUG 18)');
assert(escapeJsString('diz "oi"') === 'diz \\"oi\\"', 'escapa aspas duplas');
assert(escapeJsString('a\\b') === 'a\\\\b', 'escapa a propria barra invertida');
assert(escapeJsString('linha1\nlinha2') === 'linha1 linha2', 'quebra de linha vira espaco');
assert(escapeJsString(null) === '', 'null vira string vazia');

// A barra deve ser escapada ANTES das aspas, senao o escape se corrompe
assert(escapeJsString("a\\'b") === "a\\\\\\'b", 'ordem correta: barra antes das aspas');

// ── mesclarEstados: cicloNumero nunca regride (BUG 20) ──────────────────────
console.log('\nmesclarEstados — cicloNumero:');

const base = (ciclo, fase) => ({
    blocosAtivos: [],
    faseAtual: fase,
    cicloNumero: ciclo,
    revisoesContador: {},
    atualizadoEm: '2026-01-01T00:00:00.000Z'
});

// Dispositivo A completou o ciclo 3 offline; B (ciclo 2) salvou depois com
// versao maior. Sem o fix, o merge adotava base=B e o ciclo regredia para 2.
let m = mesclarEstados(base(3, 1), base(2, 1), 1, 5);
assert(m.cicloNumero === 3, `ciclo maior vence mesmo vindo do lado nao-base (obteve ${m.cicloNumero})`);

m = mesclarEstados(base(2, 1), base(7, 1), 5, 1);
assert(m.cicloNumero === 7, 'ciclo maior vence quando esta no servidor');

m = mesclarEstados(base(4, 1), base(4, 1), 1, 1);
assert(m.cicloNumero === 4, 'ciclos iguais: mantem o valor');

// Fase continua com a mesma regra
m = mesclarEstados(base(1, 3), base(1, 2), 1, 5);
assert(m.faseAtual === 3, 'fase maior vence (regra preexistente preservada)');

// ── Conclusão de bloco nunca é desfeita pelo merge ──────────────────────────
console.log('\nmesclarEstados — conclusoes:');

const comBlocos = (concluido, ciclo) => ({
    blocosAtivos: [{ id: 'b0-POR', legenda: 'POR', concluido, assunto: concluido ? 'Crase' : null }],
    faseAtual: 1,
    cicloNumero: ciclo,
    revisoesContador: {},
    atualizadoEm: '2026-01-01T00:00:00.000Z'
});

m = mesclarEstados(comBlocos(false, 1), comBlocos(true, 1), 1, 5);
assert(m.blocosAtivos[0].concluido === true, 'conclusao do outro lado e preservada (uniao)');
assert(m.blocosAtivos[0].assunto === 'Crase', 'assunto vem junto com a conclusao');

m = mesclarEstados(comBlocos(true, 1), comBlocos(false, 1), 1, 5);
assert(m.blocosAtivos[0].concluido === true, 'servidor sem conclusao nao desfaz a local');

// ── Import Excel: células numéricas (BUG 17) ────────────────────────────────
console.log('\nImport Excel — celulas numericas:');

// Reproduz o helper _txt usado em converterLinhasParaEdital
const _txt = v => String(v ?? '').trim();

assert(_txt(101) === '101', 'numero vira string (antes: TypeError em .trim())');
assert(_txt('  Direito  ') === 'Direito', 'string com espacos e aparada');
assert(_txt(null) === '', 'null vira vazio');
assert(_txt(undefined) === '', 'undefined vira vazio');
assert(_txt(0) === '0', 'zero preservado');
assert(parseInt(_txt(3), 10) === 3, 'ordem numerica continua parseavel');

// Garante que o codigo real usa o helper (guarda contra regressao)
const editalCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'edital.js'), 'utf8');
assert(editalCode.includes("const _txt = v => String(v ?? '').trim()"),
    'converterLinhasParaEdital usa o helper _txt');

// ── Guardas de regressao no codigo-fonte ────────────────────────────────────
console.log('\nGuardas de regressao:');

const planosCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'planos.js'), 'utf8');
assert(!/parseInt\([^)]*\)\s*\?\?/.test(planosCode),
    'planos.js nao usa mais `parseInt(...) ?? default` (BUG 13: gravava NaN)');
assert(planosCode.includes('Number.isFinite(cfg.intervaloEntreBlocos)'),
    'aplicacao no aluno filtra NaN vindo de atribuicoes antigas');
assert(planosCode.includes('atribuicaoEm'),
    'planos.js compara o carimbo da atribuicao (BUG 19)');

const supabaseSyncCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'supabase-sync.js'), 'utf8');
assert(supabaseSyncCode.includes("errSel.code === '42703'"),
    'fallback legado so dispara em undefined_column (BUG 10)');

const timerCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'timer.js'), 'utf8');
assert(timerCode.includes('if (cronometroRodando) return;'),
    '_tentarResumir tem guarda contra interval duplicado (BUG 12)');
assert(timerCode.includes('pausaInicioEm'),
    'timer persiste o estado pausado (BUG 11)');

const editalSrc = editalCode;
assert(!editalSrc.includes('onchange="alterarStatusEdital'),
    'edital.js nao usa mais handler inline com nome interpolado (BUG 18/XSS)');

const videosCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'videos.js'), 'utf8');
assert(videosCode.includes('rel="noopener noreferrer"'),
    'links externos de video tem rel=noopener');

// ── Resumo ───────────────────────────────────────────────────────────────────
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
