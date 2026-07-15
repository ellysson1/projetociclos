// Redistribui um total fixo de blocos entre matérias, ponderando pelo fator
// de desempenho de cada uma (calcularFatoresDesempenho). Usado ao iniciar um
// novo ciclo: mantém o mesmo total de blocos do ciclo anterior, mas dá mais
// peso a matérias com menor acerto em questões. Função pura (sem DOM/estado
// global) — o total de saída sempre soma exatamente `totais` de entrada.
function _calcularRedistribuicaoPorDesempenho(totais, fatoresDesemp) {
    const legendas = Object.keys(totais);
    const totalBlocos = legendas.reduce((s, leg) => s + totais[leg], 0);
    if (totalBlocos === 0) return {};

    const pesos = {};
    let totalPonderado = 0;
    legendas.forEach(leg => {
        pesos[leg] = totais[leg] * ((fatoresDesemp && fatoresDesemp[leg]) || 1);
        totalPonderado += pesos[leg];
    });

    const ideal = {};
    const novo = {};
    legendas.forEach(leg => {
        ideal[leg] = totalPonderado > 0 ? (pesos[leg] / totalPonderado) * totalBlocos : totais[leg];
        novo[leg] = Math.max(1, Math.floor(ideal[leg]));
    });

    let usados = legendas.reduce((s, leg) => s + novo[leg], 0);
    const restos = legendas
        .map(leg => ({ leg, resto: ideal[leg] - Math.floor(ideal[leg]) }))
        .sort((a, b) => b.resto - a.resto);
    let ri = 0;
    while (usados < totalBlocos && restos.length > 0) {
        novo[restos[ri % restos.length].leg]++;
        usados++;
        ri++;
        if (ri > restos.length * totalBlocos) break;
    }

    const reducao = legendas.filter(leg => novo[leg] > 1).sort((a, b) => novo[b] - novo[a]);
    let rj = 0;
    while (usados > totalBlocos && reducao.length > 0) {
        const leg = reducao[rj % reducao.length];
        if (novo[leg] > 1) { novo[leg]--; usados--; }
        rj++;
        if (rj > reducao.length * totalBlocos) break;
    }

    return novo;
}

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

    if (blocos.length > 0 && blocos.every(b => b.concluido)) {
        const doneBanner = document.createElement('div');
        doneBanner.className = 'ciclo-completo-banner';
        const texto = document.createElement('div');
        texto.innerHTML = '<strong>Ciclo concluído!</strong><span>Todos os blocos foram estudados.</span>';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ciclo-completo-banner__btn';
        btn.textContent = 'Iniciar Próximo Ciclo';
        btn.addEventListener('click', () => {
            if (typeof iniciarProximoCiclo === 'function') iniciarProximoCiclo();
        });
        doneBanner.appendChild(texto);
        doneBanner.appendChild(btn);
        container.appendChild(doneBanner);
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

    // Clique no corpo do card (fora de Concluir/Cronômetro): detalhe do estudo —
    // aula do curso, correlação com o edital e assunto no TEC.
    card.addEventListener('click', function(e) {
        if (e.target.closest('.bloco-card__check') || e.target.closest('.bloco-card__btn-timer')) return;
        const idx = parseInt(card.getAttribute('data-index'));
        if (typeof abrirDetalheBloco === 'function') abrirDetalheBloco(idx);
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
        if (temAjuste) partes.push('Com base no seu desempenho em questões, matérias com menor acerto receberão mais blocos no próximo ciclo.');

        const itensPendentes = contarItensRevisaoPendente();
        if (itensPendentes > 0) partes.push(`Há ${itensPendentes} itens do edital pendentes de revisão. Confira na aba Revisão.`);

        partes.push('Quando estiver pronto, clique em "Iniciar Próximo Ciclo" no topo do seu ciclo.');

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

// ── Detalhe do bloco: aula do curso ↔ edital ↔ TEC ──────────────────────────
// Montado com textContent (nunca innerHTML) porque os nomes vêm de dados
// editáveis por usuários.
function abrirDetalheBloco(index) {
    const bloco = blocosAtivos && blocosAtivos[index];
    if (!bloco) return;
    const cont = document.getElementById('detalheBlocoConteudo');
    const titulo = document.getElementById('detalheBlocoMateria');
    if (!cont || !titulo) return;

    titulo.textContent = `${bloco.nome} (${bloco.legenda})`;
    cont.innerHTML = '';

    const addLinha = (rotulo, valor) => {
        const div = document.createElement('div');
        div.className = 'detalhe-bloco__linha';
        const lab = document.createElement('span');
        lab.className = 'detalhe-bloco__rotulo';
        lab.textContent = rotulo;
        const val = document.createElement('span');
        val.className = 'detalhe-bloco__valor';
        val.textContent = valor;
        div.appendChild(lab);
        div.appendChild(val);
        cont.appendChild(div);
        return val;
    };

    if (bloco.concluido) {
        const aviso = document.createElement('p');
        aviso.className = 'detalhe-bloco__concluido';
        aviso.textContent = 'Bloco concluído';
        cont.appendChild(aviso);
        if (bloco.assunto) addLinha('Assunto estudado', bloco.assunto);
        if (bloco.questoes && bloco.questoes.feitas > 0) {
            const pct = Math.round((bloco.questoes.corretas / bloco.questoes.feitas) * 100);
            addLinha('Questões', `${bloco.questoes.corretas}/${bloco.questoes.feitas} (${pct}%)`);
        }
    } else {
        const d = typeof obterSugestaoDetalhada === 'function' ? obterSugestaoDetalhada(bloco.nome) : null;
        if (!d) {
            const p = document.createElement('p');
            p.className = 'detalhe-bloco__vazio';
            p.textContent = planoAdotado?.edital
                ? 'Nenhum assunto pendente no edital para esta matéria.'
                : 'Este plano não possui edital vinculado.';
            cont.appendChild(p);
        } else {
            const destaque = document.createElement('div');
            destaque.className = 'detalhe-bloco__destaque';
            const rotuloDestaque = document.createElement('span');
            rotuloDestaque.className = 'detalhe-bloco__rotulo';
            rotuloDestaque.textContent = d.revisao ? 'Revisar agora' : 'Estudar agora';
            const aulaNome = document.createElement('p');
            aulaNome.className = 'detalhe-bloco__aula';
            aulaNome.textContent = d.exibicao;
            destaque.appendChild(rotuloDestaque);
            destaque.appendChild(aulaNome);
            cont.appendChild(destaque);

            // Correlação com o edital: sempre visível, mostra o caminho oficial
            const caminho = d.nomeOficial && d.nomeOficial !== d.topicoOficial
                ? `${d.materiaEdital} › ${d.topicoOficial} › ${d.nomeOficial}`
                : `${d.materiaEdital} › ${d.topicoOficial}`;
            addLinha('No edital', caminho);

            if (d.tecAssunto) {
                const val = addLinha('No TEC', d.tecAssunto);
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'edital-item__tec-copy';
                btn.textContent = 'Copiar';
                btn.title = 'Copiar nome do assunto para buscar no TEC Concursos';
                btn.addEventListener('click', () => {
                    navigator.clipboard.writeText(d.tecAssunto);
                    btn.textContent = 'Copiado!';
                    setTimeout(() => { btn.textContent = 'Copiar'; }, 1500);
                });
                val.parentNode.appendChild(btn);
            }
        }
    }

    if (typeof abrirModal === 'function') abrirModal('modalDetalheBloco');
}

function continuarEstudo() {
    exibirCicloVisual(blocosAtivos);
    alternarAba('meuciclo');
}

// ── Próximo ciclo ────────────────────────────────────────────────────────────
// Ao concluir 100% do ciclo, verificarConclusao() apenas incrementa
// cicloNumero e avisa — nada regenera os blocos, então o aluno fica travado
// com tudo marcado como concluído. iniciarProximoCiclo() abre uma confirmação
// (não bloqueante, apenas informativa) sobre revisão pendente e então
// redistribui o MESMO total de blocos do ciclo anterior, ponderado pelo
// desempenho em questões — sem alterar nenhum status de edital_progresso.
function iniciarProximoCiclo() {
    if (!blocosAtivos || blocosAtivos.length === 0 || !blocosAtivos.every(b => b.concluido)) return;

    const itensPendentes = typeof contarItensRevisaoPendente === 'function' ? contarItensRevisaoPendente() : 0;
    const textoEl = document.getElementById('confirmarCicloRevisaoTexto');
    if (textoEl) {
        textoEl.textContent = itensPendentes > 0
            ? `Você tem ${itensPendentes} item(ns) do edital pendente(s) de revisão do ciclo anterior.`
            : 'Não há itens pendentes de revisão no momento.';
    }
    if (typeof abrirModal === 'function') abrirModal('modalConfirmarProximoCiclo');
}

function _gerarProximoCiclo() {
    if (!blocosAtivos || blocosAtivos.length === 0) return;

    // Agrupa por matéria: template (para clonar campos como nome/cor/duração)
    // e total de blocos que a matéria tinha no ciclo que acabou de terminar.
    const grupos = {};
    blocosAtivos.forEach(bloco => {
        if (!grupos[bloco.legenda]) grupos[bloco.legenda] = { template: bloco, total: 0 };
        grupos[bloco.legenda].total++;
    });

    const totais = {};
    Object.keys(grupos).forEach(leg => { totais[leg] = grupos[leg].total; });

    const fatoresDesemp = typeof calcularFatoresDesempenho === 'function' ? calcularFatoresDesempenho() : {};
    const novoTotais = _calcularRedistribuicaoPorDesempenho(totais, fatoresDesemp);

    const novosBlocos = [];
    Object.entries(novoTotais).forEach(([leg, qtd]) => {
        const template = grupos[leg].template;
        for (let i = 0; i < qtd; i++) {
            const clone = { ...template };
            delete clone.id; // ids são reatribuídos por garantirIdsBlocos no próximo merge/conclusão
            clone.concluido = false;
            clone.assunto = null;
            clone.questoes = null;
            novosBlocos.push(clone);
        }
    });

    if (typeof _distribuirPorDeficit === 'function' && novosBlocos.length > 1) {
        const contagem = {};
        novosBlocos.forEach(b => { contagem[b.legenda] = (contagem[b.legenda] || 0) + 1; });
        const entradas = Object.entries(contagem).map(([leg, qtd]) => ({ legenda: leg, qtdBlocos: qtd }));
        const ordem = _distribuirPorDeficit(entradas);
        const porLegenda = {};
        novosBlocos.forEach(b => { (porLegenda[b.legenda] = porLegenda[b.legenda] || []).push(b); });
        blocosAtivos = ordem.map(leg => porLegenda[leg].shift());
    } else {
        blocosAtivos = novosBlocos;
    }

    exibirCicloVisual(blocosAtivos);
    salvarEstado();
}

function iniciarNovoEstudo() {
    salvarAoSair = false;
    localStorage.removeItem('cicloEstudosEstado');
    location.reload();
}
