const $ = (id) => document.getElementById(id);
const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const vid = (u) => `<video src="${esc(u)}" controls playsinline preload="metadata"></video>`;
let S = {}, P = [], R = [], cur = "All", pick = null, cartMode = false, reelMuted = true, rlObs = null;
const store = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
let WISH = store("wish", []), CART = store("cart", {});
const heartBtn = (id) => `<button class="heart${WISH.includes(id) ? " on" : ""}" data-w="${id}" aria-label="Save to wishlist">♥</button>`;
const thumb = (p) => (p.images[0] ? `<img src="${esc(p.images[0])}" alt="">` : "");
const stars = (n) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
const avg = (l) => (l.length ? l.reduce((a, x) => a + x.rating, 0) / l.length : 0);
const forP = (id) => R.filter((x) => x.productId === id);
const rate = (id) => { const l = forP(id); return l.length ? `<div class="rate"><span class="st">${stars(avg(l))}</span> ${avg(l).toFixed(1)} (${l.length})</div>` : ""; };
const revCard = (r) => { const p = P.find((x) => x.id === r.productId); return `
  <figure class="rev">${r.video ? vid(r.video) : r.photo ? `<img src="${esc(r.photo)}" alt="Photo from ${esc(r.name)}" loading="lazy">` : ""}
    <div class="rb"><div class="st">${stars(r.rating)}</div><blockquote>${esc(r.text)}</blockquote>
    <figcaption><strong>${esc(r.name)}</strong>${r.city ? ", " + esc(r.city) : ""}${p ? "<br>Saree: " + esc(p.name) : ""}</figcaption></div></figure>`; };
const wa = (t) => `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(t)}`;

async function load() {
  const get = (n, d) => fetch("/api/" + n).then((r) => r.json()).catch(() => d);
  [S, P, R] = await Promise.all([get("settings", {}), get("products", []), get("reviews", [])]);
  head(); draw(); reviews(); cats(); offers(); reelsRow(); help(); counts();
}

function head() {
  const n = S.shopName || "Saree Shop";
  document.title = n;
  $("brand").textContent = n;
  $("foot").textContent = "© 2026 " + n;
  $("logo").hidden = !S.logo; if (S.logo) $("logo").src = S.logo;
  $("ownerPhoto").hidden = !S.ownerPhoto; if (S.ownerPhoto) $("ownerPhoto").src = S.ownerPhoto;
  $("ownerName").textContent = S.ownerName ? "Meet " + S.ownerName : "";
  $("tagline").textContent = S.tagline || "Handpicked sarees, delivered across India";
  $("about").textContent = S.about || "";
  $("deliveryText").textContent = S.deliveryText || "Buy on this website and we deliver to your door, anywhere in India.";
  $("introBox").innerHTML = S.introVideo ? vid(S.introVideo) : "";
  $("delVid").innerHTML = S.deliveryVideo ? vid(S.deliveryVideo) : "";
  const L = [["Instagram", S.instagram], ["Facebook", S.facebook], ["YouTube", S.youtube], ["Google", S.google],
    ["WhatsApp", S.whatsapp && wa("Hi, I'd like to know more about your sarees.")]].filter((x) => x[1]);
  const h = L.map(([a, b]) => `<a class="soc ${a}" href="${esc(b)}" target="_blank" rel="noopener">${a}</a>`).join("");
  $("social").innerHTML = h; $("social2").innerHTML = h || '<p class="sub">Contact links will appear here.</p>';
  const ab = { Instagram: "IG", Facebook: "FB", YouTube: "YT", Google: "G", WhatsApp: "WA" };
  $("dock").innerHTML = L.map(([a, b]) => `<a href="${esc(b)}" target="_blank" rel="noopener" aria-label="${a}" title="${a}">${ab[a]}</a>`).join("");
  $("wa").hidden = !S.whatsapp;
  if (S.whatsapp) $("wa").href = wa("Hi, I'd like to know more about your sarees.");
}

let idx = 0, sx = 0, moved = false;
function layout() {
  const cs = [...$("grid").querySelectorAll(".card")], n = cs.length;
  cs.forEach((c, i) => {
    let d = (((i - idx) % n) + n) % n; if (d > n / 2) d -= n;
    const a = Math.abs(d);
    c.style.transform = `translateX(${d * c.offsetWidth * 0.68}px) translateZ(${-a * 140}px) rotateY(${-d * 32}deg)`;
    c.style.opacity = a > 2 ? 0 : 1 - a * 0.28;
    c.style.zIndex = 10 - a;
    c.style.pointerEvents = a > 2 ? "none" : "auto";
    c.classList.toggle("on", d === 0);
  });
}
const go = (k) => { const n = $("grid").querySelectorAll(".card").length; if (n) { idx = (idx + k + n) % n; layout(); } };

