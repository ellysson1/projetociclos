let videosAssistidos = new Set();
let videosCarregados = false;

// ── Vimeo URL helpers ──────────────────────────────────────────────────────

function extrairVimeoId(url) {
    if (!url) return null;
    const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return match ? match[1] : null;
}

function gerarEmbedUrl(url) {
    const id = extrairVimeoId(url);
    if (!id) return null;
    const hashMatch = url.match(/vimeo\.com\/\d+\/([a-f0-9]+)/);
    const hash = hashMatch ? `?h=${hashMatch[1]}` : '';
    return `https://player.vimeo.com/video/${id}${hash}`;
}

// ── CRUD ───────────────────────────────────────────────────────────────────

async function carregarVideos() {
    if (!supabaseConfigurado()) return [];
    const { data, error } = await supabaseClient
        .from('videos')
        .select('*')
        .order('curso')
        .order('assunto')
        .order('ordem');
    if (error) {
        console.error('Erro ao carregar videos:', error);
        return [];
    }
    return data || [];
}

async function carregarVideosAssistidos() {
    if (!supabaseConfigurado()) return;
    const user = await getUsuarioLogado();
    if (!user) return;
    const { data, error } = await supabaseClient
        .from('videos_assistidos')
        .select('video_id')
        .eq('user_id', user.id);
    if (error) {
        console.error('Erro ao carregar videos assistidos:', error);
        return;
    }
    videosAssistidos = new Set((data || []).map(d => d.video_id));
}

async function marcarVideoAssistido(videoId, assistido) {
    if (!supabaseConfigurado()) return;
    const user = await getUsuarioLogado();
    if (!user) return;

    if (assistido) {
        videosAssistidos.add(videoId);
        await supabaseClient.from('videos_assistidos')
            .upsert({ user_id: user.id, video_id: videoId },
                     { onConflict: 'user_id,video_id' });
    } else {
        videosAssistidos.delete(videoId);
        await supabaseClient.from('videos_assistidos')
            .delete()
            .eq('user_id', user.id)
            .eq('video_id', videoId);
    }
}

async function adicionarVideo() {
    const curso = document.getElementById('videoCurso').value.trim();
    const assunto = document.getElementById('videoAssunto').value.trim();
    const titulo = document.getElementById('videoTitulo').value.trim();
    const url = document.getElementById('videoUrl').value.trim();

    if (!curso || !assunto || !titulo || !url) {
        alert('Preencha todos os campos.');
        return;
    }
    if (!extrairVimeoId(url)) {
        alert('URL do Vimeo invalida. Use o formato: https://vimeo.com/123456789');
        return;
    }

    const user = await getUsuarioLogado();
    if (!user) return;

    const { error } = await supabaseClient
        .from('videos')
        .insert({
            professor_id: user.id,
            curso,
            assunto,
            titulo,
            vimeo_url: url,
            ordem: 0
        });

    if (error) {
        console.error('Erro ao adicionar video:', error);
        alert('Erro ao adicionar video.');
        return;
    }

    document.getElementById('videoCurso').value = '';
    document.getElementById('videoAssunto').value = '';
    document.getElementById('videoTitulo').value = '';
    document.getElementById('videoUrl').value = '';
    alert('Video adicionado!');
    await renderizarVideosProfessor();
}

async function removerVideo(id) {
    if (!confirm('Remover este video?')) return;
    const { error } = await supabaseClient.from('videos').delete().eq('id', id);
    if (error) {
        console.error('Erro ao remover video:', error);
        alert('Erro ao remover.');
        return;
    }
    await renderizarVideosProfessor();
}

// ── Renderizar tab (auto-detect role) ──────────────────────────────────────

async function renderizarVideosTab() {
    const user = await getUsuarioLogado();
    if (!user) return;

    if (isTeacher()) {
        document.getElementById('videosAluno').style.display = 'none';
        document.getElementById('videosProfessor').style.display = 'block';
        await renderizarVideosProfessor();
    } else {
        document.getElementById('videosAluno').style.display = 'block';
        document.getElementById('videosProfessor').style.display = 'none';
        await renderizarVideosAluno();
    }
    videosCarregados = true;
}

// ── Renderizar (Aluno) ─────────────────────────────────────────────────────

