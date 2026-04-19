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
                <div style="display:flex; gap:8px; flex-shrink:0;">
                    <button class="btn-editar-plano" data-id="${plano.id}" style="font-size:12px; padding:6px 12px;">Editar</button>
                    <button class="btn-excluir-plano" data-id="${plano.id}" style="font-size:12px; padding:6px 12px; background:#FF6B6B;">Excluir</button>
                </div>
            </div>
        `;
        container.appendChild(card);
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

let planoEditando = null;

function abrirEditorPlano(planoId) {
    const editor = document.getElementById('planoEditor');
    const lista = document.getElementById('planosLista');
    const btnCriar = document.getElementById('btnCriarPlano');

    if (planoId) {
        carregarPlanosProfessor().then(planos => {
            planoEditando = planos.find(p => String(p.id) === String(planoId)) || null;
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
    const planoIdInput = document.getElementById('planoId');
    if (planoIdInput) planoIdInput.value = '';
    renderizarListaPlanosProfessor();
}

function preencherEditorPlano() {
    const planoIdInput = document.getElementById('planoId');
    if (planoIdInput) planoIdInput.value = planoEditando?.id || '';
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

    const planoId = document.getElementById('planoId')?.value || null;

    return {
        id: planoId || planoEditando?.id || null,
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

    const planos = await carregarPlanosPublicos();

    if (planos.length === 0) {
        container.innerHTML = '<p style="color:#999;">Nenhum plano disponível no momento.</p>';
        return;
    }

    container.innerHTML = '';
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
            <button class="btn-adotar-plano" data-id="${plano.id}" style="margin-top:8px; font-size:13px; padding:6px 16px; background:#4CAF50;">Adotar Este Plano</button>
        `;
        container.appendChild(card);
    });

    container.querySelectorAll('.btn-adotar-plano').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            adotarPlano(btn.dataset.id);
        });
    });
}

async function adotarPlano(planoId) {
    const planos = await carregarPlanosPublicos();
    const plano = planos.find(p => p.id === planoId);
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

    // Aplicar configurações
    const cfg = plano.configuracoes || {};
    if (cfg.duracaoBloco) configuracoes.duracaoBloco = cfg.duracaoBloco;
    if (cfg.intervaloEntreBlocos !== undefined) configuracoes.intervaloEntreBlocos = cfg.intervaloEntreBlocos;
    if (cfg.blocosPorSessao) configuracoes.blocosPorSessao = cfg.blocosPorSessao;
    if (cfg.horasSemanais) document.getElementById('horasSemanais').value = cfg.horasSemanais;

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
