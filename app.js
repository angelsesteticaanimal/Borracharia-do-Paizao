import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserSessionPersistence, deleteUser } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, deleteDoc, onSnapshot, serverTimestamp, query, orderBy } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const qs = s => document.querySelector(s);
const tenant = (new URLSearchParams(location.search).get('loja') || 'demo').toLowerCase().replace(/[^a-z0-9-]/g, '-');
const money = v => Number(v || 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const esc = v => { const d=document.createElement('div'); d.textContent=v ?? ''; return d.innerHTML; };
const statusLabel = s => ({aberta:'Aberta',execucao:'Em execução',concluida:'Concluída'})[s] || s;
const emailFor = username => `${String(username).trim().toLowerCase().replace(/[^a-z0-9._-]/g,'')}.${tenant}@borracharia.app`;

let app, auth, db, session=null, settings={}, orders=[], stock=[], expenses=[], users=[];
let unsubscribers=[];

function show(id){ ['loading','configView','loginView','setupView','appView'].forEach(x=>qs('#'+x)?.classList.add('hidden')); qs('#'+id)?.classList.remove('hidden'); }
function toast(msg){ const e=qs('#toast');e.textContent=msg;e.classList.remove('hidden');setTimeout(()=>e.classList.add('hidden'),2800); }
function configured(){ const c=window.FIREBASE_CONFIG||{}; return c.apiKey && !c.apiKey.includes('COLE_AQUI') && c.projectId && !c.projectId.includes('COLE_AQUI'); }

if(!configured()) show('configView'); else init();

async function init(){
  app=initializeApp(window.FIREBASE_CONFIG); auth=getAuth(app); db=getFirestore(app);
  await setPersistence(auth,browserSessionPersistence);
  qs('#tenantInfo').textContent=`Borracharia: ${tenant}`;
  bindStaticEvents();
  onAuthStateChanged(auth, async user=>{
    clearListeners();
    if(!user){ session=null; await loadPublicBrand(); show('loginView'); return; }
    const profile=await getDoc(doc(db,'tenants',tenant,'users',user.uid));
    if(!profile.exists() || profile.data().active===false){ await signOut(auth); toast('Usuário sem acesso ou bloqueado.'); return; }
    session={uid:user.uid,...profile.data()};
    startRealtime(); show('appView'); buildMenu(); navigate('dashboard');
  });
}

function bindStaticEvents(){
  qs('#showSetupBtn').onclick=()=>show('setupView');
  qs('#backLoginBtn').onclick=()=>show('loginView');
  qs('#loginForm').onsubmit=async e=>{
    e.preventDefault();
    try{ show('loading'); await signInWithEmailAndPassword(auth,emailFor(qs('#loginUser').value),qs('#loginPassword').value); }
    catch(err){ show('loginView'); toast('Usuário ou senha inválidos.'); }
  };
  qs('#setupForm').onsubmit=async e=>{
    e.preventDefault(); const f=new FormData(e.target);
    try{
      show('loading');
      const cred=await createUserWithEmailAndPassword(auth,emailFor(f.get('username')),f.get('password'));
      await setDoc(doc(db,'tenants',tenant),{businessName:f.get('businessName'),phone:'',address:'',primaryColor:'#f59e0b',logoData:'',ownerUid:cred.user.uid,createdAt:serverTimestamp()});
      await setDoc(doc(db,'tenants',tenant,'users',cred.user.uid),{name:f.get('name'),username:String(f.get('username')).toLowerCase(),role:'admin',active:true,createdAt:serverTimestamp()});
      toast('Sistema criado com sucesso.');
    }catch(err){ console.error(err); show('setupView'); toast(err.message==='exists'?'Esta borracharia já existe.':'Não foi possível criar. Verifique as regras e a senha.'); }
  };
  qs('#logoutBtn').onclick=()=>signOut(auth);
}

async function loadPublicBrand(){
  try{ const t=await getDoc(doc(db,'tenants',tenant)); settings=t.exists()?t.data():{businessName:'Controle da Borracharia',primaryColor:'#f59e0b',logoData:''}; applyBrand(); }
  catch{ settings={businessName:'Controle da Borracharia',primaryColor:'#f59e0b',logoData:''}; applyBrand(); }
}
function applyBrand(){
  document.documentElement.style.setProperty('--primary',settings.primaryColor||'#f59e0b');
  qs('#loginBusinessName').textContent=settings.businessName||'Controle da Borracharia';
  qs('#headerBusinessName').textContent=settings.businessName||'Borracharia';
  const has=Boolean(settings.logoData);
  [['#loginLogo','#loginLogoFallback'],['#headerLogo','#headerLogoFallback']].forEach(([i,f])=>{qs(i).classList.toggle('hidden',!has);qs(f).classList.toggle('hidden',has);if(has)qs(i).src=settings.logoData;});
}
function clearListeners(){ unsubscribers.forEach(fn=>fn()); unsubscribers=[]; }
function startRealtime(){
  unsubscribers.push(onSnapshot(doc(db,'tenants',tenant),s=>{settings=s.data()||{};applyBrand();refresh();}));
  unsubscribers.push(onSnapshot(query(collection(db,'tenants',tenant,'orders'),orderBy('createdAt','desc')),s=>{orders=s.docs.map(d=>({id:d.id,...d.data()}));refresh();}));
  unsubscribers.push(onSnapshot(collection(db,'tenants',tenant,'stock'),s=>{stock=s.docs.map(d=>({id:d.id,...d.data()}));refresh();}));
  if(session.role==='admin'){
    unsubscribers.push(onSnapshot(collection(db,'tenants',tenant,'expenses'),s=>{expenses=s.docs.map(d=>({id:d.id,...d.data()}));refresh();}));
    unsubscribers.push(onSnapshot(collection(db,'tenants',tenant,'users'),s=>{users=s.docs.map(d=>({id:d.id,...d.data()}));refresh();}));
  }
  qs('#roleBadge').textContent=session.role==='admin'?'Administrador':'Funcionário';
}
function refresh(){ if(!qs('#appView').classList.contains('hidden')) navigate(currentPage||'dashboard'); }
let currentPage='dashboard';
function buildMenu(){
  const all=[['dashboard','Painel'],['orders','Ordens de serviço'],['newOrder','Nova ordem'],['stock','Estoque'],['cash','Caixa'],['users','Usuários'],['settings','Personalização']];
  const allowed=session.role==='admin'?all:all.filter(([id])=>['dashboard','orders','newOrder','stock'].includes(id));
  qs('#sidebar').innerHTML=allowed.map(([id,l])=>`<button class="nav-btn" data-page="${id}">${l}</button>`).join('');
  qs('#sidebar').querySelectorAll('button').forEach(b=>b.onclick=()=>navigate(b.dataset.page));
}
function navigate(page){
  currentPage=page; document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));
  const target=qs(`#${page}Page`); if(!target)return; target.classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  ({dashboard:renderDashboard,orders:renderOrders,newOrder:renderNewOrder,stock:renderStock,cash:renderCash,users:renderUsers,settings:renderSettings}[page])();
}
function orderDate(o){ return o.createdAt?.toDate?.() || new Date(o.date||Date.now()); }
function ordersTable(list){ if(!list.length)return '<div class="empty">Nenhuma ordem cadastrada.</div>';return `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Cliente</th><th>Veículo</th><th>Serviço</th><th>Valor</th><th>Status</th></tr></thead><tbody>${list.map(o=>`<tr><td>${orderDate(o).toLocaleDateString('pt-BR')}</td><td>${esc(o.customer)}</td><td>${esc(o.vehicle)}<br><span class="muted">${esc(o.plate)}</span></td><td>${esc(o.service)}</td><td>${money(o.value)}</td><td><span class="status status-${o.status}">${statusLabel(o.status)}</span></td></tr>`).join('')}</tbody></table></div>`;}
function renderDashboard(){
  const today=new Date().toDateString(), tod=orders.filter(o=>orderDate(o).toDateString()===today), revenue=tod.filter(o=>o.status==='concluida').reduce((a,o)=>a+Number(o.value||0),0);
  qs('#dashboardPage').innerHTML=`<h1 class="page-title">Painel</h1><div class="grid grid-4"><div class="card"><div class="stat-label">Serviços hoje</div><div class="stat-value">${tod.length}</div></div><div class="card"><div class="stat-label">Faturamento hoje</div><div class="stat-value">${money(revenue)}</div></div><div class="card"><div class="stat-label">Em aberto</div><div class="stat-value">${orders.filter(o=>o.status!=='concluida').length}</div></div><div class="card"><div class="stat-label">Estoque baixo</div><div class="stat-value">${stock.filter(i=>Number(i.qty)<=Number(i.min)).length}</div></div></div><div class="card" style="margin-top:16px"><h3>Últimas ordens</h3>${ordersTable(orders.slice(0,5))}</div>`;
}
function renderOrders(){
  qs('#ordersPage').innerHTML=`<div class="toolbar"><h1 class="page-title">Ordens de serviço</h1><button id="goNewOrder" class="btn btn-primary">Nova ordem</button></div><div class="card">${ordersTable(orders)}</div>${session.role==='admin'?`<div class="card" style="margin-top:16px"><h3>Atualizar status</h3>${orders.map(o=>`<div class="toolbar"><span>${esc(o.customer)} — ${esc(o.plate)}</span><select class="statusSelect" data-id="${o.id}"><option value="aberta" ${o.status==='aberta'?'selected':''}>Aberta</option><option value="execucao" ${o.status==='execucao'?'selected':''}>Em execução</option><option value="concluida" ${o.status==='concluida'?'selected':''}>Concluída</option></select></div>`).join('')||'<div class="empty">Sem ordens.</div>'}</div>`:''}`;
  qs('#goNewOrder').onclick=()=>navigate('newOrder');
  document.querySelectorAll('.statusSelect').forEach(s=>s.onchange=()=>updateDoc(doc(db,'tenants',tenant,'orders',s.dataset.id),{status:s.value,updatedAt:serverTimestamp()}));
}
function renderNewOrder(){
  qs('#newOrderPage').innerHTML=`<h1 class="page-title">Nova ordem de serviço</h1><form id="orderForm" class="card form-grid"><label>Cliente<input name="customer" required></label><label>Telefone<input name="phone"></label><label>Veículo<input name="vehicle" required></label><label>Placa<input name="plate" required></label><label class="full">Serviço<input name="service" required></label><label>Valor<input name="value" type="number" min="0" step="0.01" required></label><label>Pagamento<select name="payment"><option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>A prazo</option></select></label><label>Status<select name="status"><option value="aberta">Aberta</option><option value="execucao">Em execução</option><option value="concluida">Concluída</option></select></label><label class="full">Observações<textarea name="notes"></textarea></label><div class="full"><button class="btn btn-primary">Salvar ordem</button></div></form>`;
  qs('#orderForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);await addDoc(collection(db,'tenants',tenant,'orders'),{customer:f.get('customer'),phone:f.get('phone'),vehicle:f.get('vehicle'),plate:String(f.get('plate')).toUpperCase(),service:f.get('service'),value:Number(f.get('value')),payment:f.get('payment'),status:f.get('status'),notes:f.get('notes'),employee:session.name,createdBy:session.uid,createdAt:serverTimestamp()});toast('Ordem salva online.');navigate('orders');};
}
function renderStock(){
  qs('#stockPage').innerHTML=`<h1 class="page-title">Estoque</h1><div class="card table-wrap"><table><thead><tr><th>Item</th><th>Quantidade</th><th>Mínimo</th><th>Situação</th></tr></thead><tbody>${stock.map(i=>`<tr><td>${esc(i.item)}</td><td>${i.qty}</td><td>${i.min}</td><td>${Number(i.qty)<=Number(i.min)?'<span class="status status-aberta">Baixo</span>':'Normal'}</td></tr>`).join('')}</tbody></table></div><form id="stockForm" class="card form-grid" style="margin-top:16px"><label>Item<input name="item" required></label><label>Quantidade<input name="qty" type="number" required></label><label>Estoque mínimo<input name="min" type="number" required></label><div class="full"><button class="btn btn-primary">Adicionar item</button></div></form>`;
  qs('#stockForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);await addDoc(collection(db,'tenants',tenant,'stock'),{item:f.get('item'),qty:Number(f.get('qty')),min:Number(f.get('min')),createdAt:serverTimestamp()});toast('Item salvo.');};
}
function renderCash(){
  if(session.role!=='admin')return; const rev=orders.filter(o=>o.status==='concluida').reduce((a,o)=>a+Number(o.value||0),0), exp=expenses.reduce((a,x)=>a+Number(x.value||0),0);
  qs('#cashPage').innerHTML=`<h1 class="page-title">Caixa</h1><div class="grid grid-3"><div class="card"><div class="stat-label">Receitas</div><div class="stat-value">${money(rev)}</div></div><div class="card"><div class="stat-label">Despesas</div><div class="stat-value">${money(exp)}</div></div><div class="card"><div class="stat-label">Saldo</div><div class="stat-value">${money(rev-exp)}</div></div></div><form id="expenseForm" class="card form-grid" style="margin-top:16px"><label>Descrição<input name="description" required></label><label>Valor<input name="value" type="number" min="0" step="0.01" required></label><div class="full"><button class="btn btn-primary">Registrar despesa</button></div></form>`;
  qs('#expenseForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);await addDoc(collection(db,'tenants',tenant,'expenses'),{description:f.get('description'),value:Number(f.get('value')),createdAt:serverTimestamp()});toast('Despesa registrada.');};
}
function renderUsers(){
  if(session.role!=='admin')return;
  qs('#usersPage').innerHTML=`<h1 class="page-title">Usuários</h1><div class="card table-wrap"><table><thead><tr><th>Nome</th><th>Usuário</th><th>Perfil</th><th>Status</th><th>Ação</th></tr></thead><tbody>${users.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.username)}</td><td>${u.role==='admin'?'Administrador':'Funcionário'}</td><td>${u.active?'Ativo':'Bloqueado'}</td><td>${u.id===session.uid?'—':`<button class="btn btn-small ${u.active?'btn-danger':'btn-secondary'} toggleUser" data-id="${u.id}" data-active="${u.active}">${u.active?'Bloquear':'Ativar'}</button>`}</td></tr>`).join('')}</tbody></table></div><form id="userForm" class="card form-grid" style="margin-top:16px"><label>Nome<input name="name" required></label><label>Usuário<input name="username" required minlength="3"></label><label>Senha<input name="password" type="password" minlength="6" required></label><label>Perfil<select name="role"><option value="employee">Funcionário</option><option value="admin">Administrador</option></select></label><div class="full"><button class="btn btn-primary">Cadastrar usuário</button></div></form>`;
  qs('#userForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);let secondary;try{secondary=initializeApp(window.FIREBASE_CONFIG,'secondary-'+Date.now());const a=getAuth(secondary);const cred=await createUserWithEmailAndPassword(a,emailFor(f.get('username')),f.get('password'));await setDoc(doc(db,'tenants',tenant,'users',cred.user.uid),{name:f.get('name'),username:String(f.get('username')).toLowerCase(),role:f.get('role'),active:true,createdAt:serverTimestamp()});toast('Usuário criado.');e.target.reset();}catch(err){console.error(err);toast('Não foi possível criar. O usuário pode já existir.');}finally{if(secondary)await deleteApp(secondary);}};
  document.querySelectorAll('.toggleUser').forEach(b=>b.onclick=()=>updateDoc(doc(db,'tenants',tenant,'users',b.dataset.id),{active:b.dataset.active!=='true'}));
}
async function compressLogo(file){
  return new Promise((resolve,reject)=>{const img=new Image(),r=new FileReader();r.onload=()=>img.src=r.result;r.onerror=reject;img.onload=()=>{const max=500,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',0.78));};r.readAsDataURL(file);});
}
function renderSettings(){
  if(session.role!=='admin')return;
  qs('#settingsPage').innerHTML=`<h1 class="page-title">Personalização</h1><form id="settingsForm" class="card form-grid"><label>Nome da borracharia<input name="businessName" value="${esc(settings.businessName)}" required></label><label>Telefone / WhatsApp<input name="phone" value="${esc(settings.phone||'')}"></label><label class="full">Endereço<input name="address" value="${esc(settings.address||'')}"></label><label>Cor principal<input name="primaryColor" type="color" value="${settings.primaryColor||'#f59e0b'}"></label><label>Logomarca JPG ou PNG<input id="logoInput" type="file" accept="image/jpeg,image/png"></label><div class="full"><img id="settingsLogoPreview" class="preview-logo ${settings.logoData?'':'hidden'}" src="${settings.logoData||''}"></div><div class="full toolbar"><button class="btn btn-primary">Salvar personalização</button><button id="removeLogoBtn" class="btn btn-danger" type="button">Remover logomarca</button></div></form><div class="card" style="margin-top:16px"><strong>Link:</strong><br><span class="muted">${location.origin}${location.pathname}?loja=${tenant}</span></div>`;
  let logo=settings.logoData||'';
  qs('#logoInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>5*1024*1024)return toast('Imagem muito grande. Use até 5 MB.');logo=await compressLogo(f);qs('#settingsLogoPreview').src=logo;qs('#settingsLogoPreview').classList.remove('hidden');};
  qs('#removeLogoBtn').onclick=()=>{logo='';qs('#settingsLogoPreview').classList.add('hidden');};
  qs('#settingsForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);await updateDoc(doc(db,'tenants',tenant),{businessName:f.get('businessName'),phone:f.get('phone'),address:f.get('address'),primaryColor:f.get('primaryColor'),logoData:logo,updatedAt:serverTimestamp()});toast('Personalização salva online.');};
}
