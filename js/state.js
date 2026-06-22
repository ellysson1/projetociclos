let materiasList = [
    {nome: "AFO", legenda: "AFO"},
    {nome: "CONTABILIDADE GERAL", legenda: "CGE"},
    {nome: "CONTABILIDADE PÚBLICA", legenda: "CPB"},
    {nome: "AUDITORIA", legenda: "AUD"},
    {nome: "CONTROLE EXTERNO", legenda: "CEX"}
];

let materiasSelecionadas = [];
let blocosAtivos = [];
let coresUsadas = [];
let tempoDecorrido = 0;
let tempoTotal = 0;
let cronometroInterval;
let cronometroRodando = false;
let modoCronometro = true;
let salvarAoSair = true;
let planoAdotado = null; // { id, nome, edital }
let modosMateria = {}; // { legenda: 'questoes' | 'revisao' }
let faseAtual = 1; // Progressive cycle: current phase
let cicloNumero = 1; // Cycle counter: increments when all blocks are completed
let tipoPerfil = null; // 'autodidata' | 'curso' | 'mentoria'
let nivelConteudo = null; // 'basico' | 'intermediario' | 'avancado'
let _modoVisualizacaoAluno = false;
let _estadoProfessorBackup = null;

let configuracoes = {
    duracaoBloco: 60,
    intervaloEntreBlocos: 5,
    blocosPorSessao: 4
};

function montarEstadoLocal() {
    if (typeof garantirIdsBlocos === 'function') garantirIdsBlocos(blocosAtivos);
    return {
        materiasList,
        materiasSelecionadas,
        blocosAtivos,
        tempoDecorrido,
        modoCronometro,
        configuracoes,
        planoAdotado,
        modosMateria,
        faseAtual,
        cicloNumero,
        tipoPerfil,
        nivelConteudo,
        revisoesContador: typeof revisoesContador !== 'undefined' ? revisoesContador : {},
        horasSemanais: document.getElementById('horasSemanais')?.value || null,
        atualizadoEm: new Date().toISOString()
    };
}

// Aplica um estado (local, da nuvem ou resultado de merge) nas globals.
// Não mexe no cronômetro em andamento, exceto com forcarTempo (carga inicial).
function aplicarEstadoGlobals(estado, opts = {}) {
    if (!estado) return;
    materiasList = estado.materiasList || materiasList;
    materiasSelecionadas = estado.materiasSelecionadas || materiasSelecionadas || [];
    blocosAtivos = estado.blocosAtivos || blocosAtivos || [];
    if (typeof garantirIdsBlocos === 'function') garantirIdsBlocos(blocosAtivos);
    if (opts.forcarTempo || !cronometroRodando) {
        tempoDecorrido = estado.tempoDecorrido || 0;
        modoCronometro = estado.modoCronometro ?? modoCronometro;
    }
    configuracoes = estado.configuracoes || configuracoes;
    if (estado.planoAdotado) planoAdotado = estado.planoAdotado;
    if (estado.modosMateria) modosMateria = estado.modosMateria;
    if (estado.faseAtual) faseAtual = estado.faseAtual;
    if (estado.cicloNumero) cicloNumero = estado.cicloNumero;
    if (estado.tipoPerfil) tipoPerfil = estado.tipoPerfil;
    if (estado.nivelConteudo) nivelConteudo = estado.nivelConteudo;
    if (estado.revisoesContador && typeof revisoesContador !== 'undefined') revisoesContador = estado.revisoesContador;
    if (estado.horasSemanais) {
        const el = document.getElementById('horasSemanais');
        if (el) el.value = estado.horasSemanais;
    }
}

function salvarEstado() {
    if (_modoVisualizacaoAluno) return;
    const estado = montarEstadoLocal();
    localStorage.setItem('cicloEstudosEstado', JSON.stringify(estado));
    salvarEstadoNuvem();
    if (typeof flushEventosPendentes === 'function') flushEventosPendentes();
}

function carregarEstado() {
    const estadoSalvo = localStorage.getItem('cicloEstudosEstado');
    if (estadoSalvo) {
        const estado = JSON.parse(estadoSalvo);
        aplicarEstadoGlobals(estado, { forcarTempo: true });
        document.getElementById('inicio').style.display = 'none';
        document.getElementById('continuar').style.display = 'block';
    }
}
