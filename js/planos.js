// ── Gerenciamento de Planos (Professor) ─────────────────────────────────────

async function carregarPlanosPublicos() {
    if (!supabaseConfigurado()) return [];
    const { data, error } = await supabaseClient
        .from('planos')
        .select('*')
        .eq('publico', true)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erro ao carregar planos:', error);
        return [];
    }
    return data || [];
}

async function carregarPlanosProfessor() {
    if (!supabaseConfigurado()) return [];
    const user = await getUsuarioLogado();
    if (!user) return [];

    const { data, error } = await supabaseClient
        .from('planos')
        .select('*')
        .eq('professor_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erro ao carregar planos do professor:', error);
        return [];
    }
    return data || [];
}

async function salvarPlano(plano) {
    if (!supabaseConfigurado()) return null;
    const user = await getUsuarioLogado();
    if (!user) return null;

    const dados = {
        professor_id: user.id,
        nome: plano.nome,
        descricao: plano.descricao || '',
        materias: plano.materias || [],
        configuracoes: plano.configuracoes || {},
        edital: plano.edital || null,
        regras_evolucao: plano.regras_evolucao || [],
        publico: plano.publico !== false
    };

    if (plano.id) {
        const { data, error } = await supabaseClient
            .from('planos')
            .update(dados)
            .eq('id', plano.id)
            .eq('professor_id', user.id)
            .select()
            .maybeSingle();
        if (error) { console.error('Erro ao atualizar plano:', error); return null; }
        return data;
    } else {
        const { data, error } = await supabaseClient
            .from('planos')
            .insert(dados)
            .select()
            .maybeSingle();
        if (error) { console.error('Erro ao criar plano:', error); return null; }
        return data;
    }
}

async function excluirPlano(planoId) {
    if (!supabaseConfigurado()) return false;
    const user = await getUsuarioLogado();
    if (!user) return false;

    const { error } = await supabaseClient
        .from('planos')
        .delete()
        .eq('id', planoId)
        .eq('professor_id', user.id);

    if (error) { console.error('Erro ao excluir plano:', error); return false; }
    return true;
}

// ── UI do Professor: Aba Planos ─────────────────────────────────────────────

async function renderizarListaPlanosProfessor() {
    const container = document.getElementById('planosLista');
    if (!container) return;
    container.innerHTML = '<p style="color:#999;">Carregando planos...</p>';

    const planos = await carregarPlanosProfessor();

    if (planos.length === 0) {
        container.innerHTML = '<p style="color:#999;">Nenhum plano criado ainda.</p>';
        return;
    }

    container.innerHTML = '';
    planos.forEach(plano => {
        const card = document.createElement('div');
        card.style.cssText = 'border:1px solid var(--border-color); border-radius:8px; padding:16px; margin-bottom:12px; background:white;';
        const materiasCount = (plano.materias || []).length;
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:start; gap:12px;">
                <div>
                    <strong style="font-size:16px;">${plano.nome}</strong>
                    <p style="font-size:13px; color:#666; margin-top:4px;">${plano.descricao || 'Sem descrição'}</p>
                    <p style="font-size:12px; color:#999; margin-top:4px;">${materiasCount} matéria(s) | ${plano.publico ? 'Público' : 'Privado'}</p>
                </div>
                <div style="display:flex; gap:8px; flex-shrink:0; flex-wrap:wrap;">
                    <button class="btn-atribuir-plano" data-id="${plano.id}" style="font-size:12px; padding:6px 12px; background:#7C4DFF; color:white; border:none; border-radius:6px; cursor:pointer;">Atribuir</button>
                    <button class="btn-editar-plano" data-id="${plano.id}" style="font-size:12px; padding:6px 12px;">Editar</button>
                    <button class="btn-excluir-plano" data-id="${plano.id}" style="font-size:12px; padding:6px 12px; background:#FF6B6B;">Excluir</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    container.querySelectorAll('.btn-atribuir-plano').forEach(btn => {
        btn.addEventListener('click', () => {
            const plano = planos.find(p => p.id === btn.dataset.id);
            if (plano) abrirModalAtribuir(plano);
        });
    });
    container.querySelectorAll('.btn-editar-plano').forEach(btn => {
        btn.addEventListener('click', () => abrirEditorPlano(btn.dataset.id));
    });
    container.querySelectorAll('.btn-excluir-plano').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('Tem certeza que deseja excluir este plano?')) {
                await excluirPlano(btn.dataset.id);
                renderizarListaPlanosProfessor();
            }
        });
    });
}

