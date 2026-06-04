// ── Onboarding Wizard ────────────────────────────────────────────────────────

let _onboardingStep = 1;
let _onboardingDados = {
    objetivo: '',
    horasSemanais: 10,
    materias: [],
    planoBase: null
};

function abrirOnboarding() {
    _onboardingStep = 1;
    _onboardingDados = { objetivo: '', horasSemanais: 10, materias: [], planoBase: null };

    const overlay = document.getElementById('onboardingOverlay');
    overlay.style.display = 'flex';
    renderizarStepOnboarding();
}

function fecharOnboarding() {
    document.getElementById('onboardingOverlay').style.display = 'none';
}

function renderizarStepOnboarding() {
    const container = document.getElementById('onboardingConteudo');
    const progressBar = document.getElementById('onboardingProgresso');
    const totalSteps = 5;
    progressBar.style.width = `${(_onboardingStep / totalSteps) * 100}%`;

    document.getElementById('onboardingStepLabel').textContent = `Etapa ${_onboardingStep} de ${totalSteps}`;

    switch (_onboardingStep) {
        case 1: renderStep1Objetivo(container); break;
        case 2: renderStep2Horas(container); break;
        case 3: renderStep3Materias(container); break;
        case 4: renderStep4Familiaridade(container); break;
        case 5: renderStep5Resumo(container); break;
    }
}

// ── Step 1: Objetivo ─────────────────────────────────────────────────────────

