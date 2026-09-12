// research-themes.js — ambient visuals for the three research themes.
//
// One module, three painters, two layouts. In "row" mode it renders the three
// themes side by side as square panels with a title, rule, and short
// description, in the manner of the COLab research pillars. Given a single
// theme name it renders that painter alone as a wide banner with no chrome.
//
//   :::{anywidget} ./widgets/research-themes.js
//   {"mode": "row"}
//   :::
//
//   :::{anywidget} ./widgets/research-themes.js
//   {"mode": "scan"}
//   :::
//
// Each painter is a slow generative loop: a probe rastering a field, sampling
// windows converging on a value, and a lattice dissolving and reforming under
// a moving average. Theme-aware, paused when off-screen or hidden, static
// under prefers-reduced-motion.

const THEMES = [
  {
    kind: "scan",
    title: "Automated acquisition and analysis for STEM",
    short: "Automated acquisition",
    desc: "Script-controlled scanning, with the analysis attached to the instrument rather than to the operator.",
    href: "#automated-acquisition-and-analysis-for-stem",
  },
  {
    kind: "sampling",
    title: "Statistically representative microscopy",
    short: "Representative sampling",
    desc: "Measurements that describe the specimen, with an uncertainty, rather than one region that looked interesting.",
    href: "#statistically-representative-microscopy",
  },
  {
    kind: "materials",
    title: "Nanoscale structure in energy materials",
    short: "Energy materials",
    desc: "Minority phases, interfaces, and clusters that set performance and that a bulk average cannot resolve.",
    href: "#nanoscale-structure-in-energy-materials",
  },
];

function detectDark() {
  const de = document.documentElement;
  if (de.classList.contains("dark")) return true;
  if (de.classList.contains("light")) return false;
  try {
    const m = getComputedStyle(document.body).backgroundColor.match(/\d+/g);
    if (m && m.length >= 3) return (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]) / 255 < 0.5;
  } catch (e) {}
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (t) => t * t * (3 - 2 * t);