// ── Atribuição de Plano a Aluno ────────────────────────────────────────────

let _atribuirPlano = null; // plano sendo atribuído

async function abrirModalAtribuir(plano) {
    _atribuirPlano = plano;

    const modal = document.getElementById('modalAtribuirPlano');
    document.getElementById('atribuirPlanoNome').textContent = `Plano: ${plano.nome}`;
    document.getElementById('atribuirStep1').style.display = 'block';
    document.getElementById('atribuirStep2').style.display = 'none';

    // Carregar alunos
    const select = document.getElementById('atribuirAlunoSelect');
    select.innerHTML = '<option value="">Carregando...</option>';
    modal.classList.add('active');

    const { data: alunos, error } = await supabaseClient
        .from('profiles')
        .select('user_id, nome')
        .eq('role', 'aluno')
        .order('nome');

    if (error || !alunos || alunos.length === 0) {
        select.innerHTML = '<option value="">Nenhum aluno encontrado</option>';
        return;
    }

    select.innerHTML = '<option value="">Selecione um aluno...</option>';
    alunos.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.user_id;
        opt.textContent = a.nome || a.user_id;
        select.appendChild(opt);
    });
}

function fecharModalAtribuir() {
    document.getElementById('modalAtribuirPlano').classList.remove('active');
    _atribuirPlano = null;
}

function atribuirPassoNext() {
    const alunoId = document.getElementById('atribuirAlunoSelect').value;
    if (!alunoId) { alert('Selecione um aluno.'); return; }

    // Pré-preencher configs com valores do plano
    const cfg = _atribuirPlano.configuracoes || {};
    document.getElementById('atribuirDuracaoBloco').value = cfg.duracaoBloco || 60;
    document.getElementById('atribuirIntervalo').value = cfg.intervaloEntreBlocos ?? 5;
    document.getElementById('atribuirBlocosSessao').value = cfg.blocosPorSessao || 4;
    document.getElementById('atribuirHorasSemanais').value = cfg.horasSemanais || '';

    // Construir seletores de modo por matéria
    const container = document.getElementById('atribuirModosMateria');
    const materias = _atribuirPlano.materias || [];
    if (materias.length === 0) {
        container.innerHTML = '<p style="color:#999; font-size:13px; padding:8px;">Este plano não tem matérias definidas.</p>';
    } else {
        container.innerHTML = materias.map(m => `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-bottom:1px solid #f0f0f0;">
                <span style="font-size:14px; font-weight:600;">${m.legenda} <span style="color:#888; font-weight:400;">– ${m.nome}</span></span>
                <select class="atribuir-modo-select" data-legenda="${m.legenda}" style="font-size:13px; padding:4px 8px; border:1px solid var(--border-color); border-radius:6px;">
                    <option value="">Normal</option>
                    <option value="questoes">Só Questões</option>
                    <option value="revisao">Só Revisão</option>
                </select>
            </div>
        `).join('');
    }

    document.getElementById('atribuirStep1').style.display = 'none';
    document.getElementById('atribuirStep2').style.display = 'block';
}

function atribuirPassoBack() {
    document.getElementById('atribuirStep1').style.display = 'block';
    document.getElementById('atribuirStep2').style.display = 'none';
}

async function confirmarAtribuicao() {
    const alunoId = document.getElementById('atribuirAlunoSelect').value;
    if (!alunoId || !_atribuirPlano) return;

    const user = await getUsuarioLogado();
    if (!user) return;

    const configuracoes = {
        duracaoBloco: parseInt(document.getElementById('atribuirDuracaoBloco').value) || 60,
        intervaloEntreBlocos: parseInt(document.getElementById('atribuirIntervalo').value) ?? 5,
        blocosPorSessao: parseInt(document.getElementById('atribuirBlocosSessao').value) || 4,
        horasSemanais: parseInt(document.getElementById('atribuirHorasSemanais').value) || null
    };

    const modos_materia = {};
    document.querySelectorAll('.atribuir-modo-select').forEach(sel => {
        if (sel.value) modos_materia[sel.dataset.legenda] = sel.value;
    });

    const { error } = await supabaseClient
        .from('plano_atribuicoes')
        .upsert({
            plano_id: _atribuirPlano.id,
            professor_id: user.id,
            aluno_id: alunoId,
            configuracoes,
            modos_materia
        }, { onConflict: 'plano_id,aluno_id' });

    if (error) {
        console.error('Erro ao atribuir plano:', error);
        alert('Erro ao atribuir plano.');
        return;
    }

    const alunoNome = document.getElementById('atribuirAlunoSelect').selectedOptions[0]?.text || 'aluno';
    alert(`Plano atribuído a ${alunoNome} com sucesso!`);
    fecharModalAtribuir();
}

