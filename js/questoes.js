let blocoEmConclusao = null;
let cardEmConclusao = null;

function inicializarModaisQuestoes() {
    // Etapa 1: Confirmar assunto
    document.getElementById('btnConfirmarAssunto').addEventListener('click', function() {
        const assunto = document.getElementById('assuntoSelecionado').value.trim();
        if (!assunto) {
            alert('Por favor, selecione ou informe o assunto estudado.');
            return;
        }
        fecharModal('modalAssunto');
        blocosAtivos[blocoEmConclusao].assunto = assunto;

        // Etapa 2: Fez questões?
        abrirModal('modalQuestoes');
    });

    // Etapa 2: Sim - fez questões
    document.getElementById('btnSimQuestoes').addEventListener('click', function() {
        fecharModal('modalQuestoes');
        const bloco = blocosAtivos[blocoEmConclusao];
        document.getElementById('modalRegMateria').textContent = bloco.nome;
        document.getElementById('modalRegAssunto').textContent = bloco.assunto || '';
        document.getElementById('inputQtdFeitas').value = '';
        document.getElementById('inputQtdCorretas').value = '';
        abrirModal('modalRegistrarQuestoes');
    });

    // Etapa 2: Não - apenas estudou
    document.getElementById('btnNaoQuestoes').addEventListener('click', function() {
        fecharModal('modalQuestoes');
        finalizarConclusao(null);
    });

    // Etapa 3: Salvar questões
    document.getElementById('btnSalvarQuestoes').addEventListener('click', function() {
        const feitas = parseInt(document.getElementById('inputQtdFeitas').value) || 0;
        const corretas = parseInt(document.getElementById('inputQtdCorretas').value) || 0;

        if (feitas <= 0) {
            alert('Informe a quantidade de questões feitas.');
            return;
        }
        if (corretas > feitas) {
            alert('O número de questões corretas não pode ser maior que o de questões feitas.');
            return;
        }

        fecharModal('modalRegistrarQuestoes');
        finalizarConclusao({ feitas, corretas });
    });

    // Fechar modais clicando no overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', function(e) {
            if (e.target === this) {
                fecharModal(this.id);
                // Se cancelou, desfaz a conclusão
                if (blocoEmConclusao !== null && cardEmConclusao) {
                    const checkbox = cardEmConclusao.querySelector('input[type="checkbox"]');
                    if (checkbox) checkbox.checked = false;
                    blocoEmConclusao = null;
                    cardEmConclusao = null;
                }
            }
        });
    });
}

function iniciarFluxoConclusao(index, card) {
    blocoEmConclusao = index;
    cardEmConclusao = card;
    const bloco = blocosAtivos[index];

    document.getElementById('modalAssuntoMateria').textContent = bloco.nome;
    document.getElementById('assuntoSelecionado').value = bloco.assunto || '';
    document.getElementById('inputAssunto').value = '';

    preencherListaAssuntosEdital(bloco.nome);

    abrirModal('modalAssunto');
}