// Palette. The panels keep a dark ground in both site themes, in the way an
// electron micrograph is bright signal on a dark field, and only the accent
// follows the site: azure in light mode, lemon in dark mode.
function palette(dark) {
  return dark
    ? { bgc: [10, 12, 17], bg: "#0a0c11", ink: [236, 240, 248], dim: [110, 122, 140],
        accent: [255, 244, 79], warm: [255, 150, 130], glow: 1.0 }
    : { bgc: [16, 20, 28], bg: "#10141c", ink: [238, 242, 250], dim: [120, 132, 150],
        accent: [96, 176, 255], warm: [255, 150, 140], glow: 0.95 };
}
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
// mix two colours, then push a fraction of the way toward the accent
function mix(a, b, t, acc, ta) {
  let r = lerp(a[0], b[0], t), g = lerp(a[1], b[1], t), bl = lerp(a[2], b[2], t);
  if (ta > 0) { r = lerp(r, acc[0], ta); g = lerp(g, acc[1], ta); bl = lerp(bl, acc[2], ta); }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(bl)})`;
}

// ---------------------------------------------------------------- painter: scan
// A probe walks a serpentine raster. Behind it the field is revealed; ahead it
// is dark. The leading edge carries a bloom and a small diffraction rosette.
function scanPainter() {
  const r = rng(8731);
  // A few grains, each a lattice at its own orientation and spacing. The scan
  // reveals atom columns, so the panel reads as an atomic-resolution image
  // being written one line at a time.
  const grains = [];
  for (let i = 0; i < 9; i++)
    grains.push({
      x: r() * 1.6 - 0.3, y: r() * 1.4 - 0.2,
      ang: r() * 1.5708, d: 0.050 + 0.022 * r(), amp: 0.75 + 0.25 * r(),
    });
  function nearest(x, y) {
    let best = 9, g = grains[0];
    for (const q of grains) {
      const d = (q.x - x) * (q.x - x) + (q.y - y) * (q.y - y) * 0.35;
      if (d < best) { best = d; g = q; }
    }
    return g;
  }
  function field(x, y) {
    const g = nearest(x, y);
    const c = Math.cos(g.ang), s2 = Math.sin(g.ang);
    const u = (x * c - y * s2) / g.d, v = (x * s2 + y * c) / g.d;
    const pu = 0.5 + 0.5 * Math.cos(6.2832 * u), pv = 0.5 + 0.5 * Math.cos(6.2832 * v);
    const peak = Math.pow(pu * pv, 1.9);
    return clamp(0.1 + g.amp * peak, 0, 1);
  }
  const ROWS = 34, PERIOD = 21, PHASE = 0.34;
  return function paint(g, w, h, t, p, hover) {
    const { bg, bgc, ink, dim, accent } = p;
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const cyc = ((t / PERIOD) + PHASE) % 1;
    const prog = clamp(ease(clamp(cyc / 0.8, 0, 1)), 0, 1);
    const fade = cyc > 0.92 ? 1 - (cyc - 0.92) / 0.08 : 1;
    const rowH = h / ROWS;
    const done = prog * ROWS;
    const NX = Math.max(70, Math.round(w / 4.5));
    const aspect = w / h;
    for (let ry = 0; ry < ROWS; ry++) {
      const rowDone = clamp(done - ry, 0, 1);
      if (rowDone <= 0) continue;
      const fy = (ry + 0.5) / ROWS;
      const left = ry % 2 === 0 ? 0 : 1 - rowDone;
      const right = ry % 2 === 0 ? rowDone : 1;
      for (let ix = 0; ix < NX; ix++) {
        const fx = ix / NX;
        if (fx < left || fx > right) continue;
        const v = field(fx * aspect * 0.42, fy * 0.42);
        const travelled = ry % 2 === 0 ? fx : 1 - fx;
        const heat = 1 - clamp((done - ry - travelled) / 2.2, 0, 1);
        const amt = lerp(0.02, 0.97, Math.pow(v, 0.85)) * fade;
        g.fillStyle = mix(bgc, ink, amt, accent, heat * 0.55 * p.glow);
        g.fillRect(fx * w, ry * rowH, w / NX + 1, rowH + 1);
      }
    }
    // faint scan lines across the whole frame
    g.strokeStyle = rgba(dim, 0.08 * fade); g.lineWidth = 0.5;
    g.beginPath();
    for (let ry = 1; ry < ROWS; ry++) { g.moveTo(0, ry * rowH); g.lineTo(w, ry * rowH); }
    g.stroke();
    // probe, with a small diffraction rosette
    if (prog > 0.001 && prog < 0.999) {
      const ry = Math.min(ROWS - 1, Math.floor(done));
      const fx = done - ry;
      const px = (ry % 2 === 0 ? fx : 1 - fx) * w;
      const py = (ry + 0.5) * rowH;
      const R = Math.max(16, Math.min(w, h) * 0.1);
      const gr = g.createRadialGradient(px, py, 0, px, py, R);
      gr.addColorStop(0, rgba(accent, 0.95 * fade));
      gr.addColorStop(0.3, rgba(accent, 0.3 * fade));
      gr.addColorStop(1, rgba(accent, 0));
      g.fillStyle = gr;
      g.beginPath(); g.arc(px, py, R, 0, 6.2832); g.fill();
      const rr = R * 0.13;
      g.fillStyle = rgba(accent, 0.95 * fade);
      g.beginPath(); g.arc(px, py, rr, 0, 6.2832); g.fill();
      for (let k = 0; k < 6; k++) {
        const a = k * 1.0472 + t * 0.2;
        const d = R * 0.55;
        g.globalAlpha = (0.45 + 0.4 * Math.sin(t * 2.3 + k * 1.3)) * fade;
        g.beginPath(); g.arc(px + d * Math.cos(a), py + d * Math.sin(a), rr * 0.7, 0, 6.2832); g.fill();
      }
      g.globalAlpha = 1;
      g.strokeStyle = rgba(accent, 0.18 * fade); g.lineWidth = rowH;
      g.beginPath();
      g.moveTo(ry % 2 === 0 ? 0 : w, py); g.lineTo(px, py); g.stroke();
    }
    // vignette
    const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.78);
    vg.addColorStop(0, rgba(bgc, 0));
    vg.addColorStop(1, rgba(bgc, 0.42));
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    if (hover > 0.01) { g.fillStyle = rgba(accent, 0.05 * hover); g.fillRect(0, 0, w, h); }
  };
}

// ------------------------------------------------------------ painter: sampling
// Motes gather in colonies. Sampling windows bloom at random positions,
// brightening what they contain, and a running estimate settles onto a line.
function samplingPainter() {
  const r = rng(20260912);
  const cols = [];
  for (let i = 0; i < 7; i++) cols.push({ x: 0.1 + 0.8 * r(), y: 0.1 + 0.8 * r() });
  const motes = [];
  for (let i = 0; i < 520; i++) {
    const c = cols[Math.floor(r() * cols.length)];
    const sp = 0.055 + 0.1 * r();
    motes.push({
      x: clamp(c.x + (r() + r() + r() - 1.5) * sp, 0.01, 0.99),
      y: clamp(c.y + (r() + r() + r() - 1.5) * sp, 0.01, 0.99),
      s: 0.6 + 1.9 * r(), ph: r() * 6.283, sp: 0.5 + r(),
    });
  }
  const PERIOD = 26, EVERY = 1.15, PHASE = 0.22;
  const wr = rng(4242);
  const wins = [];
  for (let i = 0; i < Math.ceil(PERIOD / EVERY) + 2; i++)
    wins.push({ x: 0.05 + 0.72 * wr(), y: 0.05 + 0.62 * wr(), s: 0.14 + 0.09 * wr(), e: 0.6 + 0.8 * wr() });
  return function paint(g, w, h, t, p, hover) {
    const { bg, ink, dim, accent, warm } = p;
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const cyc = ((t / PERIOD) + PHASE) % 1;
    const tt = cyc * PERIOD;
    const nShown = Math.floor(tt / EVERY);
    const plotH = h * 0.22, fieldH = h - plotH;
    // which windows are open, and how strongly
    const open = [];
    for (let i = 0; i < Math.min(nShown + 1, wins.length); i++) {
      const age = tt - i * EVERY;
      if (age < 0) continue;
      const a = age < 0.5 ? ease(age / 0.5) : age < 3.2 ? 1 : Math.max(0, 1 - (age - 3.2) / 2.2);
      if (a > 0.01) open.push({ ...wins[i], a });
    }
    // motes
    for (const m of motes) {
      const x = m.x * w, y = m.y * fieldH;
      let lit = 0;
      for (const o of open)
        if (m.x > o.x && m.x < o.x + o.s && m.y * fieldH / h > o.y && m.y * fieldH / h < o.y + o.s * (w / h) * 0.62)
          lit = Math.max(lit, o.a);
      const tw = 0.55 + 0.45 * Math.sin(t * m.sp + m.ph);
      const R = m.s * (1 + 1.5 * lit) * (0.9 + 0.25 * tw);
      const c = lit > 0.02 ? accent : warm;
      const gr = g.createRadialGradient(x, y, 0, x, y, R * 4.5);
      gr.addColorStop(0, rgba(c, (0.34 + 0.5 * lit) * (0.55 + 0.45 * tw) * p.glow));
      gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, R * 4.5, 0, 6.2832); g.fill();
      g.fillStyle = rgba(c, 0.9 * (0.4 + 0.6 * lit));
      g.beginPath(); g.arc(x, y, R * 0.85, 0, 6.2832); g.fill();
    }
    // window outlines
    for (const o of open) {
      const x = o.x * w, y = o.y * h, sw = o.s * w, sh = o.s * w * 0.62;
      g.strokeStyle = rgba(accent, 0.75 * o.a); g.lineWidth = 1.2;
      g.strokeRect(x, y, sw, sh);
      const cor = Math.min(sw, sh) * 0.22;
      g.strokeStyle = rgba(accent, 0.95 * o.a); g.lineWidth = 2;
      for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + sw, y, -1, 1], [x, y + sh, 1, -1], [x + sw, y + sh, -1, -1]]) {
        g.beginPath();
        g.moveTo(cx + dx * cor, cy); g.lineTo(cx, cy); g.lineTo(cx, cy + dy * cor);
        g.stroke();
      }
    }
    // running estimate settling onto the true value
    const y0 = fieldH + plotH * 0.62, amp = plotH * 0.34;
    g.strokeStyle = rgba(dim, 0.4); g.lineWidth = 1; g.setLineDash([4, 5]);
    g.beginPath(); g.moveTo(0, y0); g.lineTo(w, y0); g.stroke();
    g.setLineDash([]);
    g.strokeStyle = rgba(accent, 0.9); g.lineWidth = 2;
    g.beginPath();
    const n = Math.max(1, nShown);
    for (let i = 0; i <= 240; i++) {
      const f = i / 240;
      const k = f * n;
      if (k > n) break;
      const x = f * w * (n / Math.max(wins.length - 2, 1));
      if (x > w) break;
      const wob = (Math.sin(k * 2.1 + 0.7) + 0.55 * Math.sin(k * 5.3 + 2.1) + 0.35 * Math.sin(k * 11.7)) / 1.9;
      const y = y0 - amp * wob / (1 + 0.85 * k);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
    if (hover > 0.01) { g.fillStyle = rgba(accent, 0.05 * hover); g.fillRect(0, 0, w, h); }
  };
}

// ----------------------------------------------------------- painter: materials
// A breathing atomic lattice with a minority population of bright clusters.
// A soft band sweeps across, inside which detail dissolves into an average.
function materialsPainter() {
  const r = rng(515151);
  const sites = [];
  const NX = 26, NY = 15;
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const off = (j % 2) * 0.5;
      sites.push({
        x: (i + off + 0.5) / NX, y: (j + 0.5) / NY,
        ph: r() * 6.283, sp: 0.5 + 0.9 * r(), minority: false,
      });
    }
  const clusters = [];
  for (let i = 0; i < 6; i++) clusters.push({ x: 0.08 + 0.84 * r(), y: 0.1 + 0.8 * r(), rad: 0.05 + 0.05 * r() });
  for (const s of sites)
    for (const c of clusters)
      if (Math.hypot(s.x - c.x, (s.y - c.y) * 0.62) < c.rad) s.minority = true;
  const PERIOD = 17, PHASE = 0.3;
  return function paint(g, w, h, t, p, hover) {
    const { bg, ink, dim, accent, warm } = p;
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const band = (((t / PERIOD) + PHASE) % 1) * 1.5 - 0.25;   // sweeps left to right
    const bw = 0.3;
    // bonds
    g.strokeStyle = rgba(dim, 0.22); g.lineWidth = 0.7;
    g.beginPath();
    for (const s of sites) {
      const near = sites.filter((o) => o !== s && Math.abs(o.x - s.x) < 1.15 / NX && Math.abs(o.y - s.y) < 1.15 / NY);
      for (const o of near) {
        if (o.x < s.x) continue;
        g.moveTo(s.x * w, s.y * h); g.lineTo(o.x * w, o.y * h);
      }
    }
    g.stroke();
    // atoms, with the averaging band dissolving detail
    for (const s of sites) {
      const d = Math.abs(s.x - band);
      const avg = d < bw ? Math.pow(1 - d / bw, 1.6) : 0;
      const jx = 0.0016 * Math.sin(t * s.sp + s.ph);
      const jy = 0.0016 * Math.cos(t * s.sp * 0.8 + s.ph);
      const x = (s.x + jx) * w, y = (s.y + jy) * h;
      const base = Math.min(w, h) * 0.013;
      const R = base * (s.minority ? 1.5 : 1) * (1 + 2.6 * avg);
      const c = s.minority ? accent : ink;
      const aCore = (s.minority ? 0.98 : 0.62) * (1 - 0.7 * avg);
      const gr = g.createRadialGradient(x, y, 0, x, y, R * 3.4);
      gr.addColorStop(0, rgba(c, (s.minority ? 0.6 : 0.2) * p.glow * (1 - 0.5 * avg)));
      gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, R * 3.4, 0, 6.2832); g.fill();
      g.fillStyle = rgba(c, aCore);
      g.beginPath(); g.arc(x, y, R, 0, 6.2832); g.fill();
    }
    // the averaging band itself, drawn as a soft vertical veil
    const bx = band * w;
    const veil = g.createLinearGradient(bx - bw * w, 0, bx + bw * w, 0);
    veil.addColorStop(0, rgba(accent, 0));
    veil.addColorStop(0.5, rgba(accent, 0.1 * p.glow));
    veil.addColorStop(1, rgba(accent, 0));
    g.fillStyle = veil;
    g.fillRect(bx - bw * w, 0, bw * 2 * w, h);
    if (hover > 0.01) { g.fillStyle = rgba(accent, 0.05 * hover); g.fillRect(0, 0, w, h); }
  };
}

const PAINTERS = { scan: scanPainter, sampling: samplingPainter, materials: materialsPainter };

function mountCanvas(cv, kind, state) {
  const paint = PAINTERS[kind]();
  const ctx = cv.getContext("2d");
  let raf = 0, t0 = performance.now() / 1000, visible = true;
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function frame() {
    raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth || 300, h = cv.clientHeight || 200;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = reduced ? 6.2 : performance.now() / 1000 - t0;
    state.hover += ((state.hoverTarget ? 1 : 0) - state.hover) * 0.12;
    paint(ctx, w, h, t, palette(state.dark), state.hover);
    if (!reduced && visible && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf) raf = requestAnimationFrame(frame); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  const io = new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
    visible ? start() : stop();
  }, { rootMargin: "120px" });
  io.observe(cv);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  new ResizeObserver(() => { if (!raf) requestAnimationFrame(frame); }).observe(cv);
  start();
  return { stop, redraw: () => { if (!raf) requestAnimationFrame(frame); }, io };
}

function render({ model, el }) {
  const opt = (k, d) => { try { const v = model.get(k); return v == null ? d : v; } catch (e) { return d; } };
  const mode = opt("mode", "row");
  const id = "rt" + Math.random().toString(36).slice(2, 7);
  const single = mode !== "row" ? THEMES.find((x) => x.kind === mode) : null;
  const style = document.createElement("style");
  style.textContent = `