function draw() {
  const T = ["All", ...new Set(P.map((p) => p.type))];
  if (!T.includes(cur)) cur = "All";
  $("filters").innerHTML = T.map((t) => `<button class="chip" aria-pressed="${t === cur}" data-t="${esc(t)}">${esc(t)}</button>`).join("");
  const L = P.filter((p) => cur === "All" || p.type === cur);
  $("grid").innerHTML = L.length ? L.map((p) => `
    <article class="card${p.soldOut ? " sold" : ""}" data-id="${p.id}" tabindex="0">
      <div class="swatch">${p.images[0] ? `<img src="${esc(p.images[0])}" alt="${esc(p.name)}" loading="lazy">` : ""}
        ${p.soldOut ? "<b>Sold out</b>" : p.tag ? `<b>${esc(p.tag)}</b>` : ""}${p.video ? "<em>▶ Video</em>" : ""}${heartBtn(p.id)}</div>
      <div class="body"><h3>${esc(p.name)}</h3>${rate(p.id)}
        <span class="fab">${esc(p.type)}${p.material ? " · " + esc(p.material) : ""}</span>
        <div class="price">${inr(p.price)}${p.old ? `<s>${inr(p.old)}</s>` : ""}</div></div>
    </article>`).join("") : '<p class="sub">New sarees are being added. Please check back soon.</p>';
  idx = 0; layout();
}

function reviews() {
  const a = avg(R);
  $("revSum").innerHTML = R.length
    ? `<span class="big">${a.toFixed(1)}</span> <span class="st">${stars(a)}</span> <span class="fab">${R.length} review${R.length > 1 ? "s" : ""}</span>`
    : '<span class="fab">No reviews yet. Be the first to review.</span>';
  $("revGrid").innerHTML = R.map(revCard).join("");
}

function openSaree(id) {
  pick = P.find((p) => p.id === id); if (!pick) return;
  const p = pick, im = p.images;
  $("dBody").innerHTML = `
    <div class="gal">${im[0] ? `<img id="big" src="${esc(im[0])}" alt="${esc(p.name)}">` : ""}
      ${im.length > 1 ? `<div class="th">${im.map((u) => `<img src="${esc(u)}" data-big="${esc(u)}" alt="">`).join("")}</div>` : ""}</div>
    <div><h2>${esc(p.name)}</h2>${rate(p.id)}
      <p class="fab">${esc(p.type)}${p.material ? " · Material: " + esc(p.material) : ""}</p>
      <div class="price">${inr(p.price)}${p.old ? `<s>${inr(p.old)}</s>` : ""}</div>
      <p>${esc(p.description)}</p>
      ${p.video ? vid(p.video) : ""}
      <p>${p.soldOut ? '<span class="btn off">Sold out</span>' : '<button class="btn" id="buy">Buy now</button> <button class="btn ghost" id="addc">Add to cart</button>'} <button class="heart big${WISH.includes(p.id) ? " on" : ""}" data-w="${p.id}" aria-label="Wishlist">♥</button>
      ${S.whatsapp ? `<a class="btn ghost" target="_blank" rel="noopener" href="${wa(`Hi, I'm interested in: ${p.name} (${inr(p.price)})`)}">Ask on WhatsApp</a>` : ""}</p>
    </div>`;
  $("dBody").lastElementChild.insertAdjacentHTML("beforeend", '<h3 class="rh">Reviews</h3>' +
    (forP(p.id).map(revCard).join("") || '<p class="sub">No reviews for this saree yet.</p>') + '<button class="btn ghost" id="wrp">Write a review</button>');
  $("dlg").showModal();
}

