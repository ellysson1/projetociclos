const SUPABASE_URL = 'https://znkxhacjuejmxhgcaqvz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ULAmkcVfbsAzJ6tRCQJarQ_WGMbMaTo';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function supabaseConfigurado() {
    return SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('COLE_AQUI') && !SUPABASE_ANON_KEY.includes('COLE_AQUI');
}

function getBaseUrl() {
    const path = window.location.pathname || '';
    return path.endsWith('/') ? path : path.replace(/[^/]+$/, '');
}

// ── Escape de HTML ──────────────────────────────────────────────────────────
// Todo dado vindo do banco (nomes de matérias, planos, alunos, vídeos,
// notificações, itens de edital) é editável por usuários e pode ser
// renderizado no navegador de OUTRO usuário (professor vê dados de aluno e
// vice-versa). Sem escape, um nome com `<img onerror=...>` executa script na
// sessão da vítima. Use SEMPRE ao interpolar texto em innerHTML.
function escapeHtml(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor).replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[c]);
}

// Escape para uso dentro de atributos de string em handlers inline
// (onclick="fn('...')"). Evita que aspas em nomes quebrem o JS gerado.
function escapeJsString(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\r?\n/g, ' ');
}
