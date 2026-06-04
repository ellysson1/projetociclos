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
    const btnLogoutTop = document.getElementById('btnLogoutTop');
    if (btnLogoutTop) btnLogoutTop.addEventListener('click', sair);

    // Modais de conclusao
    inicializarModaisQuestoes();

    // Planos (professor)
    document.getElementById('btnCriarPlano').addEventListener('click', () => abrirEditorPlano(null));
    document.getElementById('btnSalvarPlano').addEventListener('click', async () => {
        const dados = coletarDadosPlano();
        if (!dados.nome) { alert('Informe o nome do plano.'); return; }
        if (dados.materias.length === 0) { alert('Adicione pelo menos uma materia.'); return; }
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

    // Upload materias (aluno)
    document.getElementById('btnUploadMaterias').addEventListener('click', uploadMateriasAluno);
    document.getElementById('btnBaixarModeloAluno').addEventListener('click', baixarModeloExcel);

    // Painel de alunos (professor)
    document.getElementById('btnFecharPainel').addEventListener('click', fecharPainelAlunos);

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

    const logado = await atualizarUIAuth();
    if (supabaseConfigurado()) {
        const { data } = await supabaseClient.auth.getSession();
        if (data.session) {
            await ensureProfile();
            atualizarUIRole();
            await carregarEstadoNuvem();
            await verificarEAplicarPlanoAtribuido();
            atualizarVisibilidadeEdital();
            if (planoAdotado?.edital) {
                await carregarEditalProgresso();
                renderizarEdital();
            }
            autoResumeIfActive();
            if (typeof atualizarSugestoesBlocos === 'function') atualizarSugestoesBlocos();
            if (typeof carregarNotificacoes === 'function') carregarNotificacoes();
        }
        supabaseClient.auth.onAuthStateChange(async (_event, session) => {
            if (session) {
                await ensureProfile();
                atualizarUIRole();
                await carregarEstadoNuvem();
                await verificarEAplicarPlanoAtribuido();
                atualizarVisibilidadeEdital();
                if (planoAdotado?.edital) {
                    await carregarEditalProgresso();
                    renderizarEdital();
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
window.addEventListener('beforeunload', () => {
    if (salvarAoSair) salvarEstado();
});
