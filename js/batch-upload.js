// ── Upload em Lote de Matérias (Excel/CSV) ──────────────────────────────────

function criarInputUpload(callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.style.display = 'none';
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        processarArquivoMaterias(file, callback);
        input.remove();
    });
    document.body.appendChild(input);
    input.click();
}

function processarArquivoMaterias(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            if (rows.length === 0) {
                alert('O arquivo está vazio ou não possui dados na primeira aba.');
                return;
            }

            const materias = normalizarLinhas(rows);
            if (materias.length === 0) {
                alert('Nenhuma matéria válida encontrada. Verifique se o arquivo possui colunas "Nome" e "Sigla".');
                return;
            }

            mostrarPreviewImportacao(materias, callback);
        } catch (err) {
            console.error('Erro ao processar arquivo:', err);
            alert('Erro ao ler o arquivo. Verifique se é um arquivo Excel (.xlsx/.xls) ou CSV válido.');
        }
    };
    reader.readAsArrayBuffer(file);
}

function normalizarLinhas(rows) {
    const materias = [];
    rows.forEach(row => {
        // Tentar encontrar colunas por diferentes nomes
        const nome = row['Nome'] || row['nome'] || row['NOME'] || row['Materia'] || row['materia'] || row['MATERIA'] || '';
        const sigla = row['Sigla'] || row['sigla'] || row['SIGLA'] || row['Legenda'] || row['legenda'] || row['LEGENDA'] || '';
        const peso = parseInt(row['Peso'] || row['peso'] || row['PESO']) || 5;
        const extensao = parseInt(row['Extensao'] || row['extensao'] || row['EXTENSAO'] || row['Extensão'] || row['Volume'] || row['volume']) || 5;
        const dificuldade = parseInt(row['Dificuldade'] || row['dificuldade'] || row['DIFICULDADE']) || 5;

        if (nome.trim() && sigla.trim()) {
            materias.push({
                nome: nome.trim(),
                legenda: sigla.trim().toUpperCase().substring(0, 3),
                peso: Math.min(10, Math.max(1, peso)),
                extensao: Math.min(10, Math.max(1, extensao)),
                dificuldade: Math.min(10, Math.max(1, dificuldade))
            });
        }
    });
    return materias;
}

function mostrarPreviewImportacao(materias, callback) {
    // Criar modal de preview
    let modal = document.getElementById('modalPreviewImport');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalPreviewImport';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }

    let tableRows = materias.map((m, i) => `
        <tr>
            <td style="padding:6px 8px; border:1px solid #eee;">${i + 1}</td>
            <td style="padding:6px 8px; border:1px solid #eee;">${m.nome}</td>
            <td style="padding:6px 8px; border:1px solid #eee;">${m.legenda}</td>
            <td style="padding:6px 8px; border:1px solid #eee; text-align:center;">${m.peso}</td>
            <td style="padding:6px 8px; border:1px solid #eee; text-align:center;">${m.extensao}</td>
            <td style="padding:6px 8px; border:1px solid #eee; text-align:center;">${m.dificuldade}</td>
        </tr>
    `).join('');

    modal.innerHTML = `
        <div class="modal-card" style="max-width:600px;">
            <h3>Preview da Importação</h3>
            <p>${materias.length} matéria(s) encontrada(s)</p>
            <div style="max-height:300px; overflow-y:auto; margin:12px 0;">
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead>
                        <tr style="background:#f5f5f5;">
                            <th style="padding:6px 8px; border:1px solid #eee;">#</th>
                            <th style="padding:6px 8px; border:1px solid #eee;">Nome</th>
                            <th style="padding:6px 8px; border:1px solid #eee;">Sigla</th>
                            <th style="padding:6px 8px; border:1px solid #eee;">Peso</th>
                            <th style="padding:6px 8px; border:1px solid #eee;">Ext.</th>
                            <th style="padding:6px 8px; border:1px solid #eee;">Dif.</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
            <div class="modal-actions">
                <button id="btnConfirmarImport" style="background:#4CAF50;">Confirmar Importação</button>
                <button id="btnCancelarImport" style="background:#999;">Cancelar</button>
            </div>
        </div>
    `;

    modal.classList.add('active');

    document.getElementById('btnConfirmarImport').addEventListener('click', () => {
        modal.classList.remove('active');
        callback(materias);
    });

    document.getElementById('btnCancelarImport').addEventListener('click', () => {
        modal.classList.remove('active');
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });
}

function baixarModeloExcel() {
    const wb = XLSX.utils.book_new();
    const dados = [
        { Nome: 'CONTABILIDADE GERAL', Sigla: 'CGE', Peso: 8, Extensao: 7, Dificuldade: 6 },
        { Nome: 'AFO', Sigla: 'AFO', Peso: 7, Extensao: 5, Dificuldade: 5 },
        { Nome: 'AUDITORIA', Sigla: 'AUD', Peso: 6, Extensao: 6, Dificuldade: 7 }
    ];
    const ws = XLSX.utils.json_to_sheet(dados);
    ws['!cols'] = [{ wch: 25 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Matérias');
    XLSX.writeFile(wb, 'modelo_materias.xlsx');
}

// Upload para a aba Matérias do aluno
function uploadMateriasAluno() {
    criarInputUpload((materias) => {
        materias.forEach(m => {
            if (!materiasList.some(existing => existing.legenda === m.legenda)) {
                materiasList.push({ nome: m.nome, legenda: m.legenda });
            }
        });
        inicializarSelecaoMaterias();
        salvarEstado();
        alert(`${materias.length} matéria(s) importada(s) com sucesso!`);
    });
}

// Upload para o editor de planos do professor
function uploadMateriasPlano() {
    criarInputUpload((materias) => {
        renderizarMateriasPlano(materias);
        alert(`${materias.length} matéria(s) importada(s) para o plano!`);
    });
}
