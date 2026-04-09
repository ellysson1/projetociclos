function gerarCorAleatoria() {
    const h = Math.floor(Math.random() * 360);
    const s = Math.floor(Math.random() * 30) + 70;
    const l = Math.floor(Math.random() * 20) + 70;
    return `hsl(${h}, ${s}%, ${l}%)`;
}

function gerarCorUnica() {
    let cor;
    let tentativas = 0;
    do {
        cor = gerarCorAleatoria();
        tentativas++;
    } while ((coresUsadas.includes(cor) || isGreenish(cor)) && tentativas < 100);
    coresUsadas.push(cor);
    return cor;
}

function isGreenish(cor) {
    const hue = parseInt(cor.match(/hsl\((\d+)/)[1]);
    return hue > 70 && hue < 150;
}

function inicializarSelecaoMaterias() {
    const materiasContainer = document.getElementById("materiasLista");
    materiasContainer.innerHTML = "";
    materiasList.forEach(materia => {
        adicionarMateriaAoDOM(materia);
    });
}

function adicionarMateriaAoDOM(materia) {
    const materiasContainer = document.getElementById("materiasLista");
    const div = document.createElement("div");
    div.className = "materia-item";
    div.innerHTML = `
        <input type="checkbox" id="${materia.legenda}" value="${materia.legenda}">
        <label for="${materia.legenda}">${materia.nome}</label>
        <button class="remover-materia" data-legenda="${materia.legenda}">&times;</button>
    `;
    materiasContainer.appendChild(div);

    div.querySelector('.remover-materia').addEventListener('click', function() {
        removerMateria(materia.legenda);
    });
}

function removerMateria(legenda) {
    materiasList = materiasList.filter(m => m.legenda !== legenda);
    inicializarSelecaoMaterias();
    salvarEstado();
}

function avancarHorasSemanais(event) {
    event.preventDefault();
    const horasSemanais = document.getElementById("horasSemanais").value;
    if (horasSemanais && parseInt(horasSemanais) > 0) {
        alternarAba('materias');
    } else {
        alert("Por favor, insira um número válido de horas semanais.");
    }
}

function avancarSelecaoMaterias() {
    materiasSelecionadas = Array.from(document.querySelectorAll('#materiasLista input[type="checkbox"]:checked'))
        .map(checkbox => {
            const materia = materiasList.find(m => m.legenda === checkbox.value);
            return {...materia, cor: gerarCorUnica()};
        });

    if (materiasSelecionadas.length > 0) {
        preencherTabelaVariaveis();
        alternarAba('variaveis');
    } else {
        alert("Por favor, selecione pelo menos uma matéria.");
    }
}
