import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
const p=new URLSearchParams(location.search),tenant=(p.get('loja')||'').toLowerCase().replace(/[^a-z0-9-]/g,'-'),id=p.get('id')||'',el=document.querySelector('#content'),title=document.querySelector('#title');
function esc(v){const d=document.createElement('div');d.textContent=v??'';return d.innerHTML}
function safeUrl(v){try{const u=new URL(String(v||'').trim());return /^https?:$/.test(u.protocol)?u.toString():''}catch{return''}}
(async()=>{try{
 if(!window.FIREBASE_CONFIG?.apiKey)throw new Error('Configuração do Firebase não foi carregada. Confira se firebase-config.js está no GitHub.');
 if(!tenant||!id)throw new Error('Link de divulgação inválido: faltam loja ou identificação da campanha.');
 const app=initializeApp(window.FIREBASE_CONFIG),db=getFirestore(app),ref=doc(db,'tenants',tenant,'publicityPublic',id),snap=await getDoc(ref);
 if(!snap.exists())throw new Error('Divulgação não encontrada. Edite e salve novamente esta campanha no aplicativo para recriar o link público.');
 const c={id,...snap.data()};if(c.active===false)throw new Error('Esta divulgação foi encerrada.');
 title.textContent='🛞 BORRACHARIA DO PAIZÃO';
 let fileData=c.fileData||'';
 if(!fileData&&c.fileChunked){const cs=await getDocs(collection(db,'tenants',tenant,'publicityPublic',id,'chunks'));const parts=cs.docs.map(x=>x.data()).sort((a,b)=>Number(a.index)-Number(b.index)).map(x=>x.data||'');if(parts.length)fileData=`data:${c.fileMime||c.fileType||'application/octet-stream'};base64,${parts.join('')}`}
 const dest=safeUrl(c.destinationUrl),isPdf=(c.fileType||'').includes('pdf')||(c.fileName||'').toLowerCase().endsWith('.pdf');
 let media='';if(fileData){media=isPdf?`<iframe class="pdf" src="${fileData}" title="${esc(c.fileName||'PDF')}"></iframe>`:`<a href="${fileData}" target="_blank" rel="noopener"><img class="media" src="${fileData}" alt="${esc(c.headline||c.title||'Divulgação')}"></a>`}
 const button=dest?`<div class="actions"><a class="btn" href="${esc(dest)}" target="_blank" rel="noopener">${esc(c.buttonText||'ABRIR AGORA')}</a></div>`:(fileData?`<div class="actions"><a class="btn" href="${fileData}" target="_blank" rel="noopener">ABRIR ARQUIVO</a></div>`:'');
 el.innerHTML=`<div class="eyebrow">DIVULGAÇÃO ESPECIAL</div><h2>${esc(c.headline||c.title||'Divulgação')}</h2>${c.introText?`<p class="intro">${esc(c.introText)}</p>`:''}${media}${button}<p class="muted">Borracharia do Paizão</p>`;
}catch(e){console.error(e);el.innerHTML=`<div class="empty"><h2>Não foi possível abrir a divulgação</h2><p>${esc(e.message||e)}</p><p class="muted">Atualize a campanha na aba Divulgação e use o botão Testar link.</p></div>`}})();
