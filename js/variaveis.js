function calcularFatoresDesempenho() {
    const porMateria = {};
    if (!blocosAtivos || blocosAtivos.length === 0) return porMateria;

    blocosAtivos.forEach(bloco => {
        if (!bloco.concluido || !bloco.questoes) return;
        const key = bloco.legenda;
        if (!porMateria[key]) porMateria[key] = { feitas: 0, corretas: 0 };
        porMateria[key].feitas += bloco.questoes.feitas || 0;
        porMateria[key].corretas += bloco.questoes.corretas || 0;
    });

    const fatores = {};
    const mediaGlobal = (() => {
        let tf = 0, tc = 0;
        Object.values(porMateria).forEach(d => { tf += d.feitas; tc += d.corretas; });
        return tf > 0 ? tc / tf : 0.5;
    })();

    Object.entries(porMateria).forEach(([leg, dados]) => {
        if (dados.feitas < 5) return;
        const pctAcerto = dados.corretas / dados.feitas;
        // Subjects below average get boost (up to 1.5x), above average get reduction (down to 0.7x)
        // Formula: factor = 1 + (mediaGlobal - pctAcerto) clamped to [0.7, 1.5]
        fatores[leg] = Math.max(0.7, Math.min(1.5, 1 + (mediaGlobal - pctAcerto)));
    });

    return fatores;
}

function preencherTabelaVariaveis() {
    const tabela = document.getElementById("tabelaVariaveis").getElementsByTagName('tbody')[0];
    tabela.innerHTML = "";
    materiasSelecionadas.forEach(materia => {
        const row = tabela.insertRow();
        row.insertCell(0).innerText = materia.nome;
        ['peso', 'extensao', 'dificuldade'].forEach(variavel => {
            const cell = row.insertCell();
            const input = document.createElement("input");
            input.type = "number";
            input.min = "1";
            input.max = "10";
            input.required = true;
            input.name = `${variavel}-${materia.legenda}`;
            if (materia[variavel]) input.value = materia[variavel];
            cell.appendChild(input);
        });
    });
}

function calcularBlocos() {
    const horasSemanais = parseInt(document.getElementById('horasSemanais').value);
    if (isNaN(horasSemanais) || horasSemanais <= 0) {
        alert("Por favor, insira um número válido de horas semanais.");
        return;
    }

    const minutosTotais = horasSemanais * 60;
    const duracaoBloco = configuracoes.duracaoBloco;
    if (duracaoBloco <= 0) {
        alert('A duração do bloco deve ser maior que zero. Por favor, verifique as configurações.');
        return;
    }

    const totalBlocos = Math.floor(minutosTotais / duracaoBloco);
    let blocos = [];
    let totalPonderado = 0;
    let valido = true;

    materiasSelecionadas.forEach(materia => {
        if (!valido) return;
        const peso = parseFloat(document.getElementsByName(`peso-${materia.legenda}`)[0].value);
        const extensao = parseFloat(document.getElementsByName(`extensao-${materia.legenda}`)[0].value);
        const dificuldade = parseFloat(document.getElementsByName(`dificuldade-${materia.legenda}`)[0].value);

        if (isNaN(peso) || isNaN(extensao) || isNaN(dificuldade)) {
            alert(`Por favor, preencha todos os campos com valores numéricos para a matéria ${materia.nome}.`);
            valido = false;
            return;
        }

        const valorPonderado = (peso * 0.5 + extensao * 0.25 + dificuldade * 0.25);
        totalPonderado += valorPonderado;
        blocos.push({ ...materia, valorPonderado, meioBloco: false });
    });

    if (!valido) return;
    if (blocos.length === 0) {
        alert("Não há matérias selecionadas para calcular os blocos.");
        return;
    }

    const fatoresDesemp = calcularFatoresDesempenho();
    if (Object.keys(fatoresDesemp).length > 0) {
        totalPonderado = 0;
        blocos.forEach(b => {
            b.valorPonderado *= (fatoresDesemp[b.legenda] || 1);
            totalPonderado += b.valorPonderado;
        });
    }

    _alocarBlocosLargestRemainder(blocos, totalBlocos, totalPonderado, duracaoBloco);

    const materiasSemBlocos = blocos.filter(bloco => bloco.quantidadeBlocos === 0);
    if (materiasSemBlocos.length > 0) {
        const mensagem = `Atenção: As seguintes matérias ficaram sem blocos alocados:\n${materiasSemBlocos.map(b => b.nome).join(', ')}\nConsidere ajustar os pesos ou aumentar o tempo total de estudo.`;
        alert(mensagem);
    }

    preencherTabelaAjustes(blocos);
    alternarAba('ajustes');
}

