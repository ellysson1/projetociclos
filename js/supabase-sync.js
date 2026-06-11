// ── Sync do estado com versionamento otimista (Fase 2 / T1) ─────────────────
// Push: lê a versão do servidor; se o servidor está à frente, mescla antes
// de subir; o UPDATE é condicional (WHERE versao = lida) — escrita
// concorrente falha e dispara pull + merge + retry (máx. 3 tentativas).
// Estado local NUNCA sobrescreve estado mais novo do servidor sem merge.

let _salvandoNuvem = false;

async function salvarEstadoNuvem() {
    if (!supabaseConfigurado()) return;
    const user = await getUsuarioLogado();
    if (!user) return;
    if (_salvandoNuvem) return;
    _salvandoNuvem = true;

    try {
        for (let tentativa = 0; tentativa < 3; tentativa++) {
            const { data: row, error: errSel } = await supabaseClient
                .from('progresso')
                .select('versao, estado')
                .eq('user_id', user.id)
                .maybeSingle();

            if (errSel) {
                // Coluna versao ainda não existe (migração não aplicada):
                // cair no comportamento legado para não interromper o sync.
                await _salvarEstadoNuvemLegado(user);
                return;
            }

            const estadoLocal = montarEstadoLocal();

            if (!row) {
                const { error } = await supabaseClient
                    .from('progresso')
                    .insert({
                        user_id: user.id,
                        estado: estadoLocal,
                        versao: 1,
                        device_id: typeof getDeviceId === 'function' ? getDeviceId() : null,
                        updated_at: new Date().toISOString()
                    });
                if (!error) {
                    if (typeof setVersaoLocal === 'function') setVersaoLocal(1);
                    return;
                }
                continue; // corrida: outro dispositivo inseriu primeiro
            }

            const versaoServidor = row.versao || 0;
            const versaoLocal = typeof getVersaoLocal === 'function' ? getVersaoLocal() : 0;

            let estadoFinal = estadoLocal;
            if (versaoServidor > versaoLocal && row.estado && typeof mesclarEstados === 'function') {
                estadoFinal = mesclarEstados(estadoLocal, row.estado, versaoLocal, versaoServidor);
                aplicarEstadoGlobals(estadoFinal);
                if (blocosAtivos.length > 0 && typeof exibirCicloVisual === 'function' && !cronometroRodando) {
                    exibirCicloVisual(blocosAtivos);
                }
            }

            const { data: upd, error: errUpd } = await supabaseClient
                .from('progresso')
                .update({
                    estado: estadoFinal,
                    versao: versaoServidor + 1,
                    device_id: typeof getDeviceId === 'function' ? getDeviceId() : null,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', user.id)
                .eq('versao', versaoServidor)
                .select('versao');

            if (!errUpd && upd && upd.length > 0) {
                if (typeof setVersaoLocal === 'function') setVersaoLocal(upd[0].versao);
                localStorage.setItem('cicloEstudosEstado', JSON.stringify(estadoFinal));
                return;
            }
            // 0 linhas: escrita concorrente entre o SELECT e o UPDATE → retry
        }
        console.warn('Sync: conflito persistente de versão; nova tentativa no próximo ciclo.');
    } finally {
        _salvandoNuvem = false;
    }
}

// Comportamento anterior à migração (sem coluna versao). Mantido apenas como
// fallback para o intervalo entre o deploy do JS e a execução do SQL.
async function _salvarEstadoNuvemLegado(user) {
    const { error } = await supabaseClient
        .from('progresso')
        .upsert({
            user_id: user.id,
            estado: montarEstadoLocal(),
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    if (error) console.error('Erro ao salvar na nuvem:', error);
}

async function carregarEstadoNuvem() {
    if (!supabaseConfigurado()) return;
    const user = await getUsuarioLogado();
    if (!user) return;

    let data = null;
    const resp = await supabaseClient
        .from('progresso')
        .select('estado, versao, anotacoes')
        .eq('user_id', user.id)
        .maybeSingle();

    if (resp.error) {
        // Migração ainda não aplicada: tentar sem a coluna versao
        const legado = await supabaseClient
            .from('progresso')
            .select('estado, anotacoes')
            .eq('user_id', user.id)
            .maybeSingle();
        if (legado.error) {
            console.error('Erro ao carregar da nuvem:', legado.error);
            return;
        }
        data = legado.data;
    } else {
        data = resp.data;
    }

    if (!data) {
        document.getElementById('inicio').style.display = 'block';
        document.getElementById('continuar').style.display = 'none';
        return;
    }

    if (data.estado) {
        // Pull obrigatório na abertura: o servidor é a base; deltas locais
        // não sincronizados (ex.: estudo offline) entram via merge.
        const versaoServidor = data.versao || 0;
        const versaoLocal = typeof getVersaoLocal === 'function' ? getVersaoLocal() : 0;
        const estadoLocal = montarEstadoLocal();
        const temDadosLocais = (estadoLocal.blocosAtivos || []).length > 0 ||
                               (estadoLocal.materiasSelecionadas || []).length > 0;

        const estadoFinal = (temDadosLocais && typeof mesclarEstados === 'function')
            ? mesclarEstados(estadoLocal, data.estado, versaoLocal, versaoServidor)
            : data.estado;

        aplicarEstadoGlobals(estadoFinal, { forcarTempo: true });
        if (typeof setVersaoLocal === 'function') setVersaoLocal(versaoServidor);
        localStorage.setItem('cicloEstudosEstado', JSON.stringify(estadoFinal));

        inicializarSelecaoMaterias();
        carregarConfiguracoes();
        if (blocosAtivos.length > 0) {
            document.getElementById('inicio').style.display = 'none';
            document.getElementById('continuar').style.display = 'block';
        } else {
            document.getElementById('inicio').style.display = 'block';
            document.getElementById('continuar').style.display = 'none';
        }
    }

    // anotacoes field kept in DB for backwards compatibility but no longer used in UI
}
