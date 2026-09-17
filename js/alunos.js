// ── Aba Alunos (professor) ──────────────────────────────────────────────────
// Visão consolidada de todos os alunos com plano atribuído por este professor:
// perfil de acesso, nível de conteúdo, plano e última atividade.
//
// Restrição de RLS: o professor tem SELECT (somente leitura) sobre `progresso`
// dos alunos — não pode escrever `tipoPerfil` direto na conta do aluno. Por
// isso o perfil definido aqui é gravado em `plano_atribuicoes.configuracoes`
// (linha do professor) e aplicado no aluno em verificarEAplicarPlanoAtribuido,
// exatamente como já acontece com `nivel_conteudo`.

const PERFIS_ALUNO = [
    { valor: 'autodidata', rotulo: 'Autodidata', desc: 'Configura o próprio ciclo; vê abas Planos, Variáveis e Ajustes.' },
    { valor: 'curso', rotulo: 'Curso preparatório', desc: 'Adota o plano de um curso e escolhe o nível.' },
    { valor: 'mentoria', rotulo: 'Mentoria', desc: 'Você configura tudo; o aluno só estuda e reporta progresso.' }
];

const NIVEIS_CONTEUDO = [
    { valor: 'basico', rotulo: 'Básico (6 matérias)' },
    { valor: 'intermediario', rotulo: 'Intermediário (12 matérias)' },
    { valor: 'avancado', rotulo: 'Avançado (todas)' }
];

function _rotuloPerfil(valor) {
    return PERFIS_ALUNO.find(p => p.valor === valor)?.rotulo || 'Não definido';
}

async function renderizarAbaAlunos() {
    const container = document.getElementById('alunosConteudo');
    if (!container) return;
    if (typeof isTeacher !== 'function' || !isTeacher()) {
        container.innerHTML = '';
        return;
    }

    container.textContent = 'Carregando alunos...';

    const user = await getUsuarioLogado();
    if (!user) { container.textContent = 'Faça login para ver seus alunos.'; return; }

    const { data: atribuicoes, error } = await supabaseClient
        .from('plano_atribuicoes')
        .select('aluno_id, plano_id, configuracoes, updated_at, created_at, planos(nome)')
        .eq('professor_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erro ao carregar alunos:', error);
        container.innerHTML = '';
        const err = document.createElement('p');
        err.style.cssText = 'color:#C62828;';
        err.textContent = 'Não foi possível carregar os alunos. Verifique sua conexão e tente novamente.';
        container.appendChild(err);
        return;
    }

    if (!atribuicoes || atribuicoes.length === 0) {
        container.innerHTML = '';
        const vazio = document.createElement('p');
        vazio.style.cssText = 'color:#999;';
        vazio.textContent = 'Nenhum aluno com plano atribuído ainda. Vá em Planos → Atribuir para vincular um aluno.';
        container.appendChild(vazio);
        return;
    }

    const alunoIds = [...new Set(atribuicoes.map(a => a.aluno_id))];

    const [profilesResp, progressoResp] = await Promise.all([
        supabaseClient.from('profiles').select('user_id, nome').in('user_id', alunoIds),
        supabaseClient.from('progresso').select('user_id, estado, updated_at').in('user_id', alunoIds)
    ]);

    if (progressoResp.error) console.warn('Alunos: erro ao ler progresso (provável RLS):', progressoResp.error);

    const nomes = {};
    (profilesResp.data || []).forEach(p => { nomes[p.user_id] = p.nome || 'Aluno'; });

    const progressos = {};
    (progressoResp.data || []).forEach(p => { progressos[p.user_id] = p; });

    container.innerHTML = '';
    atribuicoes.forEach(atr => {
        container.appendChild(_criarCardAluno(atr, nomes, progressos));
    });
}

