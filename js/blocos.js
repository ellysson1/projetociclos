// T8: Distribuição round-robin ponderada por déficit acumulado.
// Correta por construção: a cada posição escolhe a matéria com maior
// diferença entre a alocação ideal e a já posicionada, respeitando a
// regra de no máximo 2 consecutivos iguais. Sem laço infinito mesmo em
// distribuições extremas (uma matéria com >2/3 dos blocos).
function _distribuirPorDeficit(materias) {
    const total = materias.reduce((s, m) => s + m.qtdBlocos, 0);
    if (total === 0) return [];
    const colocados = {};
    materias.forEach(m => { colocados[m.legenda] = 0; });
    const resultado = [];

    for (let pos = 0; pos < total; pos++) {
        const candidatas = materias
            .filter(m => colocados[m.legenda] < m.qtdBlocos)
            .map(m => ({
                m,
                deficit: (m.qtdBlocos / total) * (pos + 1) - colocados[m.legenda]
            }))
            .sort((a, b) => {
                const diff = b.deficit - a.deficit;
                if (Math.abs(diff) > 0.0001) return diff;
                return Math.random() - 0.5; // pequeno ruído no desempate → variedade entre ciclos
            });

        const n = resultado.length;
        const violaRegra = (leg) => n >= 2 && resultado[n - 1] === leg && resultado[n - 2] === leg;
        const valida = candidatas.find(c => !violaRegra(c.m.legenda)) || candidatas[0];
        resultado.push(valida.m.legenda);
        colocados[valida.m.legenda]++;
    }
    return resultado;
}

function distribuirBlocosAleatoriamente(blocos) {
    const materias = blocos
        .filter(b => b.quantidadeBlocos > 0)
        .map(b => ({ ...b, qtdBlocos: b.quantidadeBlocos }));

    const ordem = _distribuirPorDeficit(materias);
    const porLegenda = {};
    materias.forEach(b => { porLegenda[b.legenda] = b; });

    return ordem.map(leg => {
        const bloco = porLegenda[leg];
        const copia = { ...bloco };
        delete copia.qtdBlocos;
        delete copia.quantidadeBlocos;
        if (bloco.meioBloco && !copia.duracaoEspecifica) {
            copia.duracaoEspecifica = Math.round(configuracoes.duracaoBloco / 2);
        }
        return copia;
    });
}

function exibirCicloVisual(blocos) {
    const container = document.getElementById("blocosContainer");
    container.innerHTML = "";

    if (planoAdotado?.maxFase > 1) {
        const faseBanner = document.createElement('div');
        faseBanner.style.cssText = 'display:flex; align-items:center; gap:10px; padding:10px 14px; margin-bottom:14px; border-radius:8px; background:#E8EAF6; border:1px solid #C5CAE9; font-size:14px;';
        const proximaFaseInfo = faseAtual < planoAdotado.maxFase
            ? ` — próximas matérias entram com 60% do edital concluído`
            : ' — todas as matérias incluídas';
        faseBanner.innerHTML = `<strong style="color:#3F51B5;">Fase ${faseAtual}/${planoAdotado.maxFase}</strong><span style="color:#666;">${proximaFaseInfo}</span>`;
        container.appendChild(faseBanner);
    }

    const bps = configuracoes.blocosPorSessao;
    const sessoes = [];
    for (let i = 0; i < blocos.length; i += bps) {
        sessoes.push(blocos.slice(i, i + bps));
    }

    sessoes.forEach((sessao, sessaoIdx) => {
        const sessaoDiv = document.createElement("div");
        sessaoDiv.className = "sessao-group";

        const header = document.createElement("div");
        header.className = "sessao-group__header";
        header.textContent = `Sessão ${sessaoIdx + 1}`;
        sessaoDiv.appendChild(header);

        const grid = document.createElement("div");
        grid.className = "blocos-grid";

        sessao.forEach((bloco, blocoIdx) => {
            const globalIndex = sessaoIdx * bps + blocoIdx;
            const card = criarCardBloco(bloco, globalIndex);
            grid.appendChild(card);
        });

        sessaoDiv.appendChild(grid);
        container.appendChild(sessaoDiv);

        if (sessaoIdx < sessoes.length - 1) {
            const intervalo = document.createElement("div");
            intervalo.className = "sessao-intervalo";
            intervalo.textContent = `Intervalo: ${configuracoes.intervaloEntreBlocos} min`;
            container.appendChild(intervalo);
        }
    });

    inicializarControlesTempo();
}