let planoEditando = null;

function abrirEditorPlano(planoId) {
    const editor = document.getElementById('planoEditor');
    const lista = document.getElementById('planosLista');
    const btnCriar = document.getElementById('btnCriarPlano');

    if (planoId) {
        carregarPlanosProfessor().then(planos => {
            planoEditando = planos.find(p => p.id === planoId) || null;
            preencherEditorPlano();
        });
    } else {
        planoEditando = null;
        preencherEditorPlano();
    }

    if (editor) editor.style.display = 'block';
    if (lista) lista.style.display = 'none';
    if (btnCriar) btnCriar.style.display = 'none';
}

function fecharEditorPlano() {
    const editor = document.getElementById('planoEditor');
    const lista = document.getElementById('planosLista');
    const btnCriar = document.getElementById('btnCriarPlano');

    if (editor) editor.style.display = 'none';
    if (lista) lista.style.display = 'block';
    if (btnCriar) btnCriar.style.display = 'inline-block';

    planoEditando = null;
    renderizarListaPlanosProfessor();
}

function preencherEditorPlano() {
    document.getElementById('planoNome').value = planoEditando?.nome || '';
    document.getElementById('planoDescricao').value = planoEditando?.descricao || '';
    document.getElementById('planoPublico').checked = planoEditando?.publico !== false;
    document.getElementById('planoDuracaoBloco').value = planoEditando?.configuracoes?.duracaoBloco || 60;
    document.getElementById('planoIntervalo').value = planoEditando?.configuracoes?.intervaloEntreBlocos || 5;
    document.getElementById('planoBlocosSessao').value = planoEditando?.configuracoes?.blocosPorSessao || 4;
    document.getElementById('planoHorasSemanais').value = planoEditando?.configuracoes?.horasSemanais || '';

    renderizarMateriasPlano(planoEditando?.materias || []);
    renderizarEditorEdital(planoEditando?.edital || []);
}