function preencherListaAssuntosEdital(materiaBloco) {
    const lista = document.getElementById('listaAssuntosEdital');
    const outroContainer = document.getElementById('assuntoOutroContainer');
    const hiddenInput = document.getElementById('assuntoSelecionado');
    lista.innerHTML = '';
    outroContainer.style.display = 'none';

    const itens = [];

    if (planoAdotado?.edital) {
        const materiaBlNorm = normalizarTexto(materiaBloco);
        planoAdotado.edital.forEach(materiaObj => {
            const materiaNorm = normalizarTexto(materiaObj.materia);
            const mesmaMateria = materiaNorm.includes(materiaBlNorm) || materiaBlNorm.includes(materiaNorm);
            if (!mesmaMateria) return;

            (materiaObj.topicos || []).forEach(topicoObj => {
                const subtopicos = topicoObj.subtopicos || [];
                if (subtopicos.length > 0) {
                    subtopicos.forEach(sub => itens.push(sub));
                } else {
                    itens.push(topicoObj.nome);
                }
            });
        });
    }

    // Sync free-text input with hidden field (replace to avoid duplicate listeners)
    const inputAssunto = document.getElementById('inputAssunto');
    const newInput = inputAssunto.cloneNode(true);
    inputAssunto.parentNode.replaceChild(newInput, inputAssunto);
    newInput.addEventListener('input', function() {
        hiddenInput.value = this.value.trim();
    });

    // If no edital topics found for this materia, go straight to free-text
    if (itens.length === 0) {
        outroContainer.style.display = 'block';
        newInput.focus();
        if (hiddenInput.value) newInput.value = hiddenInput.value;
        return;
    }

    itens.forEach(texto => {
        const div = document.createElement('div');
        div.className = 'assunto-item';
        div.textContent = texto;
        div.addEventListener('click', () => {
            lista.querySelectorAll('.assunto-item').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            hiddenInput.value = texto;
            outroContainer.style.display = 'none';
            newInput.value = '';
        });
        lista.appendChild(div);
    });

    // "Outros" option at bottom
    const outroDiv = document.createElement('div');
    outroDiv.className = 'assunto-item assunto-item--outro';
    outroDiv.textContent = 'Outros (digitar)';
    outroDiv.addEventListener('click', () => {
        lista.querySelectorAll('.assunto-item').forEach(el => el.classList.remove('selected'));
        outroDiv.classList.add('selected');
        outroContainer.style.display = 'block';
        hiddenInput.value = '';
        newInput.value = '';
        newInput.focus();
    });
    lista.appendChild(outroDiv);

    // Pre-select if bloco already has assunto
    if (hiddenInput.value) {
        let found = false;
        lista.querySelectorAll('.assunto-item:not(.assunto-item--outro)').forEach(el => {
            if (el.textContent === hiddenInput.value) { el.classList.add('selected'); found = true; }
        });
        if (!found) {
            outroDiv.classList.add('selected');
            outroContainer.style.display = 'block';
            newInput.value = hiddenInput.value;
        }
    }
}

function finalizarConclusao(questoes) {
    if (blocoEmConclusao === null) return;

    const bloco = blocosAtivos[blocoEmConclusao];
    bloco.concluido = true;
    bloco.questoes = questoes;

    if (cardEmConclusao) {
        cardEmConclusao.classList.add('concluido');
        const infoEl = cardEmConclusao.querySelector('.bloco-card__info-concluido');
        if (infoEl) {
            let info = bloco.assunto || '';
            if (questoes && questoes.feitas > 0) {
                const pct = Math.round((questoes.corretas / questoes.feitas) * 1000) / 10;
                info += (info ? ' | ' : '') + `${pct}% de acertos (${questoes.corretas}/${questoes.feitas})`;
            }
            infoEl.textContent = info;
        }
    }

    salvarEstado();
    salvarQuestoesNuvem(bloco, questoes);

    // Atualizar progresso no edital
    if (typeof atualizarProgressoEdital === 'function') {
        atualizarProgressoEdital(bloco.nome, bloco.assunto, questoes);
    }

    blocoEmConclusao = null;
    cardEmConclusao = null;

    verificarConclusao();
}

async function salvarQuestoesNuvem(bloco, questoes) {
    if (!supabaseConfigurado() || !questoes) return;
    const user = await getUsuarioLogado();
    if (!user) return;

    const { error } = await supabaseClient
        .from('questoes')
        .insert({
            user_id: user.id,
            bloco_index: blocosAtivos.indexOf(bloco),
            materia: bloco.nome,
            assunto: bloco.assunto || '',
            questoes_feitas: questoes.feitas,
            questoes_corretas: questoes.corretas
        });

    if (error) {
        console.error('Erro ao salvar questões:', error);
    }
}

function abrirModal(id) {
    document.getElementById(id).classList.add('active');
}

function fecharModal(id) {
    document.getElementById(id).classList.remove('active');
}