$("filters").addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (b) { cur = b.dataset.t; draw(); } });
$("grid").addEventListener("click", (e) => {
  if (e.target.closest("[data-w]")) return;
  if (moved) { moved = false; return; }
  const c = e.target.closest("[data-id]"); if (!c) return;
  if (c.classList.contains("on")) openSaree(c.dataset.id); else { idx = [...$("grid").children].indexOf(c); layout(); }
});
const st = $("grid").parentElement;
st.addEventListener("pointerdown", (e) => { sx = e.clientX; moved = false; });
st.addEventListener("pointerup", (e) => { const dx = e.clientX - sx; if (Math.abs(dx) > 40) { moved = true; go(dx < 0 ? 1 : -1); } });
$("prev").onclick = () => go(-1);
$("next").onclick = () => go(1);
addEventListener("resize", layout);
addEventListener("keydown", (e) => { if (!document.querySelector("dialog[open]")) { if (e.key === "ArrowLeft") go(-1); if (e.key === "ArrowRight") go(1); } });
if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
  setInterval(() => { if (!st.matches(":hover") && !document.querySelector("dialog[open]") && !st.contains(document.activeElement)) go(1); }, 4500);
$("grid").addEventListener("keydown", (e) => { if (e.key === "Enter") { const c = e.target.closest("[data-id]"); if (c) openSaree(c.dataset.id); } });
$("dBody").addEventListener("click", (e) => {
  if (e.target.dataset.big) $("big").src = e.target.dataset.big;
  if (e.target.id === "addc") addCart(pick.id);
  if (e.target.id === "wrp") { $("dlg").close(); openReview(pick.id); }
  if (e.target.id === "buy") {
    $("dlg").close();
    $("osum").textContent = `${pick.name} – ${inr(pick.price)} each`;
    cartMode = false; $("of").elements.qty.closest("label").hidden = false;
    $("of").hidden = false; $("odone").hidden = true; $("oerr").textContent = "";
    $("odlg").showModal();
  }
});
document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
document.querySelectorAll("dialog").forEach((d) => d.addEventListener("close", () => d.querySelectorAll("video").forEach((v) => v.pause())));

$("of").addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target)); if (cartMode) body.items = Object.entries(CART).map(([productId, qty]) => ({ productId, qty })); else body.productId = pick.id;
  const r = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json();
  if (!r.ok) { $("oerr").textContent = d.error; return; }
  const o = d.order;
  if (cartMode) { CART = {}; save("cart", CART); counts(); }
  $("of").hidden = true; $("of").reset();
  $("odone").hidden = false;
  $("odone").innerHTML = `<h2>Order received</h2><p>Thank you, ${esc(o.name)}. We will confirm your order and payment details on your phone or WhatsApp.</p>` +
    (S.whatsapp ? `<a class="btn" target="_blank" rel="noopener" href="${wa(`Hi, I placed an order on your website: ${o.items.map((i) => i.name + " x" + i.qty).join(", ")}. Total ${inr(o.total)}. Name: ${o.name}, Phone: ${o.phone}, Pincode: ${o.pincode}`)}">Send details on WhatsApp</a>` : "");
});
function openReview(pid) {
  $("rsel").innerHTML = '<option value="">General (about the shop)</option>' + P.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
  $("rsel").value = pid || "";
  $("rf").hidden = false; $("rdone").hidden = true; $("rerr").textContent = "";
  $("rdlg").showModal();
}
$("wr").addEventListener("click", () => openReview(""));
$("rf").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("rerr").textContent = "Sending… (videos can take a minute)";
  try {
    const r = await fetch("/api/reviews", { method: "POST", body: new FormData(e.target) });
    const d = await r.json();
    if (!r.ok) { $("rerr").textContent = d.error; return; }
    e.target.reset(); $("rf").hidden = true; $("rdone").hidden = false;
    $("rdone").innerHTML = "<h2>Thank you!</h2><p>Your review will appear on the website after the owner checks it.</p>";
  } catch (err) { $("rerr").textContent = "Could not send. Please try again."; }
});
document.addEventListener("pointermove", (e) => {
  const t = e.target.closest(".rev,.steps li,.card.on");
  if (t) { const r = t.getBoundingClientRect(); t.style.setProperty("--mx", e.clientX - r.left + "px"); t.style.setProperty("--my", e.clientY - r.top + "px"); }
});
if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }), { threshold: 0.1 });
  document.querySelectorAll(".india .wrap,#shop .wrap,#delivery .wrap,#reviews .wrap,#contact .wrap").forEach((el) => { el.classList.add("rv"); io.observe(el); });
}

/* ---------- toast, counts ---------- */
function toast(m) {
  const t = document.createElement("div"); t.className = "toast"; t.textContent = m;
  (document.querySelector("dialog[open]") || document.body).append(t); setTimeout(() => t.remove(), 1800);
}
function counts() {
  $("wN").textContent = WISH.length;
  $("cN").textContent = Object.values(CART).reduce((a, b) => a + b, 0);
}

