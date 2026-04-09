function inicializarControlesTempo() {
    document.getElementById('tempoControle').style.display = 'block';
}

function alternarModoTempo() {
    modoCronometro = document.getElementById('tipoTempo').value === 'cronometro';
    document.getElementById('timerConfig').style.display = modoCronometro ? 'none' : 'block';
    resetarTempo();
}

function iniciarPausarTempo() {
    if (cronometroRodando) {
        clearInterval(cronometroInterval);
        document.getElementById('iniciarPausar').textContent = 'Retomar';
    } else {
        if (!modoCronometro && tempoDecorrido === 0) {
            const horas = parseInt(document.getElementById('timerHoras').value) || 0;
            const minutos = parseInt(document.getElementById('timerMinutos').value) || 0;
            tempoTotal = (horas * 3600) + (minutos * 60);
            tempoDecorrido = tempoTotal;
        }
        cronometroInterval = setInterval(atualizarTempo, 1000);
        document.getElementById('iniciarPausar').textContent = 'Pausar';
    }
    cronometroRodando = !cronometroRodando;
}

function atualizarTempo() {
    if (modoCronometro) {
        tempoDecorrido++;
    } else {
        tempoDecorrido--;
        if (tempoDecorrido <= 0) {
            clearInterval(cronometroInterval);
            cronometroRodando = false;
            document.getElementById('iniciarPausar').textContent = 'Iniciar';
            alert('Tempo esgotado!');
        }
    }
    atualizarExibicaoTempo();
}

function atualizarExibicaoTempo() {
    const tempo = modoCronometro ? tempoDecorrido : Math.max(0, tempoDecorrido);
    const horas = Math.floor(tempo / 3600);
    const minutos = Math.floor((tempo % 3600) / 60);
    const segundos = tempo % 60;
    document.getElementById('tempo').textContent =
        `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
}

function resetarTempo() {
    clearInterval(cronometroInterval);
    cronometroRodando = false;
    tempoDecorrido = 0;
    document.getElementById('iniciarPausar').textContent = 'Iniciar';
    atualizarExibicaoTempo();
}
