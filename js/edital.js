// ── Fase 5: Aba Edital - Acompanhamento do Conteúdo Programático ────────────

let editalProgresso = {}; // { "materia|topico|subtopico": { status, questoes_feitas, questoes_corretas } }

// ── Carregar / Salvar progresso do edital no Supabase ───────────────────────

async function carregarEditalProgresso() {
    if (!supabaseConfigurado() || !planoAdotado?.id) return;
    const user = await getUsuarioLogado();
    if (!user) return;

    const { data, error } = await supabaseClient
        .from('edital_progresso')
        .select('*')
        .eq('user_id', user.id)
        .eq('plano_id', planoAdotado.id);

    if (error) {
        console.error('Erro ao carregar progresso do edital:', error);
        return;
    }

    editalProgresso = {};
    (data || []).forEach(row => {
        const key = gerarChaveEdital(row.materia, row.topico, row.subtopico);
        editalProgresso[key] = {
            status: row.status || 'pendente',
            questoes_feitas: row.questoes_feitas || 0,
            questoes_corretas: row.questoes_corretas || 0
        };
    });
}

async function salvarEditalProgressoItem(materia, topico, subtopico, dados) {
    if (!supabaseConfigurado() || !planoAdotado?.id) return;
    const user = await getUsuarioLogado();
    if (!user) return;

    const registro = {
        user_id: user.id,
        plano_id: planoAdotado.id,
        materia,
        topico,
        subtopico: subtopico || null,
        status: dados.status || 'pendente',
        questoes_feitas: dados.questoes_feitas || 0,
        questoes_corretas: dados.questoes_corretas || 0,
        updated_at: new Date().toISOString()
    };

    // Proteção multi-dispositivo: um dispositivo com estado antigo nunca
    // rebaixa o status nem reduz a contagem de questões já gravada.
    let query = supabaseClient
        .from('edital_progresso')
        .select('status, questoes_feitas, questoes_corretas')
        .eq('user_id', user.id)
        .eq('plano_id', planoAdotado.id)
        .eq('materia', materia)
        .eq('topico', topico);
    query = subtopico ? query.eq('subtopico', subtopico) : query.is('subtopico', null);
    const { data: atual } = await query.maybeSingle();

    if (atual) {
        const rank = typeof RANK_STATUS_EDITAL !== 'undefined'
            ? RANK_STATUS_EDITAL
            : { pendente: 0, em_andamento: 1, visto: 2, concluido: 3 };
        if ((rank[atual.status] || 0) > (rank[registro.status] || 0)) registro.status = atual.status;
        registro.questoes_feitas = Math.max(registro.questoes_feitas, atual.questoes_feitas || 0);
        registro.questoes_corretas = Math.max(registro.questoes_corretas, atual.questoes_corretas || 0);

        const chave = gerarChaveEdital(materia, topico, subtopico);
        if (editalProgresso[chave]) {
            editalProgresso[chave].status = registro.status;
            editalProgresso[chave].questoes_feitas = registro.questoes_feitas;
            editalProgresso[chave].questoes_corretas = registro.questoes_corretas;
        }
    }

    const { error } = await supabaseClient
        .from('edital_progresso')
        .upsert(registro, {
            onConflict: 'user_id,plano_id,materia,topico,subtopico'
        });

    if (error) {
        console.error('Erro ao salvar progresso do edital:', error);
    }
}

function gerarChaveEdital(materia, topico, subtopico) {
    return [materia, topico, subtopico || ''].join('|');
}

// ── Lookup de matéria por ID estável (T2) ──────────────────────────────────

function _encontrarMateriaEditalPorId(materiaBloco) {
    if (!planoAdotado?.edital || !materiasSelecionadas) return null;
    const matSel = materiasSelecionadas.find(m => m.nome === materiaBloco || m.legenda === materiaBloco);
    if (!matSel?.materia_edital_id) return null;
    return planoAdotado.edital.find(e => e.id === matSel.materia_edital_id) || null;
}

function _encontrarMateriaEditalFuzzy(materiaBloco) {
    if (!planoAdotado?.edital) return null;
    const materiaBlNorm = normalizarTexto(materiaBloco);
    let melhorMateria = null, melhorSim = 0;
    for (const materiaObj of planoAdotado.edital) {
        const sim = calcularSimilaridade(materiaBlNorm, normalizarTexto(materiaObj.materia));
        if (sim > melhorSim) { melhorSim = sim; melhorMateria = materiaObj; }
    }
    return (melhorMateria && melhorSim >= 0.4) ? melhorMateria : null;
}

// ── Renderizar aba Edital (árvore accordion) ────────────────────────────────