/* ---------- categories ---------- */
function cats() {
  const T = [...new Set(P.map((p) => p.type))];
  $("categories").hidden = !T.length;
  $("cats").innerHTML = T.map((t) => {
    const l = P.filter((p) => p.type === t), im = l.find((p) => p.images[0]);
    return `<button class="cat" data-c="${esc(t)}">${im ? `<img src="${esc(im.images[0])}" alt="" loading="lazy">` : ""}<span><b>${esc(t)}</b>${l.length} saree${l.length > 1 ? "s" : ""}</span></button>`;
  }).join("");
}
$("cats").addEventListener("click", (e) => {
  const b = e.target.closest("[data-c]"); if (!b) return;
  cur = b.dataset.c; draw(); $("shop").scrollIntoView({ behavior: "smooth" });
});

/* ---------- offers ---------- */
function offers() {
  const L = P.filter((p) => p.old > p.price && !p.soldOut).sort((a, b) => (b.old - b.price) / b.old - (a.old - a.price) / a.old);
  $("offerBar").hidden = !S.offerText; $("offerBar").textContent = S.offerText || "";
  $("offers").hidden = !L.length;
  $("offerSub").textContent = "Sarees with special prices right now.";
  $("offerGrid").innerHTML = L.map((p) => `
    <button class="offer" data-d="${p.id}">${thumb(p)}<span class="pct">${Math.round(((p.old - p.price) / p.old) * 100)}% OFF</span>
      <span class="ob"><h3>${esc(p.name)}</h3><span class="price">${inr(p.price)}<s>${inr(p.old)}</s></span></span></button>`).join("");
}

/* ---------- wishlist ---------- */
function toggleW(id) {
  const i = WISH.indexOf(id); i < 0 ? WISH.push(id) : WISH.splice(i, 1);
  save("wish", WISH); counts();
  document.querySelectorAll(`[data-w="${id}"]`).forEach((b) => b.classList.toggle("on", WISH.includes(id)));
  toast(i < 0 ? "Saved to wishlist" : "Removed from wishlist");
  if ($("wdlg").open) renderWish();
}
function renderWish() {
  const L = WISH.map((id) => P.find((p) => p.id === id)).filter(Boolean);
  $("wItems").innerHTML = L.length ? L.map((p) => `
    <div class="li">${thumb(p)}<div><strong>${esc(p.name)}</strong><br><span class="fab">${inr(p.price)}${p.soldOut ? " · Sold out" : ""}</span></div>
      <button class="btn ghost sm" data-d="${p.id}">View</button>${p.soldOut ? "" : `<button class="btn ghost sm" data-a="${p.id}">Add to cart</button>`}
      <button class="btn ghost sm" data-w="${p.id}">Remove</button></div>`).join("") : '<p class="sub">Your wishlist is empty. Tap the ♥ on any saree to save it.</p>';
}
$("wBtn").onclick = () => { renderWish(); $("wdlg").showModal(); };

/* ---------- cart ---------- */
const cartList = () => Object.entries(CART).map(([id, q]) => ({ p: P.find((x) => x.id === id), q })).filter((x) => x.p && !x.p.soldOut);
function addCart(id) {
  CART[id] = Math.min(10, (CART[id] || 0) + 1); save("cart", CART); counts(); toast("Added to cart");
  if ($("cdlg").open) renderCart();
}
function renderCart() {
  const L = cartList();
  $("cItems").innerHTML = L.length ? L.map(({ p, q }) => `
    <div class="li">${thumb(p)}<div><strong>${esc(p.name)}</strong><br><span class="fab">${inr(p.price)} each</span></div>
      <div class="qty"><button data-q="${p.id}" data-s="-1" aria-label="Less">−</button><span>${q}</span><button data-q="${p.id}" data-s="1" aria-label="More">+</button></div>
      <button class="btn ghost sm" data-rm="${p.id}">Remove</button></div>`).join("") : '<p class="sub">Your cart is empty.</p>';
  $("cTot").textContent = L.length ? "Total: " + inr(L.reduce((a, { p, q }) => a + p.price * q, 0)) : "";
  $("checkout").hidden = !L.length;
}
$("cBtn").onclick = () => { renderCart(); $("cdlg").showModal(); };
$("cItems").addEventListener("click", (e) => {
  const q = e.target.dataset.q, rm = e.target.dataset.rm;
  if (q) { CART[q] = Math.min(10, Math.max(1, (CART[q] || 1) + +e.target.dataset.s)); }
  if (rm) delete CART[rm];
  if (q || rm) { save("cart", CART); counts(); renderCart(); }
});
$("checkout").onclick = () => {
  cartMode = true; $("cdlg").close();
  $("osum").textContent = cartList().map(({ p, q }) => `${p.name} × ${q}`).join(", ") + " – " + $("cTot").textContent;
  $("of").elements.qty.closest("label").hidden = true;
  $("of").hidden = false; $("odone").hidden = true; $("oerr").textContent = "";
  $("odlg").showModal();
};

