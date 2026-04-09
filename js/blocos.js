function distribuirBlocosAleatoriamente(blocos) {
    let blocosDistribuidos = [];
    blocos.forEach(bloco => {
        for (let i = 0; i < bloco.quantidadeBlocos; i++) {
            blocosDistribuidos.push({ ...bloco });
        }
    });

    for (let i = blocosDistribuidos.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [blocosDistribuidos[i], blocosDistribuidos[j]] = [blocosDistribuidos[j], blocosDistribuidos[i]];
    }

    for (let i = 2; i < blocosDistribuidos.length; i++) {
        if (blocosDistribuidos[i].legenda === blocosDistribuidos[i-1].legenda &&
            blocosDistribuidos[i].legenda === blocosDistribuidos[i-2].legenda) {
            let j = i + 1;
            while (j < blocosDistribuidos.length && blocosDistribuidos[j].legenda === blocosDistribuidos[i].legenda) {
                j++;
            }
            if (j < blocosDistribuidos.length) {
                [blocosDistribuidos[i], blocosDistribuidos[j]] = [blocosDistribuidos[j], blocosDistribuidos[i]];
            }
        }
    }

    return blocosDistribuidos;
}

function exibirCicloVisual(blocos) {
    const container = document.getElementById("blocosContainer");
    container.innerHTML = "";

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

    // Info concluido
    let infoConcluido = '';
    if (bloco.assunto) {
        infoConcluido += bloco.assunto;
    }
    if (bloco.questoes && bloco.questoes.feitas > 0) {
        const pct = Math.round((bloco.questoes.corretas / bloco.questoes.feitas) * 1000) / 10;
        infoConcluido += (infoConcluido ? ' | ' : '') + `${pct}% de acertos (${bloco.questoes.corretas}/${bloco.questoes.feitas})`;
    }

    card.innerHTML = `
        <div class="bloco-card__header" style="background-color: ${bloco.cor}"></div>
        <div class="bloco-card__sigla">${bloco.legenda}</div>
        <div class="bloco-card__nome">${bloco.nome}</div>
        <div class="bloco-card__duracao">${duracao} min</div>
        <div class="bloco-card__footer">
            <label class="bloco-card__check">
                <input type="checkbox" ${bloco.concluido ? 'checked' : ''}>
                <span>Concluir</span>
            </label>
            <button class="bloco-card__btn-timer" type="button">Cronômetro</button>
        </div>
        <div class="bloco-card__info-concluido">${infoConcluido}</div>
    `;

    // Checkbox handler - fluxo de conclusão
    const checkbox = card.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', function(e) {
        e.stopPropagation();
        const idx = parseInt(card.getAttribute('data-index'));
        if (this.checked && !blocosAtivos[idx].concluido) {
            iniciarFluxoConclusao(idx, card);
        } else if (!this.checked && blocosAtivos[idx].concluido) {
            blocosAtivos[idx].concluido = false;
            blocosAtivos[idx].assunto = null;
            blocosAtivos[idx].questoes = null;
            card.classList.remove('concluido');
            card.querySelector('.bloco-card__info-concluido').textContent = '';
            salvarEstado();
        }
    });

    // Timer button
    card.querySelector('.bloco-card__btn-timer').addEventListener('click', function(e) {
        e.stopPropagation();
        alternarAba('ciclo');
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

function verificarConclusao() {
    const todosConcluidos = blocosAtivos.every(bloco => bloco.concluido);
    if (todosConcluidos && blocosAtivos.length > 0) {
        alert("Parabéns! Você completou todo o ciclo de estudos!");
    }
}

function continuarEstudo() {
    exibirCicloVisual(blocosAtivos);
    alternarAba('ciclo');
}

function iniciarNovoEstudo() {
    salvarAoSair = false;
    localStorage.removeItem('cicloEstudosEstado');
    localStorage.removeItem('cicloEstudosAnotacoes');
    location.reload();
}
