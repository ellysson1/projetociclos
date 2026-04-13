async function salvarEstadoNuvem() {
    if (!supabaseConfigurado()) return;
    const user = await getUsuarioLogado();
    if (!user) return;

    const estado = {
        materiasList,
        materiasSelecionadas,
        blocosAtivos,
        tempoDecorrido,
        modoCronometro,
        configuracoes,
        horasSemanais: document.getElementById('horasSemanais')?.value || null
    };

    const { error } = await supabaseClient
        .from('progresso')
        .upsert({
            user_id: user.id,
            estado,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

    if (error) {
        console.error('Erro ao salvar na nuvem:', error);
    }
}

async function carregarEstadoNuvem() {
    if (!supabaseConfigurado()) return;
    const user = await getUsuarioLogado();
    if (!user) return;

    const { data, error } = await supabaseClient
        .from('progresso')
        .select('estado, anotacoes')
        .eq('user_id', user.id)
        .maybeSingle();

    if (error) {
        console.error('Erro ao carregar da nuvem:', error);
        return;
    }
    if (!data) {
        document.getElementById('inicio').style.display = 'block';
        document.getElementById('continuar').style.display = 'none';
        return;
    }

    if (data.estado) {
        materiasList = data.estado.materiasList || materiasList;
        materiasSelecionadas = data.estado.materiasSelecionadas || [];
        blocosAtivos = data.estado.blocosAtivos || [];
        tempoDecorrido = data.estado.tempoDecorrido || 0;
        modoCronometro = data.estado.modoCronometro ?? true;
        configuracoes = data.estado.configuracoes || configuracoes;

        if (data.estado.horasSemanais) {
            document.getElementById('horasSemanais').value = data.estado.horasSemanais;
        }

        inicializarSelecaoMaterias();
        carregarConfiguracoes();
        if (blocosAtivos.length > 0) {
            document.getElementById('inicio').style.display = 'none';
            document.getElementById('continuar').style.display = 'block';
        } else {
            document.getElementById('inicio').style.display = 'block';
            document.getElementById('continuar').style.display = 'none';
        }
    }

    // anotacoes field kept in DB for backwards compatibility but no longer used in UI
}