async function renderStep1Objetivo(container) {
    container.innerHTML = `
        <h2 style="font-size:24px; color:#3F51B5; margin-bottom:8px;">Bem-vindo ao Ciclo de Estudos!</h2>
        <p style="color:#666; margin-bottom:24px;">Vamos montar seu plano de estudos personalizado em poucos minutos.</p>
        <label style="font-weight:600; font-size:15px; display:block; margin-bottom:8px;">Qual concurso ou objetivo voce esta estudando?</label>
        <input type="text" id="onbObjetivo" placeholder="Ex: TCU 2026, OAB, ENEM..." value="${_onboardingDados.objetivo}"
            style="width:100%; padding:14px; font-size:16px; border:2px solid #E1E4E8; border-radius:10px; margin-bottom:20px;">
        <div id="onbPlanosDisponiveis" style="margin-bottom:20px;"></div>
        <div style="display:flex; justify-content:flex-end; gap:10px;">
            <button onclick="fecharOnboarding()" style="background:#999; padding:10px 20px; border-radius:8px; color:white; border:none; cursor:pointer;">Cancelar</button>
            <button onclick="onbAvancar()" style="background:#3F51B5; padding:10px 24px; border-radius:8px; color:white; border:none; cursor:pointer; font-weight:600;">Proximo &rarr;</button>
        </div>
    `;

    // Load available plans
    const planosDiv = document.getElementById('onbPlanosDisponiveis');
    if (supabaseConfigurado()) {
        const user = await getUsuarioLogado();
        let planos = [];
        let atribuicao = null;

        if (user) {
            const { data: atrs } = await supabaseClient
                .from('plano_atribuicoes')
                .select('*, planos(*)')
                .eq('aluno_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1);
            if (atrs?.length && atrs[0].planos) {
                atribuicao = atrs[0];
                planos.unshift(atrs[0].planos);
            }
        }

        const publicos = await carregarPlanosPublicos();
        publicos.forEach(p => {
            if (!planos.some(pp => pp.id === p.id)) planos.push(p);
        });

        if (planos.length > 0) {
            planosDiv.innerHTML = '<p style="font-size:14px; color:#555; margin-bottom:10px; font-weight:600;">Ou escolha um plano pronto:</p>';
            planos.forEach(p => {
                const isAtribuido = atribuicao?.planos?.id === p.id;
                const card = document.createElement('div');
                card.style.cssText = `padding:12px 16px; border:2px solid ${_onboardingDados.planoBase?.id === p.id ? '#3F51B5' : (isAtribuido ? '#7C4DFF' : '#E1E4E8')}; border-radius:10px; margin-bottom:8px; cursor:pointer; transition:all 0.2s; background:${_onboardingDados.planoBase?.id === p.id ? '#E8EAF6' : 'white'};`;
                card.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        ${isAtribuido ? '<span style="background:#7C4DFF; color:white; font-size:10px; padding:2px 8px; border-radius:10px; font-weight:700;">ATRIBUIDO</span>' : ''}
                        <strong style="font-size:15px;">${p.nome}</strong>
                    </div>
                    <p style="font-size:13px; color:#888; margin-top:4px;">${(p.materias || []).length} materias${p.configuracoes?.horasSemanais ? ' | ' + p.configuracoes.horasSemanais + 'h/sem' : ''}</p>
                `;
                card.addEventListener('click', () => {
                    _onboardingDados.planoBase = p;
                    _onboardingDados.planoAtribuicao = isAtribuido ? atribuicao : null;
                    _onboardingDados.objetivo = p.nome;
                    document.getElementById('onbObjetivo').value = p.nome;
                    const cfg = { ...(p.configuracoes || {}), ...(atribuicao?.configuracoes || {}) };
                    if (cfg.horasSemanais) _onboardingDados.horasSemanais = cfg.horasSemanais;
                    _onboardingDados.materias = (p.materias || []).map(m => ({
                        nome: m.nome,
                        legenda: m.legenda,
                        fase: m.fase || 1,
                        importancia: pesoParaNivel(m.peso),
                        extensao: pesoParaNivel(m.extensao),
                        dificuldade: pesoParaNivel(m.dificuldade)
                    }));
                    renderStep1Objetivo(container);
                });
                planosDiv.appendChild(card);
            });
        }
    }
}

// ── Step 2: Horas ────────────────────────────────────────────────────────────

function renderStep2Horas(container) {
    const opcoes = [5, 10, 15, 20, 25, 30, 40];
    container.innerHTML = `
        <h2 style="font-size:22px; color:#3F51B5; margin-bottom:8px;">Quanto tempo voce tem por semana?</h2>
        <p style="color:#666; margin-bottom:24px;">Escolha a opcao mais proxima da sua realidade. Voce pode ajustar depois.</p>
        <div style="display:flex; flex-wrap:wrap; gap:12px; justify-content:center; margin-bottom:20px;">
            ${opcoes.map(h => `
                <button class="onb-hora-btn" data-horas="${h}" style="
                    width:80px; height:80px; border-radius:12px; font-size:20px; font-weight:700;
                    border:2px solid ${_onboardingDados.horasSemanais === h ? '#3F51B5' : '#E1E4E8'};
                    background:${_onboardingDados.horasSemanais === h ? '#E8EAF6' : 'white'};
                    color:${_onboardingDados.horasSemanais === h ? '#3F51B5' : '#333'};
                    cursor:pointer; transition:all 0.2s;
                ">${h}h</button>
            `).join('')}
        </div>
        <div style="text-align:center; margin-bottom:20px;">
            <label style="font-size:14px; color:#666;">Ou digite um valor:</label>
            <input type="number" id="onbHorasCustom" value="${_onboardingDados.horasSemanais}" min="1" max="80"
                style="width:80px; text-align:center; padding:8px; font-size:16px; border:2px solid #E1E4E8; border-radius:8px; margin-left:8px;">
        </div>
        <div style="display:flex; justify-content:space-between; gap:10px;">
            <button onclick="onbVoltar()" style="background:#999; padding:10px 20px; border-radius:8px; color:white; border:none; cursor:pointer;">&larr; Voltar</button>
            <button onclick="onbAvancar()" style="background:#3F51B5; padding:10px 24px; border-radius:8px; color:white; border:none; cursor:pointer; font-weight:600;">Proximo &rarr;</button>
        </div>
    `;

    container.querySelectorAll('.onb-hora-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            _onboardingDados.horasSemanais = parseInt(btn.dataset.horas);
            document.getElementById('onbHorasCustom').value = _onboardingDados.horasSemanais;
            renderStep2Horas(container);
        });
    });

    document.getElementById('onbHorasCustom').addEventListener('change', (e) => {
        _onboardingDados.horasSemanais = parseInt(e.target.value) || 10;
    });
}

// ── Step 3: Materias ─────────────────────────────────────────────────────────

function renderStep3Materias(container) {
    const temMaterias = _onboardingDados.materias.length > 0;
    container.innerHTML = `
        <h2 style="font-size:22px; color:#3F51B5; margin-bottom:8px;">Quais materias voce vai estudar?</h2>
        <p style="color:#666; margin-bottom:16px;">${temMaterias ? 'As materias do plano ja foram carregadas. Adicione ou remova como quiser.' : 'Adicione as materias do seu edital.'}</p>
        <div id="onbMateriasLista" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px;"></div>
        <div style="display:flex; gap:8px; margin-bottom:20px;">
            <input type="text" id="onbNovaMateriaNome" placeholder="Nome da materia" style="flex:2; padding:10px; border:2px solid #E1E4E8; border-radius:8px; font-size:14px;">
            <input type="text" id="onbNovaMateriaSigla" placeholder="Sigla" maxlength="3" style="width:70px; padding:10px; border:2px solid #E1E4E8; border-radius:8px; font-size:14px; text-transform:uppercase;">
            <button id="onbBtnAddMateria" style="background:#4CAF50; color:white; border:none; border-radius:8px; padding:10px 16px; cursor:pointer; font-weight:600; white-space:nowrap;">+ Adicionar</button>
        </div>
        <div style="display:flex; justify-content:space-between; gap:10px;">
            <button onclick="onbVoltar()" style="background:#999; padding:10px 20px; border-radius:8px; color:white; border:none; cursor:pointer;">&larr; Voltar</button>
            <button onclick="onbAvancar()" style="background:#3F51B5; padding:10px 24px; border-radius:8px; color:white; border:none; cursor:pointer; font-weight:600;">Proximo &rarr;</button>
        </div>
    `;

    const lista = document.getElementById('onbMateriasLista');
    _onboardingDados.materias.forEach((m, idx) => {
        const chip = document.createElement('div');
        chip.style.cssText = 'display:inline-flex; align-items:center; gap:6px; padding:8px 14px; background:#E8EAF6; border-radius:20px; font-size:14px; font-weight:500; color:#3F51B5;';
        chip.innerHTML = `<span>${m.legenda} — ${m.nome}</span><span class="onb-remove-materia" data-idx="${idx}" style="cursor:pointer; font-size:16px; color:#FF6B6B; font-weight:700;">&times;</span>`;
        lista.appendChild(chip);
    });

    lista.querySelectorAll('.onb-remove-materia').forEach(btn => {
        btn.addEventListener('click', () => {
            _onboardingDados.materias.splice(parseInt(btn.dataset.idx), 1);
            renderStep3Materias(container);
        });
    });

    document.getElementById('onbBtnAddMateria').addEventListener('click', () => {
        const nome = document.getElementById('onbNovaMateriaNome').value.trim();
        const sigla = document.getElementById('onbNovaMateriaSigla').value.trim().toUpperCase();
        if (!nome || !sigla) { alert('Preencha nome e sigla.'); return; }
        if (sigla.length > 3) { alert('Sigla deve ter no maximo 3 letras.'); return; }
        if (_onboardingDados.materias.some(m => m.legenda === sigla)) { alert('Sigla ja existe.'); return; }
        _onboardingDados.materias.push({
            nome, legenda: sigla, fase: 1,
            importancia: 'medio', extensao: 'medio', dificuldade: 'medio'
        });
        renderStep3Materias(container);
    });
}

// ── Step 4: Familiaridade ────────────────────────────────────────────────────

function renderStep4Familiaridade(container) {
    container.innerHTML = `
        <h2 style="font-size:22px; color:#3F51B5; margin-bottom:8px;">Como voce avalia cada materia?</h2>
        <p style="color:#666; margin-bottom:20px;">Responda rapidamente — nao precisa ser perfeito, voce pode ajustar depois.</p>
        <div id="onbFamiliaridadeLista" style="max-height:400px; overflow-y:auto;"></div>
        <div style="display:flex; justify-content:space-between; gap:10px; margin-top:20px;">
            <button onclick="onbVoltar()" style="background:#999; padding:10px 20px; border-radius:8px; color:white; border:none; cursor:pointer;">&larr; Voltar</button>
            <button onclick="onbAvancar()" style="background:#3F51B5; padding:10px 24px; border-radius:8px; color:white; border:none; cursor:pointer; font-weight:600;">Ver Resumo &rarr;</button>
        </div>
    `;

    const lista = document.getElementById('onbFamiliaridadeLista');
    _onboardingDados.materias.forEach((m, idx) => {
        const card = document.createElement('div');
        card.style.cssText = 'border:1px solid #E1E4E8; border-radius:10px; padding:14px; margin-bottom:12px; background:white;';
        card.innerHTML = `
            <div style="font-weight:700; font-size:15px; color:#333; margin-bottom:10px;">${m.legenda} — ${m.nome}</div>
            <div style="display:grid; grid-template-columns:1fr; gap:8px;">
                <div>
                    <span style="font-size:13px; color:#555; font-weight:600;">Quanto cai na prova?</span>
                    <div style="display:flex; gap:6px; margin-top:4px;">
                        ${renderBotoesNivel(idx, 'importancia', m.importancia, ['Pouco', 'Medio', 'Muito'])}
                    </div>
                </div>
                <div>
                    <span style="font-size:13px; color:#555; font-weight:600;">Extensao do conteudo?</span>
                    <div style="display:flex; gap:6px; margin-top:4px;">
                        ${renderBotoesNivel(idx, 'extensao', m.extensao, ['Curto', 'Medio', 'Extenso'])}
                    </div>
                </div>
                <div>
                    <span style="font-size:13px; color:#555; font-weight:600;">Sua dificuldade?</span>
                    <div style="display:flex; gap:6px; margin-top:4px;">
                        ${renderBotoesNivel(idx, 'dificuldade', m.dificuldade, ['Facil', 'OK', 'Dificil'])}
                    </div>
                </div>
            </div>
        `;
        lista.appendChild(card);
    });

    lista.querySelectorAll('.onb-nivel-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            const campo = btn.dataset.campo;
            const valor = btn.dataset.valor;
            _onboardingDados.materias[idx][campo] = valor;
            renderStep4Familiaridade(container);
        });
    });
}

function renderBotoesNivel(idx, campo, valorAtual, labels) {
    const valores = ['pouco', 'medio', 'muito'];
    if (campo === 'extensao') valores[0] = 'pouco'; // curto
    if (campo === 'dificuldade') valores[2] = 'muito'; // dificil
    return labels.map((label, i) => {
        const val = valores[i];
        const ativo = valorAtual === val;
        const cores = ['#4CAF50', '#FF9800', '#F44336'];
        return `<button class="onb-nivel-btn" data-idx="${idx}" data-campo="${campo}" data-valor="${val}" style="
            flex:1; padding:6px 4px; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; border:2px solid ${ativo ? cores[i] : '#E1E4E8'};
            background:${ativo ? cores[i] + '22' : 'white'}; color:${ativo ? cores[i] : '#888'}; transition:all 0.15s;
        ">${label}</button>`;
    }).join('');
}

// ── Step 5: Resumo ───────────────────────────────────────────────────────────

function renderStep5Resumo(container) {
    const materias = _onboardingDados.materias;
    const horas = _onboardingDados.horasSemanais;
    const duracaoBloco = configuracoes?.duracaoBloco || 60;
    const totalBlocos = Math.floor((horas * 60) / duracaoBloco);

    container.innerHTML = `
        <h2 style="font-size:22px; color:#3F51B5; margin-bottom:8px;">Tudo pronto!</h2>
        <p style="color:#666; margin-bottom:20px;">Confira o resumo e gere seu ciclo de estudos.</p>
        <div style="background:#F5F7FA; border-radius:10px; padding:16px; margin-bottom:20px;">
            <div style="display:flex; justify-content:space-around; text-align:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
                <div>
                    <div style="font-size:28px; font-weight:700; color:#3F51B5;">${horas}h</div>
                    <div style="font-size:13px; color:#888;">por semana</div>
                </div>
                <div>
                    <div style="font-size:28px; font-weight:700; color:#3F51B5;">${materias.length}</div>
                    <div style="font-size:13px; color:#888;">materias</div>
                </div>
                <div>
                    <div style="font-size:28px; font-weight:700; color:#3F51B5;">~${totalBlocos}</div>
                    <div style="font-size:13px; color:#888;">blocos de ${duracaoBloco}min</div>
                </div>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
                ${materias.map(m => {
                    const cor = m.importancia === 'muito' ? '#F44336' : m.importancia === 'medio' ? '#FF9800' : '#4CAF50';
                    return `<span style="padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600; background:${cor}22; color:${cor}; border:1px solid ${cor}44;">${m.legenda}</span>`;
                }).join('')}
            </div>
        </div>
        <div style="display:flex; justify-content:space-between; gap:10px;">
            <button onclick="onbVoltar()" style="background:#999; padding:10px 20px; border-radius:8px; color:white; border:none; cursor:pointer;">&larr; Voltar</button>
            <button onclick="onbFinalizar()" style="background:#4CAF50; padding:12px 28px; border-radius:8px; color:white; border:none; cursor:pointer; font-weight:700; font-size:16px;">Gerar Meu Ciclo!</button>
        </div>
    `;
}

// ── Navigation ───────────────────────────────────────────────────────────────

function onbAvancar() {
    if (_onboardingStep === 1) {
        _onboardingDados.objetivo = document.getElementById('onbObjetivo')?.value?.trim() || '';
    }
    if (_onboardingStep === 2) {
        _onboardingDados.horasSemanais = parseInt(document.getElementById('onbHorasCustom')?.value) || 10;
    }
    if (_onboardingStep === 3 && _onboardingDados.materias.length === 0) {
        alert('Adicione pelo menos uma materia.');
        return;
    }
    _onboardingStep++;
    renderizarStepOnboarding();
}

function onbVoltar() {
    if (_onboardingStep > 1) {
        _onboardingStep--;
        renderizarStepOnboarding();
    }
}

// ── Finalizar ────────────────────────────────────────────────────────────────

function onbFinalizar() {
    const dados = _onboardingDados;

    // Set hours
    document.getElementById('horasSemanais').value = dados.horasSemanais;
    const editInput = document.getElementById('horasSemanaisEdit');
    if (editInput) editInput.value = dados.horasSemanais;

    // Convert materias and set globals
    coresUsadas = [];
    materiasList = dados.materias.map(m => ({ nome: m.nome, legenda: m.legenda }));
    materiasSelecionadas = dados.materias.map(m => ({
        nome: m.nome,
        legenda: m.legenda,
        fase: m.fase || 1,
        peso: nivelParaPeso(m.importancia),
        extensao: nivelParaPeso(m.extensao),
        dificuldade: nivelParaPeso(m.dificuldade),
        cor: gerarCorUnica()
    }));

    // If there's a base plan, adopt it
    if (dados.planoBase) {
        const plano = dados.planoBase;
        const todasMaterias = plano.materias || [];
        const maxFase = Math.max(1, ...todasMaterias.map(m => m.fase || 1));
        faseAtual = 1;
        planoAdotado = {
            id: plano.id,
            nome: plano.nome,
            edital: plano.edital || null,
            materias: todasMaterias,
            maxFase
        };

        // Apply configs
        const cfgPlano = plano.configuracoes || {};
        const cfgAtrib = dados.planoAtribuicao?.configuracoes || {};
        const cfg = { ...cfgPlano, ...cfgAtrib };
        if (cfg.duracaoBloco) configuracoes.duracaoBloco = cfg.duracaoBloco;
        if (cfg.intervaloEntreBlocos !== undefined) configuracoes.intervaloEntreBlocos = cfg.intervaloEntreBlocos;
        if (cfg.blocosPorSessao) configuracoes.blocosPorSessao = cfg.blocosPorSessao;

        modosMateria = dados.planoAtribuicao?.modos_materia || {};

        if (typeof atualizarVisibilidadeEdital === 'function') atualizarVisibilidadeEdital();
        if (planoAdotado.edital && typeof carregarEditalProgresso === 'function') {
            carregarEditalProgresso().then(() => {
                if (typeof renderizarEdital === 'function') renderizarEdital();
            });
        }
    }

    inicializarSelecaoMaterias();
    carregarConfiguracoes();
    preencherTabelaVariaveis();

    // Pre-fill weights from onboarding answers
    materiasSelecionadas.forEach(m => {
        const pesoInput = document.getElementsByName(`peso-${m.legenda}`)[0];
        const extInput = document.getElementsByName(`extensao-${m.legenda}`)[0];
        const difInput = document.getElementsByName(`dificuldade-${m.legenda}`)[0];
        if (pesoInput) pesoInput.value = m.peso;
        if (extInput) extInput.value = m.extensao;
        if (difInput) difInput.value = m.dificuldade;
    });

    // Generate cycle
    calcularBlocos();

    fecharOnboarding();
    salvarEstado();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function nivelParaPeso(nivel) {
    switch (nivel) {
        case 'pouco': return 3;
        case 'medio': return 5;
        case 'muito': return 8;
        default: return 5;
    }
}

function pesoParaNivel(peso) {
    if (!peso || peso <= 3) return 'pouco';
    if (peso <= 6) return 'medio';
    return 'muito';
}