// T7 + T9: Alocação por maior resto (largest remainder) com invariante de
// piso de meio-bloco para toda matéria ativa.
// - 2+ matérias na faixa (0,1): meio-bloco para todas.
// - Exatamente 1 matéria na faixa: arredonda para 1 bloco inteiro e
//   remove proporcionalmente da matéria de maior alocação.
// - Invariante: toda matéria ativa termina com ≥ meio-bloco (0 blocos
//   nunca acontece silenciosamente; se horas forem insuficientes, avisa).
function _alocarBlocosLargestRemainder(blocos, totalBlocos, totalPonderado, duracaoBloco) {
    blocos.forEach(b => {
        b._share = (b.valorPonderado / totalPonderado) * totalBlocos;
    });

    // Identificar candidatos a meio-bloco (share entre 0 e 1, exclusive)
    const candidatosMeio = blocos.filter(b => b._share > 0 && b._share < 1);
    const usarMeioBloco = candidatosMeio.length >= 2;

    // T7: Exatamente 1 matéria na faixa → promover a 1 bloco inteiro
    const promoverParaInteiro = candidatosMeio.length === 1;

    // Número de "slots" efetivos a distribuir: meio-blocos contam como 0.5
    let slotsParaDistribuir = totalBlocos;
    let meiosBlocos = 0;

    blocos.forEach(b => {
        if (b._share > 0 && b._share < 1) {
            if (usarMeioBloco) {
                b.quantidadeBlocos = 1;
                b.meioBloco = true;
                meiosBlocos++;
            } else if (promoverParaInteiro) {
                b.quantidadeBlocos = 1;
                b.meioBloco = false;
            } else {
                b.quantidadeBlocos = 0;
                b.meioBloco = false;
            }
        } else if (b._share >= 1) {
            b.quantidadeBlocos = Math.floor(b._share);
            b.meioBloco = false;
        } else {
            b.quantidadeBlocos = 0;
            b.meioBloco = false;
        }
    });

    // Calcular minutos efetivos usados e disponíveis
    let minutosUsados = 0;
    blocos.forEach(b => {
        if (b.meioBloco) minutosUsados += duracaoBloco / 2;
        else minutosUsados += b.quantidadeBlocos * duracaoBloco;
    });
    const minutosDisponiveis = totalBlocos * duracaoBloco;

    // Distribuir blocos remanescentes pelo método de maior resto
    const candidatos = blocos.filter(b => !b.meioBloco && b._share >= 1);
    const restos = candidatos.map(b => ({
        bloco: b,
        resto: b._share - Math.floor(b._share)
    })).sort((a, b) => b.resto - a.resto);

    let i = 0;
    while (minutosUsados + duracaoBloco <= minutosDisponiveis && restos.length > 0) {
        restos[i % restos.length].bloco.quantidadeBlocos++;
        minutosUsados += duracaoBloco;
        i++;
        if (i > restos.length * totalBlocos) break;
    }

    // T7: se promovemos 1 matéria para inteiro, compensar retirando 1 bloco
    // da matéria com mais blocos (se sobrou minutos a mais)
    if (promoverParaInteiro && minutosUsados > minutosDisponiveis) {
        const maior = blocos
            .filter(b => !b.meioBloco && b.quantidadeBlocos > 1)
            .sort((a, b) => b.quantidadeBlocos - a.quantidadeBlocos)[0];
        if (maior) {
            maior.quantidadeBlocos--;
            minutosUsados -= duracaoBloco;
        }
    }

    // Reduzir sobre-alocação restante (por arredondamento)
    if (minutosUsados > minutosDisponiveis) {
        const reducao = blocos
            .filter(b => !b.meioBloco && b.quantidadeBlocos > 1)
            .sort((a, b) => b.quantidadeBlocos - a.quantidadeBlocos);
        let j = 0;
        while (minutosUsados > minutosDisponiveis && reducao.length > 0) {
            const b = reducao[j % reducao.length];
            if (b.quantidadeBlocos > 1) {
                b.quantidadeBlocos--;
                minutosUsados -= duracaoBloco;
            }
            j++;
            if (j > reducao.length * totalBlocos) break;
        }
    }

    // Invariante T7: toda matéria ativa termina com >= meio-bloco
    const nMateriasAtivas = blocos.filter(b => b._share > 0).length;
    const pisoMinutos = nMateriasAtivas * (duracaoBloco / 2);
    if (minutosDisponiveis < pisoMinutos) {
        alert(`Com ${Math.round(minutosDisponiveis / 60)}h semanais não é possível manter todas as ${nMateriasAtivas} matérias. Considere remover matérias ou aumentar as horas.`);
    }

    // Propagar meioBloco para materiasSelecionadas
    blocos.forEach(bloco => {
        const m = materiasSelecionadas.find(m => m.legenda === bloco.legenda);
        if (m) m.meioBloco = bloco.meioBloco;
        delete bloco._share;
    });
}

