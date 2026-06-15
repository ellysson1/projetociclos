// ── Aba Revisão: Assuntos já estudados com contador de revisões ──────────────

let revisoesContador = {}; // { "materia|topico|subtopico": number }

function renderizarRevisao() {
    const container = document.getElementById('revisaoLista');
    const vazio = document.getElementById('revisaoVazio');
    if (!container) return;

    const edital = planoAdotado?.edital;
    if (!edital || Object.keys(editalProgresso).length === 0) {
        container.innerHTML = '';
        if (vazio) vazio.style.display = 'block';
        atualizarVisibilidadeRevisao();
        return;
    }

    const filtroMateria = document.getElementById('revisaoFiltroMateria')?.value || 'todas';
    const busca = (document.getElementById('revisaoBusca')?.value || '').toLowerCase().trim();

    // Collect studied items grouped by materia
    const grupos = {};
    let temItens = false;

    edital.forEach(materiaObj => {
        const topicos = materiaObj.topicos || [];
        topicos.forEach(topicoObj => {
            const subtopicos = topicoObj.subtopicos || [];

            const processarItem = (topico, subtopico) => {
                const chave = gerarChaveEdital(materiaObj.materia, topico, subtopico);
                const prog = editalProgresso[chave];
                if (!prog) return;
                if (prog.status !== 'visto' && prog.status !== 'concluido' && prog.status !== 'em_andamento') return;

                const label = subtopico || topico;
                if (filtroMateria !== 'todas' && materiaObj.materia !== filtroMateria) return;
                if (busca && !label.toLowerCase().includes(busca)) return;

                const cicloAtual = typeof cicloNumero !== 'undefined' ? cicloNumero : 1;
                const distanciaCiclo = cicloAtual - (prog.ultimo_ciclo_revisado || prog.ciclo_visto || cicloAtual);

                if (!grupos[materiaObj.materia]) grupos[materiaObj.materia] = [];
                grupos[materiaObj.materia].push({
                    chave,
                    label,
                    topico,
                    subtopico,
                    status: prog.status,
                    questoes_feitas: prog.questoes_feitas || 0,
                    questoes_corretas: prog.questoes_corretas || 0,
                    ciclo_visto: prog.ciclo_visto || null,
                    distanciaCiclo
                });
                temItens = true;
            };

            if (subtopicos.length > 0) {
                subtopicos.forEach(sub => processarItem(topicoObj.nome, sub));
            } else {
                processarItem(topicoObj.nome, null);
            }
        });
    });

    if (!temItens) {
        container.innerHTML = '';
        if (vazio) vazio.style.display = 'block';
        atualizarVisibilidadeRevisao();
        return;
    }
    if (vazio) vazio.style.display = 'none';

    // Populate materia filter
    const filtroSelect = document.getElementById('revisaoFiltroMateria');
    if (filtroSelect) {
        const materiaAtual = filtroSelect.value;
        const todasMaterias = Object.keys(grupos);
        // Only rebuild if options changed
        const opcoesAtuais = Array.from(filtroSelect.options).map(o => o.value).filter(v => v !== 'todas');
        const allMaterias = [...new Set(edital.map(m => m.materia))];
        if (JSON.stringify(opcoesAtuais) !== JSON.stringify(allMaterias)) {
            filtroSelect.innerHTML = '<option value="todas">Todas as materias</option>';
            allMaterias.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m;
                filtroSelect.appendChild(opt);
            });
            filtroSelect.value = materiaAtual || 'todas';
        }
    }

    // Render
    container.innerHTML = '';
    Object.entries(grupos).forEach(([materia, itens]) => {
        itens.sort((a, b) => b.distanciaCiclo - a.distanciaCiclo);

        const grupo = document.createElement('div');
        grupo.className = 'revisao-grupo';

        let itensHTML = '';
        itens.forEach(item => {
            const rev = revisoesContador[item.chave] || 0;
            const statusLabel = item.status === 'visto' ? 'Visto'
                : item.status === 'concluido' ? 'Concluído'
                : 'Em andamento';

            let questoesHTML = '';
            if (item.questoes_feitas > 0) {
                const pct = Math.round((item.questoes_corretas / item.questoes_feitas) * 100);
                questoesHTML = `<span style="font-size:11px; color:#888;">| ${item.questoes_corretas}/${item.questoes_feitas} questões (${pct}%)</span>`;
            }

            let cicloHTML = '';
            if (item.distanciaCiclo >= 2) {
                cicloHTML = `<span style="font-size:11px; font-weight:600; color:#FF6B6B; margin-left:6px;">⟳ revisar (${item.distanciaCiclo} ciclos)</span>`;
            } else if (item.distanciaCiclo === 1) {
                cicloHTML = `<span style="font-size:11px; color:#FF9800; margin-left:6px;">1 ciclo atrás</span>`;
            }

            let opcoesRev = '';
            for (let i = 0; i <= 10; i++) {
                opcoesRev += `<option value="${i}" ${rev === i ? 'selected' : ''}>${i}</option>`;
            }

            itensHTML += `
                <div class="revisao-item${item.distanciaCiclo >= 2 ? ' revisao-item--pendente' : ''}">
                    <div class="revisao-item__info">
                        <span>${item.label}</span>
                        <span class="revisao-item__status revisao-item__status--${item.status}">${statusLabel}</span>
                        ${questoesHTML}
                        ${cicloHTML}
                    </div>
                    <div class="revisao-item__revisoes">
                        <span>Revisões:</span>
                        <select onchange="atualizarRevisoes('${item.chave}', parseInt(this.value))">
                            ${opcoesRev}
                        </select>
                    </div>
                </div>
            `;
        });

        grupo.innerHTML = `
            <div class="revisao-grupo__header">${materia}</div>
            ${itensHTML}
        `;
        container.appendChild(grupo);
    });

    atualizarVisibilidadeRevisao();
}

async function atualizarRevisoes(chave, valor) {
    revisoesContador[chave] = valor;
    salvarEstado();
}

function atualizarVisibilidadeRevisao() {
    const tabRevisao = document.querySelector('.tab[data-tab="revisao"]');
    if (!tabRevisao) return;

    const temEstudo = Object.values(editalProgresso).some(p =>
        p.status === 'visto' || p.status === 'concluido' || p.status === 'em_andamento'
    );
    const temEdital = planoAdotado?.edital && planoAdotado.edital.length > 0;
    tabRevisao.style.display = (temEdital && temEstudo) ? 'inline-block' : 'none';
}
