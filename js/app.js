document.addEventListener('DOMContentLoaded', async function() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            alternarAba(this.getAttribute('data-tab'));
        });
    });

    document.getElementById('horasForm').addEventListener('submit', avancarHorasSemanais);
    document.getElementById('proximoMaterias').addEventListener('click', avancarSelecaoMaterias);
    document.getElementById('calcularBlocos').addEventListener('click', calcularBlocos);
    document.getElementById('ajustarBlocos').addEventListener('click', ajustarBlocos);

    document.getElementById('adicionarMateria').addEventListener('click', function() {
        const nome = document.getElementById('novaMateriaNome').value.trim();
        const sigla = document.getElementById('novaMateriaSigla').value.trim().toUpperCase();
        if (nome && sigla) {
            if (sigla.length > 3) {
                alert('A sigla deve ter no máximo 3 letras.');
                return;
            }
            if (materiasList.some(m => m.legenda === sigla)) {
                alert('Já existe uma matéria com essa sigla. Por favor, escolha outra.');
                return;
            }
            const novaMateria = {nome: nome, legenda: sigla};
            materiasList.push(novaMateria);
            adicionarMateriaAoDOM(novaMateria);
            document.getElementById('novaMateriaNome').value = '';
            document.getElementById('novaMateriaSigla').value = '';
            alert('Matéria adicionada com sucesso!');
        } else {
            alert('Para adicionar uma nova matéria, preencha tanto o nome quanto a sigla.');
        }
    });

    document.getElementById('salvarAnotacoes').addEventListener('click', salvarAnotacoes);
    document.getElementById('tipoTempo').addEventListener('change', alternarModoTempo);
    document.getElementById('iniciarPausar').addEventListener('click', iniciarPausarTempo);
    document.getElementById('resetar').addEventListener('click', resetarTempo);
    document.getElementById('salvarConfiguracoes').addEventListener('click', salvarConfiguracoes);
    document.getElementById('continuarEstudo').addEventListener('click', continuarEstudo);
    document.getElementById('novoEstudo').addEventListener('click', iniciarNovoEstudo);
    document.getElementById('gerarPDF').addEventListener('click', gerarPDF);
    document.getElementById('exportarExcel').addEventListener('click', exportarParaExcel);
    const btnLogoutTop = document.getElementById('btnLogoutTop');
    if (btnLogoutTop) btnLogoutTop.addEventListener('click', sair);

    // Modais de conclusão
    inicializarModaisQuestoes();

    // Planos (professor)
    document.getElementById('btnCriarPlano').addEventListener('click', () => abrirEditorPlano(null));
    document.getElementById('btnSalvarPlano').addEventListener('click', async () => {
        const dados = coletarDadosPlano();
        if (!dados.nome) { alert('Informe o nome do plano.'); return; }
        if (dados.materias.length === 0) { alert('Adicione pelo menos uma matéria.'); return; }
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

    // Upload matérias (aluno)
    document.getElementById('btnUploadMaterias').addEventListener('click', uploadMateriasAluno);
    document.getElementById('btnBaixarModeloAluno').addEventListener('click', baixarModeloExcel);

    // Escolher plano (aluno)
    document.getElementById('btnEscolherPlano').addEventListener('click', renderizarPlanosDisponiveis);

    inicializarSelecaoMaterias();
    carregarAnotacoes();
    carregarConfiguracoes();
    carregarEstado();

    const logado = await atualizarUIAuth();
    if (supabaseConfigurado()) {
        const { data } = await supabaseClient.auth.getSession();
        if (data.session) {
            await ensureProfile();
            atualizarUIRole();
            await carregarEstadoNuvem();
        }
        supabaseClient.auth.onAuthStateChange(async (_event, session) => {
            if (session) {
                await ensureProfile();
                atualizarUIRole();
                await carregarEstadoNuvem();
            }
            await atualizarUIAuth();
        });
    }

    if (!logado) {
        alternarAba('home');
    }
});

setInterval(async () => { if (await getUsuarioLogado()) salvarEstado(); }, 30000);
window.addEventListener('beforeunload', () => {
    if (salvarAoSair) salvarEstado();
});