function preencherTabelaAjustes(blocos) {
    const tabela = document.getElementById("tabelaAjustes").getElementsByTagName('tbody')[0];
    tabela.innerHTML = "";
    blocos.forEach(bloco => {
        const row = tabela.insertRow();
        const nomeCell = row.insertCell(0);
        nomeCell.innerText = bloco.nome + (bloco.meioBloco ? ' (½ bloco)' : '');
        const cell = row.insertCell(1);
        const input = document.createElement("input");
        input.type = "number";
        input.value = bloco.quantidadeBlocos;
        input.name = `blocos-${bloco.legenda}`;
        input.min = "0";
        cell.appendChild(input);
    });
}

// T9: Redimensionamento com largest remainder e piso de meio-bloco.
// Blocos concluídos NUNCA são alterados. Ao reduzir horas, nenhuma
// matéria ativa cai para 0 — se não couber, avisa.
function redimensionarCiclo(novasHoras) {
    if (!blocosAtivos || blocosAtivos.length === 0) {
        alert('Não há ciclo ativo para redimensionar.');
        return;
    }

    const horasAntigas = parseInt(document.getElementById('horasSemanais').value) || 0;
    if (!horasAntigas || horasAntigas <= 0) return;
    if (novasHoras === horasAntigas) return;

    const duracaoBloco = configuracoes.duracaoBloco || 60;
    const totalNovo = Math.floor((novasHoras * 60) / duracaoBloco);

    // Agrupar por matéria
    const grupos = {};
    blocosAtivos.forEach(bloco => {
        const key = bloco.legenda;
        if (!grupos[key]) grupos[key] = { template: bloco, concluidos: [], pendentes: [] };
        if (bloco.concluido) grupos[key].concluidos.push(bloco);
        else grupos[key].pendentes.push(bloco);
    });

    const materias = Object.entries(grupos).map(([leg, g]) => ({
        legenda: leg,
        template: g.template,
        nConcluidos: g.concluidos.length,
        concluidos: g.concluidos,
        pendentes: g.pendentes,
        totalAtual: g.concluidos.length + g.pendentes.length
    }));

    const totalAtualGlobal = materias.reduce((s, m) => s + m.totalAtual, 0);
    if (totalAtualGlobal === 0) return;

    // Aplicar fator de desempenho ao peso proporcional
    const fatoresDesemp = calcularFatoresDesempenho();
    let totalPonderadoResize = 0;
    materias.forEach(m => {
        m._pesoDesemp = m.totalAtual * (fatoresDesemp[m.legenda] || 1);
        totalPonderadoResize += m._pesoDesemp;
    });

    // Largest remainder: alocar totalNovo slots proporcionalmente
    materias.forEach(m => {
        m._ideal = totalPonderadoResize > 0
            ? (m._pesoDesemp / totalPonderadoResize) * totalNovo
            : m.totalAtual * (totalNovo / totalAtualGlobal);
        // Nunca abaixo dos concluídos, e nunca abaixo de 1 (piso de meio-bloco)
        m.novoTotal = Math.max(m.nConcluidos, Math.max(1, Math.floor(m._ideal)));
    });

    // Distribuir restos
    let slotsUsados = materias.reduce((s, m) => s + m.novoTotal, 0);
    const restos = materias
        .filter(m => m.novoTotal > m.nConcluidos) // só quem pode crescer
        .map(m => ({ m, resto: m._ideal - Math.floor(m._ideal) }))
        .sort((a, b) => b.resto - a.resto);

    let ri = 0;
    while (slotsUsados < totalNovo && restos.length > 0) {
        restos[ri % restos.length].m.novoTotal++;
        slotsUsados++;
        ri++;
        if (ri > restos.length * totalNovo) break;
    }

    // Se slots > total alvo (por causa dos pisos), reduzir os maiores
    const reducao = materias
        .filter(m => m.novoTotal > m.nConcluidos && m.novoTotal > 1)
        .sort((a, b) => b.novoTotal - a.novoTotal);
    let rj = 0;
    while (slotsUsados > totalNovo && reducao.length > 0) {
        const m = reducao[rj % reducao.length];
        if (m.novoTotal > m.nConcluidos && m.novoTotal > 1) {
            m.novoTotal--;
            slotsUsados--;
        }
        rj++;
        if (rj > reducao.length * totalNovo) break;
    }

    // Aviso se pisos impedem o encaixe
    if (slotsUsados > totalNovo) {
        alert(`Com ${novasHoras}h semanais não é possível manter todas as ${materias.length} matérias. Considere remover matérias ou aumentar as horas.`);
    }

    // Montar novo array
    const concluidos = [];
    const novosPendentes = [];

    materias.forEach(m => {
        concluidos.push(...m.concluidos);
        const qtdPendentes = Math.max(0, m.novoTotal - m.nConcluidos);
        for (let i = 0; i < qtdPendentes; i++) {
            novosPendentes.push(i < m.pendentes.length
                ? m.pendentes[i]
                : { ...m.template, concluido: false, assunto: null, questoes: null });
        }
    });

    // Distribuir pendentes por round-robin (T8)
    if (typeof _distribuirPorDeficit === 'function' && novosPendentes.length > 1) {
        const contagem = {};
        novosPendentes.forEach(b => { contagem[b.legenda] = (contagem[b.legenda] || 0) + 1; });
        const entradas = Object.entries(contagem).map(([leg, qtd]) => ({ legenda: leg, qtdBlocos: qtd }));
        const ordem = _distribuirPorDeficit(entradas);
        const porLegenda = {};
        novosPendentes.forEach(b => {
            if (!porLegenda[b.legenda]) porLegenda[b.legenda] = [];
            porLegenda[b.legenda].push(b);
        });
        const pendentesOrdenados = ordem.map(leg => porLegenda[leg].shift());
        blocosAtivos = [...concluidos, ...pendentesOrdenados];
    } else {
        blocosAtivos = [...concluidos, ...novosPendentes];
    }

    document.getElementById('horasSemanais').value = novasHoras;
    const editInput = document.getElementById('horasSemanaisEdit');
    if (editInput) editInput.value = novasHoras;

    salvarEstado();
    exibirCicloVisual(blocosAtivos);
}

function ajustarBlocos() {
    let blocos = [];

    materiasSelecionadas.forEach(materia => {
        const quantidadeBlocos = parseInt(document.getElementsByName(`blocos-${materia.legenda}`)[0].value) || 0;
        blocos.push({ ...materia, quantidadeBlocos });
    });

    if (blocos.every(b => b.quantidadeBlocos === 0)) {
        alert('Pelo menos uma matéria deve ter blocos alocados.');
        return;
    }

    blocosAtivos = distribuirBlocosAleatoriamente(blocos);
    exibirCicloVisual(blocosAtivos);
    alternarAba('meuciclo');
}