function renderizarEdital() {
    const arvore = document.getElementById('editalArvore');
    const vazio = document.getElementById('editalVazio');
    const resumo = document.getElementById('editalResumo');
    if (!arvore) return;

    const edital = planoAdotado?.edital;
    if (!edital || edital.length === 0) {
        arvore.innerHTML = '';
        if (vazio) vazio.style.display = 'block';
        if (resumo) resumo.style.display = 'none';
        return;
    }

    if (vazio) vazio.style.display = 'none';
    if (resumo) resumo.style.display = 'block';

    document.getElementById('editalPlanoNome').textContent = planoAdotado.nome || 'Edital';

    const filtroStatus = document.getElementById('editalFiltroStatus')?.value || 'todos';
    const busca = (document.getElementById('editalBusca')?.value || '').toLowerCase().trim();

    // Calcular progresso geral
    let totalItens = 0;
    let itensConcluidos = 0;

    arvore.innerHTML = '';

    edital.forEach((materiaObj, materiaIdx) => {
        const materiaDiv = document.createElement('div');
        materiaDiv.className = 'edital-materia';

        let materiaItens = 0;
        let materiaConcluidos = 0;
        let topicosHTML = '';
        let temItemVisivel = false;

        const topicosOrdenados = [...(materiaObj.topicos || [])].sort((a, b) => (a.ordem || 999) - (b.ordem || 999));

        topicosOrdenados.forEach((topicoObj, topicoIdx) => {
            const subtopicos = topicoObj.subtopicos || [];
            const temSubtopicos = subtopicos.length > 0;

            if (temSubtopicos) {
                let subtopicosHTML = '';
                let topicoVisivel = false;

                subtopicos.forEach(sub => {
                    const nomeSub = nomeSubtopico(sub);
                    const chave = gerarChaveEdital(materiaObj.materia, topicoObj.nome, nomeSub);
                    const prog = editalProgresso[chave] || { status: 'pendente', questoes_feitas: 0, questoes_corretas: 0 };
                    totalItens++;
                    materiaItens++;
                    if (prog.status === 'concluido' || prog.status === 'visto') { itensConcluidos++; materiaConcluidos++; }

                    if (filtroStatus !== 'todos' && prog.status !== filtroStatus) return;
                    if (busca && !nomeSub.toLowerCase().includes(busca) && !topicoObj.nome.toLowerCase().includes(busca)) return;

                    topicoVisivel = true;
                    temItemVisivel = true;
                    subtopicosHTML += criarItemEdital(materiaObj.materia, topicoObj.nome, nomeSub, prog, undefined, undefined);
                });

                if (topicoVisivel || (!busca && filtroStatus === 'todos')) {
                    const topicoProgresso = calcularProgressoTopico(materiaObj.materia, topicoObj.nome, subtopicos);
                    topicosHTML += `
                        <div class="edital-topico" draggable="true" data-materia-idx="${materiaIdx}" data-topico-idx="${topicoIdx}">
                            <div class="edital-topico__header" onclick="toggleEditalTopico(this)">
                                <span class="edital-topico__drag" style="cursor:grab; color:#bbb; margin-right:4px; font-size:14px;" title="Arrastar para reordenar">&#9776;</span>
                                <span class="edital-topico__arrow">&#9654;</span>
                                <span class="edital-topico__nome">${topicoObj.nome}</span>
                                <span class="edital-topico__progresso">${topicoProgresso.concluidos}/${topicoProgresso.total}</span>
                                <div class="edital-barra-container edital-barra-container--sm">
                                    <div class="edital-barra" style="width:${topicoProgresso.pct}%;"></div>
                                </div>
                            </div>
                            <div class="edital-topico__subtopicos" style="display:none;">
                                ${subtopicosHTML}
                            </div>
                        </div>
                    `;
                }
            } else {
                // Tópico sem subtópicos — é o item em si
                const chave = gerarChaveEdital(materiaObj.materia, topicoObj.nome, null);
                const prog = editalProgresso[chave] || { status: 'pendente', questoes_feitas: 0, questoes_corretas: 0 };
                totalItens++;
                materiaItens++;
                if (prog.status === 'concluido' || prog.status === 'visto') { itensConcluidos++; materiaConcluidos++; }

                if (filtroStatus !== 'todos' && prog.status !== filtroStatus) return;
                if (busca && !topicoObj.nome.toLowerCase().includes(busca)) return;

                temItemVisivel = true;
                topicosHTML += criarItemEdital(materiaObj.materia, topicoObj.nome, null, prog, topicoIdx, materiaIdx);
            }
        });

        if (!temItemVisivel && (busca || filtroStatus !== 'todos')) return;

        const materiaPct = materiaItens > 0 ? Math.round((materiaConcluidos / materiaItens) * 100) : 0;

        materiaDiv.innerHTML = `
            <div class="edital-materia__header" onclick="toggleEditalMateria(this)">
                <span class="edital-materia__arrow">&#9654;</span>
                <strong class="edital-materia__nome">${materiaObj.materia}</strong>
                <span class="edital-materia__progresso">${materiaConcluidos}/${materiaItens} (${materiaPct}%)</span>
                <div class="edital-barra-container">
                    <div class="edital-barra" style="width:${materiaPct}%;"></div>
                </div>
            </div>
            <div class="edital-materia__conteudo" style="display:none;">
                ${topicosHTML}
            </div>
        `;
        arvore.appendChild(materiaDiv);
    });

    // Atualizar progresso geral
    const pctGeral = totalItens > 0 ? Math.round((itensConcluidos / totalItens) * 100) : 0;
    document.getElementById('editalProgressoGeral').textContent = `${itensConcluidos}/${totalItens} concluídos (${pctGeral}%)`;
    document.getElementById('editalBarraGeral').style.width = pctGeral + '%';

    // Drag and drop para reordenar tópicos
    inicializarDragDropEdital(arvore);

    // Atualizar sugestões nos cards de blocos (edital agora confirmado carregado)
    if (typeof atualizarSugestoesBlocos === 'function') atualizarSugestoesBlocos();
}