.${id}-row { display:flex; gap:0; width:100%; margin:0.6rem 0 1.6rem; }
.${id}-col { flex:1 1 0; min-width:0; display:flex; flex-direction:column;
  padding:0 1rem 0.2rem; border-left:1px solid var(--${id}-rule); }
.${id}-col:first-child { border-left:0; }
.${id}-panel { position:relative; width:100%; aspect-ratio:1/1; border-radius:10px;
  overflow:hidden; line-height:0; }
.${id}-banner { position:relative; width:100%; aspect-ratio:24/7; border-radius:12px;
  overflow:hidden; line-height:0; margin:0.4rem 0 1.4rem; }
.${id}-panel canvas, .${id}-banner canvas { display:block; width:100%; height:100%; }
.${id}-title { font-size:0.97rem; font-weight:600; line-height:1.3; margin:0.85rem 0 0.2rem;
  color:var(--${id}-fg); text-wrap:balance; }
.${id}-bar { width:0; height:2px; background:var(--${id}-accent); transition:width .3s ease;
  margin-bottom:0.5rem; }
.${id}-col:hover .${id}-bar { width:34px; }
.${id}-desc { font-size:0.85rem; line-height:1.55; color:var(--${id}-dim); margin:0 0 0.55rem; flex:1 0 auto; }
.${id}-more { font-size:0.82rem; }
.${id}-more a { color:var(--${id}-accent); text-decoration:none; }
.${id}-more a:hover { text-decoration:underline; }
@media (max-width:640px){ .${id}-row{ flex-direction:column; gap:1.4rem; }
  .${id}-col{ border-left:0; padding:0; } .${id}-banner{ aspect-ratio:16/9; } }
