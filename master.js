import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut,sendPasswordResetEmail} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import {getFirestore,doc,getDoc,collection,getDocs,setDoc,updateDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
const $=id=>document.getElementById(id);
const modules=['os','financeiro','estoque','marketing','sorteios'];
const names={os:'Ordens de serviço',financeiro:'Financeiro',estoque:'Estoque',marketing:'Marketing',sorteios:'Sorteios'};
const presets={essencial:['os'],profissional:['os','financeiro','estoque'],completo:[...modules]};
const message=(s,error=false)=>{$('message').textContent=s;$('message').className=error?'error':'';};
let auth,db,rows=[],editId=null,authorized=false,inviteId='';
const baseUrl=()=>new URL('./',location.href).href;
const shopUrl=id=>`${baseUrl()}?loja=${encodeURIComponent(id)}`;
const validSlug=id=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)&&id.length>=3&&id.length<=60;
$('modules').innerHTML=modules.map(m=>`<label><input type="checkbox" name="module" value="${m}"> ${names[m]}</label>`).join('');
const setMods=arr=>document.querySelectorAll('[name=module]').forEach(e=>e.checked=arr.includes(e.value));
$('plan').addEventListener('change',()=>setMods(presets[$('plan').value]));
$('slug').addEventListener('input',e=>{if(!editId)e.target.value=e.target.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');});
function textNode(tag,value){const el=document.createElement(tag);el.textContent=value??'';return el;}
function stat(label,value){const el=document.createElement('div');el.className='stat';el.append(textNode('b',String(value)),textNode('span',label));return el;}
function resetEditor(){editId=null;$('tenantForm').reset();$('slug').disabled=false;$('editorTitle').textContent='Cadastrar borracharia';setMods(presets.essencial);$('editor').hidden=false;$('editor').scrollIntoView({behavior:'smooth'});}
$('newBtn').onclick=resetEditor;
$('cancel').onclick=()=>{$('editor').hidden=true;};
function showInvite(id){inviteId=id;const x=rows.find(x=>x.id===id);$('invite').hidden=false;$('inviteText').textContent=shopUrl(id);$('inviteAdmin').textContent=`Administrador: ${x?.adminEmail||'E-mail ainda não cadastrado'} • UID: ${x?.adminUid||'não informado'}`;$('qrArea').hidden=true;$('invite').scrollIntoView({behavior:'smooth'});}
async function copy(t){try{await navigator.clipboard.writeText(t);message('Copiado.');}catch{prompt('Copie:',t);}}
$('copyInvite').onclick=()=>copy(shopUrl(inviteId));
function whatsapp(x,body){const digits=(x?.phone||'').replace(/\D/g,'');const phone=digits?(digits.startsWith('55')?digits:'55'+digits):'';window.open(`https://wa.me/${phone}?text=${encodeURIComponent(body)}`,'_blank','noopener');}
$('sendInvite').onclick=()=>{const x=rows.find(x=>x.id===inviteId);if(!x)return;whatsapp(x,`Olá! Seu aplicativo ${x.name||'da borracharia'} está disponível:\n${shopUrl(x.id)}\n\nLogin: ${x.adminEmail||'(solicite seu e-mail de acesso)'}\nAbra no Chrome e escolha Instalar aplicativo ou Adicionar à tela inicial. Por segurança, a senha não é enviada nesta mensagem.`);};
$('showQr').onclick=()=>{$('qrImage').src=`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shopUrl(inviteId))}`;$('qrArea').hidden=false;};
$('resetInvite').onclick=()=>{const x=rows.find(x=>x.id===inviteId);if(x)resetPassword(x);};
function render(){const s=$('stats');s.replaceChildren(stat('Total de lojas',rows.length),stat('Ativas',rows.filter(x=>x.status==='ativa').length),stat('Em teste',rows.filter(x=>x.status==='teste').length),stat('Suspensas',rows.filter(x=>x.status==='suspensa').length));const list=$('list');list.replaceChildren();for(const x of rows){const box=document.createElement('article');box.className='card item';box.append(textNode('h3',x.name||x.id),textNode('p',`${x.city||'Cidade não informada'} • ${x.plan||'Sem plano'}`),textNode('p',`Vencimento: ${x.due||'Não definido'}`));const pill=textNode('span',x.status||'sem status');pill.className='pill '+(x.status||'');box.append(pill,textNode('p',`Loja: ${x.id}`),textNode('p',`Administrador: ${x.adminEmail||'Não configurado'}`));const actions=document.createElement('div');actions.className='actions';const make=(name,fn,secondary=true)=>{const b=textNode('button',name);b.type='button';if(secondary)b.className='secondary';b.onclick=fn;actions.append(b);};make('Editar',()=>edit(x));make('Copiar link',()=>copy(shopUrl(x.id)));make('WhatsApp',()=>whatsapp(x,`Olá! Acesse ${x.name||'sua borracharia'} em:\n${shopUrl(x.id)}\nLogin: ${x.adminEmail||'(a confirmar)'}`),false);make('QR Code',()=>{showInvite(x.id);$('showQr').click();});make('Redefinir senha',()=>resetPassword(x));box.append(actions);list.append(box);}}
async function resetPassword(x){if(!authorized)return;if(!x.adminEmail){message('Primeiro informe o e-mail do administrador em Editar.',true);return;}if(!confirm(`Enviar um e-mail de redefinição de senha para ${x.adminEmail}?\n\nO cliente receberá o link por e-mail, não pelo WhatsApp.`))return;try{await sendPasswordResetEmail(auth,x.adminEmail);message('Solicitação enviada ao Firebase. Confira a caixa de entrada e o spam. Por privacidade, o envio não confirma que o e-mail existe.');}catch(e){message('Falha ao solicitar redefinição: '+e.message,true);}}
function edit(x){editId=x.id;$('editorTitle').textContent='Editar '+x.name;$('slug').value=x.id;$('slug').disabled=true;for(const [field,key] of [['name','name'],['owner','contactName'],['phone','phone'],['city','city'],['plan','plan'],['status','status'],['due','due'],['users','userLimit'],['adminEmail','adminEmail'],['adminUid','adminUid']])$(field).value=x[key]??'';setMods(Array.isArray(x.modules)?x.modules:presets[x.plan]||presets.essencial);$('editor').hidden=false;$('editor').scrollIntoView({behavior:'smooth'});}
async function refresh(){const snapshot=await getDocs(collection(db,'masterTenants'));rows=snapshot.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||'').localeCompare(b.name||''));render();}
$('tenantForm').onsubmit=async e=>{e.preventDefault();if(!authorized)return;const id=editId||$('slug').value.trim().toLowerCase();if(!validSlug(id)){message('Identificador inválido: use letras minúsculas, números e hífens.',true);return;}const adminEmail=$('adminEmail').value.trim().toLowerCase();const adminUid=$('adminUid').value.trim();if(!adminEmail||!$('adminEmail').checkValidity()){message('Informe um e-mail válido.',true);return;}const data={name:$('name').value.trim(),contactName:$('owner').value.trim(),phone:$('phone').value.trim(),city:$('city').value.trim(),plan:$('plan').value,status:$('status').value,due:$('due').value,userLimit:Number($('users').value),modules:[...document.querySelectorAll('[name=module]:checked')].map(x=>x.value),adminEmail,adminUid,updatedAt:serverTimestamp()};const submit=e.target.querySelector('[type=submit]');submit.disabled=true;try{message('Salvando cadastro administrativo...');if(editId){await updateDoc(doc(db,'masterTenants',id),data);}else{if((await getDoc(doc(db,'masterTenants',id))).exists())throw new Error('Identificador já existe.');await setDoc(doc(db,'masterTenants',id),{...data,createdAt:serverTimestamp(),createdBy:auth.currentUser.uid});}message('Cadastro administrativo salvo. ATENÇÃO: confirme o usuário no Firebase Authentication, o vínculo de permissões e a loja operacional antes de enviar ao cliente.');$('editor').hidden=true;await refresh();showInvite(id);}catch(err){message('Falha ao salvar: '+err.message,true);}finally{submit.disabled=false;}};
$('loginForm').onsubmit=async e=>{e.preventDefault();if(!auth){message('Firebase não inicializado. Verifique a configuração.',true);return;}try{message('Autenticando...');await signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value);}catch(err){message('Falha no login: '+(err.code||err.message),true);}};
$('logout').onclick=()=>signOut(auth);
try{
  const config=window.FIREBASE_CONFIG || window.firebaseConfig;
  if(!config?.apiKey || !config?.projectId)throw new Error('firebase-config.js ausente ou inválido.');
  const app=initializeApp(config);auth=getAuth(app);db=getFirestore(app);
  onAuthStateChanged(auth,async user=>{
    authorized=false;$('panel').hidden=true;$('logout').hidden=true;$('login').hidden=false;
    if(!user){if(!$('message').classList.contains('error'))message('');return;}
    message('Verificando autorização Master...');
    try{
      const master=await getDoc(doc(db,'masterAdmins',user.uid));
      if(!master.exists() || master.data().active!==true){
        message('Conta autenticada, mas sem autorização Master. Verifique masterAdmins/UID e as regras do Firestore.',true);
        await signOut(auth);return;
      }
      authorized=true;$('login').hidden=true;$('panel').hidden=false;$('logout').hidden=false;
      message('Carregando borracharias...');
      try{await refresh();message('');}
      catch(err){message('Login Master confirmado, mas não foi possível listar as lojas: '+(err.code||err.message)+'. Verifique as regras masterTenants.',true);}
    }catch(err){
      message('Falha ao validar acesso Master: '+(err.code||err.message)+'. Verifique as regras masterAdmins.',true);
      await signOut(auth);
    }
  },err=>message('Erro de sessão Firebase: '+(err.code||err.message),true));
}catch(err){message('Configuração necessária: '+err.message,true);}
