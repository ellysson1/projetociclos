// ── T11: LGPD — Exportar dados pessoais e excluir conta ─────────────────────

async function exportarDadosPessoais() {
    if (!supabaseConfigurado()) { alert('Supabase não configurado.'); return; }
    const user = await getUsuarioLogado();
    if (!user) { alert('Faça login para exportar seus dados.'); return; }

    const statusEl = document.getElementById('lgpdStatus');
    if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.background = '#E3F2FD';
        statusEl.style.color = '#1565C0';
        statusEl.textContent = 'Coletando seus dados...';
    }

    const tabelas = [
        'profiles',
        'progresso',
        'edital_progresso',
        'questoes',
        'plano_atribuicoes',
        'notificacoes',
        'videos_assistidos',
        'eventos_estudo'
    ];

    const dados = { exportado_em: new Date().toISOString(), usuario: { id: user.id, email: user.email } };

    for (const tabela of tabelas) {
        try {
            const { data, error } = await supabaseClient
                .from(tabela)
                .select('*')
                .eq('user_id', user.id);
            if (error) {
                dados[tabela] = { erro: error.message };
            } else {
                dados[tabela] = data || [];
            }
        } catch (e) {
            dados[tabela] = { erro: e.message };
        }
    }

    // Planos criados pelo professor
    try {
        const { data } = await supabaseClient
            .from('planos')
            .select('*')
            .eq('professor_id', user.id);
        dados.planos_criados = data || [];
    } catch (e) {
        dados.planos_criados = { erro: e.message };
    }

    // Estado local
    dados.estado_local = montarEstadoLocal();

    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meus-dados-${user.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    if (statusEl) {
        statusEl.style.background = '#E8F5E9';
        statusEl.style.color = '#2E7D32';
        statusEl.textContent = 'Dados exportados com sucesso!';
    }
}

async function excluirConta() {
    if (!supabaseConfigurado()) { alert('Supabase não configurado.'); return; }
    const user = await getUsuarioLogado();
    if (!user) { alert('Faça login para excluir sua conta.'); return; }

    const confirmacao1 = confirm(
        'ATENÇÃO: Esta ação é IRREVERSÍVEL.\n\n' +
        'Todos os seus dados serão permanentemente excluídos:\n' +
        '• Progresso de estudo\n' +
        '• Histórico de questões\n' +
        '• Progresso no edital\n' +
        '• Notificações\n' +
        '• Vídeos assistidos\n' +
        '• Eventos de estudo\n\n' +
        'Deseja continuar?'
    );
    if (!confirmacao1) return;

    const confirmacao2 = prompt(
        'Para confirmar, digite seu email (' + user.email + '):'
    );
    if (confirmacao2 !== user.email) {
        alert('Email não confere. Exclusão cancelada.');
        return;
    }

    const statusEl = document.getElementById('lgpdStatus');
    if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.background = '#FFF8E1';
        statusEl.style.color = '#E65100';
        statusEl.textContent = 'Excluindo seus dados...';
    }

    const tabelasUsuario = [
        'eventos_estudo',
        'videos_assistidos',
        'notificacoes',
        'questoes',
        'edital_progresso',
        'plano_atribuicoes',
        'progresso',
        'profiles'
    ];

    const erros = [];
    for (const tabela of tabelasUsuario) {
        try {
            const { error } = await supabaseClient
                .from(tabela)
                .delete()
                .eq('user_id', user.id);
            if (error) erros.push(`${tabela}: ${error.message}`);
        } catch (e) {
            erros.push(`${tabela}: ${e.message}`);
        }
    }

    // Excluir planos criados pelo professor
    try {
        const { error } = await supabaseClient
            .from('planos')
            .delete()
            .eq('professor_id', user.id);
        if (error) erros.push(`planos: ${error.message}`);
    } catch (e) {
        erros.push(`planos: ${e.message}`);
    }

    // Limpar dados locais
    localStorage.removeItem('cicloEstudosEstado');
    localStorage.removeItem('cicloSyncVersao');
    localStorage.removeItem('cicloDeviceId');

    if (erros.length > 0) {
        if (statusEl) {
            statusEl.style.background = '#FFEBEE';
            statusEl.style.color = '#C62828';
            statusEl.textContent = 'Alguns dados não puderam ser excluídos: ' + erros.join('; ');
        }
        return;
    }

    // Sign out
    await supabaseClient.auth.signOut();

    if (statusEl) {
        statusEl.style.background = '#E8F5E9';
        statusEl.style.color = '#2E7D32';
        statusEl.textContent = 'Conta excluída com sucesso. Redirecionando...';
    }

    alert('Sua conta e todos os seus dados foram excluídos permanentemente.');
    setTimeout(() => location.reload(), 1500);
}