function criarCardBloco(bloco, index) {
    const card = document.createElement("div");
    card.className = "bloco-card";
    card.setAttribute("data-index", index);
    card.draggable = true;

    if (bloco.concluido) {
        card.classList.add("concluido");
    }

    const duracao = bloco.duracaoEspecifica || configuracoes.duracaoBloco;

    // Info concluido or suggested topic
    let infoConcluido = '';
    let sugestaoHTML = '';
    if (bloco.concluido) {
        if (bloco.assunto) {
            infoConcluido += bloco.assunto;
        }
        if (bloco.questoes && bloco.questoes.feitas > 0) {
            const pct = Math.round((bloco.questoes.corretas / bloco.questoes.feitas) * 1000) / 10;
            infoConcluido += (infoConcluido ? ' | ' : '') + `${pct}% de acertos (${bloco.questoes.corretas}/${bloco.questoes.feitas})`;
        }
    } else if (typeof obterAssuntoSugerido === 'function') {
        const sugestao = obterAssuntoSugerido(bloco.nome);
        if (sugestao) {
            const safeTitle = sugestao.replace(/"/g, '&quot;');
            sugestaoHTML = `<div class="bloco-card__sugestao" title="${safeTitle}">${sugestao}</div>`;
        }
    }

    const modo = modosMateria && modosMateria[bloco.legenda];
    const modoBadge = modo === 'questoes'
        ? '<span class="bloco-modo bloco-modo--questoes">Só Questões</span>'
        : modo === 'revisao'
            ? '<span class="bloco-modo bloco-modo--revisao">Só Revisão</span>'
            : '';

    card.innerHTML = `
        <div class="bloco-card__header" style="background-color: ${bloco.cor}"></div>
        <div class="bloco-card__sigla">${bloco.legenda}</div>
        <div class="bloco-card__nome">${bloco.nome}</div>
        <div class="bloco-card__duracao">${duracao} min</div>
        ${modoBadge}
        <div class="bloco-card__footer">
            <label class="bloco-card__check">
                <input type="checkbox" ${bloco.concluido ? 'checked' : ''}>
                <span>Concluir</span>
            </label>
            <button class="bloco-card__btn-timer" type="button">Cronômetro</button>
        </div>
        <div class="bloco-card__info-concluido">${infoConcluido}</div>
        ${sugestaoHTML}
    `;

    // Checkbox handler - fluxo de conclusão
    const checkbox = card.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', function(e) {
        e.stopPropagation();
        const idx = parseInt(card.getAttribute('data-index'));
        if (this.checked && !blocosAtivos[idx].concluido) {
            iniciarFluxoConclusao(idx, card);
        } else if (!this.checked && blocosAtivos[idx].concluido) {
            // Invariante do produto: um bloco concluído nunca é desconcluído
            // por nenhum mecanismo. Reverter o checkbox e preservar os dados.
            this.checked = true;
            alert('Blocos concluídos não podem ser desmarcados — isso preserva o histórico do seu ciclo.');
        }
    });

    // Timer button
    card.querySelector('.bloco-card__btn-timer').addEventListener('click', function(e) {
        e.stopPropagation();
        alternarAba('meuciclo');
        document.getElementById('tempoControle').scrollIntoView({ behavior: 'smooth' });
    });

    // Drag and drop
    card.addEventListener('dragstart', function(e) {
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.getAttribute('data-index'));
    });

    card.addEventListener('dragend', function() {
        this.classList.remove('dragging');
    });

    card.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this.classList.add('drag-over');
    });

    card.addEventListener('dragleave', function() {
        this.classList.remove('drag-over');
    });

    card.addEventListener('drop', function(e) {
        e.stopPropagation();
        this.classList.remove('drag-over');
        const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'));
        const targetIndex = parseInt(this.getAttribute('data-index'));
        if (sourceIndex !== targetIndex) {
            [blocosAtivos[sourceIndex], blocosAtivos[targetIndex]] = [blocosAtivos[targetIndex], blocosAtivos[sourceIndex]];
            exibirCicloVisual(blocosAtivos);
            salvarEstado();
        }
    });

    return card;
}

