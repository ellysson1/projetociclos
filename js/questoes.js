let blocoEmConclusao = null;
let cardEmConclusao = null;

function inicializarModaisQuestoes() {
    // Etapa 1: Confirmar assunto
    document.getElementById('btnConfirmarAssunto').addEventListener('click', function() {
        const assunto = document.getElementById('inputAssunto').value.trim();
        if (!assunto) {
            alert('Por favor, informe o assunto estudado.');
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
    document.getElementById('inputAssunto').value = bloco.assunto || '';
    abrirModal('modalAssunto');
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
