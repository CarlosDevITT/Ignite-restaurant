export function initPWA() {
  let deferredPrompt = null;
  let registration = null;
  let refreshing = false;
  let connectionTimer = null;
  let launchShownAt = 0;

  const params = new URLSearchParams(location.search);
  const isIOSStandalone = () => window.navigator.standalone === true;
  const isDisplayMode = (mode) => window.matchMedia?.(`(display-mode: ${mode})`).matches === true;
  const isAppMode = () =>
    isIOSStandalone() ||
    isDisplayMode('standalone') ||
    isDisplayMode('minimal-ui') ||
    isDisplayMode('fullscreen') ||
    params.get('source') === 'pwa';
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  if (!document.getElementById('ignite-pwa-critical')) {
    const style = document.createElement('style');
    style.id = 'ignite-pwa-critical';
    style.textContent = `
      .pwa-launch{position:fixed;z-index:30000;inset:0;display:grid;place-items:center;overflow:hidden;padding:max(22px,env(safe-area-inset-top)) max(22px,env(safe-area-inset-right)) max(22px,env(safe-area-inset-bottom)) max(22px,env(safe-area-inset-left));background:radial-gradient(circle at 50% 22%,rgba(7,156,85,.26),transparent 34%),radial-gradient(circle at 80% 88%,rgba(255,99,50,.13),transparent 28%),#07110c;color:#fff;transition:opacity .32s ease,visibility .32s ease}.pwa-launch[hidden]{display:none!important}.pwa-launch.is-leaving{opacity:0;visibility:hidden}.pwa-launch__inner{width:min(86vw,360px);display:grid;justify-items:center;text-align:center}.pwa-launch__logo{width:118px;height:118px;display:grid;place-items:center;overflow:hidden;border:1px solid rgba(255,255,255,.12);border-radius:32px;background:rgba(255,255,255,.06);box-shadow:0 22px 60px rgba(0,0,0,.32),inset 0 1px rgba(255,255,255,.08)}.pwa-launch__logo img{width:100%;height:100%;object-fit:cover}.pwa-launch__brand{margin:24px 0 0;font:900 clamp(30px,9vw,42px)/1 system-ui,sans-serif;letter-spacing:.14em;color:#fff}.pwa-launch__brand span{color:#ff6332}.pwa-launch__copy{margin:10px 0 0;color:#d5dfd9;font-size:.83rem;font-weight:600}.pwa-launch__progress{position:relative;width:min(180px,54vw);height:3px;overflow:hidden;margin-top:28px;border-radius:99px;background:rgba(255,255,255,.1)}.pwa-launch__progress::after{content:'';position:absolute;inset:0 auto 0 0;width:42%;border-radius:inherit;background:linear-gradient(90deg,#079c55,#20d477);animation:pwaLaunchProgress 1s ease-in-out infinite alternate}.pwa-launch__status{margin-top:11px;color:#9aaba1;font-size:.67rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}@keyframes pwaLaunchProgress{from{transform:translateX(-70%)}to{transform:translateX(210%)}}
    `;
    document.head.appendChild(style);
  }

  if (!document.getElementById('ignite-pwa-style')) {
    const link = document.createElement('link');
    link.id = 'ignite-pwa-style';
    link.rel = 'stylesheet';
    link.href = new URL('../../styles/pwa.css', import.meta.url).href;
    document.head.appendChild(link);
  }

  let launch = document.querySelector('#pwa-launch');
  if (!launch) {
    launch = document.createElement('div');
    launch.id = 'pwa-launch';
    launch.className = 'pwa-launch';
    launch.setAttribute('role', 'status');
    launch.setAttribute('aria-live', 'polite');
    launch.innerHTML = `
      <div class="pwa-launch__inner">
        <div class="pwa-launch__logo"><img src="../../assets/images/logos/ignite2.png" alt="Ignite"></div>
        <div class="pwa-launch__brand">IGNITE<span>.</span></div>
        <p class="pwa-launch__copy">Cardápio · Pedidos · Ignite Play</p>
        <div class="pwa-launch__progress" aria-hidden="true"></div>
        <span class="pwa-launch__status">Preparando sua experiência</span>
      </div>`;
    document.body.prepend(launch);
  }

  const buttons = [document.querySelector('#install-app'), document.querySelector('#profile-install')].filter(Boolean);
  const badge = document.querySelector('#connection-badge');

  const setInstallVisibility = () => {
    const installed = isAppMode();
    buttons.forEach((button) => {
      if (button.id === 'install-app') button.hidden = installed || !deferredPrompt;
      else button.hidden = installed;
    });
    document.documentElement.classList.toggle('is-pwa', installed);
  };

  const showLaunch = () => {
    if (!launch) return;
    launchShownAt = performance.now();
    launch.hidden = false;
    launch.classList.remove('is-leaving');
    launch.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('pwa-launch-active');
  };

  const markReady = async () => {
    if (!launch || launch.hidden) return;
    const elapsed = performance.now() - launchShownAt;
    const minimumVisible = 1200;
    if (elapsed < minimumVisible) await new Promise((resolve) => setTimeout(resolve, minimumVisible - elapsed));
    launch.classList.add('is-leaving');
    launch.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('pwa-launch-active');
    document.documentElement.classList.add('pwa-ready');
    setTimeout(() => { launch.hidden = true; }, 360);
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
    if (isAppMode()) {
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

  showLaunch();

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

  return { requestInstall, markReady, getRegistration: () => registration };
}
