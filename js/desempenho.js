// ── Aba Desempenho: estatisticas de questoes + progresso edital ────────────

async function renderizarDesempenho() {
    // Blocos concluidos no ciclo atual
    const blocosConcluidos = blocosAtivos.filter(b => b.concluido).length;
    document.getElementById('desempenhoBlocosConcluidos').textContent = blocosConcluidos;

    // Carregar historico de questoes do Supabase
    const questoes = await carregarQuestoesHistorico();

    let totalFeitas = 0;
    let totalCorretas = 0;
    const porMateria = {};

    questoes.forEach(q => {
        totalFeitas += q.questoes_feitas;
        totalCorretas += q.questoes_corretas;

        if (!porMateria[q.materia]) {
            porMateria[q.materia] = { feitas: 0, corretas: 0 };
        }
        porMateria[q.materia].feitas += q.questoes_feitas;
        porMateria[q.materia].corretas += q.questoes_corretas;
    });

    document.getElementById('desempenhoTotalQuestoes').textContent = totalFeitas;
    document.getElementById('desempenhoTotalCorretas').textContent = totalCorretas;
    document.getElementById('desempenhoPercentual').textContent =
        totalFeitas > 0 ? Math.round((totalCorretas / totalFeitas) * 100) + '%' : '0%';

    // Desempenho por materia
    const container = document.getElementById('desempenhoPorMateria');
    const entries = Object.entries(porMateria).sort((a, b) => b[1].feitas - a[1].feitas);

    if (entries.length === 0) {
        container.innerHTML = '<p style="color:#999;">Nenhuma questao registrada ainda. Complete blocos e registre questoes para ver seu desempenho.</p>';
    } else {
        let html = '';
        entries.forEach(([materia, dados]) => {
            const pct = dados.feitas > 0 ? Math.round((dados.corretas / dados.feitas) * 100) : 0;
            html += `
                <div class="desempenho-materia">
                    <div class="desempenho-materia__header">
                        <span class="desempenho-materia__nome">${materia}</span>
                        <span class="desempenho-materia__stats">${dados.corretas}/${dados.feitas} (${pct}%)</span>
                    </div>
                    <div class="desempenho-barra-container">
                        <div class="desempenho-barra" style="width:${pct}%;"></div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    // Ajuste automatico por desempenho
    renderizarDesempenhoAjuste(porMateria);

    // Progresso no edital
    renderizarDesempenhoEdital();
}

async function carregarQuestoesHistorico() {
    if (!supabaseConfigurado()) return [];
    const user = await getUsuarioLogado();
    if (!user) return [];

    const { data, error } = await supabaseClient
        .from('questoes')
        .select('materia, questoes_feitas, questoes_corretas')
        .eq('user_id', user.id);

    if (error) {
        console.error('Erro ao carregar questoes:', error);
        return [];
    }
    return data || [];
}

function renderizarDesempenhoAjuste(porMateriaHistorico) {
    const wrapper = document.getElementById('desempenhoAjuste');
    const conteudo = document.getElementById('desempenhoAjusteConteudo');
    if (!wrapper || !conteudo) return;

    const fatores = typeof calcularFatoresDesempenho === 'function'
        ? calcularFatoresDesempenho() : {};

    if (Object.keys(fatores).length === 0) {
        wrapper.style.display = 'none';
        return;
    }

    wrapper.style.display = 'block';

    let totalFeitas = 0, totalCorretas = 0;
    Object.values(porMateriaHistorico).forEach(d => {
        totalFeitas += d.feitas;
        totalCorretas += d.corretas;
    });
    const mediaGlobal = totalFeitas > 0 ? Math.round((totalCorretas / totalFeitas) * 100) : 0;

    const entries = Object.entries(fatores).sort((a, b) => b[1] - a[1]);

    let html = `<p style="font-size:13px; color:#888; margin-bottom:12px;">Media geral: <strong>${mediaGlobal}%</strong> de acerto (minimo 5 questoes por materia para ativar)</p>`;

    entries.forEach(([legenda, fator]) => {
        const dados = porMateriaHistorico[legenda];
        const pctAcerto = dados && dados.feitas > 0 ? Math.round((dados.corretas / dados.feitas) * 100) : 0;
        const pctAjuste = Math.round((fator - 1) * 100);
        const sinal = pctAjuste >= 0 ? '+' : '';
        const cor = pctAjuste > 0 ? '#e53935' : pctAjuste < 0 ? 'var(--success-color)' : '#666';
        const icone = pctAjuste > 0 ? '&#9650;' : pctAjuste < 0 ? '&#9660;' : '&#9679;';
        const descricao = pctAjuste > 0
            ? 'Abaixo da media — ganha mais blocos'
            : pctAjuste < 0
                ? 'Acima da media — ganha menos blocos'
                : 'Na media';

        const nome = materiasSelecionadas.find(m => m.legenda === legenda)?.nome || legenda;

        html += `
            <div class="desempenho-materia">
                <div class="desempenho-materia__header">
                    <span class="desempenho-materia__nome">${nome}</span>
                    <span style="font-size:14px; font-weight:bold; color:${cor};">${icone} ${sinal}${pctAjuste}%</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:12px; color:#888;">
                    <span>Acerto: ${pctAcerto}%</span>
                    <span>${descricao}</span>
                </div>
            </div>
        `;
    });

    conteudo.innerHTML = html;
}

function renderizarDesempenhoEdital() {
    const wrapper = document.getElementById('desempenhoEdital');
    const conteudo = document.getElementById('desempenhoEditalConteudo');

    if (!planoAdotado?.edital || planoAdotado.edital.length === 0) {
        if (wrapper) wrapper.style.display = 'none';
        return;
    }

    if (wrapper) wrapper.style.display = 'block';

    let totalItens = 0;
    let itensConcluidos = 0;
    const porMateria = [];

    planoAdotado.edital.forEach(materiaObj => {
        let mTotal = 0;
        let mConcluidos = 0;

        (materiaObj.topicos || []).forEach(topicoObj => {
            const subtopicos = topicoObj.subtopicos || [];
            if (subtopicos.length > 0) {
                subtopicos.forEach(sub => {
                    const chave = gerarChaveEdital(materiaObj.materia, topicoObj.nome, sub);
                    const prog = editalProgresso[chave];
                    totalItens++;
                    mTotal++;
                    if (prog?.status === 'concluido') { itensConcluidos++; mConcluidos++; }
                });
            } else {
                const chave = gerarChaveEdital(materiaObj.materia, topicoObj.nome, null);
                const prog = editalProgresso[chave];
                totalItens++;
                mTotal++;
                if (prog?.status === 'concluido') { itensConcluidos++; mConcluidos++; }
            }
        });

        porMateria.push({
            materia: materiaObj.materia,
            total: mTotal,
            concluidos: mConcluidos,
            pct: mTotal > 0 ? Math.round((mConcluidos / mTotal) * 100) : 0
        });
    });

    const pctGeral = totalItens > 0 ? Math.round((itensConcluidos / totalItens) * 100) : 0;

    let html = `
        <div style="margin-bottom:16px; padding:14px; border:1px solid var(--border-color); border-radius:8px; background:#f0f7ff;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
                <strong>${planoAdotado.nome || 'Edital'}</strong>
                <span style="font-size:13px; color:#666;">${itensConcluidos}/${totalItens} concluidos (${pctGeral}%)</span>
            </div>
            <div class="desempenho-barra-container">
                <div class="desempenho-barra desempenho-barra--edital" style="width:${pctGeral}%;"></div>
            </div>
        </div>
    `;

    porMateria.forEach(m => {
        html += `
            <div class="desempenho-materia">
                <div class="desempenho-materia__header">
                    <span class="desempenho-materia__nome">${m.materia}</span>
                    <span class="desempenho-materia__stats">${m.concluidos}/${m.total} (${m.pct}%)</span>
                </div>
                <div class="desempenho-barra-container">
                    <div class="desempenho-barra desempenho-barra--edital" style="width:${m.pct}%;"></div>
                </div>
            </div>
        `;
    });

    conteudo.innerHTML = html;
}
