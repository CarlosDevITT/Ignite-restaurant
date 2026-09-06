export function initPWA() {
  let deferredPrompt = null;
  const buttons = [document.querySelector('#install-app'), document.querySelector('#profile-install')];

  const requestInstall = async () => {
    if (!deferredPrompt) { Swal.fire({ icon: 'info', title: 'Instalação do app', text: 'No navegador, abra o menu e escolha “Adicionar à tela inicial”.' }); return; }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    buttons.forEach((button) => { if (button) button.hidden = true; });
  };

  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredPrompt = event; const headerButton = document.querySelector('#install-app'); if (headerButton) headerButton.hidden = false; });
  document.querySelector('#install-app').addEventListener('click', requestInstall);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((error) => console.warn('[PWA]', error)));
  }
  return { requestInstall };
}
