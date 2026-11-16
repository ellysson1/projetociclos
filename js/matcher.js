// ── T2: Matcher melhorado + normalização + IDs estáveis ──────────────────────
// Usado APENAS na reconciliação e na ordenação de buscas. Nenhuma
// comparação de nomes ocorre em tempo de leitura após a reconciliação.

const ABREVIACOES = {
    'dir': 'direito', 'adm': 'administrativo', 'admin': 'administrativo',
    'const': 'constitucional', 'trib': 'tributario', 'proc': 'processual',
    'afo': 'administracao financeira orcamentaria',
    'rlm': 'raciocinio logico matematico',
    'ctb': 'contabilidade', 'cf': 'constituicao federal',
    'ti': 'tecnologia informacao', 'info': 'informacao',
    'leg': 'legislacao', 'pen': 'penal', 'civ': 'civil',
    'emp': 'empresarial', 'amb': 'ambiental', 'prev': 'previdenciario',
    'trab': 'trabalho', 'eleit': 'eleitoral', 'int': 'internacional',
    'port': 'portugues', 'mat': 'matematica', 'rac': 'raciocinio',
    'econ': 'economia', 'cont': 'contabilidade', 'aud': 'auditoria',
    'cext': 'controle externo', 'cpub': 'contabilidade publica',
    'org': 'organizacao', 'admpub': 'administracao publica',
    'gp': 'gestao pessoas', 'gpp': 'gestao publica',
    'gest': 'gestao', 'fin': 'financeiro', 'orc': 'orcamentario'
};

const STOPWORDS_MATCHER = new Set([
    'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'ao', 'as', 'os',
    'em', 'na', 'no', 'nas', 'nos', 'com', 'por', 'para', 'que',
    'nocoes', 'legislacao', 'aplicada', 'geral', 'especial'
]);

function normalizarParaMatch(nome) {
    if (!nome) return [];
    return nome.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map(t => ABREVIACOES[t] || t)
        .join(' ').split(/\s+/)
        .filter(t => t && t.length > 1 && !STOPWORDS_MATCHER.has(t));
}

function _levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const m = Array.from({ length: a.length + 1 }, (_, i) => i);
    for (let j = 1; j <= b.length; j++) {
        let prev = m[0];
        m[0] = j;
        for (let i = 1; i <= a.length; i++) {
            const temp = m[i];
            m[i] = a[i - 1] === b[j - 1]
                ? prev
                : 1 + Math.min(prev, m[i], m[i - 1]);
            prev = temp;
        }
    }
    return m[a.length];
}

function scoreMatcher(nomeA, nomeB) {
    const a = normalizarParaMatch(nomeA);
    const b = normalizarParaMatch(nomeB);
    if (a.length === 0 || b.length === 0) return 0;

    const setA = new Set(a), setB = new Set(b);
    const inter = [...setA].filter(t => setB.has(t)).length;
    const jaccard = inter / (new Set([...setA, ...setB]).size || 1);

    const strA = a.join(' '), strB = b.join(' ');
    const maxLen = Math.max(strA.length, strB.length, 1);
    const lev = 1 - _levenshtein(strA, strB) / maxLen;

    return Math.max(jaccard, lev);
}

function rankCandidatas(nome, candidatas) {
    const scored = candidatas.map(c => ({
        candidata: c,
        score: scoreMatcher(nome, c.nome || c.materia || c)
    })).sort((a, b) => b.score - a.score);

    return scored.map((s, i) => ({
        ...s,
        gap: i === 0 && scored.length > 1 ? s.score - scored[1].score : s.score
    }));
}

function autoVinculavel(ranked) {
    if (!ranked.length) return false;
    return ranked[0].score >= 0.85 && ranked[0].gap >= 0.25;
}

// ── IDs estáveis para itens do edital ────────────────────────────────────────

function garantirIdsEdital(edital) {
    if (!Array.isArray(edital)) return edital;
    edital.forEach(materiaObj => {
        if (!materiaObj.id) materiaObj.id = typeof gerarUUID === 'function' ? gerarUUID() : _fallbackUUID();
        (materiaObj.topicos || []).forEach(topicoObj => {
            if (!topicoObj.id) topicoObj.id = typeof gerarUUID === 'function' ? gerarUUID() : _fallbackUUID();
            if (Array.isArray(topicoObj.subtopicos)) {
                topicoObj.subtopicos = topicoObj.subtopicos.map(sub => {
                    if (typeof sub === 'string') {
                        return { id: (typeof gerarUUID === 'function' ? gerarUUID() : _fallbackUUID()), nome: sub };
                    }
                    if (!sub.id) sub.id = typeof gerarUUID === 'function' ? gerarUUID() : _fallbackUUID();
                    return sub;
                });
            }
        });
    });
    return edital;
}

function _fallbackUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function nomeSubtopico(sub) {
    return typeof sub === 'string' ? sub : (sub?.nome || '');
}
