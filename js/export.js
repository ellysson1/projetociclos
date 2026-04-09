function hslToHex(hsl) {
    const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!match) return 'FFFFFF';
    const h = parseInt(match[1]) / 360;
    const s = parseInt(match[2]) / 100;
    const l = parseInt(match[3]) / 100;
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    const toHex = x => Math.round(x * 255).toString(16).padStart(2, '0');
    return `${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function gerarPDF() {
    let printContent = `
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Ciclo de Estudos - PDF</title>
            <style>
                @page { size: A4 landscape; margin: 1cm; }
                body { font-family: Arial, sans-serif; font-size: 10px; width: 277mm; height: 190mm; }
                .ciclo-container { display: flex; flex-wrap: wrap; justify-content: flex-start; }
                .sessao { margin-bottom: 10px; page-break-inside: avoid; }
                .bloco {
                    display: inline-block; width: 60px; height: 30px;
                    border: 1px solid #000; margin: 2px; text-align: center;
                    vertical-align: middle; line-height: 15px;
                }
                .intervalo {
                    display: inline-block; width: 60px; height: 30px;
                    border: 1px dashed #000; margin: 2px; text-align: center;
                    vertical-align: middle; line-height: 15px;
                }
                h1 { font-size: 16px; margin-bottom: 10px; }
                h2 { font-size: 14px; margin-top: 5px; margin-bottom: 5px; }
            </style>
        </head>
        <body>
            <h1>Ciclo de Estudos</h1>
            <div class="ciclo-container">
    `;

    let blocoCounter = 0;
    let sessaoCounter = 1;

    printContent += '<div class="sessao">';
    printContent += `<h2>Sessão ${sessaoCounter}</h2>`;

    blocosAtivos.forEach((bloco) => {
        if (blocoCounter % configuracoes.blocosPorSessao === 0 && blocoCounter !== 0) {
            printContent += `<div class="intervalo">Intervalo<br>${configuracoes.intervaloEntreBlocos}min</div>`;
            printContent += '</div>';
            sessaoCounter++;
            printContent += '<div class="sessao">';
            printContent += `<h2>Sessão ${sessaoCounter}</h2>`;
        }

        printContent += `<div class="bloco" style="background-color: ${bloco.cor}">${bloco.legenda}<br>${bloco.duracaoEspecifica || configuracoes.duracaoBloco}min</div>`;
        blocoCounter++;
    });

    printContent += '</div></div></body></html>';

    const blob = new Blob([printContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    setTimeout(() => {
        printWindow.print();
        URL.revokeObjectURL(url);
    }, 250);
}

function exportarParaExcel() {
    const bps = configuracoes.blocosPorSessao;
    const nCols = bps + 1;

    const sessoes = [];
    for (let i = 0; i < blocosAtivos.length; i += bps) {
        sessoes.push(blocosAtivos.slice(i, i + bps));
    }

    const td = 'padding:8px 14px; text-align:center; vertical-align:middle; border:1px solid #CCCCCC; min-width:110px; font-family:Arial,sans-serif; font-size:10pt;';

    let html = `<html><head><meta charset="UTF-8"></head><body>
    <table border="1" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">`;

    html += `<tr>
        <td colspan="${nCols}" style="${td} background-color:#4A90E2; color:#FFFFFF;
            font-weight:bold; font-size:14pt; height:36px;">
            CICLO DE ESTUDOS
        </td>
    </tr>`;

    html += `<tr>
        <td style="${td} background-color:#2C3E50; color:#FFFFFF; font-weight:bold;">Sessão</td>`;
    for (let c = 1; c <= bps; c++) {
        html += `<td style="${td} background-color:#7F8C8D; color:#FFFFFF; font-weight:bold;">Bloco ${c}</td>`;
    }
    html += `</tr>`;

    sessoes.forEach((sessao, idx) => {
        html += `<tr>
            <td style="${td} background-color:#2C3E50; color:#FFFFFF; font-weight:bold; font-size:11pt;">
                Sessão ${idx + 1}
            </td>`;

        sessao.forEach(bloco => {
            const duracao = bloco.duracaoEspecifica || configuracoes.duracaoBloco;
            if (bloco.concluido) {
                html += `<td style="${td} background-color:#4CAF50; color:#FFFFFF; font-weight:bold;">
                    ${bloco.legenda}<br>
                    <span style="font-size:9pt; font-weight:normal;">${duracao}min ✓</span>
                </td>`;
            } else {
                const hex = hslToHex(bloco.cor);
                html += `<td style="${td} background-color:#${hex}; color:#333333; font-weight:bold;">
                    ${bloco.legenda}<br>
                    <span style="font-size:9pt; font-weight:normal;">${duracao}min</span>
                </td>`;
            }
        });

        for (let c = sessao.length; c < bps; c++) {
            html += `<td style="${td} background-color:#F5F5F5; color:#BBBBBB;">—</td>`;
        }
        html += `</tr>`;

        if (idx < sessoes.length - 1) {
            html += `<tr>
                <td colspan="${nCols}" style="${td} background-color:#F0F4F8; color:#888888;
                    font-style:italic; height:22px;">
                    ⏸ Intervalo: ${configuracoes.intervaloEntreBlocos} min
                </td>
            </tr>`;
        }
    });

    const total      = blocosAtivos.length;
    const concluidos = blocosAtivos.filter(b => b.concluido).length;
    html += `<tr>
        <td colspan="${nCols}" style="${td} background-color:#ECF0F1; color:#555555;
            font-size:9pt; height:24px;">
            Total: ${total} blocos &nbsp;|&nbsp;
            Concluídos: ${concluidos} &nbsp;|&nbsp;
            Pendentes: ${total - concluidos}
        </td>
    </tr>`;

    html += `</table></body></html>`;

    const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'ciclo_de_estudos.xls';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