function renderizarMateriasPlano(materias) {
    const tbody = document.getElementById('planoMateriasTbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    materias.forEach((m, idx) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="text" value="${m.nome || ''}" data-field="nome" data-idx="${idx}" class="plano-materia-input" style="width:100%;"></td>
            <td><input type="text" value="${m.legenda || ''}" data-field="legenda" data-idx="${idx}" class="plano-materia-input" maxlength="3" style="width:60px;"></td>
            <td><input type="number" value="${m.peso || 5}" data-field="peso" data-idx="${idx}" class="plano-materia-input" min="1" max="10" style="width:60px;"></td>
            <td><input type="number" value="${m.extensao || 5}" data-field="extensao" data-idx="${idx}" class="plano-materia-input" min="1" max="10" style="width:60px;"></td>
            <td><input type="number" value="${m.dificuldade || 5}" data-field="dificuldade" data-idx="${idx}" class="plano-materia-input" min="1" max="10" style="width:60px;"></td>
            <td><button class="btn-remover-materia-plano" data-idx="${idx}" style="background:#FF6B6B; padding:4px 8px; font-size:12px;">&times;</button></td>
        `;
        tbody.appendChild(row);
    });

    tbody.querySelectorAll('.btn-remover-materia-plano').forEach(btn => {
        btn.addEventListener('click', () => {
            materias.splice(parseInt(btn.dataset.idx), 1);
            renderizarMateriasPlano(materias);
        });
    });
}

function coletarDadosPlano() {
    const tbody = document.getElementById('planoMateriasTbody');
    const rows = tbody.querySelectorAll('tr');
    const materias = [];

    rows.forEach(row => {
        const inputs = row.querySelectorAll('.plano-materia-input');
        const m = {};
        inputs.forEach(input => {
            const field = input.dataset.field;
            m[field] = field === 'nome' || field === 'legenda' ? input.value.trim() : (parseInt(input.value) || 5);
        });
        if (m.nome && m.legenda) materias.push(m);
    });

    return {
        id: planoEditando?.id || null,
        nome: document.getElementById('planoNome').value.trim(),
        descricao: document.getElementById('planoDescricao').value.trim(),
        publico: document.getElementById('planoPublico').checked,
        materias,
        configuracoes: {
            duracaoBloco: parseInt(document.getElementById('planoDuracaoBloco').value) || 60,
            intervaloEntreBlocos: parseInt(document.getElementById('planoIntervalo').value) || 5,
            blocosPorSessao: parseInt(document.getElementById('planoBlocosSessao').value) || 4,
            horasSemanais: parseInt(document.getElementById('planoHorasSemanais').value) || null
        },
        edital: coletarEditalDoEditor(),
        regras_evolucao: planoEditando?.regras_evolucao || []
    };
}

function adicionarMateriaAoPlano() {
    const tbody = document.getElementById('planoMateriasTbody');
    const rows = tbody.querySelectorAll('tr');
    const materias = [];
    rows.forEach(row => {
        const inputs = row.querySelectorAll('.plano-materia-input');
        const m = {};
        inputs.forEach(input => {
            const field = input.dataset.field;
            m[field] = field === 'nome' || field === 'legenda' ? input.value.trim() : (parseInt(input.value) || 5);
        });
        materias.push(m);
    });
    materias.push({ nome: '', legenda: '', peso: 5, extensao: 5, dificuldade: 5 });
    renderizarMateriasPlano(materias);
}

// ── UI do Aluno: Seleção de Planos ──────────────────────────────────────────

async function renderizarPlanosDisponiveis() {
    const container = document.getElementById('planosDisponiveis');
    if (!container) return;
    container.innerHTML = '<p style="color:#999;">Carregando...</p>';

    const user = await getUsuarioLogado();
    const [planos, atribuicoesResp] = await Promise.all([
        carregarPlanosPublicos(),
        user && supabaseConfigurado()
            ? supabaseClient.from('plano_atribuicoes').select('*, planos(*)').eq('aluno_id', user.id)
            : Promise.resolve({ data: [] })
    ]);

    const atribuicoes = atribuicoesResp.data || [];

    if (planos.length === 0 && atribuicoes.length === 0) {
        container.innerHTML = '<p style="color:#999;">Nenhum plano disponível no momento.</p>';
        return;
    }

    container.innerHTML = '';

    // Planos atribuídos pelo professor aparecem primeiro
    atribuicoes.forEach(atr => {
        const plano = atr.planos;
        if (!plano) return;
        const card = document.createElement('div');
        card.style.cssText = 'border:2px solid #7C4DFF; border-radius:8px; padding:14px; margin-bottom:10px; background:#F3E5FF; cursor:pointer; transition: box-shadow 0.2s;';
        card.onmouseenter = () => card.style.boxShadow = '0 2px 8px rgba(124,77,255,0.2)';
        card.onmouseleave = () => card.style.boxShadow = 'none';

        const materiasCount = (plano.materias || []).length;
        const cfg = atr.configuracoes || {};
        const modos = atr.modos_materia || {};
        const modosTexto = Object.entries(modos).map(([leg, modo]) =>
            `${leg}: ${modo === 'questoes' ? 'Só Questões' : 'Só Revisão'}`
        ).join(', ');

        card.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span style="background:#7C4DFF; color:white; font-size:10px; font-weight:700; padding:2px 8px; border-radius:10px; text-transform:uppercase;">Atribuído pelo Professor</span>
            </div>
            <strong style="font-size:15px; color:#5E35B1;">${plano.nome}</strong>
            <p style="font-size:13px; color:#666; margin:4px 0;">${plano.descricao || ''}</p>
            <p style="font-size:12px; color:#888;">${materiasCount} matéria(s)${cfg.horasSemanais ? ' | ' + cfg.horasSemanais + 'h/sem' : ''}${cfg.duracaoBloco ? ' | ' + cfg.duracaoBloco + 'min/bloco' : ''}</p>
            ${modosTexto ? `<p style="font-size:12px; color:#7C4DFF; margin-top:4px;">${modosTexto}</p>` : ''}
            <button class="btn-adotar-atribuido" data-atr-id="${atr.id}" style="margin-top:8px; font-size:13px; padding:6px 16px; background:#7C4DFF; color:white; border:none; border-radius:6px; cursor:pointer;">Adotar Este Plano</button>
        `;
        container.appendChild(card);
    });

    // Planos públicos
    const idsAtribuidos = new Set(atribuicoes.map(a => a.plano_id));
    planos.forEach(plano => {
        const card = document.createElement('div');
        card.style.cssText = 'border:1px solid var(--border-color); border-radius:8px; padding:14px; margin-bottom:10px; background:white; cursor:pointer; transition: box-shadow 0.2s;';
        card.onmouseenter = () => card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        card.onmouseleave = () => card.style.boxShadow = 'none';

        const materiasCount = (plano.materias || []).length;
        const profNome = plano.profiles?.nome || 'Professor';
        const cfg = plano.configuracoes || {};

        card.innerHTML = `
            <strong style="font-size:15px; color:var(--primary-color);">${plano.nome}</strong>
            <p style="font-size:13px; color:#666; margin:4px 0;">${plano.descricao || ''}</p>
            <p style="font-size:12px; color:#999;">Por: ${profNome} | ${materiasCount} matéria(s)${cfg.horasSemanais ? ' | ' + cfg.horasSemanais + 'h/sem' : ''}</p>
            <button class="btn-adotar-plano" data-id="${plano.id}" style="margin-top:8px; font-size:13px; padding:6px 16px; background:#4CAF50; color:white; border:none; border-radius:6px; cursor:pointer;">Adotar Este Plano</button>
        `;
        container.appendChild(card);
    });

    container.querySelectorAll('.btn-adotar-atribuido').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const atrId = btn.dataset.atrId;
            const atr = atribuicoes.find(a => a.id === atrId);
            if (atr) adotarPlano(atr.plano_id, atr);
        });
    });

    container.querySelectorAll('.btn-adotar-plano').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            adotarPlano(btn.dataset.id);
        });
    });
}