`;
  el.appendChild(style);
  const root = document.createElement("div");
  root.className = single ? `${id}-solo` : `${id}-row`;
  root.innerHTML = single
    ? `<div class="${id}-banner"><canvas data-kind="${single.kind}"></canvas></div>`
    : THEMES.map((th) => `
      <div class="${id}-col">
        <div class="${id}-panel"><canvas data-kind="${th.kind}"></canvas></div>
        <div class="${id}-title">${th.title}</div>
        <div class="${id}-bar"></div>
        <div class="${id}-desc">${th.desc}</div>
        <div class="${id}-more"><a href="${th.href}">read more</a></div>
      </div>`).join("");
  el.appendChild(root);

  const state = { dark: detectDark(), hover: 0, hoverTarget: false };
  function chrome() {
    const d = state.dark;
    const set = (k, v) => root.style.setProperty(`--${id}-${k}`, v);
    set("rule", d ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.10)");
    set("fg", d ? "#e6e9ee" : "#1a1a1a");
    set("dim", d ? "#aab2bd" : "#4b5563");
    set("accent", d ? "#FFF44F" : "#007FFF");
  }
  chrome();
  const mounts = [];
  for (const cv of root.querySelectorAll("canvas")) {
    const st = { dark: state.dark, hover: 0, hoverTarget: false };
    const m = mountCanvas(cv, cv.dataset.kind, st);
    mounts.push({ m, st });
    const host = cv.closest(`.${id}-col`) || cv.parentElement;
    host.addEventListener("pointerenter", () => (st.hoverTarget = true));
    host.addEventListener("pointerleave", () => (st.hoverTarget = false));
  }
  const obs = new MutationObserver(() => {
    const d = detectDark();
    if (d === state.dark) return;
    state.dark = d;
    for (const { st, m } of mounts) { st.dark = d; m.redraw(); }
    chrome();
  });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
  obs.observe(document.body, { attributes: true });
  return () => { obs.disconnect(); for (const { m } of mounts) { m.stop(); m.io.disconnect(); } };
}
export default { render };
