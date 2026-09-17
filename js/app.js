document.addEventListener('DOMContentLoaded', async function() {
    // Main tab clicks
    document.querySelectorAll('.tab-container > .tab').forEach(tab => {
        tab.addEventListener('click', function() {
            alternarAba(this.getAttribute('data-tab'));
        });
    });

    // Sub-tab clicks
    document.querySelectorAll('.subtab').forEach(subtab => {
        subtab.addEventListener('click', function() {
            const subtabId = this.getAttribute('data-subtab');
            const parentTab = this.closest('.tab-content');
            if (parentTab) {
                ativarSubTab(parentTab.id, subtabId);
            }
        });
    });

    document.getElementById('horasForm').addEventListener('submit', avancarHorasSemanais);
    document.getElementById('proximoMaterias').addEventListener('click', avancarSelecaoMaterias);
    document.getElementById('calcularBlocos').addEventListener('click', calcularBlocos);
    document.getElementById('ajustarBlocos').addEventListener('click', ajustarBlocos);
    document.getElementById('btnIniciarOnboarding').addEventListener('click', abrirOnboarding);
    document.getElementById('btnRefazerOnboarding').addEventListener('click', abrirOnboarding);

    document.getElementById('adicionarMateria').addEventListener('click', function() {
        const nome = document.getElementById('novaMateriaNome').value.trim();
        const sigla = document.getElementById('novaMateriaSigla').value.trim().toUpperCase();
        if (nome && sigla) {
            if (sigla.length > 3) {
                alert('A sigla deve ter no maximo 3 letras.');
                return;
            }
            if (materiasList.some(m => m.legenda === sigla)) {
                alert('Ja existe uma materia com essa sigla. Por favor, escolha outra.');
                return;
            }
            const novaMateria = {nome: nome, legenda: sigla};
            materiasList.push(novaMateria);
            adicionarMateriaAoDOM(novaMateria);
            document.getElementById('novaMateriaNome').value = '';
            document.getElementById('novaMateriaSigla').value = '';
            alert('Materia adicionada com sucesso!');
        } else {
            alert('Para adicionar uma nova materia, preencha tanto o nome quanto a sigla.');
        }
    });

    document.getElementById('tipoTempo').addEventListener('change', alternarModoTempo);
    document.getElementById('iniciarPausar').addEventListener('click', iniciarPausarTempo);
    document.getElementById('resetar').addEventListener('click', resetarTempo);
    document.getElementById('salvarConfiguracoes').addEventListener('click', salvarConfiguracoes);
    document.getElementById('novoEstudo').addEventListener('click', iniciarNovoEstudo);
    document.getElementById('btnRecalcularCiclo').addEventListener('click', function() {
        const novasHoras = parseInt(document.getElementById('horasSemanaisEdit').value);
        if (!novasHoras || novasHoras <= 0) {
            alert('Por favor, insira um número válido de horas semanais.');
            return;
        }
        redimensionarCiclo(novasHoras);
    });
    document.getElementById('gerarPDF').addEventListener('click', gerarPDF);
    document.getElementById('exportarExcel').addEventListener('click', exportarParaExcel);
    document.getElementById('btnExportarDados').addEventListener('click', exportarDadosPessoais);
    document.getElementById('btnExcluirConta').addEventListener('click', excluirConta);
    const btnLogoutTop = document.getElementById('btnLogoutTop');
    if (btnLogoutTop) btnLogoutTop.addEventListener('click', sair);

    // Modais de conclusao
    inicializarModaisQuestoes();

    // Detalhe do bloco (aula do curso / edital / TEC)
    const btnFecharDetalhe = document.getElementById('btnFecharDetalheBloco');
    if (btnFecharDetalhe) btnFecharDetalhe.addEventListener('click', () => fecharModal('modalDetalheBloco'));

    // Confirmação de revisão ao iniciar o próximo ciclo
    const btnCicloRevisouSim = document.getElementById('btnCicloRevisouSim');
    if (btnCicloRevisouSim) btnCicloRevisouSim.addEventListener('click', () => {
        fecharModal('modalConfirmarProximoCiclo');
        if (typeof _gerarProximoCiclo === 'function') _gerarProximoCiclo();
    });
    const btnCicloRevisouNao = document.getElementById('btnCicloRevisouNao');
    if (btnCicloRevisouNao) btnCicloRevisouNao.addEventListener('click', () => {
        fecharModal('modalConfirmarProximoCiclo');
        alternarAba('revisao');
    });

    // Planos (professor)
    document.getElementById('btnCriarPlano').addEventListener('click', () => abrirEditorPlano(null));
    document.getElementById('btnSalvarPlano').addEventListener('click', async () => {
        const dados = coletarDadosPlano();
        if (!dados.nome) { alert('Informe o nome do plano.'); return; }
        if (dados.materias.length === 0) { alert('Adicione pelo menos uma materia.'); return; }

        if (dados.edital && dados.edital.length > 0 && typeof validarMateriasContraEdital === 'function') {
            const semMatch = validarMateriasContraEdital(dados.materias, dados.edital);
            if (semMatch.length > 0) {
                const lista = semMatch.map(s => `  • ${s.materia} (${s.legenda})`).join('\n');
                const continuar = confirm(
                    `Atenção: as seguintes matérias não têm correspondência no edital:\n\n${lista}\n\n` +
                    `Essas matérias não terão sugestão automática de assunto nem acompanhamento no edital.\n\n` +
                    `Verifique se os nomes estão escritos de forma compatível.\n\nDeseja salvar mesmo assim?`
                );
                if (!continuar) return;
            }
        }

        const result = await salvarPlano(dados);
        if (result) {
            alert('Plano salvo com sucesso!');
            fecharEditorPlano();
        } else {
            alert('Erro ao salvar plano.');
        }
    });
    document.getElementById('btnCancelarPlano').addEventListener('click', fecharEditorPlano);
    document.getElementById('btnAddMateriaPlano').addEventListener('click', adicionarMateriaAoPlano);
    document.getElementById('btnUploadMateriasPlano').addEventListener('click', uploadMateriasPlano);
    document.getElementById('btnBaixarModelo').addEventListener('click', baixarModeloExcel);
    document.getElementById('btnAddRegraEvolucao').addEventListener('click', () => {
        const container = document.getElementById('regrasEvolucaoContainer');
        const items = container.querySelectorAll('.regra-evolucao-item');
        const regras = coletarRegrasEvolucao();
        const nextFase = regras.length > 0 ? Math.max(...regras.map(r => r.fase)) + 1 : 1;
        regras.push({ fase: nextFase, pct_edital: 60 });
        renderizarRegrasEvolucao(regras);
    });

    // Upload materias (aluno)
    document.getElementById('btnUploadMaterias').addEventListener('click', uploadMateriasAluno);
    document.getElementById('btnBaixarModeloAluno').addEventListener('click', baixarModeloExcel);

    // Painel de alunos (professor)
    document.getElementById('btnFecharPainel').addEventListener('click', fecharPainelAlunos);
    document.getElementById('btnSairVisualizacao').addEventListener('click', sairModoVisualizacao);

    // Notificacoes
    document.getElementById('notificacaoBadge').addEventListener('click', () => {
        const dd = document.getElementById('notificacaoDropdown');
        dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('btnMarcarTodasLidas').addEventListener('click', marcarTodasNotificacoesLidas);

    // Editor de edital (professor)
    document.getElementById('btnAddMateriaEdital').addEventListener('click', adicionarMateriaEdital);
    document.getElementById('btnUploadEdital').addEventListener('click', uploadEditalExcel);
    document.getElementById('btnBaixarModeloEdital').addEventListener('click', baixarModeloEdital);

    // Filtros da aba Edital (aluno)
    document.getElementById('editalFiltroStatus').addEventListener('change', renderizarEdital);
    document.getElementById('editalBusca').addEventListener('input', renderizarEdital);

    // T2: Vínculos e retificação de edital
    const btnVinculos = document.getElementById('btnGerenciarVinculos');
    if (btnVinculos) btnVinculos.addEventListener('click', abrirGerenciarVinculos);
    const btnRetificacao = document.getElementById('btnRetificacaoEdital');
    if (btnRetificacao) btnRetificacao.addEventListener('click', abrirRetificacaoEdital);

    document.getElementById('btnConfirmarReconciliacao').addEventListener('click', confirmarReconciliacao);
    document.getElementById('btnCancelarReconciliacao').addEventListener('click', () => fecharModal('modalReconciliacao'));
    document.getElementById('btnSalvarVinculos').addEventListener('click', salvarVinculos);
    document.getElementById('btnFecharVinculos').addEventListener('click', () => fecharModal('modalGerenciarVinculos'));
    document.getElementById('btnUploadRetificacao').addEventListener('click', () => document.getElementById('retificacaoFileInput').click());
    document.getElementById('retificacaoFileInput').addEventListener('change', processarRetificacaoUpload);
    document.getElementById('btnConfirmarRetificacao').addEventListener('click', confirmarRetificacao);
    document.getElementById('btnCancelarRetificacao').addEventListener('click', cancelarRetificacao);

    // Filtros da aba Revisão
    document.getElementById('revisaoFiltroMateria').addEventListener('change', renderizarRevisao);
    document.getElementById('revisaoBusca').addEventListener('input', renderizarRevisao);

    // Videos
    document.getElementById('btnAddVideo').addEventListener('click', adicionarVideo);
    document.getElementById('btnFecharPlayer').addEventListener('click', fecharPlayer);

    // Escolher plano (aluno)
    document.getElementById('btnEscolherPlano').addEventListener('click', renderizarPlanosDisponiveis);

    // Modal: atribuir plano a aluno
    document.getElementById('btnAtribuirNext').addEventListener('click', atribuirPassoNext);
    document.getElementById('btnAtribuirNext2').addEventListener('click', atribuirPassoNext2);
    document.getElementById('btnAtribuirVoltar').addEventListener('click', atribuirPassoBack);
    document.getElementById('btnAtribuirVoltar2').addEventListener('click', atribuirPassoBack2);
    document.getElementById('btnAtribuirConfirmar').addEventListener('click', confirmarAtribuicao);
    document.getElementById('btnAtribuirCancelar1').addEventListener('click', fecharModalAtribuir);
    document.getElementById('btnAtribuirCancelar2').addEventListener('click', fecharModalAtribuir);
    document.getElementById('btnAtribuirCancelar3').addEventListener('click', fecharModalAtribuir);

    inicializarSelecaoMaterias();
    carregarConfiguracoes();
    carregarEstado();
    if (typeof aplicarVisibilidadePerfil === 'function') aplicarVisibilidadePerfil();

    const logado = await atualizarUIAuth();
    if (supabaseConfigurado()) {
        const { data } = await supabaseClient.auth.getSession();
        if (typeof atualizarSessionCache === 'function') atualizarSessionCache(data.session);
        if (data.session) {
            await ensureProfile();
            atualizarUIRole();
            await carregarEstadoNuvem();
            await verificarEAplicarPlanoAtribuido();
            atualizarVisibilidadeEdital();
            if (planoAdotado?.edital) {
                if (typeof garantirIdsEdital === 'function') garantirIdsEdital(planoAdotado.edital);
                await carregarEditalProgresso();
                renderizarEdital();
                if (typeof verificarReconciliacaoPendente === 'function') verificarReconciliacaoPendente();
            }
            autoResumeIfActive();
            if (typeof atualizarSugestoesBlocos === 'function') atualizarSugestoesBlocos();
            if (typeof carregarNotificacoes === 'function') carregarNotificacoes();
            if (typeof flushEventosPendentes === 'function') flushEventosPendentes();
        }
        supabaseClient.auth.onAuthStateChange(async (_event, session) => {
            if (typeof atualizarSessionCache === 'function') atualizarSessionCache(session);
            if (session) {
                await ensureProfile();
                atualizarUIRole();
                await carregarEstadoNuvem();
                await verificarEAplicarPlanoAtribuido();
                atualizarVisibilidadeEdital();
                if (planoAdotado?.edital) {
                    if (typeof garantirIdsEdital === 'function') garantirIdsEdital(planoAdotado.edital);
                    await carregarEditalProgresso();
                    renderizarEdital();
                    if (typeof verificarReconciliacaoPendente === 'function') verificarReconciliacaoPendente();
                }
                autoResumeIfActive();
                if (typeof atualizarSugestoesBlocos === 'function') atualizarSugestoesBlocos();
                if (typeof carregarNotificacoes === 'function') carregarNotificacoes();
            }
            await atualizarUIAuth();
        });
    }

    if (!logado) {
        alternarAba('home');
    }

    // Fallback: retry suggestions after all async settles
    setTimeout(() => {
        if (typeof atualizarSugestoesBlocos === 'function') atualizarSugestoesBlocos();
    }, 3000);
});

function autoResumeIfActive() {
    if (blocosAtivos && blocosAtivos.length > 0) {
        exibirCicloVisual(blocosAtivos);
        alternarAba('meuciclo');
    }
}

setInterval(async () => { if (await getUsuarioLogado()) salvarEstado(); }, 30000);

// T1.4: beforeunload não dispara de forma confiável em mobile. O caminho
// principal é visibilitychange + fetch keepalive (sobrevive ao fechamento
// da aba); beforeunload fica como fallback para desktop.
document.addEventListener('visibilitychange', () => {
    // Modo visualização: não sobrescrever o localStorage nem a nuvem do
    // professor com o estado do aluno que está sendo visualizado.
    if (typeof _modoVisualizacaoAluno !== 'undefined' && _modoVisualizacaoAluno) return;
    if (document.visibilityState === 'hidden' && salvarAoSair) {
        localStorage.setItem('cicloEstudosEstado', JSON.stringify(montarEstadoLocal()));
        if (typeof enviarBeaconSync === 'function') enviarBeaconSync();
    }
});

window.addEventListener('online', () => {
    if (typeof flushEventosPendentes === 'function') flushEventosPendentes();
});

window.addEventListener('beforeunload', () => {
    if (salvarAoSair) salvarEstado();
});
