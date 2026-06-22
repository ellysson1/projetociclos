// ── Fase 2 (T1): Motor de sincronização robusta multi-dispositivo ───────────
// device_id por dispositivo, fila de eventos idempotentes (append-only),
// regras de merge entre estado local e servidor, e envio via beacon ao
// ocultar a aba. Nenhuma conclusão de bloco é perdida ou desfeita por merge.

const RANK_STATUS_EDITAL = { pendente: 0, em_andamento: 1, visto: 2, concluido: 3 };

function gerarUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function getDeviceId() {
    let id = localStorage.getItem('cicloDeviceId');
    if (!id) {
        id = gerarUUID();
        localStorage.setItem('cicloDeviceId', id);
    }
    return id;
}

// Última versão do estado confirmada com o servidor (relógio lógico)
function getVersaoLocal() {
    return parseInt(localStorage.getItem('cicloSyncVersao') || '0', 10);
}

function setVersaoLocal(v) {
    localStorage.setItem('cicloSyncVersao', String(v));
}

// ── IDs estáveis de blocos ───────────────────────────────────────────────────
// Blocos legados não têm id. A atribuição é determinística (índice + legenda):
// dois dispositivos partindo do mesmo estado derivam os mesmos ids, o que
// permite a união de blocos concluídos no merge.
function garantirIdsBlocos(blocos) {
    if (!Array.isArray(blocos)) return;
    const usados = new Set(blocos.filter(b => b && b.id).map(b => b.id));
    blocos.forEach((b, i) => {
        if (!b || b.id) return;
        let id = `b${i}-${b.legenda || 'x'}`;
        let seq = 0;
        while (usados.has(id)) {
            seq++;
            id = `b${i}-${b.legenda || 'x'}-${seq}`;
        }
        b.id = id;
        usados.add(id);
    });
}

// ── Merge de estados (local × servidor) ──────────────────────────────────────
// Regras (T1.3):
// - Estrutura base: vence a versão mais alta
// - Blocos concluídos: união por id — conclusão NUNCA é desfeita
// - Fase: vence a maior
// - Contador de revisões: maior valor por chave
// - Configurações/horas: vence o estado salvo mais recentemente (atualizadoEm)
function mesclarEstados(eLocal, eServidor, versaoLocal, versaoServidor) {
    if (!eServidor) return eLocal;
    if (!eLocal) return eServidor;

    const baseEhServidor = (versaoServidor || 0) >= (versaoLocal || 0);
    const base = baseEhServidor ? eServidor : eLocal;
    const outro = baseEhServidor ? eLocal : eServidor;
    const m = JSON.parse(JSON.stringify(base));

    garantirIdsBlocos(m.blocosAtivos);
    garantirIdsBlocos(outro.blocosAtivos);

    // 1. União de blocos concluídos
    const porId = new Map((m.blocosAtivos || []).map(b => [b.id, b]));
    (outro.blocosAtivos || []).forEach(b => {
        if (!b.concluido) return;
        const alvo = porId.get(b.id);
        if (alvo) {
            if (!alvo.concluido) {
                alvo.concluido = true;
                alvo.assunto = b.assunto || alvo.assunto;
                alvo.questoes = b.questoes || alvo.questoes;
            }
        } else {
            m.blocosAtivos = m.blocosAtivos || [];
            m.blocosAtivos.push(JSON.parse(JSON.stringify(b)));
        }
    });

    // 2. Fase: vence a maior
    m.faseAtual = Math.max(m.faseAtual || 1, outro.faseAtual || 1);

    // 3. Revisões: maior contador por chave
    const revBase = m.revisoesContador || {};
    const revOutro = outro.revisoesContador || {};
    Object.keys(revOutro).forEach(k => {
        revBase[k] = Math.max(revBase[k] || 0, revOutro[k] || 0);
    });
    m.revisoesContador = revBase;

    // 4. Configurações: vence o salvamento mais recente
    const tBase = Date.parse(base.atualizadoEm || '') || 0;
    const tOutro = Date.parse(outro.atualizadoEm || '') || 0;
    if (tOutro > tBase) {
        if (outro.configuracoes) m.configuracoes = outro.configuracoes;
        if (outro.horasSemanais != null) m.horasSemanais = outro.horasSemanais;
        if (outro.modoCronometro != null) m.modoCronometro = outro.modoCronometro;
    }
    m.atualizadoEm = new Date(Math.max(tBase, tOutro) || Date.now()).toISOString();

    return m;
}

// ── Fila de eventos imutáveis (T1.2) ─────────────────────────────────────────
// Eventos são gravados imediatamente; em falha de rede ficam na fila local
// e são reenviados no próximo sync. client_event_id garante idempotência.

