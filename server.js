const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PASSWORD = process.env.ADMIN_PASSWORD || "change-me";
// On a host with a permanent disk, set DATA_DIR to that disk's folder so data and uploads survive restarts
const BASE = process.env.DATA_DIR || __dirname;
const D = path.join(BASE, "data");
const UP = process.env.DATA_DIR ? path.join(BASE, "uploads") : path.join(__dirname, "public", "uploads");
[D, UP].forEach((d) => fs.mkdirSync(d, { recursive: true }));

const rd = (n, def) => { try { return JSON.parse(fs.readFileSync(path.join(D, n + ".json"), "utf8")); } catch { return def; } };
const wr = (n, v) => fs.writeFileSync(path.join(D, n + ".json"), JSON.stringify(v, null, 2));
const id = () => crypto.randomBytes(5).toString("hex");
const s = (v, n) => String(v || "").trim().slice(0, n);
const link = (v) => (/^https?:\/\//.test(String(v || "").trim()) ? s(v, 300) : "");
const url = (f) => "/uploads/" + f.filename;
const rm = (u) => [].concat(u || []).forEach((x) => x && x.startsWith("/uploads/") && fs.unlink(path.join(UP, path.basename(x)), () => {}));
const norm = (p) => ({ ...p, images: p.images || (p.image ? [p.image] : []), video: p.video || "" });
const tokens = new Set();

const upload = multer({
  storage: multer.diskStorage({
    destination: UP,
    filename: (q, f, cb) => cb(null, Date.now() + "-" + crypto.randomBytes(3).toString("hex") + path.extname(f.originalname).toLowerCase())
  }),
  limits: { fileSize: 60 * 1024 * 1024 },
  fileFilter: (q, f, cb) => cb(null, /^(image\/(jpeg|png|webp)|video\/(mp4|webm))$/.test(f.mimetype))
});
const fields = (...n) => upload.fields(n.map((name) => ({ name, maxCount: name === "images" ? 5 : 1 })));
const auth = (q, r, next) => (tokens.has(q.get("x-token")) ? next() : r.status(401).json({ error: "Login required" }));

app.use(express.json());
app.use("/uploads", express.static(UP));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/login", (q, r) => {
  if (q.body.password !== PASSWORD) return r.status(401).json({ error: "Wrong password" });
  const t = crypto.randomBytes(16).toString("hex");
  tokens.add(t);
  r.json({ token: t });
});

/* ---- shop settings: logo, owner photo, intro video, social links ---- */
app.get("/api/settings", (q, r) => r.json(rd("settings", {})));
app.put("/api/settings", auth, fields("logo", "ownerPhoto", "introVideo", "deliveryVideo"), (q, r) => {
  const c = rd("settings", {});
  ["shopName", "ownerName", "tagline", "deliveryText", "offerText"].forEach((k) => k in q.body && (c[k] = s(q.body[k], 150)));
  if ("about" in q.body) c.about = s(q.body.about, 800);
  if ("faq" in q.body) c.faq = s(q.body.faq, 2500);
  ["facebook", "youtube", "instagram", "google"].forEach((k) => k in q.body && (c[k] = link(q.body[k])));
  if ("whatsapp" in q.body) c.whatsapp = String(q.body.whatsapp).replace(/\D/g, "").slice(0, 15);
  for (const k in q.files || {}) { rm(c[k]); c[k] = url(q.files[k][0]); }
  wr("settings", c);
  r.json(c);
});

/* ---- sarees: up to 5 photos + 1 short video ---- */
const clean = (b) => ({
  name: s(b.name, 80), type: s(b.type, 40) || "Other",
  price: Math.max(0, +b.price || 0), old: Math.max(0, +b.old || 0),
  tag: s(b.tag, 20), material: s(b.material, 80), description: s(b.description, 500),
  soldOut: b.soldOut === "true"
});
app.get("/api/products", (q, r) => r.json(rd("products", []).map(norm)));
app.post("/api/products", auth, fields("images", "video"), (q, r) => {
  const d = clean(q.body), f = q.files || {};
  if (!d.name || !d.price) return r.status(400).json({ error: "Name and price are required" });
  const it = { id: id(), ...d, images: (f.images || []).map(url), video: f.video ? url(f.video[0]) : "" };
  const l = rd("products", []); l.unshift(it); wr("products", l);
  r.json(it);
});
app.put("/api/products/:id", auth, fields("images", "video"), (q, r) => {
  const l = rd("products", []), i = l.findIndex((p) => p.id === q.params.id), f = q.files || {};
  if (i < 0) return r.status(404).json({ error: "Not found" });
  const o = norm(l[i]), d = clean(q.body);
  if (f.images) { rm(o.images); d.images = f.images.map(url); }
  if (f.video) { rm(o.video); d.video = url(f.video[0]); }
  l[i] = { ...o, ...d }; wr("products", l);
  r.json(l[i]);
});
app.delete("/api/products/:id", auth, (q, r) => {
  const l = rd("products", []), it = l.find((p) => p.id === q.params.id);
  if (it) { const n = norm(it); rm(n.images); rm(n.video); }
  wr("products", l.filter((p) => p.id !== q.params.id));
  r.json({ ok: true });
});

