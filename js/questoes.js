let blocoEmConclusao = null;
let cardEmConclusao = null;
let concluiuAssunto = false; // did student finish studying the topic?

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

        // Etapa 2: Concluiu o estudo desse assunto?
        abrirModal('modalConcluiuEstudo');
    });

    // Etapa 2: Sim, concluiu
    document.getElementById('btnSimConcluiu').addEventListener('click', function() {
        concluiuAssunto = true;
        fecharModal('modalConcluiuEstudo');
        abrirModal('modalQuestoes');
    });

    // Etapa 2: Não concluiu (em andamento)
    document.getElementById('btnNaoConcluiu').addEventListener('click', function() {
        concluiuAssunto = false;
        fecharModal('modalConcluiuEstudo');
        abrirModal('modalQuestoes');
    });

    // Etapa 3: Sim - fez questões
    document.getElementById('btnSimQuestoes').addEventListener('click', function() {
        fecharModal('modalQuestoes');
        const bloco = blocosAtivos[blocoEmConclusao];
        document.getElementById('modalRegMateria').textContent = bloco.nome;
        document.getElementById('modalRegAssunto').textContent = bloco.assunto || '';
        document.getElementById('inputQtdFeitas').value = '';
        document.getElementById('inputQtdCorretas').value = '';
        abrirModal('modalRegistrarQuestoes');
    });

    // Etapa 3: Não - apenas estudou
    document.getElementById('btnNaoQuestoes').addEventListener('click', function() {
        fecharModal('modalQuestoes');
        finalizarConclusao(null);
    });

    // Etapa 4: Salvar questões
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
    concluiuAssunto = false;
    const bloco = blocosAtivos[index];

    document.getElementById('modalAssuntoMateria').textContent = bloco.nome;
    document.getElementById('assuntoSelecionado').value = bloco.assunto || '';
    document.getElementById('inputAssunto').value = '';

    mostrarAssuntoSugerido(bloco.nome);
    preencherListaAssuntosEdital(bloco.nome);

    abrirModal('modalAssunto');
}

function mostrarAssuntoSugerido(materiaBloco) {
    const container = document.getElementById('assuntoSugeridoContainer');
    const texto = document.getElementById('assuntoSugeridoTexto');
    container.style.display = 'none';

    if (typeof obterAssuntoSugerido !== 'function') return;
    const sugerido = obterAssuntoSugerido(materiaBloco);

    if (sugerido) {
        texto.textContent = sugerido;
        container.style.display = 'block';
        container.onclick = () => {
            document.getElementById('assuntoSelecionado').value = sugerido;
            const lista = document.getElementById('listaAssuntosEdital');
            lista.querySelectorAll('.assunto-item').forEach(el => {
                const span = el.querySelector('span');
                const t = span ? span.textContent : el.textContent;
                el.classList.toggle('selected', t === sugerido);
            });
            document.getElementById('assuntoOutroContainer').style.display = 'none';
        };
    }
}

