function setAuthStatus(msg, isError = false) {
    const el = document.getElementById('authStatus');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? '#C62828' : '#2E7D32';
}

async function getUsuarioLogado() {
    if (!supabaseConfigurado()) return null;
    const { data, error } = await supabaseClient.auth.getUser();
    if (error) {
        console.error(error);
        return null;
    }
    return data.user || null;
}

async function redirecionarParaLogin() {
    const base = getBaseUrl();
    window.location.href = base + 'login.html';
}

async function sair() {
    if (!supabaseConfigurado()) return;
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        console.error(error);
        return;
    }
    const base = getBaseUrl();
    window.location.href = base + 'login.html';
}

async function atualizarUIAuth() {
    const user = await getUsuarioLogado();
    const logado = !!user;
    const usuarioInfo = document.getElementById('usuarioInfo');
    const btnIrLogin = document.getElementById('btnIrLogin');
    const btnLogoutTop = document.getElementById('btnLogoutTop');
    const bloqueioAuth = document.getElementById('bloqueioAuth');

    if (usuarioInfo) {
        usuarioInfo.textContent = logado ? `Logado como ${user.email}` : 'Você não está logado.';
    }
    if (btnIrLogin) btnIrLogin.style.display = logado ? 'none' : 'inline-block';
    if (btnLogoutTop) btnLogoutTop.style.display = logado ? 'inline-block' : 'none';
    if (bloqueioAuth) bloqueioAuth.style.display = logado ? 'none' : 'block';

    const abas = document.querySelector('.tab-container');
    const homeInicio = document.getElementById('inicio');
    const homeContinuar = document.getElementById('continuar');

    if (abas) abas.style.display = logado ? 'flex' : 'none';
    if (!logado) {
        if (homeInicio) homeInicio.style.display = 'none';
        if (homeContinuar) homeContinuar.style.display = 'none';
        alternarAba('home');
    }
    return logado;
}
