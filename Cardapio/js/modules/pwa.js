export function initPWA() {
  let deferredPrompt = null;
  let registration = null;
  let refreshing = false;
  let connectionTimer = null;

  if (!document.getElementById('ignite-pwa-style')) {
    const link = document.createElement('link');
    link.id = 'ignite-pwa-style';
    link.rel = 'stylesheet';
    link.href = new URL('../../styles/pwa.css', import.meta.url).href;
    document.head.appendChild(link);
  }

  const buttons = [document.querySelector('#install-app'), document.querySelector('#profile-install')].filter(Boolean);
  const badge = document.querySelector('#connection-badge');
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  const setInstallVisibility = () => {
    const installed = isStandalone();
    buttons.forEach((button) => {
      if (button.id === 'install-app') button.hidden = installed || !deferredPrompt;
      else button.hidden = installed;
    });
    document.documentElement.classList.toggle('is-pwa', installed);
  };

  const toast = (icon, title) => {
    if (!window.Swal) return;
    Swal.fire({ toast: true, position: 'top', icon, title, showConfirmButton: false, timer: 2200, timerProgressBar: true });
  };

  const showConnectionBadge = (online) => {
    if (!badge) return;
    clearTimeout(connectionTimer);
    badge.hidden = false;
    badge.className = `connection-badge ${online ? 'is-online' : 'is-offline'}`;
    badge.textContent = online ? 'Conexão restabelecida' : 'Sem internet · usando conteúdo disponível offline';
    if (online) connectionTimer = setTimeout(() => { badge.hidden = true; }, 2600);
  };

  const requestInstall = async () => {
    if (isStandalone()) {
      toast('success', 'Ignite já está instalado');
      return;
    }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => null);
      if (choice?.outcome === 'accepted') deferredPrompt = null;
      setInstallVisibility();
      return;
    }
    if (window.Swal) {
      const text = isIOS
        ? 'No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.'
        : 'Abra o menu do navegador e escolha “Instalar app” ou “Adicionar à tela inicial”.';
      Swal.fire({ icon: 'info', title: 'Instalar Ignite', text, confirmButtonText: 'Entendi' });
    }
  };

  const offerUpdate = async (worker) => {
    if (!worker || !window.Swal) return;
    const result = await Swal.fire({
      icon: 'info',
      title: 'Nova versão disponível',
      text: 'Atualizamos o Ignite. Recarregue para usar a versão mais recente.',
      showCancelButton: true,
      confirmButtonText: 'Atualizar agora',
      cancelButtonText: 'Depois',
      allowOutsideClick: true,
    });
    if (result.isConfirmed) worker.postMessage({ type: 'SKIP_WAITING' });
  };

  const watchRegistration = (reg) => {
    registration = reg;
    if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
      });
    });
  };

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    setInstallVisibility();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    setInstallVisibility();
    toast('success', 'Ignite instalado');
  });

  buttons.forEach((button) => button.addEventListener('click', requestInstall));
  setInstallVisibility();

  const updateConnectionState = () => {
    const online = navigator.onLine;
    const wasOffline = document.documentElement.dataset.wasOffline === 'true';
    document.documentElement.classList.toggle('is-offline', !online);
    if (!online) showConnectionBadge(false);
    else if (wasOffline) showConnectionBadge(true);
    else if (badge) badge.hidden = true;
    document.documentElement.dataset.wasOffline = online ? 'false' : 'true';
  };
  window.addEventListener('offline', updateConnectionState);
  window.addEventListener('online', () => {
    updateConnectionState();
    registration?.update().catch(() => {});
  });
  updateConnectionState();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
        watchRegistration(reg);
        reg.update().catch(() => {});
      } catch (error) {
        console.warn('[PWA] Falha ao registrar Service Worker:', error);
      }
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });

    window.addEventListener('focus', () => registration?.update().catch(() => {}));
    setInterval(() => registration?.update().catch(() => {}), 60 * 60 * 1000);
  }

  return { requestInstall, getRegistration: () => registration };
}