/* ---- reviews are written by customers; the owner approves them ---- */
const hits = new Map();
app.set("trust proxy", 1);
app.get("/api/reviews", (q, r) => r.json(rd("reviews", []).filter((x) => x.approved)));
app.get("/api/reviews/all", auth, (q, r) => r.json(rd("reviews", [])));
app.post("/api/reviews", fields("photo", "video"), (q, r) => {
  const f = q.files || {}, b = q.body, rating = Math.round(+b.rating), now = Date.now();
  const drop = () => Object.values(f).flat().forEach((x) => rm(url(x)));
  const h = (hits.get(q.ip) || []).filter((t) => now - t < 3600000);
  if (h.length >= 5) { drop(); return r.status(429).json({ error: "Too many reviews from this device. Please try again later." }); }
  if (!s(b.name, 60) || !s(b.text, 600) || !(rating >= 1 && rating <= 5)) {
    drop(); return r.status(400).json({ error: "Please give a star rating, your name and your review." });
  }
  hits.set(q.ip, [...h, now]);
  const pid = rd("products", []).some((p) => p.id === b.productId) ? b.productId : "";
  const it = { id: id(), productId: pid, rating, name: s(b.name, 60), city: s(b.city, 60), text: s(b.text, 600),
    photo: f.photo ? url(f.photo[0]) : "", video: f.video ? url(f.video[0]) : "", approved: false, date: new Date().toISOString() };
  const l = rd("reviews", []); l.unshift(it); wr("reviews", l);
  r.json({ ok: true });
});
app.put("/api/reviews/:id/approve", auth, (q, r) => {
  const l = rd("reviews", []), it = l.find((x) => x.id === q.params.id);
  if (!it) return r.status(404).json({ error: "Not found" });
  it.approved = true; wr("reviews", l); r.json(it);
});
app.delete("/api/reviews/:id", auth, (q, r) => {
  const l = rd("reviews", []), it = l.find((x) => x.id === q.params.id);
  if (it) { rm(it.photo); rm(it.video); }
  wr("reviews", l.filter((x) => x.id !== q.params.id));
  r.json({ ok: true });
});

/* ---- orders placed on the website ---- */
app.post("/api/orders", (q, r) => {
  const b = q.body, all = rd("products", []);
  const raw = Array.isArray(b.items) ? b.items : [{ productId: b.productId, qty: b.qty }];
  const items = raw.slice(0, 20).map((x) => {
    const p = all.find((y) => y.id === x.productId);
    return p && !p.soldOut ? { name: p.name, price: p.price, qty: Math.min(10, Math.max(1, +x.qty || 1)) } : null;
  }).filter(Boolean);
  if (!items.length) return r.status(400).json({ error: "These sarees are not available" });
  const o = { id: id(), date: new Date().toISOString(), items, total: items.reduce((a, i) => a + i.price * i.qty, 0),
    name: s(b.name, 80), phone: s(b.phone, 15), address: s(b.address, 300), pincode: s(b.pincode, 10), note: s(b.note, 200) };
  if (!o.name || !/^\d{10}$/.test(o.phone.replace(/\D/g, "").slice(-10)) || !o.address || !/^\d{6}$/.test(o.pincode))
    return r.status(400).json({ error: "Please enter name, 10-digit phone, address and 6-digit pincode" });
  const l = rd("orders", []); l.unshift(o); wr("orders", l);
  r.json({ ok: true, order: o });
});
app.get("/api/orders", auth, (q, r) => r.json(rd("orders", [])));
app.delete("/api/orders/:id", auth, (q, r) => { wr("orders", rd("orders", []).filter((x) => x.id !== q.params.id)); r.json({ ok: true }); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Shop: http://localhost:${PORT}   Admin: http://localhost:${PORT}/admin.html`));
