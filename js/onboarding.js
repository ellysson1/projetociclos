// ── Onboarding Wizard ────────────────────────────────────────────────────────

let _onboardingStep = 1;
let _onboardingDados = {
    objetivo: '',
    horasSemanais: 10,
    materias: [],
    planoBase: null,
    limitarMaterias: false,
    materiasIniciais: 6,
    materiasPorCiclo: 2
};

function abrirOnboarding() {
    _onboardingStep = 1;
    _onboardingDados = { objetivo: '', horasSemanais: 10, materias: [], planoBase: null, limitarMaterias: false, materiasIniciais: 6, materiasPorCiclo: 2 };

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
    const totalSteps = 6;
    progressBar.style.width = `${(_onboardingStep / totalSteps) * 100}%`;

    document.getElementById('onboardingStepLabel').textContent = `Etapa ${_onboardingStep} de ${totalSteps}`;

    switch (_onboardingStep) {
        case 1: renderStep1Objetivo(container); break;
        case 2: renderStep2Horas(container); break;
        case 3: renderStep3Materias(container); break;
        case 4: renderStep4Familiaridade(container); break;
        case 5: renderStep5LimiteMaterias(container); break;
        case 6: renderStep6Resumo(container); break;
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
            <button onclick="onbAvancar()" style="background:#3F51B5; padding:10px 24px; border-radius:8px; color:white; border:none; cursor:pointer; font-weight:600;">Proximo &rarr;</button>
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

// ── Step 5: Limite de matérias no ciclo inicial ─────────────────────────────

function renderStep5LimiteMaterias(container) {
    const total = _onboardingDados.materias.length;
    const limitarAtivo = _onboardingDados.limitarMaterias;

    container.innerHTML = `
        <h2 style="font-size:22px; color:#3F51B5; margin-bottom:8px;">Quantas materias no primeiro ciclo?</h2>
        <p style="color:#666; margin-bottom:24px;">Voce pode comecar com todas ou ir adicionando aos poucos conforme avanca.</p>

        <div style="display:flex; gap:12px; margin-bottom:20px;">
            <button class="onb-limite-opt" data-limitar="false" style="
                flex:1; padding:16px; border-radius:12px; text-align:center; cursor:pointer; transition:all 0.2s;
                border:2px solid ${!limitarAtivo ? '#3F51B5' : '#E1E4E8'};
                background:${!limitarAtivo ? '#E8EAF6' : 'white'};
            ">
                <div style="font-size:24px; margin-bottom:4px;">📚</div>
                <div style="font-weight:700; font-size:15px; color:${!limitarAtivo ? '#3F51B5' : '#333'};">Todas (${total})</div>
                <div style="font-size:12px; color:#888; margin-top:2px;">Desde o primeiro ciclo</div>
            </button>
            <button class="onb-limite-opt" data-limitar="true" style="
                flex:1; padding:16px; border-radius:12px; text-align:center; cursor:pointer; transition:all 0.2s;
                border:2px solid ${limitarAtivo ? '#3F51B5' : '#E1E4E8'};
                background:${limitarAtivo ? '#E8EAF6' : 'white'};
            ">
                <div style="font-size:24px; margin-bottom:4px;">🎯</div>
                <div style="font-weight:700; font-size:15px; color:${limitarAtivo ? '#3F51B5' : '#333'};">Gradual</div>
                <div style="font-size:12px; color:#888; margin-top:2px;">Comecar com poucas, crescer aos poucos</div>
            </button>
        </div>

        <div id="onbLimiteConfig" style="display:${limitarAtivo ? 'block' : 'none'}; background:#F5F7FA; border-radius:12px; padding:16px; margin-bottom:20px;">
            <div style="margin-bottom:16px;">
                <label style="font-size:14px; font-weight:600; color:#555; display:block; margin-bottom:6px;">Materias no ciclo inicial:</label>
                <div style="display:flex; align-items:center; gap:12px;">
                    <input type="range" id="onbMateriasIniciais" min="1" max="${total}" value="${_onboardingDados.materiasIniciais}" style="flex:1;">
                    <span id="onbMateriasIniciaisLabel" style="font-size:20px; font-weight:700; color:#3F51B5; min-width:30px; text-align:center;">${Math.min(_onboardingDados.materiasIniciais, total)}</span>
                </div>
            </div>
            <div>
                <label style="font-size:14px; font-weight:600; color:#555; display:block; margin-bottom:6px;">Novas materias a cada avanco:</label>
                <div style="display:flex; gap:8px;">
                    ${[1, 2, 3, 4].map(n => `
                        <button class="onb-incremento-btn" data-val="${n}" style="
                            flex:1; padding:10px; border-radius:8px; font-size:16px; font-weight:700; cursor:pointer; transition:all 0.15s;
                            border:2px solid ${_onboardingDados.materiasPorCiclo === n ? '#3F51B5' : '#E1E4E8'};
                            background:${_onboardingDados.materiasPorCiclo === n ? '#E8EAF6' : 'white'};
                            color:${_onboardingDados.materiasPorCiclo === n ? '#3F51B5' : '#888'};
                        ">+${n}</button>
                    `).join('')}
                </div>
            </div>
            <p style="font-size:12px; color:#999; margin-top:12px;">As materias serao priorizadas pela importancia e dificuldade que voce definiu.</p>
        </div>

        <div style="display:flex; justify-content:space-between; gap:10px;">
            <button onclick="onbVoltar()" style="background:#999; padding:10px 20px; border-radius:8px; color:white; border:none; cursor:pointer;">&larr; Voltar</button>
            <button onclick="onbAvancar()" style="background:#3F51B5; padding:10px 24px; border-radius:8px; color:white; border:none; cursor:pointer; font-weight:600;">Ver Resumo &rarr;</button>
        </div>
    `;

    container.querySelectorAll('.onb-limite-opt').forEach(btn => {
        btn.addEventListener('click', () => {
            _onboardingDados.limitarMaterias = btn.dataset.limitar === 'true';
            renderStep5LimiteMaterias(container);
        });
    });

    const slider = document.getElementById('onbMateriasIniciais');
    const sliderLabel = document.getElementById('onbMateriasIniciaisLabel');
    if (slider) {
        slider.addEventListener('input', () => {
            _onboardingDados.materiasIniciais = parseInt(slider.value);
            if (sliderLabel) sliderLabel.textContent = slider.value;
        });
    }

    container.querySelectorAll('.onb-incremento-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            _onboardingDados.materiasPorCiclo = parseInt(btn.dataset.val);
            renderStep5LimiteMaterias(container);
        });
    });
}

