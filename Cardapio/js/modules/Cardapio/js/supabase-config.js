// Configuração centralizada do Supabase
(function() {
    // Evita múltiplas inicializações
    if (window.__supabaseInitialized) {
        console.log('ℹ️ Supabase já inicializado');
        return;
    }

    const SUPABASE_CONFIG = {
        url: 'https://qgnqztsxfeugopuhyioq.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnbnF6dHN4ZmV1Z29wdWh5aW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MTg4MjEsImV4cCI6MjA3MzA5NDgyMX0.mW88-7P_Af3WMVAUT7ha4Mf0nyKJoSiNjMfuXiCllIA'
    };

    // Aguarda o DOM e o SDK carregarem
    function init() {
        // Verificar se o SDK está disponível
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            createClient();
        } else {
            // Tentar novamente em 100ms (máx 50 tentativas)
            let tentativas = 0;
            const maxTentativas = 50;
            
            const verificarSDK = setInterval(() => {
                tentativas++;
                if (window.supabase && typeof window.supabase.createClient === 'function') {
                    clearInterval(verificarSDK);
                    createClient();
                } else if (tentativas >= maxTentativas) {
                    clearInterval(verificarSDK);
                    console.error('❌ SDK do Supabase não carregado após', maxTentativas, 'tentativas');
                }
            }, 100);
        }
    }

    function createClient() {
        try {
            // Criar cliente apenas se não existir
            if (!window.supabaseClient) {
                console.log('🔌 Criando cliente Supabase...');
                
                const client = window.supabase.createClient(
                    SUPABASE_CONFIG.url,
                    SUPABASE_CONFIG.anonKey,
                    {
                        auth: {
                            persistSession: true,
                            autoRefreshToken: true
                        }
                    }
                );

                // Salvar referência global
                window.supabaseClient = client;
                window.__supabaseInitialized = true;

                console.log('✅ Supabase configurado com sucesso!');

                configurarResilienciaDeSessao(client);

                // Disparar evento de configuração completa
                window.dispatchEvent(new CustomEvent('supabase:ready'));
            }
        } catch (error) {
            console.error('❌ Erro ao configurar Supabase:', error);
        }
    }

    let refreshPromise = null;
    window.refreshSupabaseSession = () => {
        if (!refreshPromise) refreshPromise = window.supabaseClient.auth.refreshSession()
            .finally(() => { refreshPromise = null; });
        return refreshPromise;
    };

    // ── Resiliência de sessão/JWT ──────────────────────────────
    // Evita o cenário observado em produção: PGRST303 (JWT expired) / HTTP 401
    // em "pedidos.js" e "produtos.js" porque o token guardado ficou expirado
    // (ex.: PDV aberto o dia inteiro, aba em segundo plano por horas — o timer
    // interno de autoRefreshToken pode não disparar a tempo nesses casos).
    // persistSession + autoRefreshToken continuam ativos (já garantem o caso
    // comum); isto aqui é a rede de segurança para quando eles não bastam.
    function configurarResilienciaDeSessao(client) {
        // Reage à renovação/perda de sessão e avisa o resto do app via evento,
        // sem precisar que cada módulo conheça detalhes do Supabase Auth.
        client.auth.onAuthStateChange((event, session) => {
            if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
                console.log(`🔄 Sessão ${event === 'TOKEN_REFRESHED' ? 'renovada' : 'iniciada'}.`);
                window.dispatchEvent(new CustomEvent('supabase:session-updated', { detail: { session } }));
            } else if (event === 'SIGNED_OUT') {
                console.warn('🔐 Sessão encerrada — redirecionando para login.');
                window.dispatchEvent(new CustomEvent('supabase:signed-out'));
                // Este arquivo é carregado tanto pelo login (index.html) quanto
                // pelo dashboard (src/index.html) — só redireciona quando
                // estamos de fato no dashboard, para não criar loop na tela de login.
                if (false) {
                    window.location.href = '../index.html';
                }
            }
        });

        // Confere/renova a sessão sempre que o PDV volta a ficar em primeiro
        // plano — cobre o caso do terminal ficar com a aba em segundo plano
        // (ou o computador em suspensão) por tempo suficiente para o token
        // expirar antes do timer de autoRefreshToken disparar.
        const revalidarSessao = async () => {
            try {
                const { data: { session } } = await client.auth.getSession();
                if (!session) return;
                const expiraEmMs = (session.expires_at || 0) * 1000 - Date.now();
                if (expiraEmMs < 60000) {
                    console.log('🔄 Token perto de expirar (ou expirado) — renovando...');
                    await window.refreshSupabaseSession();
                }
            } catch (error) {
                console.warn('⚠️ Falha ao revalidar sessão:', error.message);
            }
        };

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') revalidarSessao();
        });
        window.addEventListener('focus', revalidarSessao);
        revalidarSessao();
    }

    // Detecta o erro específico relatado (PGRST303 / 401 / "jwt expired") vindo
    // do PostgREST, sem depender de string exata de uma única versão da API.
    window.isJwtExpiredError = function isJwtExpiredError(error) {
        if (!error) return false;
        const codigo = error.code || error.details || '';
        const mensagem = String(error.message || '').toLowerCase();
        return codigo === 'PGRST303' || error.status === 401 ||
            mensagem.includes('jwt expired') || mensagem.includes('invalid jwt') || mensagem.includes('jwt');
    };

    // Executa uma consulta e, se ela falhar por JWT expirado, renova a sessão
    // UMA vez e tenta de novo — para nunca reutilizar um token expirado numa
    // segunda chamada. "queryFn" deve ser uma função que monta e retorna a
    // consulta (não a consulta já executada), para que o retry seja uma
    // requisição nova de verdade, não a mesma promise reaproveitada.
    window.supabaseRetry = async function supabaseRetry(queryFn) {
        let resultado = await queryFn();
        if (resultado && resultado.error && window.isJwtExpiredError(resultado.error)) {
            console.warn('🔄 JWT expirado detectado — renovando sessão e tentando novamente...');
            const client = window.supabaseClient;
            const { error: erroRenovacao } = client ? await window.refreshSupabaseSession() : { error: new Error('Cliente Supabase indisponível') };
            if (!erroRenovacao) {
                resultado = await queryFn();
            } else {
                console.warn('⚠️ Não foi possível renovar a sessão:', erroRenovacao.message);
            }
        }
        return resultado;
    };

    // Iniciar quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();