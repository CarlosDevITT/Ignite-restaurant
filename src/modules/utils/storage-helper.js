/**
 * storage-helper.js - Utilitário seguro para localStorage
 * Resolve problemas de "Tracking Prevention" e acesso negado em protocolos file://
 */

const safeStorage = (() => {
    let _available = null;

    function isAvailable() {
        if (_available !== null) return _available;
        try {
            localStorage.setItem('__ignite_test__', '1');
            localStorage.removeItem('__ignite_test__');
            _available = true;
        } catch (e) {
            _available = false;
            console.warn('⚠️ localStorage bloqueado ou não disponível (Tracking Prevention). Os dados serão mantidos apenas nesta sessão.');
        }
        return _available;
    }

    // Fallback em memória se localStorage não estiver disponível
    const memoryStorage = new Map();

    return {
        getItem(key) {
            if (isAvailable()) {
                try { return localStorage.getItem(key); } catch (e) { return memoryStorage.get(key) || null; }
            }
            return memoryStorage.get(key) || null;
        },

        setItem(key, value) {
            if (isAvailable()) {
                try {
                    localStorage.setItem(key, value);
                    return;
                } catch (e) { /* Fallback to memory */ }
            }
            memoryStorage.set(key, value);
        },

        removeItem(key) {
            if (isAvailable()) {
                try {
                    localStorage.removeItem(key);
                    return;
                } catch (e) { /* Fallback to memory */ }
            }
            memoryStorage.delete(key);
        },

        clear() {
            if (isAvailable()) {
                try {
                    localStorage.clear();
                    return;
                } catch (e) { /* Fallback to memory */ }
            }
            memoryStorage.clear();
        }
    };
})();

// Exportar para uso global
window.safeStorage = safeStorage;