function inicializarDragDropEdital(container) {
    const draggables = container.querySelectorAll('[draggable="true"]');

    draggables.forEach(el => {
        el.addEventListener('dragstart', function(e) {
            e.stopPropagation();
            this.classList.add('edital-dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', JSON.stringify({
                materiaIdx: parseInt(this.dataset.materiaIdx),
                topicoIdx: parseInt(this.dataset.topicoIdx)
            }));
        });

        el.addEventListener('dragend', function() {
            this.classList.remove('edital-dragging');
            container.querySelectorAll('.edital-drag-over').forEach(o => o.classList.remove('edital-drag-over'));
        });

        el.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            this.classList.add('edital-drag-over');
        });

        el.addEventListener('dragleave', function() {
            this.classList.remove('edital-drag-over');
        });

        el.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('edital-drag-over');

            const source = JSON.parse(e.dataTransfer.getData('text/plain'));
            const targetMateriaIdx = parseInt(this.dataset.materiaIdx);
            const targetTopicoIdx = parseInt(this.dataset.topicoIdx);

            if (source.materiaIdx !== targetMateriaIdx) return;
            if (source.topicoIdx === targetTopicoIdx) return;

            const edital = planoAdotado?.edital;
            if (!edital) return;

            const topicos = edital[source.materiaIdx].topicos;
            const [moved] = topicos.splice(source.topicoIdx, 1);
            topicos.splice(targetTopicoIdx, 0, moved);

            // Update ordem values to reflect new positions
            topicos.forEach((t, i) => { t.ordem = i + 1; });

            salvarEstado();
            renderizarEdital();
        });
    });
}

function criarItemEdital(materia, topico, subtopico, prog, topicoIdx, materiaIdx) {
    const label = subtopico || topico;
    const statusClass = `edital-status--${prog.status}`;

    let questoesInfo = '';
    if (prog.questoes_feitas > 0) {
        const pct = Math.round((prog.questoes_corretas / prog.questoes_feitas) * 100);
        questoesInfo = `<span class="edital-item__questoes">${prog.questoes_corretas}/${prog.questoes_feitas} questões (${pct}%)</span>`;
    }

    const dataAttrs = `data-materia="${materia}" data-topico="${topico}" data-subtopico="${subtopico || ''}"`;
    const dragAttrs = !subtopico && topicoIdx !== undefined
        ? `draggable="true" data-materia-idx="${materiaIdx}" data-topico-idx="${topicoIdx}"`
        : '';
    const dragHandle = !subtopico && topicoIdx !== undefined
        ? '<span style="cursor:grab; color:#bbb; margin-right:6px; font-size:14px;" title="Arrastar para reordenar">&#9776;</span>'
        : '';

    return `
        <div class="edital-item ${statusClass}" ${dataAttrs} ${dragAttrs}>
            ${dragHandle}
            <div class="edital-item__info">
                <span class="edital-item__label">${label}</span>
                ${questoesInfo}
            </div>
            <div class="edital-item__actions">
                <select class="edital-item__select" onchange="alterarStatusEdital(this, '${materia}', '${topico}', '${subtopico || ''}')">
                    <option value="pendente" ${prog.status === 'pendente' ? 'selected' : ''}>Pendente</option>
                    <option value="em_andamento" ${prog.status === 'em_andamento' ? 'selected' : ''}>Em andamento</option>
                    <option value="visto" ${prog.status === 'visto' ? 'selected' : ''}>Visto</option>
                    <option value="concluido" ${prog.status === 'concluido' ? 'selected' : ''}>Concluído</option>
                </select>
            </div>
        </div>
    `;
}

function calcularProgressoTopico(materia, topico, subtopicos) {
    let total = subtopicos.length;
    let concluidos = 0;
    subtopicos.forEach(sub => {
        const chave = gerarChaveEdital(materia, topico, nomeSubtopico(sub));
        const prog = editalProgresso[chave];
        if (prog && (prog.status === 'concluido' || prog.status === 'visto')) concluidos++;
    });
    return {
        total,
        concluidos,
        pct: total > 0 ? Math.round((concluidos / total) * 100) : 0
    };
}

// ── Interações: accordion toggle, alterar status ────────────────────────────

function toggleEditalMateria(header) {
    const conteudo = header.nextElementSibling;
    const arrow = header.querySelector('.edital-materia__arrow');
    const aberto = conteudo.style.display !== 'none';
    conteudo.style.display = aberto ? 'none' : 'block';
    arrow.style.transform = aberto ? '' : 'rotate(90deg)';
}

function toggleEditalTopico(header) {
    const conteudo = header.nextElementSibling;
    const arrow = header.querySelector('.edital-topico__arrow');
    const aberto = conteudo.style.display !== 'none';
    conteudo.style.display = aberto ? 'none' : 'block';
    arrow.style.transform = aberto ? '' : 'rotate(90deg)';
}

async function alterarStatusEdital(select, materia, topico, subtopico) {
    const novoStatus = select.value;
    const chave = gerarChaveEdital(materia, topico, subtopico || null);

    if (!editalProgresso[chave]) {
        editalProgresso[chave] = { status: 'pendente', questoes_feitas: 0, questoes_corretas: 0 };
    }
    editalProgresso[chave].status = novoStatus;

    // Atualizar visual do item
    const item = select.closest('.edital-item');
    if (item) {
        item.className = `edital-item edital-status--${novoStatus}`;
    }

    await salvarEditalProgressoItem(materia, topico, subtopico || null, editalProgresso[chave]);
    renderizarEdital();
}

