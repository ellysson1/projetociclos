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
        blocos.push({ ...materia, valorPonderado });
    });

    if (!valido) return;

    if (blocos.length === 0) {
        alert("Não há matérias selecionadas para calcular os blocos.");
        return;
    }

    let blocosAlocados = 0;
    blocos.forEach((bloco, index) => {
        if (index === blocos.length - 1) {
            bloco.quantidadeBlocos = totalBlocos - blocosAlocados;
        } else {
            bloco.quantidadeBlocos = Math.ceil((bloco.valorPonderado / totalPonderado) * totalBlocos);
            if (blocosAlocados + bloco.quantidadeBlocos > totalBlocos) {
                bloco.quantidadeBlocos = totalBlocos - blocosAlocados;
            }
        }
        blocosAlocados += bloco.quantidadeBlocos;
    });

    if (blocosAlocados < totalBlocos) {
        const diferenca = totalBlocos - blocosAlocados;
        for (let i = 0; i < diferenca; i++) {
            blocos[i % blocos.length].quantidadeBlocos++;
        }
    } else if (blocosAlocados > totalBlocos) {
        const excesso = blocosAlocados - totalBlocos;
        for (let i = 0; i < excesso; i++) {
            const idx = blocos.length - 1 - (i % blocos.length);
            if (blocos[idx].quantidadeBlocos > 1) {
                blocos[idx].quantidadeBlocos--;
            }
        }
    }

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
        row.insertCell(0).innerText = bloco.nome;
        const cell = row.insertCell(1);
        const input = document.createElement("input");
        input.type = "number";
        input.value = bloco.quantidadeBlocos;
        input.name = `blocos-${bloco.legenda}`;
        input.min = "0";
        cell.appendChild(input);
    });
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
    alternarAba('ciclo');
}
