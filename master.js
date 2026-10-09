import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import {getFirestore,doc,getDoc,collection,getDocs} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-functions.js';
const $=id=>document.getElementById(id),modules=['os','financeiro','estoque','marketing','sorteios'],names={os:'Ordens de serviço',financeiro:'Financeiro',estoque:'Estoque',marketing:'Marketing',sorteios:'Sorteios'};
const presets={essencial:['os'],profissional:['os','financeiro','estoque'],completo:[...modules]};
const message=(s,error=false)=>{$('message').textContent=s;$('message').className=error?'error':'';};
let auth,db,functions,rows=[],editId=null,authorized=false,inviteId='';
const baseUrl=()=>new URL('./',location.href).href;
const shopUrl=id=>`${baseUrl()}?loja=${encodeURIComponent(id)}`;
const validSlug=id=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)&&id.length<=60;
const validUser=id=>/^[a-z0-9._-]{3,40}$/.test(id);
$('modules').innerHTML=modules.map(m=>`<label><input type="checkbox" name="module" value="${m}"> ${names[m]}</label>`).join('');
const setMods=arr=>document.querySelectorAll('[name=module]').forEach(e=>e.checked=arr.includes(e.value));
$('plan').addEventListener('change',()=>setMods(presets[$('plan').value]));
$('slug').addEventListener('input',e=>{if(!editId)e.target.value=e.target.value.toLowerCase().trim().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');});
$('adminUser').addEventListener('input',e=>e.target.value=e.target.value.toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9._-]/g,''));
function textNode(tag,value){const el=document.createElement(tag);el.textContent=value??'';return el;}
function stat(label,value){const el=document.createElement('div');el.className='stat';el.append(textNode('b',String(value)),textNode('span',label));return el;}
function resetEditor(){editId=null;$('tenantForm').reset();$('slug').disabled=false;$('adminFields').hidden=false;$('adminUser').required=true;$('adminPassword').required=true;$('editorTitle').textContent='Cadastrar borracharia';setMods(presets.essencial);$('editor').hidden=false;$('editor').scrollIntoView({behavior:'smooth'});}
$('newBtn').onclick=resetEditor;$('cancel').onclick=()=>{$('editor').hidden=true;};
function showInvite(id){inviteId=id;const url=shopUrl(id);$('invite').hidden=false;$('inviteText').textContent=url;$('qrArea').hidden=true;$('invite').scrollIntoView({behavior:'smooth'});}
async function copy(text){try{await navigator.clipboard.writeText(text);message('Link copiado.');}catch{prompt('Copie o link:',text);}}
$('copyInvite').onclick=()=>copy(shopUrl(inviteId));
$('sendInvite').onclick=()=>{const x=rows.find(x=>x.id===inviteId);const text=`Olá! Seu aplicativo ${x?.name||'da borracharia'} está disponível em:\n${shopUrl(inviteId)}\n\nAbra no Chrome e escolha Instalar aplicativo ou Adicionar à tela inicial. Entre com o usuário e a senha inicial recebidos separadamente.`;const phone=(x?.phone||'').replace(/\D/g,'');const number=phone?(phone.startsWith('55')?phone:'55'+phone):'';window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`,'_blank','noopener');};
$('showQr').onclick=()=>{$('qrImage').src=`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shopUrl(inviteId))}`;$('qrArea').hidden=false;};
function render(){const s=$('stats');s.replaceChildren(stat('Total de lojas',rows.length),stat('Ativas',rows.filter(x=>x.status==='ativa').length),stat('Em teste',rows.filter(x=>x.status==='teste').length),stat('Suspensas',rows.filter(x=>x.status==='suspensa').length));const list=$('list');list.replaceChildren();for(const x of rows){const box=document.createElement('article');box.className='card item';box.append(textNode('h3',x.name||x.id),textNode('p',`${x.city||'Cidade não informada'} • ${x.plan||'Sem plano'}`),textNode('p',`Vencimento: ${x.due||'Não definido'}`));const pill=textNode('span',x.status||'sem status');pill.className='pill '+(x.status||'');box.append(pill,textNode('p',`Loja: ${x.id}`));const actions=document.createElement('div');actions.className='actions';const editBtn=textNode('button','Editar');editBtn.className='secondary';editBtn.onclick=()=>edit(x);const copyBtn=textNode('button','Copiar link');copyBtn.className='secondary';copyBtn.onclick=()=>copy(shopUrl(x.id));const waBtn=textNode('button','WhatsApp');waBtn.onclick=()=>{showInvite(x.id);$('sendInvite').click();};const resetBtn=textNode('button','Redefinir senha');resetBtn.className='secondary';resetBtn.onclick=()=>resetPassword(x);const qrBtn=textNode('button','QR Code');qrBtn.className='secondary';qrBtn.onclick=()=>{showInvite(x.id);$('showQr').click();};actions.append(editBtn,copyBtn,waBtn,qrBtn,resetBtn);box.append(actions);list.append(box);}}
async function resetPassword(x){
 if(!authorized||!confirm(`Gerar um link para ${x.contactName||'o administrador'} definir uma nova senha da loja ${x.name||x.id}?\n\nO link é confidencial e deverá ser enviado somente ao responsável.`))return;
 try{
  message('Gerando link seguro de redefinição...');
  const fn=httpsCallable(functions,'masterResetAdminPassword');
  const result=await fn({slug:x.id});
  const {resetLink,adminUsername}=result.data||{};
  if(!resetLink)throw new Error('Link não recebido.');
  const body=`Olá! Para cadastrar uma nova senha de administrador da ${x.name||'borracharia'}, abra este link de uso único (com validade limitada):\n${resetLink}\n\nSeu usuário: ${adminUsername||'consulte o administrador'}\n\nNão compartilhe este link. Se você não solicitou, avise o responsável.`;
  const phone=(x.phone||'').replace(/\D/g,'');
  const number=phone?(phone.startsWith('55')?phone:'55'+phone):'';
  const url=`https://wa.me/${number}?text=${encodeURIComponent(body)}`;
  message('Link gerado. O WhatsApp será aberto com a mensagem. Confira o destinatário antes de enviar.');
  const opened=window.open(url,'_blank','noopener');
  if(!opened){const ok=confirm('O navegador bloqueou o WhatsApp. Copiar a mensagem para enviar manualmente?');if(ok)await copy(body);}
 }catch(e){console.error(e);message('Não foi possível redefinir: '+(e.message||'erro desconhecido'),true);}
}
function edit(x){editId=x.id;$('editorTitle').textContent='Editar '+x.name;$('slug').value=x.id;$('slug').disabled=true;$('adminFields').hidden=true;$('adminUser').required=false;$('adminPassword').required=false;for(const [field,key] of [['name','name'],['owner','contactName'],['phone','phone'],['city','city'],['plan','plan'],['status','status'],['due','due'],['users','userLimit']])$(field).value=x[key]??'';setMods(Array.isArray(x.modules)?x.modules:presets[x.plan]||presets.essencial);$('editor').hidden=false;$('editor').scrollIntoView({behavior:'smooth'});}
async function refresh(){const snapshot=await getDocs(collection(db,'tenants'));rows=snapshot.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||'').localeCompare(b.name||''));render();}
$('tenantForm').onsubmit=async e=>{e.preventDefault();if(!authorized)return;const id=editId||$('slug').value.trim().toLowerCase();if(!validSlug(id)){message('Identificador: use letras minúsculas, números e hífens, sem hífen no início ou no fim.',true);return;}const data={name:$('name').value.trim(),contactName:$('owner').value.trim(),phone:$('phone').value.trim(),city:$('city').value.trim(),plan:$('plan').value,status:$('status').value,due:$('due').value,userLimit:Number($('users').value),modules:[...document.querySelectorAll('[name=module]:checked')].map(x=>x.value)};const user=$('adminUser').value.trim(),password=$('adminPassword').value;if(!editId&&(!validUser(user)||password.length<8)){message('Usuário: 3 a 40 caracteres minúsculos, números, ponto, hífen ou sublinhado. Senha: mínimo 8 caracteres.',true);return;}const submit=e.target.querySelector('[type=submit]');submit.disabled=true;try{message(editId?'Atualizando loja...':'Criando loja e administrador...');const fn=httpsCallable(functions,editId?'masterUpdateTenant':'masterCreateTenant');await fn(editId?{slug:id,...data}:{slug:id,...data,adminUsername:user,adminPassword:password});message(editId?'Loja atualizada.':'Loja e administrador criados. Envie o usuário e a senha inicial ao cliente por um canal seguro.');$('editor').hidden=true;await refresh();showInvite(id);}catch(err){console.error(err);message('Falha: '+(err.message||'Verifique se as Cloud Functions foram publicadas.'),true);}finally{submit.disabled=false;}};
$('loginForm').onsubmit=async e=>{e.preventDefault();try{message('Autenticando...');await signInWithEmailAndPassword(auth,$('email').value,$('password').value);}catch(e){message('Falha no login: '+e.message,true);}};
$('logout').onclick=()=>signOut(auth);
try{const config=window.firebaseConfig;if(!config?.apiKey)throw new Error('firebase-config.js não encontrado ou inválido.');const app=initializeApp(config);auth=getAuth(app);db=getFirestore(app);functions=getFunctions(app,'us-central1');onAuthStateChanged(auth,async user=>{authorized=false;$('panel').hidden=true;$('logout').hidden=true;$('login').hidden=!user;if(!user){message('');return;}try{const master=await getDoc(doc(db,'masterAdmins',user.uid));if(!master.exists()||master.data().active!==true){message('Este usuário não possui autorização Master.',true);await signOut(auth);return;}authorized=true;$('login').hidden=true;$('panel').hidden=false;$('logout').hidden=false;message('');await refresh();}catch(e){message('Falha ao validar acesso Master: '+e.message,true);await signOut(auth);}});}catch(e){message('Configuração necessária: '+e.message,true);}