// ── Match automático: assunto → tópico do edital ────────────────────────────

function atualizarProgressoEdital(materia, assunto, questoes, statusDesejado) {
    if (!planoAdotado?.edital || !assunto) return;

    const edital = planoAdotado.edital;
    const match = encontrarMatchEdital(materia, assunto, edital);

    if (match) {
        const chave = gerarChaveEdital(match.materia, match.topico, match.subtopico);
        if (!editalProgresso[chave]) {
            editalProgresso[chave] = { status: 'pendente', questoes_feitas: 0, questoes_corretas: 0 };
        }

        const atual = editalProgresso[chave].status;
        const novoStatus = statusDesejado || 'visto';
        // Never downgrade from 'concluido' (manual only), and 'visto' > 'em_andamento'
        if (atual !== 'concluido' && !(atual === 'visto' && novoStatus === 'em_andamento')) {
            editalProgresso[chave].status = novoStatus;
        }
        if (questoes && questoes.feitas > 0) {
            editalProgresso[chave].questoes_feitas += questoes.feitas;
            editalProgresso[chave].questoes_corretas += questoes.corretas;
        }

        if (typeof registrarEvento === 'function') {
            registrarEvento('topico_status', {
                materia: match.materia,
                topico: match.topico,
                subtopico: match.subtopico || null,
                status: editalProgresso[chave].status,
                questoes: questoes || null
            });
        }

        salvarEditalProgressoItem(match.materia, match.topico, match.subtopico, editalProgresso[chave]);
        if (typeof renderizarEdital === 'function') renderizarEdital();
        if (typeof renderizarRevisao === 'function') renderizarRevisao();
    }
}

function encontrarMatchEdital(materiaBloco, assunto, edital) {
    const assuntoNorm = normalizarTexto(assunto);
    let melhorMatch = null;
    let melhorScore = 0;

    const materiaById = _encontrarMateriaEditalPorId(materiaBloco);
    const materiasParaBuscar = materiaById ? [materiaById] : edital;

    materiasParaBuscar.forEach(materiaObj => {
        if (!materiaById) {
            const materiaNorm = normalizarTexto(materiaObj.materia);
            const mesmaMateria = materiaNorm.includes(normalizarTexto(materiaBloco)) ||
                                 normalizarTexto(materiaBloco).includes(materiaNorm);
            if (!mesmaMateria) return;
        }

        (materiaObj.topicos || []).forEach(topicoObj => {
            const subtopicos = topicoObj.subtopicos || [];

            if (subtopicos.length > 0) {
                subtopicos.forEach(sub => {
                    const nomeSub = nomeSubtopico(sub);
                    const score = calcularSimilaridade(assuntoNorm, normalizarTexto(nomeSub));
                    if (score > melhorScore && score >= 0.4) {
                        melhorScore = score;
                        melhorMatch = { materia: materiaObj.materia, topico: topicoObj.nome, subtopico: nomeSub };
                    }
                });
            }

            // Também comparar com o tópico
            const scoreTopic = calcularSimilaridade(assuntoNorm, normalizarTexto(topicoObj.nome));
            if (scoreTopic > melhorScore && scoreTopic >= 0.4) {
                melhorScore = scoreTopic;
                melhorMatch = { materia: materiaObj.materia, topico: topicoObj.nome, subtopico: subtopicos.length > 0 ? null : null };
                // Se não tem subtópicos, o match é o próprio tópico
                if (subtopicos.length === 0) {
                    melhorMatch.subtopico = null;
                }
            }
        });
    });

    return melhorMatch;
}

