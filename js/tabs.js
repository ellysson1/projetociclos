// Mapping of legacy tab names to new main-tab + sub-tab structure
const subtabMap = {
    'home':           { tab: 'ciclo', subtab: 'subtab-inicio' },
    'materias':       { tab: 'ciclo', subtab: 'subtab-materias' },
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
}
