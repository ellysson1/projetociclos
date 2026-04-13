const CODIGO_PROFESSOR = 'prof2026@ciclo';

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
        const role = user.user_metadata?.role === 'professor' ? 'professor' : 'aluno';
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

async function promoverParaProfessor(userId) {
    const { error } = await supabaseClient
        .from('profiles')
        .update({ role: 'professor' })
        .eq('user_id', userId);

    if (error) {
        console.error('Erro ao promover para professor:', error);
        return false;
    }
    return true;
}

function atualizarUIRole() {
    const planosAluno = document.getElementById('planosAluno');
    const planosProfessor = document.getElementById('planosProfessor');

    if (isTeacher()) {
        if (planosAluno) planosAluno.style.display = 'none';
        if (planosProfessor) planosProfessor.style.display = 'block';
        renderizarListaPlanosProfessor();
    } else {
        if (planosAluno) planosAluno.style.display = 'block';
        if (planosProfessor) planosProfessor.style.display = 'none';
    }

    // Atualizar visibilidade da aba Edital
    if (typeof atualizarVisibilidadeEdital === 'function') {
        atualizarVisibilidadeEdital();
    }
}
