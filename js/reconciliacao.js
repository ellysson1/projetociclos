// ── T2: Reconciliação de matérias (ciclo ↔ edital) + Retificação de edital ──
// Resolve o vínculo materia_edital_id uma única vez, com humano no circuito.
// Após a reconciliação, nenhuma comparação de nomes ocorre em runtime.

// ── Reconciliação ────────────────────────────────────────────────────────────

function verificarReconciliacaoPendente() {
    if (!planoAdotado?.edital || !Array.isArray(planoAdotado.edital)) return;
    if (!materiasSelecionadas || materiasSelecionadas.length === 0) return;

    garantirIdsEdital(planoAdotado.edital);

    const semVinculo = materiasSelecionadas.filter(m =>
        !m.materia_edital_id && planoAdotado.edital.length > 0
    );
    if (semVinculo.length === 0) return;

    const candidatasEdital = planoAdotado.edital.map(me => ({ id: me.id, nome: me.materia }));
    const precisaConfirmar = [];

    semVinculo.forEach(m => {
        const ranked = rankCandidatas(m.nome, candidatasEdital);
        if (autoVinculavel(ranked)) {
            m.materia_edital_id = ranked[0].candidata.id;
        } else if (ranked.length > 0 && ranked[0].score > 0) {
            precisaConfirmar.push({ materia: m, ranked });
        }
    });

    if (precisaConfirmar.length > 0) {
        abrirModalReconciliacao(precisaConfirmar);
    } else {
        salvarEstado();
    }
}