// ── Step 6: Resumo ──────────────────────────────────────────────────────────

function renderStep6Resumo(container) {
    const materias = _onboardingDados.materias;
    const horas = _onboardingDados.horasSemanais;
    const duracaoBloco = configuracoes?.duracaoBloco || 60;
    const totalBlocos = Math.floor((horas * 60) / duracaoBloco);

    // Calcular blocos por matéria (simulação)
    const materiasComFase = _calcularFasesMaterias(materias);
    const materiasAtivas = materiasComFase.filter(m => m.fase === 1);
    const blocosPorMateria = _simularBlocos(materiasAtivas, totalBlocos);

    const materiasProxFases = materiasComFase.filter(m => m.fase > 1);

    container.innerHTML = `
        <h2 style="font-size:22px; color:#3F51B5; margin-bottom:8px;">Tudo pronto!</h2>
        <p style="color:#666; margin-bottom:20px;">Confira o resumo e gere seu ciclo de estudos.</p>

        <div style="background:#F5F7FA; border-radius:12px; padding:20px; margin-bottom:20px;">
            <div style="display:flex; justify-content:space-around; text-align:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
                <div>
                    <div style="font-size:32px; font-weight:700; color:#3F51B5;">${horas}h</div>
                    <div style="font-size:13px; color:#888;">por semana</div>
                </div>
                <div>
                    <div style="font-size:32px; font-weight:700; color:#3F51B5;">${materiasAtivas.length}</div>
                    <div style="font-size:13px; color:#888;">materias${materiasProxFases.length > 0 ? ` (de ${materias.length})` : ''}</div>
                </div>
                <div>
                    <div style="font-size:32px; font-weight:700; color:#3F51B5;">${totalBlocos}</div>
                    <div style="font-size:13px; color:#888;">blocos de ${duracaoBloco}min</div>
                </div>
            </div>

            <div style="margin-bottom:12px;">
                <div style="font-size:13px; font-weight:600; color:#555; margin-bottom:8px;">Distribuicao dos blocos:</div>
                ${blocosPorMateria.map(b => {
                    const cor = b.importancia === 'muito' ? '#F44336' : b.importancia === 'medio' ? '#FF9800' : '#4CAF50';
                    const pct = totalBlocos > 0 ? Math.round((b.qtd / totalBlocos) * 100) : 0;
                    return `
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                            <span style="font-size:12px; font-weight:600; color:${cor}; min-width:36px;">${b.legenda}</span>
                            <div style="flex:1; height:20px; background:#E1E4E8; border-radius:10px; overflow:hidden;">
                                <div style="height:100%; width:${pct}%; background:${cor}; border-radius:10px; min-width:${b.qtd > 0 ? '8px' : '0'}; transition:width 0.3s;"></div>
                            </div>
                            <span style="font-size:13px; font-weight:700; color:#333; min-width:44px; text-align:right;">${b.qtd} ${b.meioBloco ? '(½)' : ''}</span>
                        </div>
                    `;
                }).join('')}
            </div>

            ${materiasProxFases.length > 0 ? `
                <div style="border-top:1px solid #E1E4E8; padding-top:12px; margin-top:8px;">
                    <div style="font-size:12px; color:#888; margin-bottom:6px;">Entram nas proximas fases (+${_onboardingDados.materiasPorCiclo} por avanco):</div>
                    <div style="display:flex; flex-wrap:wrap; gap:4px;">
                        ${materiasProxFases.map(m => `<span style="padding:3px 8px; border-radius:8px; font-size:11px; font-weight:600; background:#E1E4E833; color:#999; border:1px solid #E1E4E8;">${m.legenda}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
        </div>

        <div style="display:flex; justify-content:space-between; gap:10px;">
            <button onclick="onbVoltar()" style="background:#999; padding:10px 20px; border-radius:8px; color:white; border:none; cursor:pointer;">&larr; Voltar</button>
            <button onclick="onbFinalizar()" style="background:linear-gradient(135deg, #4CAF50, #2E7D32); padding:14px 32px; border-radius:10px; color:white; border:none; cursor:pointer; font-weight:700; font-size:16px; box-shadow:0 4px 12px rgba(76,175,80,.3);">Gerar Meu Ciclo!</button>
        </div>
    `;
}

function _calcularFasesMaterias(materias) {
    if (!_onboardingDados.limitarMaterias || materias.length === 0) {
        return materias.map(m => ({ ...m, fase: m.fase || 1 }));
    }

    const iniciais = Math.max(1, Math.min(_onboardingDados.materiasIniciais, materias.length));
    const porCiclo = _onboardingDados.materiasPorCiclo || 2;

    // Sort by priority: importancia "muito" first, then "medio", then "pouco"; within same, dificuldade "muito" first
    const sorted = [...materias].sort((a, b) => {
        const prioMap = { muito: 3, medio: 2, pouco: 1 };
        const pa = (prioMap[a.importancia] || 2) * 10 + (prioMap[a.dificuldade] || 2);
        const pb = (prioMap[b.importancia] || 2) * 10 + (prioMap[b.dificuldade] || 2);
        return pb - pa;
    });

    return sorted.map((m, idx) => {
        if (idx < iniciais) return { ...m, fase: 1 };
        const cicloExtra = Math.ceil((idx - iniciais + 1) / porCiclo);
        return { ...m, fase: 1 + cicloExtra };
    });
}

function _simularBlocos(materias, totalBlocos) {
    if (materias.length === 0) return [];

    const blocos = materias.map(m => {
        const peso = nivelParaPeso(m.importancia);
        const ext = nivelParaPeso(m.extensao);
        const dif = nivelParaPeso(m.dificuldade);
        const vp = peso * 0.5 + ext * 0.25 + dif * 0.25;
        return { legenda: m.legenda, importancia: m.importancia, valorPonderado: vp, meioBloco: false, qtd: 0 };
    });

    const totalP = blocos.reduce((s, b) => s + b.valorPonderado, 0);
    if (totalP === 0) return blocos;

    blocos.forEach(b => {
        b._share = (b.valorPonderado / totalP) * totalBlocos;
        b.qtd = Math.floor(b._share);
    });

    let atribuidos = blocos.reduce((s, b) => s + b.qtd, 0);
    const restos = blocos.map(b => ({ b, r: b._share - b.qtd })).sort((a, b) => b.r - a.r);
    let i = 0;
    while (atribuidos < totalBlocos && restos.length > 0) {
        restos[i % restos.length].b.qtd++;
        atribuidos++;
        i++;
        if (i > restos.length * 2) break;
    }

    blocos.forEach(b => { delete b._share; });
    return blocos;
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
    if (_onboardingStep === 5) {
        if (_onboardingDados.limitarMaterias) {
            _onboardingDados.materiasIniciais = parseInt(document.getElementById('onbMateriasIniciais')?.value) || 6;
        }
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

    // Apply phase assignments from limiter
    const materiasComFase = _calcularFasesMaterias(dados.materias);

    // Convert materias and set globals
    coresUsadas = [];
    const todasMaterias = materiasComFase.map(m => ({
        nome: m.nome,
        legenda: m.legenda,
        fase: m.fase || 1,
        peso: nivelParaPeso(m.importancia),
        extensao: nivelParaPeso(m.extensao),
        dificuldade: nivelParaPeso(m.dificuldade),
        cor: gerarCorUnica()
    }));
    const materiasDoPlano = todasMaterias.filter(m => m.fase <= 1);
    materiasList = materiasDoPlano.map(m => ({ nome: m.nome, legenda: m.legenda }));
    materiasSelecionadas = materiasDoPlano;

    const maxFaseCalculada = Math.max(1, ...todasMaterias.map(m => m.fase || 1));

    if (dados.planoBase) {
        const plano = dados.planoBase;
        const materiasPlano = plano.materias || [];
        // Apply phases from onboarding limiter to plan materias
        if (dados.limitarMaterias) {
            materiasPlano.forEach(mp => {
                const match = todasMaterias.find(tm => tm.legenda === mp.legenda);
                if (match) mp.fase = match.fase;
            });
        }
        const maxFase = Math.max(1, ...materiasPlano.map(m => m.fase || 1));
        faseAtual = 1;
        planoAdotado = {
            id: plano.id,
            nome: plano.nome,
            edital: plano.edital || null,
            materias: materiasPlano,
            maxFase,
            regras_evolucao: plano.regras_evolucao || []
        };

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
    } else if (maxFaseCalculada > 1) {
        faseAtual = 1;
        planoAdotado = {
            id: null,
            nome: dados.objetivo || 'Ciclo Manual',
            edital: null,
            materias: todasMaterias,
            maxFase: maxFaseCalculada,
            regras_evolucao: []
        };
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