async function renderizarVideosAluno() {
    const videos = await carregarVideos();
    await carregarVideosAssistidos();

    const arvore = document.getElementById('videosArvore');
    const vazio = document.getElementById('videosVazio');
    if (!arvore) return;

    if (videos.length === 0) {
        arvore.innerHTML = '';
        if (vazio) vazio.style.display = 'block';
        return;
    }
    if (vazio) vazio.style.display = 'none';

    const cursos = agruparVideos(videos);
    let html = '';

    Object.entries(cursos).forEach(([cursoNome, assuntos]) => {
        let totalAulas = 0, assistidas = 0;
        let assuntosHTML = '';

        Object.entries(assuntos).forEach(([assuntoNome, aulas]) => {
            let aulasHTML = '';
            aulas.forEach(aula => {
                totalAulas++;
                const foiAssistida = videosAssistidos.has(aula.id);
                if (foiAssistida) assistidas++;
                const embedUrl = gerarEmbedUrl(aula.vimeo_url) || '';
                const tituloEscapado = aula.titulo.replace(/'/g, "\\'").replace(/"/g, '&quot;');

                aulasHTML += `
                    <div class="video-aula ${foiAssistida ? 'video-aula--assistida' : ''}">
                        <label class="video-aula__check">
                            <input type="checkbox" ${foiAssistida ? 'checked' : ''}
                                onchange="marcarVideoAssistido('${aula.id}', this.checked); this.closest('.video-aula').classList.toggle('video-aula--assistida')">
                        </label>
                        <span class="video-aula__titulo" onclick="abrirPlayer('${embedUrl}', '${tituloEscapado}')">
                            &#9654; ${aula.titulo}
                        </span>
                    </div>`;
            });

            assuntosHTML += `
                <div class="video-assunto">
                    <div class="video-assunto__header" onclick="toggleVideoAssunto(this)">
                        <span class="video-assunto__arrow">&#9654;</span>
                        <span class="video-assunto__nome">${assuntoNome}</span>
                        <span class="video-assunto__count">${aulas.length} aula(s)</span>
                    </div>
                    <div class="video-assunto__aulas" style="display:none;">
                        ${aulasHTML}
                    </div>
                </div>`;
        });

        html += `
            <div class="video-curso">
                <div class="video-curso__header" onclick="toggleVideoCurso(this)">
                    <span class="video-curso__arrow">&#9654;</span>
                    <strong class="video-curso__nome">${cursoNome}</strong>
                    <span class="video-curso__count">${assistidas}/${totalAulas} assistida(s)</span>
                </div>
                <div class="video-curso__conteudo" style="display:none;">
                    ${assuntosHTML}
                </div>
            </div>`;
    });

    arvore.innerHTML = html;
}

// ── Renderizar (Professor) ─────────────────────────────────────────────────

async function renderizarVideosProfessor() {
    const user = await getUsuarioLogado();
    if (!user) return;

    const { data: videos, error } = await supabaseClient
        .from('videos')
        .select('*')
        .eq('professor_id', user.id)
        .order('curso')
        .order('assunto')
        .order('ordem');

    if (error) { console.error(error); return; }

    const container = document.getElementById('videosListaProfessor');
    if (!container) return;

    if (!videos || videos.length === 0) {
        container.innerHTML = '<p style="color:#999;">Nenhum video adicionado ainda.</p>';
        return;
    }

    const cursos = agruparVideos(videos);
    let html = '';

    Object.entries(cursos).forEach(([cursoNome, assuntos]) => {
        html += `<div style="margin-bottom:16px; border:1px solid var(--border-color); border-radius:8px; padding:12px;">
            <h4 style="color:var(--primary-color); margin-bottom:8px;">${cursoNome}</h4>`;

        Object.entries(assuntos).forEach(([assuntoNome, aulas]) => {
            html += `<div style="margin-left:12px; margin-bottom:8px;">
                <strong style="font-size:13px; color:#555;">${assuntoNome}</strong>`;

            aulas.forEach(aula => {
                html += `<div class="video-prof-item">
                    <span>&#9654; ${aula.titulo}</span>
                    <a href="${aula.vimeo_url}" target="_blank">ver</a>
                    <button onclick="removerVideo('${aula.id}')">&#215;</button>
                </div>`;
            });

            html += `</div>`;
        });

        html += `</div>`;
    });

    container.innerHTML = html;
}

// ── Player ─────────────────────────────────────────────────────────────────

function abrirPlayer(embedUrl, titulo) {
    if (!embedUrl) { alert('URL do Vimeo invalida.'); return; }
    const player = document.getElementById('videosPlayer');
    document.getElementById('vimeoEmbed').src = embedUrl;
    document.getElementById('videoPlayerTitulo').textContent = titulo;
    player.style.display = 'block';
    player.scrollIntoView({ behavior: 'smooth' });
}

function fecharPlayer() {
    document.getElementById('videosPlayer').style.display = 'none';
    document.getElementById('vimeoEmbed').src = '';
}

// ── Toggle accordion ───────────────────────────────────────────────────────

function toggleVideoCurso(header) {
    const conteudo = header.nextElementSibling;
    const arrow = header.querySelector('.video-curso__arrow');
    const aberto = conteudo.style.display !== 'none';
    conteudo.style.display = aberto ? 'none' : 'block';
    arrow.style.transform = aberto ? '' : 'rotate(90deg)';
}

function toggleVideoAssunto(header) {
    const conteudo = header.nextElementSibling;
    const arrow = header.querySelector('.video-assunto__arrow');
    const aberto = conteudo.style.display !== 'none';
    conteudo.style.display = aberto ? 'none' : 'block';
    arrow.style.transform = aberto ? '' : 'rotate(90deg)';
}

// ── Helpers ────────────────────────────────────────────────────────────────

function agruparVideos(videos) {
    const cursos = {};
    videos.forEach(v => {
        if (!cursos[v.curso]) cursos[v.curso] = {};
        if (!cursos[v.curso][v.assunto]) cursos[v.curso][v.assunto] = [];
        cursos[v.curso][v.assunto].push(v);
    });
    return cursos;
}