function normalizarTexto(texto) {
    return (texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
}

function calcularSimilaridade(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;

    // Verificar se um contém o outro
    if (a.includes(b) || b.includes(a)) return 0.9;

    // Palavras em comum
    const palavrasA = a.split(/\s+/).filter(p => p.length > 2);
    const palavrasB = b.split(/\s+/).filter(p => p.length > 2);
    if (palavrasA.length === 0 || palavrasB.length === 0) return 0;

    let comuns = 0;
    palavrasA.forEach(pa => {
        if (palavrasB.some(pb => pb.includes(pa) || pa.includes(pb))) comuns++;
    });

    return comuns / Math.max(palavrasA.length, palavrasB.length);
}

// ── Validação: verificar correspondência matérias ↔ edital ─────────────────

function validarMateriasContraEdital(materias, edital) {
    if (!edital || edital.length === 0 || !materias || materias.length === 0) return [];

    const semCorrespondencia = [];
    const editalNomes = edital.map(e => normalizarTexto(e.materia));

    materias.forEach(m => {
        const nomeNorm = normalizarTexto(m.nome);
        let melhorScore = 0;
        let melhorNome = '';
        editalNomes.forEach((en, idx) => {
            const s = calcularSimilaridade(nomeNorm, en);
            if (s > melhorScore) {
                melhorScore = s;
                melhorNome = edital[idx].materia;
            }
        });
        if (melhorScore < 0.4) {
            semCorrespondencia.push({ materia: m.nome, legenda: m.legenda, melhorCandidata: melhorNome, score: melhorScore });
        }
    });

    return semCorrespondencia;
}

// ── Autocomplete: preencher datalist com tópicos do edital ──────────────────

function preencherDatalistEdital(materiaBloco) {
    const datalist = document.getElementById('datalistTopicosEdital');
    if (!datalist) return;
    datalist.innerHTML = '';

    if (!planoAdotado?.edital) return;

    const materiaObj = _encontrarMateriaEditalPorId(materiaBloco) || _encontrarMateriaEditalFuzzy(materiaBloco);
    if (!materiaObj) return;

    (materiaObj.topicos || []).forEach(topicoObj => {
        const subtopicos = topicoObj.subtopicos || [];
        if (subtopicos.length > 0) {
            subtopicos.forEach(sub => {
                const nomeSub = nomeSubtopico(sub);
                const chave = gerarChaveEdital(materiaObj.materia, topicoObj.nome, nomeSub);
                const prog = editalProgresso[chave];
                const jaConcluido = prog && prog.status === 'concluido';
                const opt = document.createElement('option');
                opt.value = nomeSub;
                opt.label = jaConcluido ? `${nomeSub} (concluído)` : nomeSub;
                datalist.appendChild(opt);
            });
        } else {
            const chave = gerarChaveEdital(materiaObj.materia, topicoObj.nome, null);
            const prog = editalProgresso[chave];
            const jaConcluido = prog && prog.status === 'concluido';
            const opt = document.createElement('option');
            opt.value = topicoObj.nome;
            opt.label = jaConcluido ? `${topicoObj.nome} (concluído)` : topicoObj.nome;
            datalist.appendChild(opt);
        }
    });
}

// ── Visibilidade da aba Edital ──────────────────────────────────────────────

function obterAssuntoSugerido(materiaBloco) {
    if (!planoAdotado?.edital) return null;

    const melhorMateria = _encontrarMateriaEditalPorId(materiaBloco) || _encontrarMateriaEditalFuzzy(materiaBloco);
    if (!melhorMateria) return null;

    const topicos = [...(melhorMateria.topicos || [])].sort((a, b) => (a.ordem || 999) - (b.ordem || 999));

    for (const topicoObj of topicos) {
        const subtopicos = topicoObj.subtopicos || [];
        if (subtopicos.length > 0) {
            for (const sub of subtopicos) {
                const nomeSub = nomeSubtopico(sub);
                const chave = gerarChaveEdital(melhorMateria.materia, topicoObj.nome, nomeSub);
                const prog = editalProgresso[chave];
                if (!prog || prog.status === 'pendente') return nomeSub;
            }
        } else {
            const chave = gerarChaveEdital(melhorMateria.materia, topicoObj.nome, null);
            const prog = editalProgresso[chave];
            if (!prog || prog.status === 'pendente') return topicoObj.nome;
        }
    }
    return null;
}

function atualizarVisibilidadeEdital() {
    const tabEdital = document.querySelector('.tab[data-tab="edital"]');
    if (!tabEdital) return;

    const temEdital = planoAdotado?.edital && planoAdotado.edital.length > 0;
    tabEdital.style.display = temEdital ? 'inline-block' : 'none';

    if (typeof atualizarVisibilidadeRevisao === 'function') {
        atualizarVisibilidadeRevisao();
    }
}

// ── Editor de Edital (professor) ────────────────────────────────────────────

let editalEditando = []; // Array de { materia, topicos: [{ nome, subtopicos: [] }] }

function renderizarEditorEdital(edital) {
    editalEditando = JSON.parse(JSON.stringify(edital || []));
    atualizarEditorEditalUI();
}

function atualizarEditorEditalUI() {
    const container = document.getElementById('editalEditorContainer');
    if (!container) return;

    if (editalEditando.length === 0) {
        container.innerHTML = '<p style="color:#999; font-size:13px;">Nenhuma matéria no edital. Clique em "+ Adicionar Matéria" ou importe via Excel/CSV.</p>';
        return;
    }

    let html = '';
    editalEditando.forEach((materiaObj, mIdx) => {
        html += `
            <div class="edital-editor-materia" style="border:1px solid var(--border-color); border-radius:8px; padding:12px; margin-bottom:12px; background:#fafafa;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <input type="text" value="${materiaObj.materia || ''}" placeholder="Nome da Matéria"
                        onchange="editalEditando[${mIdx}].materia = this.value.trim()"
                        style="font-weight:bold; font-size:14px; border:1px solid var(--border-color); border-radius:4px; padding:6px 10px; flex:1; margin-right:8px;">
                    <button onclick="removerMateriaEdital(${mIdx})" style="background:#FF6B6B; padding:4px 10px; font-size:12px;">&times;</button>
                </div>
                <div style="margin-left:16px;">
                    ${renderizarTopicosEditor(materiaObj.topicos || [], mIdx)}
                    <button onclick="adicionarTopicoEdital(${mIdx})" style="font-size:12px; padding:4px 12px; background:#26A69A; margin-top:6px;">+ Tópico</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function renderizarTopicosEditor(topicos, mIdx) {
    let html = '';
    topicos.forEach((topico, tIdx) => {
        html += `
            <div style="margin-bottom:8px; padding:8px; background:white; border:1px solid #eee; border-radius:4px;">
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                    <input type="text" value="${topico.nome || ''}" placeholder="Nome do Tópico"
                        onchange="editalEditando[${mIdx}].topicos[${tIdx}].nome = this.value.trim()"
                        style="font-size:13px; border:1px solid var(--border-color); border-radius:4px; padding:4px 8px; flex:1;">
                    <button onclick="removerTopicoEdital(${mIdx}, ${tIdx})" style="background:#FF6B6B; padding:2px 8px; font-size:11px;">&times;</button>
                </div>
                <div style="margin-left:20px;">
                    ${renderizarSubtopicosEditor(topico.subtopicos || [], mIdx, tIdx)}
                    <button onclick="adicionarSubtopicoEdital(${mIdx}, ${tIdx})" style="font-size:11px; padding:2px 10px; background:#78909C; margin-top:4px;">+ Subtópico</button>
                </div>
            </div>
        `;
    });
    return html;
}

function renderizarSubtopicosEditor(subtopicos, mIdx, tIdx) {
    let html = '';
    subtopicos.forEach((sub, sIdx) => {
        const nomeSub = typeof nomeSubtopico === 'function' ? nomeSubtopico(sub) : (typeof sub === 'string' ? sub : sub?.nome || '');
        html += `
            <div style="display:flex; align-items:center; gap:4px; margin-bottom:3px;">
                <span style="color:#999; font-size:11px;">&#8226;</span>
                <input type="text" value="${nomeSub}" placeholder="Subtópico"
                    onchange="editalEditando[${mIdx}].topicos[${tIdx}].subtopicos[${sIdx}] = this.value.trim()"
                    style="font-size:12px; border:1px solid #ddd; border-radius:3px; padding:3px 6px; flex:1;">
                <button onclick="removerSubtopicoEdital(${mIdx}, ${tIdx}, ${sIdx})" style="background:#FF6B6B; padding:1px 6px; font-size:10px;">&times;</button>
            </div>
        `;
    });
    return html;
}

function adicionarMateriaEdital() {
    editalEditando.push({ materia: '', topicos: [] });
    atualizarEditorEditalUI();
}

function removerMateriaEdital(mIdx) {
    editalEditando.splice(mIdx, 1);
    atualizarEditorEditalUI();
}

function adicionarTopicoEdital(mIdx) {
    if (!editalEditando[mIdx].topicos) editalEditando[mIdx].topicos = [];
    editalEditando[mIdx].topicos.push({ nome: '', subtopicos: [] });
    atualizarEditorEditalUI();
}

function removerTopicoEdital(mIdx, tIdx) {
    editalEditando[mIdx].topicos.splice(tIdx, 1);
    atualizarEditorEditalUI();
}

function adicionarSubtopicoEdital(mIdx, tIdx) {
    if (!editalEditando[mIdx].topicos[tIdx].subtopicos) editalEditando[mIdx].topicos[tIdx].subtopicos = [];
    editalEditando[mIdx].topicos[tIdx].subtopicos.push('');
    atualizarEditorEditalUI();
}

function removerSubtopicoEdital(mIdx, tIdx, sIdx) {
    editalEditando[mIdx].topicos[tIdx].subtopicos.splice(sIdx, 1);
    atualizarEditorEditalUI();
}

function coletarEditalDoEditor() {
    return editalEditando
        .filter(m => m.materia && m.materia.trim())
        .map(m => ({
            materia: m.materia.trim(),
            topicos: (m.topicos || [])
                .filter(t => t.nome && t.nome.trim())
                .map((t, idx) => ({
                    nome: t.nome.trim(),
                    subtopicos: (t.subtopicos || []).filter(s => s && s.trim()).map(s => s.trim()),
                    ordem: t.ordem || (idx + 1)
                }))
        }));
}

// ── Import/Export Edital Excel/CSV ──────────────────────────────────────────

function uploadEditalExcel() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.style.display = 'none';
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        processarArquivoEdital(file);
        input.remove();
    });
    document.body.appendChild(input);
    input.click();
}

function processarArquivoEdital(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            if (rows.length === 0) {
                alert('O arquivo está vazio.');
                return;
            }

            const editalImportado = converterLinhasParaEdital(rows);
            if (editalImportado.length === 0) {
                alert('Nenhum dado válido encontrado. Verifique se o arquivo possui colunas "Materia", "Topico" e opcionalmente "Subtopico".');
                return;
            }

            mostrarPreviewEdital(editalImportado);
        } catch (err) {
            console.error('Erro ao processar arquivo de edital:', err);
            alert('Erro ao ler o arquivo.');
        }
    };
    reader.readAsArrayBuffer(file);
}

function converterLinhasParaEdital(rows) {
    const mapa = {};
    const ordemMapa = {};

    rows.forEach(row => {
        const materia = (row['Materia'] || row['materia'] || row['MATERIA'] || row['Matéria'] || row['matéria'] || '').trim();
        const topico = (row['Topico'] || row['topico'] || row['TOPICO'] || row['Tópico'] || row['tópico'] || '').trim();
        const subtopico = (row['Subtopico'] || row['subtopico'] || row['SUBTOPICO'] || row['Subtópico'] || row['subtópico'] || '').trim();
        const ordem = parseInt(row['Ordem'] || row['ordem'] || row['ORDEM'] || '') || 999;

        if (!materia || !topico) return;

        if (!mapa[materia]) mapa[materia] = {};
        if (!mapa[materia][topico]) mapa[materia][topico] = [];
        if (!ordemMapa[materia]) ordemMapa[materia] = {};
        if (!ordemMapa[materia][topico]) ordemMapa[materia][topico] = ordem;
        // Keep the lowest ordem value for this topic
        if (ordem < ordemMapa[materia][topico]) ordemMapa[materia][topico] = ordem;

        if (subtopico && !mapa[materia][topico].includes(subtopico)) {
            mapa[materia][topico].push(subtopico);
        }
    });

    return Object.entries(mapa).map(([materia, topicos]) => ({
        materia,
        topicos: Object.entries(topicos)
            .map(([nome, subtopicos]) => ({
                nome,
                subtopicos,
                ordem: ordemMapa[materia]?.[nome] || 999
            }))
            .sort((a, b) => a.ordem - b.ordem)
    }));
}

function mostrarPreviewEdital(editalImportado) {
    let modal = document.getElementById('modalPreviewEdital');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalPreviewEdital';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }

    let totalTopicos = 0;
    let totalSubtopicos = 0;
    let previewHTML = '';

    editalImportado.forEach(m => {
        previewHTML += `<div style="margin-bottom:8px;"><strong>${m.materia}</strong>`;
        (m.topicos || []).forEach(t => {
            totalTopicos++;
            previewHTML += `<div style="margin-left:16px; font-size:13px;">&#8226; ${t.nome}`;
            (t.subtopicos || []).forEach(s => {
                totalSubtopicos++;
                previewHTML += `<div style="margin-left:32px; font-size:12px; color:#666;">&#8226; ${s}</div>`;
            });
            previewHTML += `</div>`;
        });
        previewHTML += `</div>`;
    });

    modal.innerHTML = `
        <div class="modal-card" style="max-width:600px;">
            <h3>Preview do Edital</h3>
            <p>${editalImportado.length} matéria(s), ${totalTopicos} tópico(s), ${totalSubtopicos} subtópico(s)</p>
            <div style="max-height:350px; overflow-y:auto; margin:12px 0; padding:8px; background:#f9f9f9; border-radius:6px;">
                ${previewHTML}
            </div>
            <div class="modal-actions">
                <button id="btnConfirmarEditalImport" style="background:#4CAF50;">Confirmar</button>
                <button id="btnCancelarEditalImport" style="background:#999;">Cancelar</button>
            </div>
        </div>
    `;

    modal.classList.add('active');

    document.getElementById('btnConfirmarEditalImport').addEventListener('click', () => {
        modal.classList.remove('active');
        editalEditando = editalImportado;
        atualizarEditorEditalUI();
        alert('Edital importado com sucesso!');
    });

    document.getElementById('btnCancelarEditalImport').addEventListener('click', () => {
        modal.classList.remove('active');
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });
}

