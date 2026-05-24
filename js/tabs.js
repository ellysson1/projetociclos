// Mapping of legacy tab names to new main-tab + sub-tab structure
const subtabMap = {
    'home':           { tab: 'ciclo', subtab: 'subtab-meuciclo' },
    'materias':       { tab: 'ciclo', subtab: 'subtab-variaveis' },
    'variaveis':      { tab: 'ciclo', subtab: 'subtab-variaveis' },
    'ajustes':        { tab: 'ciclo', subtab: 'subtab-ajustes' },
    'meuciclo':       { tab: 'ciclo', subtab: 'subtab-meuciclo' },
    'configuracoes':  { tab: 'ciclo', subtab: 'subtab-config' },
};

function alternarAba(tabName) {
    const mapping = subtabMap[tabName];
    if (mapping) {
        ativarMainTab(mapping.tab);
        ativarSubTab(mapping.tab, mapping.subtab);
    } else {
        ativarMainTab(tabName);
    }
}

function ativarMainTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-container > .tab').forEach(t => t.classList.remove('active'));

    const content = document.getElementById(tabName);
    if (content) content.classList.add('active');

    const tab = document.querySelector(`.tab-container > .tab[data-tab="${tabName}"]`);
    if (tab) tab.classList.add('active');

    // Auto-load data when switching to specific tabs
    if (tabName === 'desempenho' && typeof renderizarDesempenho === 'function') {
        renderizarDesempenho();
    }
    if (tabName === 'videos' && typeof renderizarVideosTab === 'function') {
        renderizarVideosTab();
    }
    if (tabName === 'revisao' && typeof renderizarRevisao === 'function') {
        renderizarRevisao();
    }
}

function ativarSubTab(parentTabId, subtabId) {
    const parentTab = document.getElementById(parentTabId);
    if (!parentTab) return;

    parentTab.querySelectorAll('.subtab-content').forEach(c => c.classList.remove('active'));
    parentTab.querySelectorAll('.subtab').forEach(s => s.classList.remove('active'));

    const subtabContent = document.getElementById(subtabId);
    if (subtabContent) subtabContent.classList.add('active');

    const subtabBtn = parentTab.querySelector(`.subtab[data-subtab="${subtabId}"]`);
    if (subtabBtn) subtabBtn.classList.add('active');

    // Sync horasSemanaisEdit when navigating to Meu Ciclo
    if (subtabId === 'subtab-meuciclo') {
        const editInput = document.getElementById('horasSemanaisEdit');
        const mainInput = document.getElementById('horasSemanais');
        if (editInput && mainInput && mainInput.value) editInput.value = mainInput.value;
    }

    // Auto-populate variables table when navigating to Variaveis
    if (subtabId === 'subtab-variaveis') {
        const tbody = document.getElementById('tabelaVariaveis')?.getElementsByTagName('tbody')[0];
        if (tbody && tbody.rows.length === 0 && typeof materiasSelecionadas !== 'undefined' && materiasSelecionadas.length > 0 && typeof preencherTabelaVariaveis === 'function') {
            preencherTabelaVariaveis();
        }
    }

    // Auto-populate adjustments table when navigating to Ajustes
    if (subtabId === 'subtab-ajustes') {
        const tbody = document.getElementById('tabelaAjustes')?.getElementsByTagName('tbody')[0];
        if (tbody && tbody.rows.length === 0 && typeof blocosAtivos !== 'undefined' && blocosAtivos && blocosAtivos.length > 0 && typeof preencherTabelaAjustes === 'function') {
            const contagem = {};
            blocosAtivos.forEach(b => { contagem[b.legenda] = (contagem[b.legenda] || 0) + 1; });
            const blocosPara = (materiasSelecionadas || []).map(m => ({ ...m, quantidadeBlocos: contagem[m.legenda] || 0 }));
            if (blocosPara.some(b => b.quantidadeBlocos > 0)) preencherTabelaAjustes(blocosPara);
        }
    }
}
