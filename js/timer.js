// ── T3: Cronômetro baseado em timestamp (elimina drift e throttling) ─────────
// O setInterval(1s) serve APENAS para renderizar. O tempo real é calculado
// por Date.now(), imune a throttling de abas em segundo plano.
// Estado persistido em localStorage para sobreviver a refresh.

const TIMER_STATE_KEY = 'cicloTimerState';

function _lerTimerState() {
    try { return JSON.parse(localStorage.getItem(TIMER_STATE_KEY)) || null; }
    catch { return null; }
}

function _salvarTimerState() {
    if (!cronometroRodando) {
        localStorage.removeItem(TIMER_STATE_KEY);
        return;
    }
    localStorage.setItem(TIMER_STATE_KEY, JSON.stringify({
        inicioEm: _timerInicioEm,
        pausasAcumuladas: _timerPausasAcumuladas,
        modo: modoCronometro ? 'cronometro' : 'timer',
        tempoTotal: tempoTotal
    }));
}

let _timerInicioEm = 0;
let _timerPausaInicioEm = 0;
let _timerPausasAcumuladas = 0;

function inicializarControlesTempo() {
    document.getElementById('tempoControle').style.display = 'block';
    _tentarResumir();
}

function _tentarResumir() {
    const st = _lerTimerState();
    if (!st || !st.inicioEm) return;

    _timerInicioEm = st.inicioEm;
    _timerPausasAcumuladas = st.pausasAcumuladas || 0;
    modoCronometro = st.modo === 'cronometro';
    if (!modoCronometro) tempoTotal = st.tempoTotal || 0;

    document.getElementById('tipoTempo').value = modoCronometro ? 'cronometro' : 'timer';
    document.getElementById('timerConfig').style.display = modoCronometro ? 'none' : 'block';

    const decorrido = _calcDecorrido();
    if (!modoCronometro && decorrido >= tempoTotal) {
        _dispararFim();
        return;
    }

    cronometroRodando = true;
    cronometroInterval = setInterval(_renderTick, 1000);
    document.getElementById('iniciarPausar').textContent = 'Pausar';
    _renderTick();
}

function alternarModoTempo() {
    modoCronometro = document.getElementById('tipoTempo').value === 'cronometro';
    document.getElementById('timerConfig').style.display = modoCronometro ? 'none' : 'block';
    resetarTempo();
}

function iniciarPausarTempo() {
    if (cronometroRodando) {
        // Pausar
        clearInterval(cronometroInterval);
        _timerPausaInicioEm = Date.now();
        document.getElementById('iniciarPausar').textContent = 'Retomar';
        cronometroRodando = false;
        _salvarTimerState();
        return;
    }

    // Iniciar / Retomar
    if (_timerInicioEm === 0) {
        // Primeiro início
        if (!modoCronometro) {
            const horas = parseInt(document.getElementById('timerHoras').value) || 0;
            const minutos = parseInt(document.getElementById('timerMinutos').value) || 0;
            tempoTotal = (horas * 3600) + (minutos * 60);
            if (tempoTotal <= 0) {
                alert('Defina um tempo válido para o timer.');
                return;
            }
        }
        _timerInicioEm = Date.now();
        _timerPausasAcumuladas = 0;
    } else if (_timerPausaInicioEm > 0) {
        // Retomando de pausa
        _timerPausasAcumuladas += Date.now() - _timerPausaInicioEm;
        _timerPausaInicioEm = 0;
    }

    cronometroRodando = true;
    cronometroInterval = setInterval(_renderTick, 1000);
    document.getElementById('iniciarPausar').textContent = 'Pausar';
    _salvarTimerState();
}

function _calcDecorrido() {
    if (_timerInicioEm === 0) return 0;
    const agora = cronometroRodando ? Date.now() : (_timerPausaInicioEm || Date.now());
    return Math.floor((agora - _timerInicioEm - _timerPausasAcumuladas) / 1000);
}

function _renderTick() {
    const decorrido = _calcDecorrido();

    if (modoCronometro) {
        tempoDecorrido = decorrido;
    } else {
        tempoDecorrido = Math.max(0, tempoTotal - decorrido);
        if (tempoDecorrido <= 0) {
            _dispararFim();
            return;
        }
    }
    atualizarExibicaoTempo();
}

function _dispararFim() {
    clearInterval(cronometroInterval);
    cronometroRodando = false;
    tempoDecorrido = 0;
    _timerInicioEm = 0;
    _timerPausasAcumuladas = 0;
    _timerPausaInicioEm = 0;
    localStorage.removeItem(TIMER_STATE_KEY);
    document.getElementById('iniciarPausar').textContent = 'Iniciar';
    atualizarExibicaoTempo();

    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Ciclo de Estudos', { body: 'Tempo esgotado!' });
    }
    alert('Tempo esgotado!');
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
    _timerInicioEm = 0;
    _timerPausasAcumuladas = 0;
    _timerPausaInicioEm = 0;
    localStorage.removeItem(TIMER_STATE_KEY);
    document.getElementById('iniciarPausar').textContent = 'Iniciar';
    atualizarExibicaoTempo();
}

// Ao voltar de aba em segundo plano: re-renderizar imediatamente
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && cronometroRodando) {
        _renderTick();
    }
});

// Pedir permissão de notificação de forma não intrusiva (apenas quando o
// aluno iniciar o primeiro bloco — chamado em iniciarPausarTempo):
if ('Notification' in window && Notification.permission === 'default') {
    document.getElementById('iniciarPausar')?.addEventListener('click', function _pedirPermissao() {
        Notification.requestPermission();
        this.removeEventListener('click', _pedirPermissao);
    }, { once: true });
}