function baixarModeloEdital() {
    const wb = XLSX.utils.book_new();
    const dados = [
        { Materia: 'CONTABILIDADE GERAL', Topico: 'Balanço Patrimonial', Subtopico: 'Ativo Circulante', Ordem: 1 },
        { Materia: 'CONTABILIDADE GERAL', Topico: 'Balanço Patrimonial', Subtopico: 'Passivo Circulante', Ordem: 1 },
        { Materia: 'CONTABILIDADE GERAL', Topico: 'Balanço Patrimonial', Subtopico: 'Patrimônio Líquido', Ordem: 1 },
        { Materia: 'CONTABILIDADE GERAL', Topico: 'DRE', Subtopico: 'Receitas', Ordem: 2 },
        { Materia: 'CONTABILIDADE GERAL', Topico: 'DRE', Subtopico: 'Despesas', Ordem: 2 },
        { Materia: 'AFO', Topico: 'Orçamento Público', Subtopico: '', Ordem: 1 },
        { Materia: 'AFO', Topico: 'Ciclo Orçamentário', Subtopico: 'PPA', Ordem: 2 },
        { Materia: 'AFO', Topico: 'Ciclo Orçamentário', Subtopico: 'LDO', Ordem: 2 },
        { Materia: 'AFO', Topico: 'Ciclo Orçamentário', Subtopico: 'LOA', Ordem: 2 }
    ];
    const ws = XLSX.utils.json_to_sheet(dados);
    ws['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Edital');
    XLSX.writeFile(wb, 'modelo_edital.xlsx');
}