async function verificarEAplicarPlanoAtribuido() {
    if (!supabaseConfigurado()) return;
    const user = await getUsuarioLogado();
    if (!user || (typeof isTeacher === 'function' && isTeacher())) return;

    const { data: atribuicoes, error } = await supabaseClient
        .from('plano_atribuicoes')
        .select('*, planos(*)')
        .eq('aluno_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

    if (error || !atribuicoes?.length) return;

    const atr = atribuicoes[0];
    const plano = atr.planos;
    if (!plano) return;

    // Skip if student already has this plan applied
    if (planoAdotado?.id === plano.id) return;

    // Apply plan reference
    planoAdotado = { id: plano.id, nome: plano.nome, edital: plano.edital || null };

    // Apply materias (list only, don't touch blocosAtivos)
    const materiasDoPlano = plano.materias || [];
    materiasList = materiasDoPlano.map(m => ({ nome: m.nome, legenda: m.legenda }));

    // Merge configs (plan defaults < atribuicao overrides)
    const cfg = { ...(plano.configuracoes || {}), ...(atr.configuracoes || {}) };
    if (cfg.duracaoBloco) configuracoes.duracaoBloco = cfg.duracaoBloco;
    if (cfg.intervaloEntreBlocos !== undefined) configuracoes.intervaloEntreBlocos = cfg.intervaloEntreBlocos;
    if (cfg.blocosPorSessao) configuracoes.blocosPorSessao = cfg.blocosPorSessao;

    // Apply subject modes
    modosMateria = atr.modos_materia || {};

    // Refresh UI
    inicializarSelecaoMaterias();
    carregarConfiguracoes();

    // Update edital
    if (typeof atualizarVisibilidadeEdital === 'function') atualizarVisibilidadeEdital();
    if (planoAdotado.edital && typeof carregarEditalProgresso === 'function') {
        await carregarEditalProgresso();
        if (typeof renderizarEdital === 'function') renderizarEdital();
    }

    // If no active cycle, generate one from the plan
    if ((!blocosAtivos || blocosAtivos.length === 0) && materiasDoPlano.length > 0 && cfg.horasSemanais) {
        const horasSemanais = cfg.horasSemanais;
        document.getElementById('horasSemanais').value = horasSemanais;

        const minutosTotais = horasSemanais * 60;
        const totalBlocos = Math.floor(minutosTotais / (configuracoes.duracaoBloco || 60));

        coresUsadas = [];
        let totalPonderado = 0;
        const blocos = materiasDoPlano.map(m => {
            const vp = (m.peso || 5) * 0.5 + (m.extensao || 5) * 0.25 + (m.dificuldade || 5) * 0.25;
            totalPonderado += vp;
            return { ...m, cor: gerarCorUnica(), valorPonderado: vp };
        });

        let allocated = 0;
        blocos.forEach((b, idx) => {
            if (idx === blocos.length - 1) {
                b.quantidadeBlocos = Math.max(1, totalBlocos - allocated);
            } else {
                b.quantidadeBlocos = Math.max(1, Math.ceil((b.valorPonderado / totalPonderado) * totalBlocos));
                if (allocated + b.quantidadeBlocos > totalBlocos) b.quantidadeBlocos = Math.max(1, totalBlocos - allocated);
            }
            allocated += b.quantidadeBlocos;
        });

        materiasSelecionadas = blocos;
        blocosAtivos = distribuirBlocosAleatoriamente(blocos);
        exibirCicloVisual(blocosAtivos);
        alternarAba('meuciclo');
    }

    salvarEstado();
}

async function adotarPlano(planoId, atribuicao = null) {
    // Busca o plano (em planos públicos ou via atribuição)
    let plano = null;
    if (atribuicao?.planos) {
        plano = atribuicao.planos;
    } else {
        const planos = await carregarPlanosPublicos();
        plano = planos.find(p => p.id === planoId);
    }
    if (!plano) { alert('Plano não encontrado.'); return; }

    if (!confirm(`Deseja adotar o plano "${plano.nome}"? Suas configurações atuais serão substituídas.`)) return;

    // Salvar referência ao plano adotado
    planoAdotado = {
        id: plano.id,
        nome: plano.nome,
        edital: plano.edital || null
    };

    // Aplicar matérias do plano
    const materiasDoPlano = plano.materias || [];
    materiasList = materiasDoPlano.map(m => ({ nome: m.nome, legenda: m.legenda }));
    coresUsadas = [];
    materiasSelecionadas = materiasDoPlano.map(m => ({
        ...m,
        cor: gerarCorUnica()
    }));

    // Aplicar configurações do plano, depois sobrescrever com as da atribuição se existir
    const cfgPlano = plano.configuracoes || {};
    const cfgAtrib = atribuicao?.configuracoes || {};
    const cfg = { ...cfgPlano, ...cfgAtrib };

    if (cfg.duracaoBloco) configuracoes.duracaoBloco = cfg.duracaoBloco;
    if (cfg.intervaloEntreBlocos !== undefined) configuracoes.intervaloEntreBlocos = cfg.intervaloEntreBlocos;
    if (cfg.blocosPorSessao) configuracoes.blocosPorSessao = cfg.blocosPorSessao;
    if (cfg.horasSemanais) document.getElementById('horasSemanais').value = cfg.horasSemanais;

    // Aplicar modos de matéria da atribuição
    modosMateria = atribuicao?.modos_materia || {};

    // Atualizar UI
    inicializarSelecaoMaterias();
    carregarConfiguracoes();
    document.getElementById('duracaoBloco').value = configuracoes.duracaoBloco;
    document.getElementById('intervaloEntreBlocos').value = configuracoes.intervaloEntreBlocos;
    document.getElementById('blocosPorSessao').value = configuracoes.blocosPorSessao;

    // Preencher variáveis e ir para ajustes
    preencherTabelaVariaveis();

    // Pré-preencher pesos do plano
    materiasDoPlano.forEach(m => {
        const pesoInput = document.getElementsByName(`peso-${m.legenda}`)[0];
        const extInput = document.getElementsByName(`extensao-${m.legenda}`)[0];
        const difInput = document.getElementsByName(`dificuldade-${m.legenda}`)[0];
        if (pesoInput) pesoInput.value = m.peso || 5;
        if (extInput) extInput.value = m.extensao || 5;
        if (difInput) difInput.value = m.dificuldade || 5;
    });

    salvarEstado();

    // Atualizar visibilidade da aba Edital
    if (typeof atualizarVisibilidadeEdital === 'function') {
        atualizarVisibilidadeEdital();
    }
    if (planoAdotado?.edital && typeof carregarEditalProgresso === 'function') {
        await carregarEditalProgresso();
        renderizarEdital();
    }

    alert(`Plano "${plano.nome}" adotado com sucesso! Prosseguindo para calcular blocos.`);
    calcularBlocos();
}
