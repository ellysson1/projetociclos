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

let configuracoes = {
    duracaoBloco: 60,
    intervaloEntreBlocos: 5,
    blocosPorSessao: 4
};

function salvarEstado() {
    const estado = {
        materiasList,
        materiasSelecionadas,
        blocosAtivos,
        tempoDecorrido,
        modoCronometro,
        configuracoes,
        horasSemanais: document.getElementById('horasSemanais')?.value || null
    };
    localStorage.setItem('cicloEstudosEstado', JSON.stringify(estado));
    salvarEstadoNuvem();
}

function carregarEstado() {
    const estadoSalvo = localStorage.getItem('cicloEstudosEstado');
    if (estadoSalvo) {
        const estado = JSON.parse(estadoSalvo);
        materiasList = estado.materiasList;
        materiasSelecionadas = estado.materiasSelecionadas;
        blocosAtivos = estado.blocosAtivos;
        tempoDecorrido = estado.tempoDecorrido;
        modoCronometro = estado.modoCronometro;
        configuracoes = estado.configuracoes;

        document.getElementById('horasSemanais').value = estado.horasSemanais || '';
        document.getElementById('inicio').style.display = 'none';
        document.getElementById('continuar').style.display = 'block';
    }
}
