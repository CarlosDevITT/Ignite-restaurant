// Configuração centralizada do Supabase
(function() {
    window.__supabaseConfigPending = true;
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
                window.__supabaseConfigPending = false;
                
                console.log('✅ Supabase configurado com sucesso!');
                
                // Disparar evento de configuração completa
                window.dispatchEvent(new CustomEvent('supabase:ready'));
            }
        } catch (error) {
            window.__supabaseConfigPending = false;
            console.error('❌ Erro ao configurar Supabase:', error);
        }
    }

    // Iniciar quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
