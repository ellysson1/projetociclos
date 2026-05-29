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

    // Exact proportional share per subject (can be fractional)
    blocos.forEach(bloco => {
        bloco._share = (bloco.valorPonderado / totalPonderado) * totalBlocos;
    });

    // Subjects with 0 < share < 1 are candidates for a half block
    const candidatosMeio = blocos.filter(b => b._share > 0 && b._share < 1);
    const usarMeioBloco = candidatosMeio.length >= 2;

    // Initial allocation using Math.round — avoids penalizing last subjects
    let minutosUsados = 0;
    blocos.forEach(bloco => {
        if (bloco._share >= 1) {
            bloco.quantidadeBlocos = Math.round(bloco._share);
            bloco.meioBloco = false;
            minutosUsados += bloco.quantidadeBlocos * duracaoBloco;
        } else if (bloco._share > 0) {
            bloco.quantidadeBlocos = 1;
            bloco.meioBloco = usarMeioBloco;
            minutosUsados += usarMeioBloco ? duracaoBloco / 2 : duracaoBloco;
        } else {
            bloco.quantidadeBlocos = 0;
        }
    });

    const minutosDisponiveis = totalBlocos * duracaoBloco;

    // Reduce over-allocation from subjects with the most full blocks
    if (minutosUsados > minutosDisponiveis) {
        const candidatos = blocos
            .filter(b => !b.meioBloco && b.quantidadeBlocos > 1)
            .sort((a, b) => b.quantidadeBlocos - a.quantidadeBlocos);
        let i = 0;
        while (minutosUsados > minutosDisponiveis && candidatos.length > 0) {
            const b = candidatos[i % candidatos.length];
            if (b.quantidadeBlocos > 1) {
                b.quantidadeBlocos--;
                minutosUsados -= duracaoBloco;
            }
            i++;
            if (i > candidatos.length * totalBlocos) break;
        }
    }

    // Fill under-allocation into subjects with highest fractional remainder
    if (minutosUsados < minutosDisponiveis) {
        const candidatos = blocos
            .filter(b => !b.meioBloco && b.quantidadeBlocos > 0)
            .sort((a, b) => (b._share % 1) - (a._share % 1));
        let i = 0;
        while (minutosUsados + duracaoBloco <= minutosDisponiveis && candidatos.length > 0) {
            candidatos[i % candidatos.length].quantidadeBlocos++;
            minutosUsados += duracaoBloco;
            i++;
            if (i > candidatos.length * totalBlocos) break;
        }
    }

    // Propagate meioBloco flag back to materiasSelecionadas for use in ajustarBlocos
    blocos.forEach(bloco => {
        const m = materiasSelecionadas.find(m => m.legenda === bloco.legenda);
        if (m) m.meioBloco = bloco.meioBloco;
        delete bloco._share;
    });

    const materiasSemBlocos = blocos.filter(bloco => bloco.quantidadeBlocos === 0);
    if (materiasSemBlocos.length > 0) {
        const mensagem = `Atenção: As seguintes matérias ficaram sem blocos alocados:\n${materiasSemBlocos.map(b => b.nome).join(', ')}\nConsidere ajustar os pesos ou aumentar o tempo total de estudo.`;
        alert(mensagem);
    }

    preencherTabelaAjustes(blocos);
    alternarAba('ajustes');
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

function redimensionarCiclo(novasHoras) {
    if (!blocosAtivos || blocosAtivos.length === 0) {
        alert('Não há ciclo ativo para redimensionar.');
        return;
    }

    const horasAntigas = parseInt(document.getElementById('horasSemanais').value) || 0;
    if (!horasAntigas || horasAntigas <= 0) return;
    if (novasHoras === horasAntigas) return;

    const fator = novasHoras / horasAntigas;

    // Group blocks by materia legenda
    const grupos = {};
    blocosAtivos.forEach(bloco => {
        const key = bloco.legenda;
        if (!grupos[key]) grupos[key] = { template: bloco, concluidos: [], pendentes: [] };
        if (bloco.concluido) grupos[key].concluidos.push(bloco);
        else grupos[key].pendentes.push(bloco);
    });

    const concluidos = [];
    const novosPendentes = [];

    Object.values(grupos).forEach(({ template, concluidos: c, pendentes: p }) => {
        const totalAtual = c.length + p.length;
        const novoTotal = Math.max(c.length, Math.round(totalAtual * fator));
        const qtdPendentes = novoTotal - c.length;

        concluidos.push(...c);

        for (let i = 0; i < qtdPendentes; i++) {
            novosPendentes.push(i < p.length ? p[i] : { ...template, concluido: false, assunto: null, questoes: null });
        }
    });

    // Shuffle pending blocks (Fisher-Yates)
    for (let i = novosPendentes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [novosPendentes[i], novosPendentes[j]] = [novosPendentes[j], novosPendentes[i]];
    }

    blocosAtivos = [...concluidos, ...novosPendentes];

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
