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

let lightboxImages = [];
let lightboxIndex = 0;

function campaignImages(campaign) {
  if (Array.isArray(campaign.images) && campaign.images.length) return campaign.images.filter(Boolean);
  return campaign.imageData ? [campaign.imageData] : [];
}

function openLightbox(images, index = 0) {
  lightboxImages = images;
  lightboxIndex = index;
  const box = document.querySelector("#lightbox");
  box.classList.add("open");
  box.setAttribute("aria-hidden", "false");
  drawLightbox();
}

function drawLightbox() {
  const box = document.querySelector("#lightbox");
  if (!lightboxImages.length) return box.classList.remove("open");
  box.querySelector("img").src = lightboxImages[lightboxIndex];
  box.querySelector(".lb-count").textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
  box.querySelector(".lb-prev").style.display = lightboxImages.length > 1 ? "block" : "none";
  box.querySelector(".lb-next").style.display = lightboxImages.length > 1 ? "block" : "none";
}

function renderCampaign(campaign) {
  const images = campaignImages(campaign);
  const encoded = encodeURIComponent(JSON.stringify(images));
  let media = "";
  if (images.length) {
    if (campaign.link) {
      media = `<a class="cover" href="${esc(campaign.link)}" target="_blank" rel="noopener"><img src="${images[0]}" alt="${esc(campaign.title)}"></a>`;
    } else {
      media = `<div class="gallery" data-images="${encoded}"><button class="gallery-main" type="button" aria-label="Abrir foto em tela cheia"><img src="${images[0]}" alt="${esc(campaign.title)}"><span class="photo-hint">🔍 Ver foto completa${images.length > 1 ? ` • ${images.length} fotos` : ""}</span></button>${images.length > 1 ? `<div class="thumbs">${images.map((src,i)=>`<button class="thumb ${i===0?'active':''}" type="button" data-index="${i}"><img src="${src}" alt="Foto ${i+1}"></button>`).join("")}</div>` : ""}</div>`;
    }
  }

  const message = esc(campaign.message || "").replace(/\n/g, "<br>");
  const validity = campaign.endDate ? `<p class="muted">Válido até ${esc(campaign.endDate)}</p>` : "";
  const button = campaign.link ? `<a class="btn" href="${esc(campaign.link)}" target="_blank" rel="noopener">Ver oferta</a>` : images.length ? `<button class="btn view-photos" type="button" data-images="${encoded}">Ver fotos</button>` : "";

  return `<article class="ad">${media}<div class="body"><span class="tag">${campaign.kind === "external" ? "Publicidade" : "Oferta"}</span><h2>${esc(campaign.title)}</h2><p>${message}</p>${validity}${button}</div></article>`;
}

function bindGalleries() {
  document.querySelectorAll(".gallery").forEach(gallery => {
    const images = JSON.parse(decodeURIComponent(gallery.dataset.images));
    const main = gallery.querySelector(".gallery-main img");
    let active = 0;
    gallery.querySelector(".gallery-main").onclick = () => openLightbox(images, active);
    gallery.querySelectorAll(".thumb").forEach(thumb => thumb.onclick = () => {
      active = Number(thumb.dataset.index);
      main.src = images[active];
      gallery.querySelectorAll(".thumb").forEach(t => t.classList.toggle("active", t === thumb));
    });
  });
  document.querySelectorAll(".view-photos").forEach(button => button.onclick = () => openLightbox(JSON.parse(decodeURIComponent(button.dataset.images)), 0));
}

const lightbox = document.querySelector("#lightbox");
lightbox.querySelector(".lb-close").onclick = () => lightbox.classList.remove("open");
lightbox.querySelector(".lb-prev").onclick = () => { lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length; drawLightbox(); };
lightbox.querySelector(".lb-next").onclick = () => { lightboxIndex = (lightboxIndex + 1) % lightboxImages.length; drawLightbox(); };
lightbox.onclick = event => { if (event.target === lightbox) lightbox.classList.remove("open"); };

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
    bindGalleries();
  } catch (error) {
    console.error("Erro ao carregar marketplace:", error);
    adsEl.innerHTML = `<div class="empty"><strong>Não foi possível carregar as ofertas.</strong><br><span class="muted">${esc(error.message || "Erro desconhecido")}</span></div>`;
  }
}

loadMarketplace();
