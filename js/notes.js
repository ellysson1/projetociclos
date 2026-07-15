function salvarConfiguracoes() {
    const novaDuracaoBloco = parseInt(document.getElementById('duracaoBloco').value);
    const novoIntervaloEntreBlocos = parseInt(document.getElementById('intervaloEntreBlocos').value);
    const novoBlocosPorSessao = parseInt(document.getElementById('blocosPorSessao').value);

    if (isNaN(novaDuracaoBloco) || novaDuracaoBloco < 1) {
        alert('A duracao do bloco deve ser um numero positivo.');
        return;
    }

    if (isNaN(novoIntervaloEntreBlocos) || novoIntervaloEntreBlocos < 0) {
        alert('O intervalo entre blocos deve ser um numero nao negativo.');
        return;
    }

    if (isNaN(novoBlocosPorSessao) || novoBlocosPorSessao < 1) {
        alert('O numero de blocos por sessao deve ser um numero positivo.');
        return;
    }

    configuracoes.duracaoBloco = novaDuracaoBloco;
    configuracoes.intervaloEntreBlocos = novoIntervaloEntreBlocos;
    configuracoes.blocosPorSessao = novoBlocosPorSessao;

    localStorage.setItem('cicloEstudosConfiguracoes', JSON.stringify(configuracoes));
    alert('Configuracoes salvas com sucesso!');

    if (blocosAtivos.length > 0) {
        if (confirm('Deseja recalcular os blocos com as novas configuracoes?')) {
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
