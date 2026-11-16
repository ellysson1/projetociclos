let currentProfile = null;

async function getProfile() {
    if (!supabaseConfigurado()) return null;
    const user = await getUsuarioLogado();
    if (!user) return null;

    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

    if (error) {
        console.error('Erro ao buscar profile:', error);
        return null;
    }
    return data;
}

function isTeacher() {
    return currentProfile && currentProfile.role === 'professor';
}

async function ensureProfile() {
    let profile = await getProfile();
    if (!profile) {
        const user = await getUsuarioLogado();
        if (!user) return null;
        // Toda conta nasce como aluno. O banco ignora qualquer outro valor
        // vindo do navegador (trigger impedir_auto_promocao); a promoção a
        // professor é feita pelo administrador direto no banco.
        const role = 'aluno';
        const nome = user.user_metadata?.nome || user.email.split('@')[0];
        const { error } = await supabaseClient
            .from('profiles')
            .upsert({
                user_id: user.id,
                role,
                nome
            }, { onConflict: 'user_id' });

        if (error) {
            console.error('Erro ao criar profile:', error);
            return null;
        }
        profile = await getProfile();
    }
    currentProfile = profile;
    return profile;
}

function atualizarUIRole() {
    const planosAluno = document.getElementById('planosAluno');
    const planosProfessor = document.getElementById('planosProfessor');
    const videosAluno = document.getElementById('videosAluno');
    const videosProfessor = document.getElementById('videosProfessor');

    // Aba Alunos: exclusiva do professor
    const tabAlunos = document.querySelector('.tab-container > .tab[data-tab="alunos"]');
    if (tabAlunos) tabAlunos.style.display = isTeacher() ? 'inline-block' : 'none';

    if (isTeacher()) {
        if (planosAluno) planosAluno.style.display = 'none';
        if (planosProfessor) planosProfessor.style.display = 'block';
        if (videosAluno) videosAluno.style.display = 'none';
        if (videosProfessor) videosProfessor.style.display = 'block';
        renderizarListaPlanosProfessor();
    } else {
        if (planosAluno) planosAluno.style.display = 'block';
        if (planosProfessor) planosProfessor.style.display = 'none';
        if (videosAluno) videosAluno.style.display = 'block';
        if (videosProfessor) videosProfessor.style.display = 'none';
    }

    if (typeof atualizarVisibilidadeEdital === 'function') {
        atualizarVisibilidadeEdital();
    }
}
