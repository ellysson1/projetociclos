async function salvarAnotacoes() {
    const anotacoes = document.getElementById('anotacoesTexto').value;
    localStorage.setItem('cicloEstudosAnotacoes', anotacoes);
    await salvarEstadoNuvem();
    alert('Anotações salvas com sucesso!');
}

function carregarAnotacoes() {
    const anotacoesSalvas = localStorage.getItem('cicloEstudosAnotacoes');
    if (anotacoesSalvas) {
        document.getElementById('anotacoesTexto').value = anotacoesSalvas;
    }
}

function salvarConfiguracoes() {
    const novaDuracaoBloco = parseInt(document.getElementById('duracaoBloco').value);
    const novoIntervaloEntreBlocos = parseInt(document.getElementById('intervaloEntreBlocos').value);
    const novoBlocosPorSessao = parseInt(document.getElementById('blocosPorSessao').value);

    if (isNaN(novaDuracaoBloco) || novaDuracaoBloco < 1) {
        alert('A duração do bloco deve ser um número positivo.');
        return;
    }

    if (isNaN(novoIntervaloEntreBlocos) || novoIntervaloEntreBlocos < 0) {
        alert('O intervalo entre blocos deve ser um número não negativo.');
        return;
    }

    if (isNaN(novoBlocosPorSessao) || novoBlocosPorSessao < 1) {
        alert('O número de blocos por sessão deve ser um número positivo.');
        return;
    }

    configuracoes.duracaoBloco = novaDuracaoBloco;
    configuracoes.intervaloEntreBlocos = novoIntervaloEntreBlocos;
    configuracoes.blocosPorSessao = novoBlocosPorSessao;

    localStorage.setItem('cicloEstudosConfiguracoes', JSON.stringify(configuracoes));
    alert('Configurações salvas com sucesso!');

    if (blocosAtivos.length > 0) {
        if (confirm('Deseja recalcular os blocos com as novas configurações?')) {
            calcularBlocos();
        } else {
            exibirCicloVisual(blocosAtivos);
        }
    }
}

function carregarConfiguracoes() {
    const configSalvas = localStorage.getItem('cicloEstudosConfiguracoes');
    if (configSalvas) {
        configuracoes = JSON.parse(configSalvas);
    }
    document.getElementById('duracaoBloco').value = configuracoes.duracaoBloco;
    document.getElementById('intervaloEntreBlocos').value = configuracoes.intervaloEntreBlocos;
    document.getElementById('blocosPorSessao').value = configuracoes.blocosPorSessao;
}
