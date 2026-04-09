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
