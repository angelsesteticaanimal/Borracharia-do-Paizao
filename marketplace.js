import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const params = new URLSearchParams(location.search);
const tenant = (params.get("loja") || "demo")
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, "-");

const adsEl = document.querySelector("#ads");
const titleEl = document.querySelector("#title");

function esc(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function campaignIsActive(campaign) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = parseDate(campaign.startDate);
  const end = parseDate(campaign.endDate);
  if (end) end.setHours(23, 59, 59, 999);

  return campaign.status === "active"
    && campaign.paid !== false
    && (!start || today >= start)
    && (!end || today <= end);
}

function renderCampaign(campaign) {
  const image = campaign.imageData
    ? `<img src="${campaign.imageData}" alt="${esc(campaign.title)}">`
    : "";

  const cover = campaign.link
    ? `<a class="cover" href="${esc(campaign.link)}" target="_blank" rel="noopener">${image}</a>`
    : image;

  const message = esc(campaign.message || "").replace(/\n/g, "<br>");
  const validity = campaign.endDate
    ? `<p class="muted">Válido até ${esc(campaign.endDate)}</p>`
    : "";
  const button = campaign.link
    ? `<a class="btn" href="${esc(campaign.link)}" target="_blank" rel="noopener">Ver oferta</a>`
    : "";

  return `<article class="ad">
    ${cover}
    <div class="body">
      <span class="tag">${campaign.kind === "external" ? "Publicidade" : "Oferta"}</span>
      <h2>${esc(campaign.title)}</h2>
      <p>${message}</p>
      ${validity}
      ${button}
    </div>
  </article>`;
}

async function loadMarketplace() {
  try {
    if (!window.FIREBASE_CONFIG) {
      throw new Error("Configuração do Firebase não encontrada.");
    }

    const app = initializeApp(window.FIREBASE_CONFIG);
    const db = getFirestore(app);

    const tenantSnap = await getDoc(doc(db, "tenants", tenant));
    const brand = tenantSnap.exists() ? tenantSnap.data() : {};

    document.documentElement.style.setProperty("--p", brand.primaryColor || "#f59e0b");
    titleEl.textContent = brand.businessName
      ? `Ofertas — ${brand.businessName}`
      : "Marketplace de Ofertas";

    const snap = await getDocs(collection(db, "tenants", tenant, "marketplaceCampaigns"));
    const campaigns = snap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter(campaignIsActive)
      .sort((a, b) => String(b.createdAt?.seconds || 0).localeCompare(String(a.createdAt?.seconds || 0)));

    adsEl.innerHTML = campaigns.length
      ? campaigns.map(renderCampaign).join("")
      : '<div class="empty">Nenhuma oferta ativa no momento.</div>';
  } catch (error) {
    console.error("Erro ao carregar marketplace:", error);
    adsEl.innerHTML = `<div class="empty"><strong>Não foi possível carregar as ofertas.</strong><br><span class="muted">${esc(error.message || "Erro desconhecido")}</span></div>`;
  }
}

loadMarketplace();