function preencherListaAssuntosEdital(materiaBloco) {
    const lista = document.getElementById('listaAssuntosEdital');
    const outroContainer = document.getElementById('assuntoOutroContainer');
    const hiddenInput = document.getElementById('assuntoSelecionado');
    lista.innerHTML = '';
    outroContainer.style.display = 'none';

    const itens = [];
    const itensVistos = new Set();

    if (planoAdotado?.edital) {
        const materiaEdital = (typeof _encontrarMateriaEditalPorId === 'function' && _encontrarMateriaEditalPorId(materiaBloco))
            || (typeof _encontrarMateriaEditalFuzzy === 'function' && _encontrarMateriaEditalFuzzy(materiaBloco));

        const materiasParaBuscar = materiaEdital ? [materiaEdital] : [];
        if (!materiaEdital) {
            const materiaBlNorm = normalizarTexto(materiaBloco);
            planoAdotado.edital.forEach(materiaObj => {
                const materiaNorm = normalizarTexto(materiaObj.materia);
                if (materiaNorm.includes(materiaBlNorm) || materiaBlNorm.includes(materiaNorm)) {
                    materiasParaBuscar.push(materiaObj);
                }
            });
        }

        materiasParaBuscar.forEach(materiaObj => {
            const topicos = materiaObj.topicos || [];
            const topicosOrdenados = [...topicos].sort((a, b) => (a.ordem || 999) - (b.ordem || 999));

            // Exibe o nome da aula no curso quando mapeado (é o que o aluno vê
            // na plataforma dele); encontrarChavesParaTexto resolve de volta
            // para as chaves oficiais do edital. Uma mesma aula pode cobrir
            // vários tópicos/subtópicos (curso_nome repetido) — dedupe para
            // não listar o mesmo nome mais de uma vez.
            topicosOrdenados.forEach(topicoObj => {
                const subtopicos = topicoObj.subtopicos || [];
                if (subtopicos.length > 0) {
                    subtopicos.forEach(sub => {
                        const nome = typeof nomeExibicaoEdital === 'function'
                            ? nomeExibicaoEdital(sub)
                            : (typeof sub === 'string' ? sub : sub?.nome || '');
                        if (nome && !itensVistos.has(nome)) {
                            itensVistos.add(nome);
                            itens.push(nome);
                        }
                    });
                } else {
                    const nome = typeof nomeExibicaoEdital === 'function'
                        ? nomeExibicaoEdital(topicoObj)
                        : topicoObj.nome;
                    if (nome && !itensVistos.has(nome)) {
                        itensVistos.add(nome);
                        itens.push(nome);
                    }
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

    if (itens.length === 0) {
        outroContainer.style.display = 'block';
        newInput.focus();
        if (hiddenInput.value) newInput.value = hiddenInput.value;
        return;
    }

    itens.forEach(texto => {
        // Uma aula pode cobrir vários itens do edital: agrega o status de
        // TODOS eles (concluído só se todos estiverem concluídos, em
        // andamento se algum já foi tocado).
        const chaves = encontrarChavesParaTexto(texto);
        const statuses = chaves.map(c => editalProgresso[c]?.status || 'pendente');
        const status = statuses.length === 0 ? 'pendente'
            : statuses.every(s => s === 'concluido') ? 'concluido'
            : statuses.every(s => s === 'visto' || s === 'concluido') ? 'visto'
            : statuses.some(s => s !== 'pendente') ? 'em_andamento'
            : 'pendente';

        const div = document.createElement('div');
        div.className = 'assunto-item';
        if (status === 'visto' || status === 'concluido') {
            div.classList.add('assunto-item--done');
        } else if (status === 'em_andamento') {
            div.classList.add('assunto-item--progress');
        }

        const statusLabel = status === 'visto' ? ' (visto)' :
            status === 'concluido' ? ' (concluído)' :
            status === 'em_andamento' ? ' (em andamento)' : '';

        div.innerHTML = `<span>${texto}</span>${statusLabel ? `<small style="color:#888; margin-left:6px;">${statusLabel}</small>` : ''}`;
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
            if (el.querySelector('span')?.textContent === hiddenInput.value || el.textContent === hiddenInput.value) {
                el.classList.add('selected');
                found = true;
            }
        });
        if (!found) {
            outroDiv.classList.add('selected');
            outroContainer.style.display = 'block';
            newInput.value = hiddenInput.value;
        }
    }
}

// Todas as chaves do edital que correspondem ao texto — nome oficial OU nome
// da aula no curso (curso_nome). Uma mesma aula pode cobrir vários tópicos/
// subtópicos do edital; as chaves retornadas usam SEMPRE os nomes oficiais.
function encontrarChavesParaTexto(texto) {
    if (!planoAdotado?.edital || !texto) return [];
    const _nome = typeof nomeSubtopico === 'function' ? nomeSubtopico : (s => typeof s === 'string' ? s : s?.nome || '');
    const chaves = [];
    for (const materiaObj of planoAdotado.edital) {
        for (const topicoObj of (materiaObj.topicos || [])) {
            const subtopicos = topicoObj.subtopicos || [];
            if (subtopicos.length > 0) {
                for (const sub of subtopicos) {
                    const nomeSub = _nome(sub);
                    const cursoSub = (typeof sub === 'object' && sub) ? sub.curso_nome : null;
                    if (nomeSub === texto || cursoSub === texto) {
                        chaves.push(gerarChaveEdital(materiaObj.materia, topicoObj.nome, nomeSub));
                    }
                }
            } else if (topicoObj.nome === texto || topicoObj.curso_nome === texto) {
                chaves.push(gerarChaveEdital(materiaObj.materia, topicoObj.nome, null));
            }
        }
    }
    return chaves;
}

function encontrarChaveParaTexto(texto) {
    const chaves = encontrarChavesParaTexto(texto);
    return chaves.length > 0 ? chaves[0] : null;
}

function finalizarConclusao(questoes) {
    if (blocoEmConclusao === null) return;

    if (typeof garantirIdsBlocos === 'function') garantirIdsBlocos(blocosAtivos);
    const bloco = blocosAtivos[blocoEmConclusao];
    bloco.concluido = true;
    bloco.questoes = questoes;

    // Eventos imutáveis: gravados imediatamente (fila offline + idempotência)
    // para que a conclusão nunca se perca, mesmo se a aba fechar agora.
    let eventoQuestoesId = null;
    if (typeof registrarEvento === 'function') {
        registrarEvento('bloco_concluido', {
            bloco_id: bloco.id,
            materia: bloco.nome,
            legenda: bloco.legenda,
            assunto: bloco.assunto || null,
            questoes: questoes || null
        });
        if (questoes) {
            eventoQuestoesId = registrarEvento('questoes_registradas', {
                bloco_id: bloco.id,
                materia: bloco.nome,
                assunto: bloco.assunto || null,
                feitas: questoes.feitas,
                corretas: questoes.corretas
            });
        }
    }

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
    salvarQuestoesNuvem(bloco, questoes, eventoQuestoesId);

    // Garantir vínculo matéria→edital antes de atualizar progresso
    const statusEdital = concluiuAssunto ? 'visto' : 'em_andamento';
    const matSel = typeof materiasSelecionadas !== 'undefined'
        ? materiasSelecionadas.find(m => m.nome === bloco.nome || m.legenda === bloco.legenda)
        : null;

    if (matSel && typeof reconciliarNoBloco === 'function') {
        reconciliarNoBloco(matSel, () => {
            if (typeof atualizarProgressoEdital === 'function') {
                atualizarProgressoEdital(bloco.nome, bloco.assunto, questoes, statusEdital);
            }
        });
    } else if (typeof atualizarProgressoEdital === 'function') {
        atualizarProgressoEdital(bloco.nome, bloco.assunto, questoes, statusEdital);
    }

    blocoEmConclusao = null;
    cardEmConclusao = null;
    concluiuAssunto = false;

    verificarConclusao();

    if (typeof verificarProgressoFase === 'function') {
        setTimeout(() => verificarProgressoFase(), 500);
    }
}

async function salvarQuestoesNuvem(bloco, questoes, clientEventId) {
    if (typeof _modoVisualizacaoAluno !== 'undefined' && _modoVisualizacaoAluno) return;
    if (!supabaseConfigurado() || !questoes) return;
    const user = await getUsuarioLogado();
    if (!user) return;

    const registro = {
        bloco_index: blocosAtivos.indexOf(bloco),
        materia: bloco.nome,
        assunto: bloco.assunto || '',
        questoes_feitas: questoes.feitas,
        questoes_corretas: questoes.corretas,
        client_event_id: clientEventId || (typeof gerarUUID === 'function' ? gerarUUID() : undefined)
    };

    const { error } = await supabaseClient
        .from('questoes')
        .upsert({ ...registro, user_id: user.id }, { onConflict: 'client_event_id', ignoreDuplicates: true });

    if (error) {
        // Coluna client_event_id ausente (migração pendente): insert legado.
        const legado = await supabaseClient
            .from('questoes')
            .insert({
                user_id: user.id,
                bloco_index: registro.bloco_index,
                materia: registro.materia,
                assunto: registro.assunto,
                questoes_feitas: registro.questoes_feitas,
                questoes_corretas: registro.questoes_corretas
            });
        if (legado.error) {
            console.error('Erro ao salvar questões:', legado.error);
            // Sem rede: enfileira para reenvio idempotente no próximo sync.
            if (typeof enfileirarQuestaoPendente === 'function') enfileirarQuestaoPendente(registro);
        }
    }
}

function abrirModal(id) {
    document.getElementById(id).classList.add('active');
}

function fecharModal(id) {
    document.getElementById(id).classList.remove('active');
}