function abrirModalReconciliacao(itens) {
    const modal = document.getElementById('modalReconciliacao');
    const corpo = document.getElementById('reconciliacaoCorpo');
    if (!modal || !corpo) return;

    corpo.innerHTML = '';
    itens.forEach((item, i) => {
        const div = document.createElement('div');
        div.style.cssText = 'padding:12px; border:1px solid #E1E4E8; border-radius:8px; margin-bottom:10px; background:#FAFBFC;';

        let opcoesHTML = '<option value="">— Sem correspondência no edital —</option>';
        item.ranked.forEach(r => {
            const pct = Math.round(r.score * 100);
            const sel = r === item.ranked[0] ? 'selected' : '';
            opcoesHTML += `<option value="${r.candidata.id}" ${sel}>${r.candidata.nome} (${pct}%)</option>`;
        });

        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                <strong style="min-width:180px; font-size:14px;">${item.materia.nome} (${item.materia.legenda})</strong>
                <span style="color:#999;">→</span>
                <select data-legenda="${item.materia.legenda}" class="reconciliacao-select" style="flex:1; min-width:200px; padding:6px;">
                    ${opcoesHTML}
                </select>
            </div>
        `;
        corpo.appendChild(div);
    });

    modal.classList.add('active');
}

function confirmarReconciliacao() {
    const selects = document.querySelectorAll('.reconciliacao-select');
    selects.forEach(sel => {
        const legenda = sel.dataset.legenda;
        const editalId = sel.value;
        const materia = materiasSelecionadas.find(m => m.legenda === legenda);
        if (materia && editalId) {
            materia.materia_edital_id = editalId;
        }
    });
    fecharModal('modalReconciliacao');
    salvarEstado();
    if (typeof renderizarEdital === 'function') renderizarEdital();
    if (typeof atualizarSugestoesBlocos === 'function') atualizarSugestoesBlocos();
}

// ── Reconciliação no fechamento do bloco ─────────────────────────────────────

function reconciliarNoBloco(materia, callback) {
    if (!planoAdotado?.edital || materia.materia_edital_id) {
        callback(materia.materia_edital_id || null);
        return;
    }

    garantirIdsEdital(planoAdotado.edital);
    const candidatasEdital = planoAdotado.edital.map(me => ({ id: me.id, nome: me.materia }));
    const ranked = rankCandidatas(materia.nome, candidatasEdital);

    if (autoVinculavel(ranked)) {
        materia.materia_edital_id = ranked[0].candidata.id;
        salvarEstado();
        callback(materia.materia_edital_id);
        return;
    }

    const modal = document.getElementById('modalReconciliacaoBloco');
    const corpo = document.getElementById('reconciliacaoBlocoCorpo');
    if (!modal || !corpo) { callback(null); return; }

    let opcoesHTML = '<option value="">— Não está no edital —</option>';
    ranked.forEach(r => {
        const pct = Math.round(r.score * 100);
        const sel = r === ranked[0] ? 'selected' : '';
        opcoesHTML += `<option value="${r.candidata.id}" ${sel}>${r.candidata.nome} (${pct}%)</option>`;
    });

    corpo.innerHTML = `
        <p style="margin-bottom:10px;">A matéria <strong>"${materia.nome}"</strong> ainda não está vinculada ao edital.</p>
        <select id="reconciliacaoBlocoSelect" style="width:100%; padding:8px; margin-bottom:6px;">${opcoesHTML}</select>
    `;

    modal.classList.add('active');

    const btnOk = document.getElementById('btnReconciliacaoBlocoOk');
    const handler = () => {
        const val = document.getElementById('reconciliacaoBlocoSelect').value;
        if (val) materia.materia_edital_id = val;
        fecharModal('modalReconciliacaoBloco');
        btnOk.removeEventListener('click', handler);
        salvarEstado();
        callback(materia.materia_edital_id || null);
    };
    btnOk.addEventListener('click', handler);
}

// ── Gerenciar vínculos (configurações) ───────────────────────────────────────

function abrirGerenciarVinculos() {
    const modal = document.getElementById('modalGerenciarVinculos');
    const corpo = document.getElementById('gerenciarVinculosCorpo');
    if (!modal || !corpo) return;
    if (!planoAdotado?.edital) { alert('Nenhum edital carregado.'); return; }

    garantirIdsEdital(planoAdotado.edital);
    corpo.innerHTML = '';

    materiasSelecionadas.forEach(m => {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; align-items:center; gap:10px; padding:8px; border-bottom:1px solid #eee;';

        let opcoesHTML = '<option value="">— Sem vínculo —</option>';
        planoAdotado.edital.forEach(e => {
            const sel = e.id === m.materia_edital_id ? 'selected' : '';
            opcoesHTML += `<option value="${e.id}" ${sel}>${e.materia}</option>`;
        });

        div.innerHTML = `
            <strong style="min-width:160px;">${m.nome} (${m.legenda})</strong>
            <select data-legenda="${m.legenda}" class="vinculo-select" style="flex:1; padding:6px;">${opcoesHTML}</select>
        `;
        corpo.appendChild(div);
    });

    modal.classList.add('active');
}

function salvarVinculos() {
    document.querySelectorAll('.vinculo-select').forEach(sel => {
        const legenda = sel.dataset.legenda;
        const materia = materiasSelecionadas.find(m => m.legenda === legenda);
        if (materia) materia.materia_edital_id = sel.value || null;
    });
    fecharModal('modalGerenciarVinculos');
    salvarEstado();
    if (typeof renderizarEdital === 'function') renderizarEdital();
    if (typeof atualizarSugestoesBlocos === 'function') atualizarSugestoesBlocos();
}

// ── Retificação de edital ────────────────────────────────────────────────────

function abrirRetificacaoEdital() {
    const modal = document.getElementById('modalRetificacao');
    if (!modal) return;
    document.getElementById('retificacaoResultado').innerHTML = '';
    document.getElementById('retificacaoUploadArea').style.display = 'block';
    document.getElementById('retificacaoMapeamento').style.display = 'none';
    modal.classList.add('active');
}

let _retificacaoEditalNovo = null;

function processarRetificacaoUpload() {
    const fileInput = document.getElementById('retificacaoFileInput');
    const file = fileInput?.files?.[0];
    if (!file) { alert('Selecione um arquivo Excel.'); return; }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const workbook = XLSX.read(e.target.result, { type: 'binary' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            _retificacaoEditalNovo = _parsearEditalDeLinhas(rows);
            garantirIdsEdital(_retificacaoEditalNovo);

            _renderizarMapeamento();
        } catch (err) {
            alert('Erro ao ler arquivo: ' + err.message);
        }
    };
    reader.readAsBinaryString(file);
}

function _parsearEditalDeLinhas(rows) {
    const edital = [];
    let materiaAtual = null;
    let topicoAtual = null;

    rows.forEach(row => {
        const col1 = (row[0] || '').toString().trim();
        const col2 = (row[1] || '').toString().trim();
        const col3 = (row[2] || '').toString().trim();

        if (col1 && !col2 && !col3) {
            materiaAtual = { materia: col1, topicos: [] };
            edital.push(materiaAtual);
            topicoAtual = null;
        } else if (col1 && col2 && materiaAtual) {
            topicoAtual = { nome: col1, subtopicos: [], ordem: materiaAtual.topicos.length + 1 };
            materiaAtual.topicos.push(topicoAtual);
            if (col2) topicoAtual.subtopicos.push(col2);
            if (col3) topicoAtual.subtopicos.push(col3);
        } else if ((col1 || col2) && materiaAtual) {
            if (topicoAtual) {
                const sub = col2 || col1;
                if (sub) topicoAtual.subtopicos.push(sub);
            } else {
                topicoAtual = { nome: col1 || col2, subtopicos: [], ordem: materiaAtual.topicos.length + 1 };
                materiaAtual.topicos.push(topicoAtual);
            }
        }
    });

    return edital;
}

function _renderizarMapeamento() {
    if (!_retificacaoEditalNovo || !planoAdotado?.edital) return;

    const editalAntigo = planoAdotado.edital;
    const resultado = document.getElementById('retificacaoResultado');
    resultado.innerHTML = '';

    document.getElementById('retificacaoUploadArea').style.display = 'none';
    document.getElementById('retificacaoMapeamento').style.display = 'block';

    _retificacaoEditalNovo.forEach((materiaNovaObj, idx) => {
        const candidatas = editalAntigo.map(a => ({ id: a.id, nome: a.materia }));
        const ranked = rankCandidatas(materiaNovaObj.materia, candidatas);

        const div = document.createElement('div');
        div.style.cssText = 'padding:12px; border:1px solid #E1E4E8; border-radius:8px; margin-bottom:10px; background:#FAFBFC;';

        let opcoesHTML = '<option value="__novo__">Nova (sem correspondência)</option>';
        ranked.forEach(r => {
            const pct = Math.round(r.score * 100);
            const sel = (r === ranked[0] && r.score >= 0.4) ? 'selected' : '';
            opcoesHTML += `<option value="${r.candidata.id}" ${sel}>${r.candidata.nome} (${pct}%)</option>`;
        });

        const statusTag = ranked[0]?.score >= 0.85 ? 'Auto' : ranked[0]?.score >= 0.4 ? 'Conferir' : 'Nova';

        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <span style="font-size:12px; padding:2px 6px; border-radius:4px; background:#E8EAF6;">${statusTag}</span>
                <strong style="min-width:180px;">${materiaNovaObj.materia}</strong>
                <span style="color:#999;">←</span>
                <select data-novo-idx="${idx}" class="retificacao-select" style="flex:1; min-width:200px; padding:6px;">${opcoesHTML}</select>
            </div>
        `;
        resultado.appendChild(div);

        if (ranked[0]?.score >= 0.4 && ranked[0].candidata.id !== '__novo__') {
            const materiaAntiga = editalAntigo.find(a => a.id === ranked[0].candidata.id);
            if (materiaAntiga) {
                _renderizarMapeamentoTopicos(div, materiaNovaObj, materiaAntiga, idx);
            }
        }
    });
}