function editarBloco(bloco) {
    const novaDuracao = prompt("Insira a nova duração do bloco (em minutos):", bloco.duracaoEspecifica || configuracoes.duracaoBloco);
    if (novaDuracao !== null) {
        const duracaoInt = parseInt(novaDuracao);
        if (!isNaN(duracaoInt) && duracaoInt > 0) {
            bloco.duracaoEspecifica = duracaoInt;
            exibirCicloVisual(blocosAtivos);
            salvarEstado();
        } else {
            alert("Por favor, insira um número válido de minutos.");
        }
    }
}

let _ultimoCicloConcluido = -1;

function verificarConclusao() {
    const todosConcluidos = blocosAtivos.every(bloco => bloco.concluido);
    if (todosConcluidos && blocosAtivos.length > 0) {
        // Idempotência: registrar a conclusão do ciclo apenas uma vez, mesmo
        // que verificarConclusao seja chamada novamente com o ciclo já completo.
        const cicloAtual = (typeof cicloNumero !== 'undefined') ? cicloNumero : 1;
        if (cicloAtual === _ultimoCicloConcluido) return;
        _ultimoCicloConcluido = cicloAtual;
        if (typeof cicloNumero !== 'undefined') cicloNumero++;

        const fatores = typeof calcularFatoresDesempenho === 'function' ? calcularFatoresDesempenho() : {};
        const temAjuste = Object.keys(fatores).length > 0;
        const partes = [`Parabéns! Você completou o ciclo ${(typeof cicloNumero !== 'undefined' ? cicloNumero : 2) - 1}!`];
        if (temAjuste) partes.push('Com base no seu desempenho em questões, o próximo ciclo será ajustado automaticamente — matérias com menor acerto receberão mais blocos.');

        const itensPendentes = contarItensRevisaoPendente();
        if (itensPendentes > 0) partes.push(`Há ${itensPendentes} itens do edital pendentes de revisão. Confira na aba Revisão.`);

        alert(partes.join('\n\n'));
        salvarEstado();
    }
}

function contarItensRevisaoPendente() {
    if (typeof editalProgresso === 'undefined' || typeof cicloNumero === 'undefined') return 0;
    let count = 0;
    Object.values(editalProgresso).forEach(prog => {
        if (!prog.ciclo_visto) return;
        if (prog.status !== 'visto' && prog.status !== 'concluido') return;
        const distancia = cicloNumero - (prog.ultimo_ciclo_revisado || prog.ciclo_visto);
        if (distancia >= 2) count++;
    });
    return count;
}

function atualizarSugestoesBlocos() {
    if (typeof obterAssuntoSugerido !== 'function' || !blocosAtivos) return;
    document.querySelectorAll('.bloco-card').forEach(card => {
        if (card.classList.contains('concluido')) return;
        if (card.querySelector('.bloco-card__sugestao')) return;
        const idx = parseInt(card.getAttribute('data-index'));
        const bloco = blocosAtivos[idx];
        if (!bloco) return;
        const sugestao = obterAssuntoSugerido(bloco.nome);
        if (sugestao) {
            const div = document.createElement('div');
            div.className = 'bloco-card__sugestao';
            div.title = sugestao;
            div.textContent = sugestao;
            card.appendChild(div);
        }
    });
}

function continuarEstudo() {
    exibirCicloVisual(blocosAtivos);
    alternarAba('meuciclo');
}

function iniciarNovoEstudo() {
    salvarAoSair = false;
    localStorage.removeItem('cicloEstudosEstado');
    location.reload();
}
