/* PWA: botão de instalação somente quando o navegador permitir */
(()=>{
 if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));}
 let deferredPrompt=null;
 const btn=document.createElement('button');
 btn.type='button';btn.id='installPwaBtn';btn.textContent='📲 Instalar aplicativo';
 btn.style.cssText='display:none;position:fixed;right:14px;bottom:16px;z-index:10000;background:#0755a6;color:#ffd900;border:2px solid #ffd900;border-radius:12px;padding:12px 16px;font:700 14px sans-serif;box-shadow:0 4px 15px #0005;cursor:pointer';
 document.body.appendChild(btn);
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;btn.style.display='block';});
 btn.addEventListener('click',async()=>{if(!deferredPrompt)return;const p=deferredPrompt;deferredPrompt=null;btn.style.display='none';await p.prompt();});
 window.addEventListener('appinstalled',()=>{deferredPrompt=null;btn.style.display='none';});
})();