function _criarCardAluno(atr, nomes, progressos) {
    const uid = atr.aluno_id;
    const cfg = atr.configuracoes || {};
    const prog = progressos[uid];
    const estado = prog?.estado || {};

    // Perfil efetivo: o que o professor definiu na atribuição tem precedência;
    // se nunca foi definido, mostra o que o aluno escolheu no próprio onboarding.
    const perfilAtribuido = cfg.tipo_perfil || null;
    const perfilAluno = estado.tipoPerfil || null;
    const perfilEfetivo = perfilAtribuido || perfilAluno;
    const nivelAtual = cfg.nivel_conteudo || estado.nivelConteudo || 'avancado';

    const card = document.createElement('div');
    card.style.cssText = 'border:1px solid var(--border-color); border-radius:8px; padding:14px; margin-bottom:10px; background:white;';

    // Cabeçalho: nome + plano (textContent — nomes são editáveis por usuários)
    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;';

    const esquerda = document.createElement('div');
    const nomeEl = document.createElement('strong');
    nomeEl.style.cssText = 'font-size:15px;';
    nomeEl.textContent = nomes[uid] || uid.substring(0, 8);
    esquerda.appendChild(nomeEl);

    const planoEl = document.createElement('div');
    planoEl.style.cssText = 'font-size:12px; color:#666; margin-top:2px;';
    planoEl.textContent = 'Plano: ' + (atr.planos?.nome || '(plano removido)');
    esquerda.appendChild(planoEl);
    header.appendChild(esquerda);

    const direita = document.createElement('div');
    direita.style.cssText = 'text-align:right;';
    const badge = document.createElement('span');
    badge.style.cssText = 'font-size:12px; color:white; background:#3F51B5; padding:2px 10px; border-radius:10px;';
    badge.textContent = _rotuloPerfil(perfilEfetivo);
    direita.appendChild(badge);

    const atividade = document.createElement('div');
    atividade.style.cssText = 'font-size:12px; color:#999; margin-top:4px;';
    atividade.textContent = 'Atividade: ' + (prog?.updated_at && typeof formatarTempoAtras === 'function'
        ? formatarTempoAtras(prog.updated_at)
        : 'Nunca');
    direita.appendChild(atividade);
    header.appendChild(direita);
    card.appendChild(header);

    // Aviso quando o aluno escolheu um perfil diferente do atribuído
    if (perfilAtribuido && perfilAluno && perfilAtribuido !== perfilAluno) {
        const aviso = document.createElement('div');
        aviso.style.cssText = 'font-size:12px; color:#E65100; background:#FFF8E1; border:1px solid #FFE0B2; border-radius:6px; padding:6px 10px; margin-bottom:10px;';
        aviso.textContent = `O aluno ainda está com o perfil "${_rotuloPerfil(perfilAluno)}". O novo perfil é aplicado no próximo acesso dele.`;
        card.appendChild(aviso);
    }

    // Controles
    const controles = document.createElement('div');
    controles.style.cssText = 'display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end;';

    const grupoPerfil = _criarGrupoSelect('Perfil de acesso', PERFIS_ALUNO, perfilEfetivo || 'mentoria');
    const grupoNivel = _criarGrupoSelect('Nível de conteúdo', NIVEIS_CONTEUDO, nivelAtual);
    controles.appendChild(grupoPerfil.wrapper);
    controles.appendChild(grupoNivel.wrapper);

    const btnSalvar = document.createElement('button');
    btnSalvar.type = 'button';
    btnSalvar.textContent = 'Salvar';
    btnSalvar.style.cssText = 'font-size:13px; padding:7px 18px; background:#4CAF50; color:white; border:none; border-radius:6px; cursor:pointer;';
    controles.appendChild(btnSalvar);
    card.appendChild(controles);

    // Descrição do perfil selecionado
    const descPerfil = document.createElement('div');
    descPerfil.style.cssText = 'font-size:12px; color:#888; margin-top:8px;';
    const atualizarDesc = () => {
        descPerfil.textContent = PERFIS_ALUNO.find(p => p.valor === grupoPerfil.select.value)?.desc || '';
    };
    atualizarDesc();
    grupoPerfil.select.addEventListener('change', atualizarDesc);
    card.appendChild(descPerfil);

    btnSalvar.addEventListener('click', async () => {
        btnSalvar.disabled = true;
        const textoOriginal = btnSalvar.textContent;
        btnSalvar.textContent = 'Salvando...';
        const ok = await salvarPerfilAluno(uid, atr.plano_id, grupoPerfil.select.value, grupoNivel.select.value);
        btnSalvar.disabled = false;
        btnSalvar.textContent = textoOriginal;
        if (ok) {
            alert('Perfil atualizado. As mudanças aparecem para o aluno no próximo acesso dele.');
            renderizarAbaAlunos();
        } else {
            alert('Não foi possível salvar. Verifique sua conexão e tente novamente.');
        }
    });

    return card;
}

function _criarGrupoSelect(rotulo, opcoes, valorAtual) {
    const wrapper = document.createElement('div');
    const label = document.createElement('label');
    label.style.cssText = 'display:block; font-size:12px; color:#666; margin-bottom:4px;';
    label.textContent = rotulo;
    wrapper.appendChild(label);

    const select = document.createElement('select');
    select.style.cssText = 'font-size:13px; padding:6px 10px; border:1px solid var(--border-color); border-radius:6px; background:white;';
    opcoes.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.valor;
        opt.textContent = o.rotulo;
        if (o.valor === valorAtual) opt.selected = true;
        select.appendChild(opt);
    });
    wrapper.appendChild(select);
    return { wrapper, select };
}

// Merge preservando o restante da configuração da atribuição (blocos por
// matéria, horas semanais, duração...). Função pura para ser testável.
function _mesclarConfigPerfil(cfgAtual, tipoPerfilNovo, nivelNovo) {
    return { ...(cfgAtual || {}), tipo_perfil: tipoPerfilNovo, nivel_conteudo: nivelNovo };
}

// Grava o perfil/nível na atribuição do professor (não na conta do aluno —
// RLS não permite). O aluno recebe no próximo carregamento.
async function salvarPerfilAluno(alunoId, planoId, tipoPerfilNovo, nivelNovo) {
    if (!supabaseConfigurado()) return false;
    const user = await getUsuarioLogado();
    if (!user) return false;

    const { data: atual, error: errLer } = await supabaseClient
        .from('plano_atribuicoes')
        .select('configuracoes')
        .eq('plano_id', planoId)
        .eq('aluno_id', alunoId)
        .maybeSingle();

    if (errLer) {
        console.error('Erro ao ler atribuição:', errLer);
        return false;
    }

    const cfg = _mesclarConfigPerfil(atual?.configuracoes, tipoPerfilNovo, nivelNovo);

    const { error } = await supabaseClient
        .from('plano_atribuicoes')
        .update({ configuracoes: cfg, updated_at: new Date().toISOString() })
        .eq('plano_id', planoId)
        .eq('aluno_id', alunoId);

    if (error) {
        console.error('Erro ao salvar perfil do aluno:', error);
        return false;
    }
    return true;
}