function _renderizarMapeamentoTopicos(container, materiaNova, materiaAntiga, materiaIdx) {
    const topicosDiv = document.createElement('div');
    topicosDiv.style.cssText = 'margin-top:8px; padding-left:20px; font-size:13px;';

    (materiaNova.topicos || []).forEach((topicoNovo, ti) => {
        const candidatas = (materiaAntiga.topicos || []).map(t => ({ id: t.id, nome: t.nome }));
        const ranked = rankCandidatas(topicoNovo.nome, candidatas);
        const melhor = ranked[0];

        let tag = '';
        if (melhor && melhor.score >= 0.85) {
            topicoNovo.id = melhor.candidata.id;
            tag = '<span style="color:#4CAF50; font-size:11px;">mantido</span>';
        } else if (melhor && melhor.score >= 0.4) {
            tag = '<span style="color:#FF9800; font-size:11px;">renomeado?</span>';
        } else {
            tag = '<span style="color:#2196F3; font-size:11px;">novo</span>';
        }

        topicosDiv.innerHTML += `<div style="padding:2px 0;">${tag} ${topicoNovo.nome}</div>`;
    });

    container.appendChild(topicosDiv);
}

function confirmarRetificacao() {
    if (!_retificacaoEditalNovo || !planoAdotado?.edital) return;

    const editalAntigo = planoAdotado.edital;
    const selects = document.querySelectorAll('.retificacao-select');

    selects.forEach(sel => {
        const idx = parseInt(sel.dataset.novoIdx);
        const materiaNovaObj = _retificacaoEditalNovo[idx];
        const antigoId = sel.value;

        if (antigoId && antigoId !== '__novo__') {
            materiaNovaObj.id = antigoId;

            const materiaAntiga = editalAntigo.find(a => a.id === antigoId);
            if (materiaAntiga) {
                (materiaNovaObj.topicos || []).forEach(tn => {
                    if (tn.id) return;
                    const candidatas = (materiaAntiga.topicos || []).map(t => ({ id: t.id, nome: t.nome }));
                    const ranked = rankCandidatas(tn.nome, candidatas);
                    if (ranked[0]?.score >= 0.6) {
                        tn.id = ranked[0].candidata.id;
                        const topicoAntigo = materiaAntiga.topicos.find(t => t.id === tn.id);
                        if (topicoAntigo) {
                            (tn.subtopicos || []).forEach(subNovo => {
                                const subNome = nomeSubtopico(subNovo);
                                const subAntigos = (topicoAntigo.subtopicos || []).map(s => ({
                                    id: typeof s === 'string' ? null : s.id,
                                    nome: nomeSubtopico(s)
                                })).filter(s => s.id);
                                const ranked2 = rankCandidatas(subNome, subAntigos);
                                if (ranked2[0]?.score >= 0.6) {
                                    if (typeof subNovo === 'object') subNovo.id = ranked2[0].candidata.id;
                                }
                            });
                        }
                    }
                });
            }
        }
    });

    garantirIdsEdital(_retificacaoEditalNovo);

    planoAdotado.edital = _retificacaoEditalNovo;
    _retificacaoEditalNovo = null;

    fecharModal('modalRetificacao');
    salvarEstado();

    alert('Edital atualizado! O progresso dos tópicos mapeados foi preservado.');

    if (typeof renderizarEdital === 'function') renderizarEdital();
    if (typeof atualizarSugestoesBlocos === 'function') atualizarSugestoesBlocos();

    _salvarEditalRetificadoNuvem();
}

async function _salvarEditalRetificadoNuvem() {
    if (!supabaseConfigurado() || !planoAdotado?.id) return;
    const user = await getUsuarioLogado();
    if (!user) return;

    await supabaseClient
        .from('planos')
        .update({ edital: planoAdotado.edital })
        .eq('id', planoAdotado.id);
}

function cancelarRetificacao() {
    _retificacaoEditalNovo = null;
    fecharModal('modalRetificacao');
}