// ── Ciclo Progressivo: verificação de avanço de fase ─────────────────────────

function obterRegraFase(fase) {
    const regras = planoAdotado?.regras_evolucao || [];
    return regras.find(r => r.fase === fase) || null;
}

function calcularQuestoesFase(legendasSet) {
    let totalFeitas = 0;
    let totalCorretas = 0;

    if (!planoAdotado?.edital) return { feitas: 0, corretas: 0 };

    planoAdotado.edital.forEach(materiaObj => {
        const matchLegenda = [...legendasSet].some(leg => {
            const matSel = (planoAdotado.materias || []).find(m => m.legenda === leg);
            if (!matSel) return false;
            if (matSel.materia_edital_id) return matSel.materia_edital_id === materiaObj.id;
            return calcularSimilaridade(normalizarTexto(matSel.nome), normalizarTexto(materiaObj.materia)) >= 0.4;
        });
        if (!matchLegenda) return;

        (materiaObj.topicos || []).forEach(topico => {
            const subtopicos = topico.subtopicos || [];
            if (subtopicos.length > 0) {
                subtopicos.forEach(sub => {
                    const chave = gerarChaveEdital(materiaObj.materia, topico.nome, nomeSubtopico(sub));
                    const prog = editalProgresso[chave];
                    if (prog) {
                        totalFeitas += prog.questoes_feitas || 0;
                        totalCorretas += prog.questoes_corretas || 0;
                    }
                });
            } else {
                const chave = gerarChaveEdital(materiaObj.materia, topico.nome, '');
                const prog = editalProgresso[chave];
                if (prog) {
                    totalFeitas += prog.questoes_feitas || 0;
                    totalCorretas += prog.questoes_corretas || 0;
                }
            }
        });
    });

    return { feitas: totalFeitas, corretas: totalCorretas };
}

