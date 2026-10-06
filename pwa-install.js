/* V3.12.7.17 — instalação PWA com convite recorrente enquanto não instalado */
(()=>{
  if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=3.12.7.17').catch(console.warn));}
  const standalone=()=>window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true;
  if(standalone()) return;
  let deferredPrompt=null;
  const wrap=document.createElement('div');
  wrap.id='pwaInvite';
  wrap.style.cssText='position:fixed;left:12px;right:12px;bottom:12px;z-index:10000;max-width:520px;margin:auto;background:#063b7a;color:#fff;border:2px solid #ffd21c;border-radius:16px;padding:12px 14px;box-shadow:0 8px 28px #0006;font-family:system-ui,sans-serif;display:flex;gap:10px;align-items:center;';
  wrap.innerHTML='<div style="font-size:26px">📱</div><div style="flex:1;min-width:0"><b style="display:block;color:#ffd21c">Instale a Borracharia do Paizão</b><span style="font-size:12px">Acesso rápido pela tela inicial do celular.</span></div><button type="button" id="pwaInstallAction" style="border:0;border-radius:10px;background:#ffd21c;color:#052f63;font-weight:800;padding:10px 12px">INSTALAR</button><button type="button" id="pwaClose" aria-label="Fechar" style="border:0;background:transparent;color:white;font-size:22px;padding:4px">×</button>';
  document.body.appendChild(wrap);
  const action=wrap.querySelector('#pwaInstallAction');
  const close=wrap.querySelector('#pwaClose');
  close.addEventListener('click',()=>wrap.remove());
  const isiOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const showHelp=()=>{alert(isiOS?'No iPhone/iPad: toque em Compartilhar e depois em “Adicionar à Tela de Início”.':'No Chrome: toque no menu ⋮ e procure “Instalar aplicativo” ou “Adicionar à tela inicial”. Se a instalação automática estiver disponível, volte e toque novamente em INSTALAR.');};
  action.addEventListener('click',async()=>{
    if(!deferredPrompt){showHelp();return;}
    const p=deferredPrompt; deferredPrompt=null; await p.prompt();
  });
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;});
  window.addEventListener('appinstalled',()=>{deferredPrompt=null;wrap.remove();});
})();
