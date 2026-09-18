// ============================================================
// O anel do ciclo — objeto da marca No Controle.
// Cada segmento e um bloco real do ciclo, colorido pela materia.
// O centro responde a pergunta do usuario: o que estudo agora.
// ============================================================

const ANEL_RAIO = 82;
const ANEL_ESPESSURA = 15;
const ANEL_VAO = 3; // folga entre segmentos, em unidades de arco

function renderizarAnelCiclo(blocos) {
    const alvo = document.getElementById('anelCiclo');
    if (!alvo) return;

    if (!blocos || blocos.length === 0) {
        alvo.innerHTML = '';
        return;
    }

    const total = blocos.length;
    const feitos = blocos.filter(b => b.concluido).length;
    const proximoIdx = blocos.findIndex(b => !b.concluido);
    const proximo = proximoIdx >= 0 ? blocos[proximoIdx] : null;

    const circunferencia = 2 * Math.PI * ANEL_RAIO;
    const passo = circunferencia / total;
    const comprimento = Math.max(passo - ANEL_VAO, 1);

    const segmentos = blocos.map((bloco, i) => {
        const classes = ['anel-seg'];
        if (bloco.concluido) classes.push('anel-seg--feito');
        else if (i === proximoIdx) classes.push('anel-seg--proximo');
        return `<circle class="${classes.join(' ')}" cx="100" cy="100" r="${ANEL_RAIO}"
            stroke="${bloco.cor || 'var(--nc-gelo-fraco)'}" stroke-width="${ANEL_ESPESSURA}"
            stroke-dasharray="${comprimento} ${circunferencia - comprimento}"
            stroke-dashoffset="${-i * passo}"></circle>`;
    }).join('');

    const centro = proximo
        ? `<span class="anel-modulo__rotulo">Próximo bloco</span>
           <strong class="anel-modulo__proximo">${escapeAnel(proximo.nome || proximo.legenda)}</strong>
           <span class="anel-modulo__meta">${proximo.duracaoEspecifica || configuracoes.duracaoBloco} min</span>`
        : `<span class="anel-modulo__rotulo">Ciclo ${cicloNumero}</span>
           <strong class="anel-modulo__proximo">Tudo estudado</strong>
           <span class="anel-modulo__meta">${total} blocos</span>`;

    // Quanto de cada materia ja saiu do caminho
    const porMateria = {};
    blocos.forEach(b => {
        const chave = b.legenda || b.nome;
        if (!porMateria[chave]) porMateria[chave] = { cor: b.cor, feitos: 0, total: 0 };
        porMateria[chave].total++;
        if (b.concluido) porMateria[chave].feitos++;
    });

    const legenda = Object.entries(porMateria).map(([sigla, d]) => `
        <span class="anel-modulo__materia">
            <span class="anel-modulo__ponto" style="background:${d.cor}"></span>
            ${escapeAnel(sigla)} ${d.feitos}/${d.total}
        </span>`).join('');

    alvo.innerHTML = `
        <section class="anel-modulo" aria-label="Progresso do ciclo ${cicloNumero}">
            <div class="anel-modulo__anel">
                <svg viewBox="0 0 200 200" role="img"
                     aria-label="${feitos} de ${total} blocos concluídos">
                    ${segmentos}
                </svg>
                <div class="anel-modulo__centro">${centro}</div>
            </div>
            <div class="anel-modulo__dados">
                <div class="anel-modulo__contagem">${feitos}<span>/${total}</span></div>
                <p class="anel-modulo__legenda-contagem">blocos concluídos no ciclo ${cicloNumero}</p>
                <div class="anel-modulo__materias">${legenda}</div>
            </div>
            <div class="anel-modulo__acoes">
                ${proximo
                    ? `<button type="button" class="acao" id="anelIrProximo">Estudar ${escapeAnel(proximo.legenda || proximo.nome)}</button>`
                    : `<button type="button" class="acao" id="anelProximoCiclo">Iniciar o próximo ciclo</button>`}
            </div>
        </section>`;

    const btn = document.getElementById('anelIrProximo');
    if (btn) btn.addEventListener('click', () => irParaBloco(proximoIdx));

    const btnCiclo = document.getElementById('anelProximoCiclo');
    if (btnCiclo) btnCiclo.addEventListener('click', () => {
        if (typeof iniciarProximoCiclo === 'function') iniciarProximoCiclo();
    });
}

// Leva o usuario ao card do proximo bloco e o destaca por um instante.
// Movimento que responde a uma acao: mostra o que mudou.
function irParaBloco(indice) {
    const card = document.querySelector(`.bloco-card[data-index="${indice}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('alvo');
    setTimeout(() => card.classList.remove('alvo'), 2200);
}

function escapeAnel(texto) {
    const d = document.createElement('div');
    d.textContent = texto == null ? '' : String(texto);
    return d.innerHTML;
}