function verificarProgressoFase() {
    if (!planoAdotado?.materias || !planoAdotado.maxFase || planoAdotado.maxFase <= 1) return;
    if (faseAtual >= planoAdotado.maxFase) return;
    if (!planoAdotado.edital || planoAdotado.edital.length === 0) return;

    const legendasFaseAtual = new Set(
        planoAdotado.materias
            .filter(m => (m.fase || 1) <= faseAtual)
            .map(m => m.legenda)
    );

    const regra = obterRegraFase(faseAtual);
    const pctEditalMinimo = regra?.pct_edital ?? 60;

    const pctFase = calcularPercentualPorLegendasEdital(legendasFaseAtual);
    if (pctFase < pctEditalMinimo) return;

    if (regra?.questoes_minimas || regra?.pct_acerto_minimo) {
        const { feitas, corretas } = calcularQuestoesFase(legendasFaseAtual);
        if (regra.questoes_minimas && feitas < regra.questoes_minimas) return;
        if (regra.pct_acerto_minimo && feitas > 0) {
            const pctAcerto = Math.round((corretas / feitas) * 100);
            if (pctAcerto < regra.pct_acerto_minimo) return;
        }
    }

    // Advance to next phase
    faseAtual++;

    const novasMaterias = planoAdotado.materias.filter(m => (m.fase || 1) === faseAtual);
    if (novasMaterias.length === 0) return;

    // Add new materias to active lists
    coresUsadas = coresUsadas || [];
    novasMaterias.forEach(m => {
        if (!materiasList.some(ml => ml.legenda === m.legenda)) {
            materiasList.push({ nome: m.nome, legenda: m.legenda });
        }
        if (!materiasSelecionadas.some(ms => ms.legenda === m.legenda)) {
            materiasSelecionadas.push({ ...m, cor: gerarCorUnica() });
        }
    });

    // Add blocks for new materias to the active cycle
    if (blocosAtivos && blocosAtivos.length > 0) {
        const duracaoBloco = configuracoes.duracaoBloco || 60;
        const horasSemanais = parseInt(document.getElementById('horasSemanais')?.value) || 0;
        const totalBlocosAtual = blocosAtivos.length;

        novasMaterias.forEach(m => {
            const vp = (m.peso || 5) * 0.5 + (m.extensao || 5) * 0.25 + (m.dificuldade || 5) * 0.25;
            const totalPond = materiasSelecionadas.reduce((sum, ms) =>
                sum + ((ms.peso || 5) * 0.5 + (ms.extensao || 5) * 0.25 + (ms.dificuldade || 5) * 0.25), 0);
            let qtd = Math.max(1, Math.round((vp / totalPond) * totalBlocosAtual));

            for (let i = 0; i < qtd; i++) {
                blocosAtivos.push({
                    nome: m.nome,
                    legenda: m.legenda,
                    cor: materiasSelecionadas.find(ms => ms.legenda === m.legenda)?.cor || gerarCorUnica(),
                    concluido: false,
                    assunto: null,
                    questoes: null,
                    meioBloco: false
                });
            }
        });

        exibirCicloVisual(blocosAtivos);
    }

    inicializarSelecaoMaterias();

    const nomesMaterias = novasMaterias.map(m => m.nome).join(', ');
    const msg = `Parabéns! Você avançou para a Fase ${faseAtual}!\nNovas matérias incluídas: ${nomesMaterias}`;
    alert(msg);

    if (typeof notificarAvancoFase === 'function') {
        notificarAvancoFase(faseAtual, nomesMaterias);
    }

    if (typeof registrarEvento === 'function') {
        registrarEvento('fase_avancada', { fase: faseAtual, materias: nomesMaterias });
    }

    salvarEstado();
}

function calcularPercentualPorLegendasEdital(legendasSet) {
    if (!planoAdotado?.edital) return 0;

    let totalItens = 0;
    let itensConcluidos = 0;

    planoAdotado.edital.forEach(materiaObj => {
        const matchLegenda = [...legendasSet].some(leg => {
            const matSel = (planoAdotado.materias || []).find(m => m.legenda === leg);
            if (!matSel) return false;
            if (matSel.materia_edital_id) return matSel.materia_edital_id === materiaObj.id;
            return calcularSimilaridade(normalizarTexto(matSel.nome), normalizarTexto(materiaObj.materia)) >= 0.4;
        });
        if (!matchLegenda) return;

        (materiaObj.topicos || []).forEach(topico => {
            const subtopicos = topico.subtopicos || [];
            if (subtopicos.length > 0) {
                subtopicos.forEach(sub => {
                    totalItens++;
                    const chave = gerarChaveEdital(materiaObj.materia, topico.nome, nomeSubtopico(sub));
                    if (editalProgresso[chave]?.status === 'visto') itensConcluidos++;
                });
            } else {
                totalItens++;
                const chave = gerarChaveEdital(materiaObj.materia, topico.nome, '');
                if (editalProgresso[chave]?.status === 'visto') itensConcluidos++;
            }
        });
    });

    return totalItens === 0 ? 100 : Math.round((itensConcluidos / totalItens) * 100);
}