const FILA_EVENTOS_KEY = 'cicloFilaEventos';
const FILA_QUESTOES_KEY = 'cicloFilaQuestoes';
const FILA_MAX = 500;

function _lerFila(chave) {
    try {
        return JSON.parse(localStorage.getItem(chave)) || [];
    } catch (e) {
        return [];
    }
}

function _gravarFila(chave, fila) {
    localStorage.setItem(chave, JSON.stringify(fila.slice(-FILA_MAX)));
}

function registrarEvento(tipo, payload) {
    const evento = {
        client_event_id: gerarUUID(),
        tipo,
        payload: payload || {},
        criado_em: new Date().toISOString()
    };
    const fila = _lerFila(FILA_EVENTOS_KEY);
    fila.push(evento);
    _gravarFila(FILA_EVENTOS_KEY, fila);
    flushEventosPendentes();
    return evento.client_event_id;
}

function enfileirarQuestaoPendente(registro) {
    const fila = _lerFila(FILA_QUESTOES_KEY);
    fila.push(registro);
    _gravarFila(FILA_QUESTOES_KEY, fila);
}

let _flushEmAndamento = false;

async function flushEventosPendentes() {
    if (typeof _modoVisualizacaoAluno !== 'undefined' && _modoVisualizacaoAluno) return;
    if (_flushEmAndamento) return;
    if (typeof supabaseConfigurado !== 'function' || !supabaseConfigurado()) return;
    if (!navigator.onLine) return;
    const user = await getUsuarioLogado();
    if (!user) return;

    _flushEmAndamento = true;
    try {
        let fila = _lerFila(FILA_EVENTOS_KEY);
        while (fila.length > 0) {
            const ev = fila[0];
            const { error } = await supabaseClient
                .from('eventos_estudo')
                .upsert({
                    user_id: user.id,
                    tipo: ev.tipo,
                    payload: ev.payload,
                    client_event_id: ev.client_event_id,
                    criado_em: ev.criado_em
                }, { onConflict: 'user_id,client_event_id', ignoreDuplicates: true });
            if (error) break; // rede ou tabela ausente: tenta no próximo ciclo
            fila.shift();
            _gravarFila(FILA_EVENTOS_KEY, fila);
        }

        let filaQ = _lerFila(FILA_QUESTOES_KEY);
        while (filaQ.length > 0) {
            const reg = filaQ[0];
            const { error } = await supabaseClient
                .from('questoes')
                .upsert({ ...reg, user_id: user.id }, { onConflict: 'client_event_id', ignoreDuplicates: true });
            if (error) break;
            filaQ.shift();
            _gravarFila(FILA_QUESTOES_KEY, filaQ);
        }
    } finally {
        _flushEmAndamento = false;
    }
}

// ── Beacon (T1.4): envio best-effort quando a aba é ocultada ─────────────────
// beforeunload não dispara de forma confiável em mobile; visibilitychange +
// fetch keepalive cobre o caso. O PATCH é condicional pela versão local —
// se o servidor avançou, o filtro versao=eq.N casa 0 linhas e nada é
// sobrescrito (o merge acontece no próximo sync normal).

let _sessionCache = null;

function atualizarSessionCache(session) {
    _sessionCache = session
        ? { token: session.access_token, userId: session.user.id }
        : null;
}

function enviarBeaconSync() {
    if (!_sessionCache) return;
    if (typeof supabaseConfigurado !== 'function' || !supabaseConfigurado()) return;

    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${_sessionCache.token}`,
        'Content-Type': 'application/json'
    };

    // 1. Eventos pendentes (idempotente — a fila não é limpa aqui porque a
    //    resposta não é confiável no unload; o reenvio não duplica)
    const fila = _lerFila(FILA_EVENTOS_KEY);
    if (fila.length > 0) {
        fetch(`${SUPABASE_URL}/rest/v1/eventos_estudo?on_conflict=user_id,client_event_id`, {
            method: 'POST',
            keepalive: true,
            headers: { ...headers, 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
            body: JSON.stringify(fila.map(ev => ({
                user_id: _sessionCache.userId,
                tipo: ev.tipo,
                payload: ev.payload,
                client_event_id: ev.client_event_id,
                criado_em: ev.criado_em
            })))
        }).catch(() => {});
    }

    // 2. Estado: PATCH condicional pela versão
    if (typeof montarEstadoLocal !== 'function') return;
    const v = getVersaoLocal();
    fetch(`${SUPABASE_URL}/rest/v1/progresso?user_id=eq.${_sessionCache.userId}&versao=eq.${v}`, {
        method: 'PATCH',
        keepalive: true,
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({
            estado: montarEstadoLocal(),
            versao: v + 1,
            device_id: getDeviceId(),
            updated_at: new Date().toISOString()
        })
    }).catch(() => {});
}
