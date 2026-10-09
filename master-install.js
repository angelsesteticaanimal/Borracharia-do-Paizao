// A instalação requer interação do usuário e autorização do navegador.
(() => {
  const btn = document.getElementById('installMaster');
  const banner = document.getElementById('installBanner');
  let deferredPrompt = null;
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone()) banner.hidden = true;
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./master-sw.js', {scope:'./master.html'})
        .catch(err => console.warn('Painel Master: service worker não registrado', err));
    });
  }
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); deferredPrompt = e;
    btn.textContent = 'Instalar Painel Master';
  });
  window.addEventListener('appinstalled', () => {deferredPrompt=null;banner.hidden=true;});
  btn.addEventListener('click', async () => {
    if (standalone()) {banner.hidden=true;return;}
    if (deferredPrompt) {
      const prompt = deferredPrompt; deferredPrompt = null;
      await prompt.prompt();
      await prompt.userChoice;
      return;
    }
    alert('No Chrome do Android: toque nos três pontinhos (⋮) e escolha "Adicionar à tela inicial" ou "Instalar aplicativo". Se o Painel Master já estiver instalado, abra pelo ícone.');
  });
})();