/* ---------- reels ---------- */
const reelList = () => P.filter((p) => p.video);
function reelsRow() {
  const L = reelList(); $("reels").hidden = !L.length;
  $("reelRow").innerHTML = L.map((p, i) => `<button class="reel" data-r="${i}"><video src="${esc(p.video)}#t=0.1" muted playsinline preload="metadata"></video><span class="pl">▶</span><b>${esc(p.name)}</b></button>`).join("");
}
function openReels(i) {
  const L = reelList(), feed = $("reelFeed");
  feed.innerHTML = L.map((p) => `
    <section class="rl"><video src="${esc(p.video)}" loop playsinline preload="metadata"${reelMuted ? " muted" : ""}></video>
      <div class="ov"><div><h3>${esc(p.name)}</h3><span class="price">${inr(p.price)}</span></div>
        <div class="act">${heartBtn(p.id)}${p.soldOut ? "" : `<button class="heart" data-a="${p.id}" aria-label="Add to cart">+</button>`}<button class="heart" data-d="${p.id}" aria-label="Details">i</button></div></div></section>`).join("");
  $("rldlg").showModal();
  if (rlObs) rlObs.disconnect();
  rlObs = new IntersectionObserver((es) => es.forEach((x) => {
    const v = x.target.querySelector("video");
    if (x.isIntersecting) { v.muted = reelMuted; v.play().catch(() => {}); } else v.pause();
  }), { root: feed, threshold: 0.7 });
  [...feed.children].forEach((c) => rlObs.observe(c));
  feed.children[i].scrollIntoView();
}
$("reelRow").addEventListener("click", (e) => { const b = e.target.closest("[data-r]"); if (b) openReels(+b.dataset.r); });
$("reelFeed").addEventListener("click", (e) => {
  if (e.target.tagName !== "VIDEO") return;
  reelMuted = !reelMuted; $("reelFeed").querySelectorAll("video").forEach((v) => (v.muted = reelMuted));
  toast(reelMuted ? "Sound off" : "Sound on");
});
$("rldlg").addEventListener("close", () => { if (rlObs) rlObs.disconnect(); });

/* ---------- help ---------- */
const FAQ0 = "How do I order? | Choose a saree, tap Buy now or Add to cart, and fill in your address. We confirm your order by phone or WhatsApp.\nHow do I pay? | We share the payment details when we confirm your order.\nDo you deliver all over India? | Yes. Enter your pincode at checkout and we will confirm delivery to your area.\nCan I ask about a saree before buying? | Yes. Open the saree and tap Ask on WhatsApp, or message us from this Help section.";
function help() {
  $("faq").innerHTML = (S.faq || FAQ0).split("\n").map((l) => l.split("|")).filter((a) => a.length > 1 && a[0].trim())
    .map((a) => `<details><summary>${esc(a[0].trim())}</summary><p>${esc(a.slice(1).join("|").trim())}</p></details>`).join("");
  $("helpWa").hidden = $("helpCall").hidden = !S.whatsapp;
  if (S.whatsapp) { $("helpWa").href = wa("Hi, I need help with an order."); $("helpCall").href = "tel:+" + S.whatsapp; }
}

/* one handler for wishlist / add-to-cart / details buttons anywhere */
document.addEventListener("click", (e) => {
  const w = e.target.closest("[data-w]"); if (w) { toggleW(w.dataset.w); return; }
  const a = e.target.closest("[data-a]"); if (a) { addCart(a.dataset.a); return; }
  const d = e.target.closest("[data-d]");
  if (d) { document.querySelectorAll("dialog[open]").forEach((x) => x.close()); openSaree(d.dataset.d); }
});
load();
