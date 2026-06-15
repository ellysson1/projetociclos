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

    const edital = plano.edital || null;
    if (edital && typeof garantirIdsEdital === 'function') garantirIdsEdital(edital);

    const dados = {
        professor_id: user.id,
        nome: plano.nome,
        descricao: plano.descricao || '',
        materias: plano.materias || [],
        configuracoes: plano.configuracoes || {},
        edital,
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
                    <button class="btn-painel-plano" data-id="${plano.id}" style="font-size:12px; padding:6px 12px; background:#3F51B5; color:white; border:none; border-radius:6px; cursor:pointer;">Painel</button>
                    <button class="btn-atribuir-plano" data-id="${plano.id}" style="font-size:12px; padding:6px 12px; background:#7C4DFF; color:white; border:none; border-radius:6px; cursor:pointer;">Atribuir</button>
                    <button class="btn-editar-plano" data-id="${plano.id}" style="font-size:12px; padding:6px 12px;">Editar</button>
                    <button class="btn-excluir-plano" data-id="${plano.id}" style="font-size:12px; padding:6px 12px; background:#FF6B6B;">Excluir</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    container.querySelectorAll('.btn-painel-plano').forEach(btn => {
        btn.addEventListener('click', () => {
            const plano = planos.find(p => p.id === btn.dataset.id);
            if (plano) abrirPainelAlunos(plano);
        });
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
    document.getElementById('atribuirStep3').style.display = 'none';

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

function atribuirPassoNext2() {
    const horasSemanais = parseInt(document.getElementById('atribuirHorasSemanais').value);
    const duracaoBloco = parseInt(document.getElementById('atribuirDuracaoBloco').value) || 60;

    if (!horasSemanais || horasSemanais <= 0) {
        alert('Informe as horas semanais para calcular os blocos.');
        return;
    }

    const materias = _atribuirPlano.materias || [];
    if (materias.length === 0) {
        alert('Este plano não tem matérias definidas.');
        return;
    }

    // Same proportional allocation algorithm as calcularBlocos
    const totalBlocos = Math.floor((horasSemanais * 60) / duracaoBloco);
    let totalPonderado = 0;
    const blocos = materias.map(m => {
        const vp = (m.peso || 5) * 0.5 + (m.extensao || 5) * 0.25 + (m.dificuldade || 5) * 0.25;
        totalPonderado += vp;
        return { ...m, _vp: vp, _share: 0, meioBloco: false, quantidadeBlocos: 0 };
    });

    blocos.forEach(b => { b._share = (b._vp / totalPonderado) * totalBlocos; });

    const candidatosMeio = blocos.filter(b => b._share > 0 && b._share < 1);
    const usarMeioBloco = candidatosMeio.length >= 2;

    let minutosUsados = 0;
    blocos.forEach(b => {
        if (b._share >= 1) {
            b.quantidadeBlocos = Math.round(b._share);
            minutosUsados += b.quantidadeBlocos * duracaoBloco;
        } else if (b._share > 0) {
            b.quantidadeBlocos = 1;
            b.meioBloco = usarMeioBloco;
            minutosUsados += usarMeioBloco ? duracaoBloco / 2 : duracaoBloco;
        }
    });

    const minutosDisponiveis = totalBlocos * duracaoBloco;
    if (minutosUsados > minutosDisponiveis) {
        const candidatos = blocos.filter(b => !b.meioBloco && b.quantidadeBlocos > 1)
            .sort((a, b) => b.quantidadeBlocos - a.quantidadeBlocos);
        let i = 0;
        while (minutosUsados > minutosDisponiveis && candidatos.length > 0) {
            const b = candidatos[i % candidatos.length];
            if (b.quantidadeBlocos > 1) { b.quantidadeBlocos--; minutosUsados -= duracaoBloco; }
            if (++i > candidatos.length * totalBlocos) break;
        }
    }
    if (minutosUsados < minutosDisponiveis) {
        const candidatos = blocos.filter(b => !b.meioBloco && b.quantidadeBlocos > 0)
            .sort((a, b) => (b._share % 1) - (a._share % 1));
        let i = 0;
        while (minutosUsados + duracaoBloco <= minutosDisponiveis && candidatos.length > 0) {
            candidatos[i % candidatos.length].quantidadeBlocos++;
            minutosUsados += duracaoBloco;
            if (++i > candidatos.length * totalBlocos) break;
        }
    }

    // Fill step 3 table
    const tbody = document.getElementById('atribuirBlocosTbody');
    tbody.innerHTML = '';
    blocos.forEach(b => {
        const nomeTd = document.createElement('td');
        nomeTd.style.cssText = 'padding:8px 4px; border-bottom:1px solid #f0f0f0; font-size:14px;';
        nomeTd.textContent = b.nome;
        if (b.meioBloco) {
            const tag = document.createElement('span');
            tag.style.cssText = 'color:#7C4DFF; font-size:11px; margin-left:6px;';
            tag.textContent = '(½ bloco)';
            nomeTd.appendChild(tag);
        }

        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.value = b.quantidadeBlocos;
        input.dataset.legenda = b.legenda;
        input.dataset.meioBloco = b.meioBloco ? '1' : '0';
        input.style.cssText = 'width:70px; text-align:center;';

        const numTd = document.createElement('td');
        numTd.style.cssText = 'padding:8px 4px; border-bottom:1px solid #f0f0f0; text-align:center;';
        numTd.appendChild(input);

        const tr = document.createElement('tr');
        tr.appendChild(nomeTd);
        tr.appendChild(numTd);
        tbody.appendChild(tr);
    });

    document.getElementById('atribuirStep2').style.display = 'none';
    document.getElementById('atribuirStep3').style.display = 'block';
}

function atribuirPassoBack2() {
    document.getElementById('atribuirStep3').style.display = 'none';
    document.getElementById('atribuirStep2').style.display = 'block';
}

async function confirmarAtribuicao() {
    const alunoId = document.getElementById('atribuirAlunoSelect').value;
    if (!alunoId || !_atribuirPlano) return;

    const user = await getUsuarioLogado();
    if (!user) return;

    const cfg = {
        duracaoBloco: parseInt(document.getElementById('atribuirDuracaoBloco').value) || 60,
        intervaloEntreBlocos: parseInt(document.getElementById('atribuirIntervalo').value) ?? 5,
        blocosPorSessao: parseInt(document.getElementById('atribuirBlocosSessao').value) || 4,
        horasSemanais: parseInt(document.getElementById('atribuirHorasSemanais').value) || null
    };

    // Collect block quantities defined by professor in step 3
    const blocos_por_materia = {};
    const meio_bloco_legendas = [];
    document.querySelectorAll('#atribuirBlocosTbody input[type="number"]').forEach(input => {
        blocos_por_materia[input.dataset.legenda] = parseInt(input.value) || 0;
        if (input.dataset.meioBloco === '1') meio_bloco_legendas.push(input.dataset.legenda);
    });
    cfg.blocos_por_materia = blocos_por_materia;
    if (meio_bloco_legendas.length > 0) cfg.meio_bloco_legendas = meio_bloco_legendas;

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
            configuracoes: cfg,
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
    renderizarRegrasEvolucao(planoEditando?.regras_evolucao || []);
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
            <td><input type="number" value="${m.fase || 1}" data-field="fase" data-idx="${idx}" class="plano-materia-input" min="1" max="10" style="width:50px;"></td>
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

function renderizarRegrasEvolucao(regras) {
    const container = document.getElementById('regrasEvolucaoContainer');
    if (!container) return;
    container.innerHTML = '';

    regras.forEach((regra, idx) => {
        const div = document.createElement('div');
        div.className = 'regra-evolucao-item';
        div.style.cssText = 'border:1px solid #ddd; border-radius:8px; padding:12px; margin-bottom:10px; background:#f9f9f9;';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong style="color:var(--primary-color);">Fase ${regra.fase || idx + 1} → ${(regra.fase || idx + 1) + 1}</strong>
                <button class="btn-remover-regra" data-idx="${idx}" style="background:#FF6B6B; padding:4px 8px; font-size:12px; border:none; color:white; border-radius:4px; cursor:pointer;">&times;</button>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:10px;">
                <div>
                    <label style="font-size:12px;">% minimo edital visto:</label>
                    <input type="number" class="regra-input" data-idx="${idx}" data-field="pct_edital" value="${regra.pct_edital ?? 60}" min="0" max="100" style="width:100%;">
                </div>
                <div>
                    <label style="font-size:12px;">Questoes minimas feitas:</label>
                    <input type="number" class="regra-input" data-idx="${idx}" data-field="questoes_minimas" value="${regra.questoes_minimas ?? ''}" min="0" style="width:100%;">
                </div>
                <div>
                    <label style="font-size:12px;">% minimo acerto questoes:</label>
                    <input type="number" class="regra-input" data-idx="${idx}" data-field="pct_acerto_minimo" value="${regra.pct_acerto_minimo ?? ''}" min="0" max="100" style="width:100%;">
                </div>
            </div>
        `;
        container.appendChild(div);
    });

    container.querySelectorAll('.btn-remover-regra').forEach(btn => {
        btn.addEventListener('click', () => {
            regras.splice(parseInt(btn.dataset.idx), 1);
            renderizarRegrasEvolucao(regras);
        });
    });
}

function coletarRegrasEvolucao() {
    const container = document.getElementById('regrasEvolucaoContainer');
    if (!container) return [];
    const items = container.querySelectorAll('.regra-evolucao-item');
    const regras = [];
    items.forEach(item => {
        const inputs = item.querySelectorAll('.regra-input');
        const regra = {};
        inputs.forEach(input => {
            const field = input.dataset.field;
            const val = input.value.trim();
            if (val !== '') {
                regra[field] = parseInt(val);
            }
        });
        const idx = parseInt(inputs[0]?.dataset.idx ?? regras.length);
        regra.fase = idx + 1;
        regras.push(regra);
    });
    return regras;
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
            if (field === 'nome' || field === 'legenda') {
                m[field] = input.value.trim();
            } else if (field === 'fase') {
                m[field] = parseInt(input.value) || 1;
            } else {
                m[field] = parseInt(input.value) || 5;
            }
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
        regras_evolucao: coletarRegrasEvolucao()
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
            if (field === 'nome' || field === 'legenda') {
                m[field] = input.value.trim();
            } else if (field === 'fase') {
                m[field] = parseInt(input.value) || 1;
            } else {
                m[field] = parseInt(input.value) || 5;
            }
        });
        materias.push(m);
    });
    materias.push({ nome: '', legenda: '', fase: 1, peso: 5, extensao: 5, dificuldade: 5 });
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

    // Apply plan reference (store all materias for progressive phases)
    const todasMaterias = plano.materias || [];
    const maxFase = Math.max(1, ...todasMaterias.map(m => m.fase || 1));
    planoAdotado = { id: plano.id, nome: plano.nome, edital: plano.edital || null, materias: todasMaterias, maxFase, regras_evolucao: plano.regras_evolucao || [] };

    // Only include current-phase matérias in active lists
    const materiasDoPlano = todasMaterias.filter(m => (m.fase || 1) <= faseAtual);
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

    // Sempre limpar progresso antigo e recarregar para o plano atual
    if (typeof editalProgresso !== 'undefined') editalProgresso = {};
    if (typeof atualizarVisibilidadeEdital === 'function') atualizarVisibilidadeEdital();
    if (planoAdotado.edital) {
        if (typeof carregarEditalProgresso === 'function') await carregarEditalProgresso();
        if (typeof renderizarEdital === 'function') renderizarEdital();
    } else {
        if (typeof renderizarEdital === 'function') renderizarEdital();
    }

    // If no active cycle, generate from professor-defined quantities or auto-calculate
    if ((!blocosAtivos || blocosAtivos.length === 0) && materiasDoPlano.length > 0) {
        const blocos_por_materia = cfg.blocos_por_materia || null;
        // When using professor-defined blocks, only include matérias from current phases
        const legendasFase = new Set(materiasDoPlano.map(m => m.legenda));
        const meio_bloco_legendas = new Set(cfg.meio_bloco_legendas || []);
        const horasSemanais = cfg.horasSemanais;
        const duracaoBloco = configuracoes.duracaoBloco || 60;

        coresUsadas = [];
        const blocos = materiasDoPlano.map(m => ({
            ...m,
            cor: gerarCorUnica(),
            meioBloco: meio_bloco_legendas.has(m.legenda),
            quantidadeBlocos: 0
        }));

        if (blocos_por_materia) {
            blocos.forEach(b => { b.quantidadeBlocos = blocos_por_materia[b.legenda] || 0; });
        } else if (horasSemanais) {
            if (document.getElementById('horasSemanais')) document.getElementById('horasSemanais').value = horasSemanais;
            const totalBlocos = Math.floor((horasSemanais * 60) / duracaoBloco);
            let totalPonderado = 0;
            blocos.forEach(b => {
                b._vp = (b.peso || 5) * 0.5 + (b.extensao || 5) * 0.25 + (b.dificuldade || 5) * 0.25;
                totalPonderado += b._vp;
            });
            blocos.forEach(b => { b._share = (b._vp / totalPonderado) * totalBlocos; });
            const candidatosMeio = blocos.filter(b => b._share > 0 && b._share < 1);
            const usarMeioBloco = candidatosMeio.length >= 2;
            let minutosUsados = 0;
            blocos.forEach(b => {
                if (b._share >= 1) {
                    b.quantidadeBlocos = Math.round(b._share);
                    minutosUsados += b.quantidadeBlocos * duracaoBloco;
                } else if (b._share > 0) {
                    b.quantidadeBlocos = 1;
                    b.meioBloco = usarMeioBloco;
                    minutosUsados += usarMeioBloco ? duracaoBloco / 2 : duracaoBloco;
                }
            });
            const minutosDisponiveis = totalBlocos * duracaoBloco;
            if (minutosUsados > minutosDisponiveis) {
                const cands = blocos.filter(b => !b.meioBloco && b.quantidadeBlocos > 1).sort((a, b) => b.quantidadeBlocos - a.quantidadeBlocos);
                let i = 0;
                while (minutosUsados > minutosDisponiveis && cands.length > 0) {
                    const b = cands[i % cands.length];
                    if (b.quantidadeBlocos > 1) { b.quantidadeBlocos--; minutosUsados -= duracaoBloco; }
                    if (++i > cands.length * totalBlocos) break;
                }
            }
            if (minutosUsados < minutosDisponiveis) {
                const cands = blocos.filter(b => !b.meioBloco && b.quantidadeBlocos > 0).sort((a, b) => (b._share % 1) - (a._share % 1));
                let i = 0;
                while (minutosUsados + duracaoBloco <= minutosDisponiveis && cands.length > 0) {
                    cands[i % cands.length].quantidadeBlocos++;
                    minutosUsados += duracaoBloco;
                    if (++i > cands.length * totalBlocos) break;
                }
            }
            blocos.forEach(b => { delete b._vp; delete b._share; });
        } else {
            return; // Sem horas e sem blocos definidos, não é possível gerar ciclo
        }

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

    // Salvar referência ao plano adotado (store all materias for progressive phases)
    const todasMaterias = plano.materias || [];
    const maxFase = Math.max(1, ...todasMaterias.map(m => m.fase || 1));
    faseAtual = 1;
    planoAdotado = {
        id: plano.id,
        nome: plano.nome,
        edital: plano.edital || null,
        materias: todasMaterias,
        maxFase,
        regras_evolucao: plano.regras_evolucao || []
    };

    if (planoAdotado.edital && typeof garantirIdsEdital === 'function') {
        garantirIdsEdital(planoAdotado.edital);
    }

    // Only include phase 1 matérias initially
    const materiasDoPlano = todasMaterias.filter(m => (m.fase || 1) <= faseAtual);
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

    // Sempre limpar progresso antigo e recarregar para o novo plano
    if (typeof editalProgresso !== 'undefined') editalProgresso = {};
    if (typeof atualizarVisibilidadeEdital === 'function') atualizarVisibilidadeEdital();
    if (planoAdotado?.edital) {
        if (typeof carregarEditalProgresso === 'function') await carregarEditalProgresso();
        if (typeof renderizarEdital === 'function') renderizarEdital();
    } else {
        if (typeof renderizarEdital === 'function') renderizarEdital();
    }

    alert(`Plano "${plano.nome}" adotado com sucesso! Prosseguindo para calcular blocos.`);
    calcularBlocos();

    if (planoAdotado?.edital && typeof verificarReconciliacaoPendente === 'function') {
        verificarReconciliacaoPendente();
    }
}

// ── Painel de Alunos (Professor Dashboard) ──────────────────────────────────

async function abrirPainelAlunos(plano) {
    const painel = document.getElementById('painelAlunos');
    const conteudo = document.getElementById('painelAlunosConteudo');
    painel.style.display = 'block';
    conteudo.innerHTML = '<p style="color:#999;">Carregando dados dos alunos...</p>';

    const { data: atribuicoes, error } = await supabaseClient
        .from('plano_atribuicoes')
        .select('aluno_id, configuracoes, modos_materia, created_at')
        .eq('plano_id', plano.id);

    if (error || !atribuicoes?.length) {
        conteudo.innerHTML = '<p style="color:#999;">Nenhum aluno atribuído a este plano.</p>';
        return;
    }

    const alunoIds = atribuicoes.map(a => a.aluno_id);

    const [profilesResp, progressoResp, editalResp] = await Promise.all([
        supabaseClient.from('profiles').select('user_id, nome').in('user_id', alunoIds),
        supabaseClient.from('progresso').select('user_id, estado, updated_at').in('user_id', alunoIds),
        supabaseClient.from('edital_progresso').select('user_id, materia, topico, subtopico, status').eq('plano_id', plano.id).in('user_id', alunoIds)
    ]);

    if (progressoResp.error) console.warn('Painel: erro ao ler progresso dos alunos (provável RLS):', progressoResp.error);
    if (editalResp.error) console.warn('Painel: erro ao ler edital dos alunos (provável RLS):', editalResp.error);

    const profiles = {};
    (profilesResp.data || []).forEach(p => { profiles[p.user_id] = p.nome || 'Aluno'; });

    const progressos = {};
    (progressoResp.data || []).forEach(p => { progressos[p.user_id] = p; });

    const editalPorAluno = {};
    (editalResp.data || []).forEach(row => {
        if (!editalPorAluno[row.user_id]) editalPorAluno[row.user_id] = [];
        editalPorAluno[row.user_id].push(row);
    });

    const editalTotal = contarItensEdital(plano.edital || []);
    const materiasPlano = plano.materias || [];
    const maxFase = Math.max(1, ...materiasPlano.map(m => m.fase || 1));

    conteudo.innerHTML = '';

    atribuicoes.forEach(atr => {
        const uid = atr.aluno_id;
        const nome = profiles[uid] || uid.substring(0, 8);
        const prog = progressos[uid];
        const estado = prog?.estado || {};
        const blocos = estado.blocosAtivos || [];
        const fase = estado.faseAtual || 1;
        const updatedAt = prog?.updated_at;

        const blocosConcluidos = blocos.filter(b => b.concluido).length;
        const blocosTotal = blocos.length;

        const editalRows = editalPorAluno[uid] || [];
        const editalConcluidos = editalRows.filter(r => r.status === 'visto').length;
        const pctEdital = editalTotal > 0 ? Math.round((editalConcluidos / editalTotal) * 100) : 0;

        const ultimaAtividade = updatedAt ? formatarTempoAtras(updatedAt) : 'Nunca';

        // Group blocks by legenda to show per-subject counts
        const blocosPorMateria = {};
        blocos.forEach(b => {
            if (!blocosPorMateria[b.legenda]) blocosPorMateria[b.legenda] = { total: 0, feitos: 0, nome: b.nome };
            blocosPorMateria[b.legenda].total++;
            if (b.concluido) blocosPorMateria[b.legenda].feitos++;
        });

        const materiasResumo = Object.entries(blocosPorMateria).map(([leg, d]) =>
            `<span style="font-size:12px; padding:2px 6px; border-radius:4px; background:${d.feitos === d.total ? '#E8F5E9' : '#FFF3E0'}; margin:2px;">${leg}: ${d.feitos}/${d.total}</span>`
        ).join(' ');

        // Next phase subjects
        let proximaFaseHtml = '';
        if (fase < maxFase) {
            const proximas = materiasPlano.filter(m => (m.fase || 1) === fase + 1);
            if (proximas.length > 0) {
                proximaFaseHtml = `<div style="font-size:12px; color:#7C4DFF; margin-top:6px;">Fase ${fase + 1}: ${proximas.map(m => m.nome).join(', ')}</div>`;
            }
        }

        const card = document.createElement('div');
        card.style.cssText = 'border:1px solid var(--border-color); border-radius:8px; padding:14px; margin-bottom:10px; background:white; cursor:pointer;';

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div>
                    <strong style="font-size:15px;">${nome}</strong>
                    <span style="font-size:12px; color:white; background:#3F51B5; padding:1px 8px; border-radius:10px; margin-left:8px;">Fase ${fase}/${maxFase}</span>
                </div>
                <div style="font-size:12px; color:#999;">Atividade: ${ultimaAtividade}</div>
            </div>
            <div style="display:flex; gap:16px; margin-top:8px; font-size:13px; color:#555; flex-wrap:wrap;">
                <span>Blocos: <strong>${blocosConcluidos}/${blocosTotal}</strong></span>
                <span>Edital: <strong>${pctEdital}%</strong> (${editalConcluidos}/${editalTotal})</span>
            </div>
            <div class="painel-detalhe" style="display:none; margin-top:10px; padding-top:10px; border-top:1px solid #f0f0f0;">
                <div style="margin-bottom:6px; font-size:13px; font-weight:600; color:#333;">Blocos por matéria:</div>
                <div style="display:flex; flex-wrap:wrap; gap:4px;">${materiasResumo || '<span style="font-size:12px; color:#999;">Nenhum bloco</span>'}</div>
                ${proximaFaseHtml}
                <div style="margin-top:10px;">
                    <button class="btn-reatribuir" data-uid="${uid}" style="font-size:12px; padding:4px 12px; background:#7C4DFF; color:white; border:none; border-radius:6px; cursor:pointer;">Reatribuir Plano</button>
                </div>
            </div>
        `;

        card.addEventListener('click', () => {
            const detalhe = card.querySelector('.painel-detalhe');
            detalhe.style.display = detalhe.style.display === 'none' ? 'block' : 'none';
        });

        conteudo.appendChild(card);
    });

    conteudo.querySelectorAll('.btn-reatribuir').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            abrirModalAtribuir(plano);
            setTimeout(() => {
                const select = document.getElementById('atribuirAlunoSelect');
                if (select) select.value = btn.dataset.uid;
            }, 500);
        });
    });
}

function fecharPainelAlunos() {
    document.getElementById('painelAlunos').style.display = 'none';
}

function contarItensEdital(edital) {
    let total = 0;
    (edital || []).forEach(materiaObj => {
        (materiaObj.topicos || []).forEach(topico => {
            const subs = topico.subtopicos || [];
            total += subs.length > 0 ? subs.length : 1;
        });
    });
    return total;
}

function formatarTempoAtras(isoDate) {
    const diff = Date.now() - new Date(isoDate).getTime();
    const minutos = Math.floor(diff / 60000);
    if (minutos < 1) return 'Agora';
    if (minutos < 60) return `${minutos}min atrás`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `${horas}h atrás`;
    const dias = Math.floor(horas / 24);
    return `${dias}d atrás`;
}
