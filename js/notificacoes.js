// ── Notificações in-app ──────────────────────────────────────────────────────

async function carregarNotificacoes() {
    if (!supabaseConfigurado()) return;
    const user = await getUsuarioLogado();
    if (!user) return;

    const { data, error } = await supabaseClient
        .from('notificacoes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

    if (error) {
        console.error('Erro ao carregar notificações:', error);
        return;
    }

    const notificacoes = data || [];
    const naoLidas = notificacoes.filter(n => !n.lido).length;

    const badge = document.getElementById('notificacaoBadge');
    const countEl = document.getElementById('notificacaoCount');
    if (naoLidas > 0) {
        badge.style.display = 'block';
        countEl.textContent = naoLidas > 9 ? '9+' : naoLidas;
    } else {
        badge.style.display = notificacoes.length > 0 ? 'block' : 'none';
        countEl.style.display = naoLidas > 0 ? 'flex' : 'none';
    }

    const lista = document.getElementById('notificacaoLista');
    if (notificacoes.length === 0) {
        lista.innerHTML = '<p style="text-align:center; color:#999; font-size:13px; padding:12px;">Nenhuma notificacao.</p>';
        return;
    }

    lista.innerHTML = '';
    notificacoes.forEach(n => {
        const div = document.createElement('div');
        div.style.cssText = `padding:8px 10px; border-radius:6px; margin-bottom:4px; font-size:13px; cursor:pointer; ${n.lido ? 'background:#f9f9f9; color:#888;' : 'background:#E8EAF6; color:#333; font-weight:500;'}`;
        const tempo = formatarTempoNotificacao(n.created_at);
        div.innerHTML = `<div>${n.mensagem}</div><div style="font-size:11px; color:#999; margin-top:2px;">${tempo}</div>`;
        if (!n.lido) {
            div.addEventListener('click', async () => {
                await marcarNotificacaoLida(n.id);
                div.style.background = '#f9f9f9';
                div.style.color = '#888';
                div.style.fontWeight = 'normal';
                n.lido = true;
                const restantes = notificacoes.filter(nn => !nn.lido).length;
                countEl.textContent = restantes > 9 ? '9+' : restantes;
                countEl.style.display = restantes > 0 ? 'flex' : 'none';
            });
        }
        lista.appendChild(div);
    });
}

async function marcarNotificacaoLida(id) {
    if (!supabaseConfigurado()) return;
    await supabaseClient
        .from('notificacoes')
        .update({ lido: true })
        .eq('id', id);
}

async function marcarTodasNotificacoesLidas() {
    if (!supabaseConfigurado()) return;
    const user = await getUsuarioLogado();
    if (!user) return;

    await supabaseClient
        .from('notificacoes')
        .update({ lido: true })
        .eq('user_id', user.id)
        .eq('lido', false);

    await carregarNotificacoes();
}

async function criarNotificacao(userId, tipo, mensagem) {
    if (!supabaseConfigurado()) return;

    const { error } = await supabaseClient
        .from('notificacoes')
        .insert({
            user_id: userId,
            tipo,
            mensagem,
            lido: false
        });

    if (error) {
        console.error('Erro ao criar notificação:', error);
    }
}

async function notificarAvancoFase(faseNova, nomesMaterias) {
    if (!supabaseConfigurado()) return;
    const user = await getUsuarioLogado();
    if (!user) return;

    const msg = `Você avançou para a Fase ${faseNova}! Novas matérias: ${nomesMaterias}`;
    await criarNotificacao(user.id, 'fase_avanco', msg);

    if (planoAdotado?.id) {
        const { data: atr } = await supabaseClient
            .from('plano_atribuicoes')
            .select('professor_id')
            .eq('aluno_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (atr?.professor_id) {
            const { data: perfil } = await supabaseClient
                .from('profiles')
                .select('nome')
                .eq('user_id', user.id)
                .maybeSingle();
            const nomeAluno = perfil?.nome || 'Aluno';
            const msgProf = `${nomeAluno} avançou para a Fase ${faseNova} (${nomesMaterias})`;
            await criarNotificacao(atr.professor_id, 'fase_avanco', msgProf);
        }
    }

    carregarNotificacoes();
}

function formatarTempoNotificacao(isoDate) {
    const diff = Date.now() - new Date(isoDate).getTime();
    const minutos = Math.floor(diff / 60000);
    if (minutos < 1) return 'Agora';
    if (minutos < 60) return `há ${minutos}min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `há ${horas}h`;
    const dias = Math.floor(horas / 24);
    return `há ${dias}d`;
}
