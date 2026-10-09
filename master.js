import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const config = {
  apiKey: 'AIzaSyBRu4ytOf2sBsZOE2Ax2P8fvTmA6RccTZg',
  authDomain: 'borracharia-do-paizao.firebaseapp.com',
  projectId: 'borracharia-do-paizao',
  storageBucket: 'borracharia-do-paizao.firebasestorage.app',
  messagingSenderId: '456347885525',
  appId: '1:456347885525:web:72d849f02901ab1e32a75c'
};

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);

const modules = [
  'os',
  'financeiro',
  'estoque',
  'marketing',
  'sorteios'
];

const names = {
  os: 'Ordens de serviço',
  financeiro: 'Financeiro',
  estoque: 'Estoque',
  marketing: 'Marketing',
  sorteios: 'Sorteios'
};

const presets = {
  essencial: ['os'],
  profissional: ['os', 'financeiro', 'estoque'],
  completo: [...modules]
};

let rows = [];
let editId = null;
let authorized = false;

function message(text, error = false) {
  $('message').textContent = text;
  $('message').className = error ? 'error' : '';
}

$('modules').innerHTML = modules.map(m =>
  `<label><input type="checkbox" name="module" value="${m}"> ${names[m]}</label>`
).join('');

function setMods(arr) {
  document.querySelectorAll('[name=module]').forEach(el => {
    el.checked = arr.includes(el.value);
  });
}

$('plan').addEventListener('change', () => {
  setMods(presets[$('plan').value] || []);
});

function textNode(tag, value) {
  const el = document.createElement(tag);
  el.textContent = value ?? '';
  return el;
}

function stat(label, value) {
  const el = document.createElement('div');
  el.className = 'stat';
  el.append(
    textNode('b', String(value)),
    textNode('span', label)
  );
  return el;
}

function resetEditor() {
  editId = null;
  $('tenantForm').reset();
  $('slug').disabled = false;
  $('editorTitle').textContent = 'Cadastrar borracharia';
  setMods(presets.essencial);
  $('editor').hidden = false;
  $('editor').scrollIntoView({ behavior: 'smooth' });
}

$('newBtn').onclick = resetEditor;

$('cancel').onclick = () => {
  $('editor').hidden = true;
};

function render() {
  const stats = $('stats');

  stats.replaceChildren(
    stat('Total de lojas', rows.length),
    stat('Ativas', rows.filter(x => x.status === 'ativa').length),
    stat('Em teste', rows.filter(x => x.status === 'teste').length),
    stat('Suspensas', rows.filter(x => x.status === 'suspensa').length)
  );

  const list = $('list');
  list.replaceChildren();

  for (const x of rows) {
    const box = document.createElement('article');
    box.className = 'card item';

    box.append(
      textNode('h3', x.name || x.id),
      textNode('p', `${x.city || 'Cidade não informada'} • ${x.plan || 'Sem plano'}`),
      textNode('p', `Vencimento: ${x.due || 'Não definido'}`)
    );

    const pill = textNode('span', x.status || 'sem status');
    pill.className = 'pill ' + (x.status || '');
    box.append(pill);

    const btn = textNode('button', 'Editar');
    btn.className = 'secondary';
    btn.style.marginTop = '14px';
    btn.onclick = () => edit(x);

    box.append(
      textNode('p', `Loja: ${x.id}`),
      btn
    );

    list.append(box);
  }
}

function edit(x) {
  editId = x.id;

  $('editorTitle').textContent = 'Editar ' + x.name;
  $('slug').value = x.id;
  $('slug').disabled = true;

  const fields = [
    ['name', 'name'],
    ['owner', 'contactName'],
    ['phone', 'phone'],
    ['city', 'city'],
    ['plan', 'plan'],
    ['status', 'status'],
    ['due', 'due'],
    ['users', 'userLimit']
  ];

  for (const [field, key] of fields) {
    $(field).value = x[key] ?? '';
  }

  setMods(
    Array.isArray(x.modules)
      ? x.modules
      : presets[x.plan] || presets.essencial
  );

  $('editor').hidden = false;
  $('editor').scrollIntoView({ behavior: 'smooth' });
}

async function refresh() {
  const snapshot = await getDocs(
    collection(db, 'masterTenants')
  );

  rows = snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  })).sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );

  render();
}

$('tenantForm').onsubmit = async e => {
  e.preventDefault();

  if (!authorized) {
    message('Acesso Master não autorizado.', true);
    return;
  }

  const id = editId ||
    $('slug').value.trim().toLowerCase();

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    message('Identificador inválido.', true);
    return;
  }

  const data = {
    name: $('name').value.trim(),
    contactName: $('owner').value.trim(),
    phone: $('phone').value.trim(),
    city: $('city').value.trim(),
    plan: $('plan').value,
    status: $('status').value,
    due: $('due').value,
    userLimit: Number($('users').value),
    modules: [
      ...document.querySelectorAll('[name=module]:checked')
    ].map(x => x.value),
    updatedAt: serverTimestamp()
  };

  try {
    message('Salvando...');

    const ref = doc(db, 'masterTenants', id);

    if (editId) {
      await updateDoc(ref, data);
    } else {
      const existing = await getDoc(ref);

      if (existing.exists()) {
        throw new Error(
          'Essa identificação de loja já existe.'
        );
      }

      await setDoc(ref, {
        ...data,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid
      });
    }

    message('Dados salvos com sucesso.');
    $('editor').hidden = true;

    await refresh();

  } catch (err) {
    message('Falha ao salvar: ' + err.message, true);
  }
};

$('loginForm').onsubmit = async e => {
  e.preventDefault();

  try {
    message('Autenticando...');

    await signInWithEmailAndPassword(
      auth,
      $('email').value.trim(),
      $('password').value
    );

  } catch (err) {
    message('Falha no login: ' + err.message, true);
  }
};

$('logout').onclick = async () => {
  try {
    await signOut(auth);
  } catch (err) {
    message('Falha ao sair: ' + err.message, true);
  }
};

onAuthStateChanged(auth, async user => {
  authorized = false;

  $('panel').hidden = true;
  $('logout').hidden = true;
  $('login').hidden = !!user;

  if (!user) {
    message('');
    return;
  }

  try {
    const master = await getDoc(
      doc(db, 'masterAdmins', user.uid)
    );

    if (
      !master.exists() ||
      master.data().active !== true
    ) {
      message(
        'Este usuário não possui autorização Master.',
        true
      );

      await signOut(auth);
      return;
    }

    authorized = true;

    $('login').hidden = true;
    $('panel').hidden = false;
    $('logout').hidden = false;

    message('');

    await refresh();

  } catch (err) {
    message(
      'Falha ao validar acesso Master: ' + err.message,
      true
    );
  }
});
