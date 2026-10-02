const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let tk = sessionStorage.getItem("tk"), prods = [], editId = null;

const api = (u, o = {}) => fetch(u, { ...o, headers: { "x-token": tk || "" } }).then((r) => {
  if (r.status === 401) { out(); throw new Error("Please log in again"); }
  return r;
});
function out() { tk = null; sessionStorage.removeItem("tk"); show(); }
function show() { $("loginBox").hidden = !!tk; $("app").hidden = !tk; if (tk) loadAll(); }

async function send(url, method, form, extra = {}) {
  const fd = new FormData(form);
  for (const k in extra) fd.set(k, extra[k]);
  const r = await api(url, { method, body: fd });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Could not save");
  return d;
}
const guard = (msgId, fn) => async (e) => {
  e.preventDefault();
  $(msgId).textContent = "Saving… (videos can take a minute)";
  try { await fn(); } catch (err) { $(msgId).textContent = err.message; }
};
const del = (url, after) => async () => { await api(url, { method: "DELETE" }); after(); };

/* login + tabs */
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: $("pw").value }) });
  if (!r.ok) { $("loginErr").textContent = "Wrong password. Try again."; return; }
  tk = (await r.json()).token; sessionStorage.setItem("tk", tk); $("pw").value = ""; show();
});
$("logout").addEventListener("click", out);
$("tabs").addEventListener("click", (e) => {
  const t = e.target.dataset.tab; if (!t) return;
  document.querySelectorAll(".tab").forEach((s) => (s.hidden = s.id !== t));
  document.querySelectorAll("#tabs .chip").forEach((b) => b.setAttribute("aria-pressed", b.dataset.tab === t));
});

/* shop details */
async function loadSettings() {
  const s = await (await fetch("/api/settings")).json();
  [...$("fs").elements].forEach((el) => { if (el.name && el.type !== "file") el.value = s[el.name] || ""; });
}
$("fs").addEventListener("submit", guard("ms", async () => { await send("/api/settings", "PUT", $("fs")); $("ms").textContent = "Saved. Refresh the shop to see changes."; loadSettings(); }));

/* sarees */
async function loadProducts() {
  prods = await (await fetch("/api/products")).json();
  $("pc").textContent = prods.length;
  $("types").innerHTML = [...new Set(prods.map((p) => p.type))].map((t) => `<option value="${esc(t)}">`).join("");
  $("pl").innerHTML = prods.map((p) => `
    <div class="row">${p.images[0] ? `<img src="${esc(p.images[0])}" alt="">` : ""}
      <div><strong>${esc(p.name)}</strong><br><span class="fab">${esc(p.type)} · ₹${p.price} · ${p.images.length} photo(s)${p.video ? " · video" : ""}${p.soldOut ? " · Sold out" : ""}</span></div>
      <button data-edit="${p.id}">Edit</button><button class="del" data-del="${p.id}">Delete</button></div>`).join("") || "<p>No sarees yet.</p>";
}
function resetP() { editId = null; $("fp").reset(); $("pTitle").textContent = "Add a saree"; $("pCancel").hidden = true; }
$("fp").addEventListener("submit", guard("mp", async () => {
  await send(editId ? `/api/products/${editId}` : "/api/products", editId ? "PUT" : "POST", $("fp"), { soldOut: $("fp").soldOut.checked });
  $("mp").textContent = editId ? "Saree updated." : "Saree added."; resetP(); loadProducts();
}));
$("pl").addEventListener("click", async (e) => {
  const ed = e.target.dataset.edit, dl = e.target.dataset.del;
  if (ed) {
    const p = prods.find((x) => x.id === ed); editId = ed;
    ["name", "type", "material", "price", "old", "tag", "description"].forEach((k) => ($("fp")[k].value = p[k] || ""));
    $("fp").soldOut.checked = !!p.soldOut;
    $("pTitle").textContent = "Edit saree (choose new photos or video only to replace them)";
    $("pCancel").hidden = false; scrollTo({ top: 0, behavior: "smooth" });
  }
  if (dl && confirm("Delete this saree?")) del(`/api/products/${dl}`, loadProducts)();
});
$("pCancel").addEventListener("click", resetP);

/* reviews: written by customers, approved here */
async function loadReviews() {
  const l = await (await api("/api/reviews/all")).json();
  $("rc").textContent = l.length;
  $("rl").innerHTML = l.map((r) => `
    <div class="row">${r.photo ? `<img src="${esc(r.photo)}" alt="">` : ""}
      <div><strong>${esc(r.name)}</strong> ${esc(r.city)} · <span class="st">${"★".repeat(r.rating || 0)}</span>
        ${r.approved ? "" : ' · <b style="color:var(--rani)">Waiting for approval</b>'}
        ${r.video ? ` · <a href="${esc(r.video)}" target="_blank" rel="noopener">Watch video</a>` : ""}<br><span class="fab">${esc(r.text)}</span></div>
      ${r.approved ? "" : `<button data-appr="${r.id}">Approve</button>`}<button class="del" data-rdel="${r.id}">Delete</button></div>`).join("") || "<p>No reviews yet.</p>";
}
$("rl").addEventListener("click", async (e) => {
  const a = e.target.dataset.appr, d = e.target.dataset.rdel;
  if (a) { await api(`/api/reviews/${a}/approve`, { method: "PUT" }); loadReviews(); }
  if (d && confirm("Delete this review?")) del(`/api/reviews/${d}`, loadReviews)();
});

/* orders */
async function loadOrders() {
  const l = await (await api("/api/orders")).json();
  $("oc").textContent = l.length;
  $("ol").innerHTML = l.map((o) => `
    <div class="row"><div><strong>${(o.items || [{ name: o.saree, qty: o.qty }]).map((i) => esc(i.name) + " × " + i.qty).join(", ")}</strong> · Total ₹${o.total || o.price * o.qty}<br>
      <span class="fab">${esc(o.name)} · ${esc(o.phone)} · ${esc(o.address)}, ${esc(o.pincode)}${o.note ? " · Note: " + esc(o.note) : ""}<br>${new Date(o.date).toLocaleString("en-IN")}</span></div>
      <button class="del" data-odel="${o.id}">Done / Delete</button></div>`).join("") || "<p>No orders yet.</p>";
}
$("ol").addEventListener("click", (e) => { const id = e.target.dataset.odel; if (id && confirm("Remove this order?")) del(`/api/orders/${id}`, loadOrders)(); });

function loadAll() { loadSettings(); loadProducts(); loadReviews(); loadOrders(); }
show();
