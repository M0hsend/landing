// sampling-convergence.js
// AnyWidget: why one field of view is not a measurement.
// A large synthetic microstructure contains a minority phase at a known area
// fraction. The viewer chooses how many regions to scan and how clustered the
// phase is; the widget samples those regions, reports the estimate with a
// 95% interval, and plots how the estimate converges on the true value.
// Clustering is the point: correlated microstructures need far more regions
// than the binomial intuition suggests.
//
//   :::{anywidget} ./widgets/sampling-convergence.js
//   :::

const FIELD = 600;           // field is FIELD x FIELD arbitrary units
const TRUE_FRAC = 0.12;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
// Build a phase map at a given clustering level: particles of the minority
// phase are scattered either uniformly (low clustering) or gathered into a
// few colonies (high clustering), always at the same total area fraction.
function buildMap(cluster) {
  const r = rng(4242 + Math.round(cluster * 100));
  const target = TRUE_FRAC * FIELD * FIELD;
  const rad = 5;
  const nPart = Math.round(target / (Math.PI * rad * rad));
  const nCol = Math.max(1, Math.round(90 - 86 * cluster));
  const cols = [];
  for (let i = 0; i < nCol; i++) cols.push({ x: r() * FIELD, y: r() * FIELD });
  const spread = 12 + 160 * (1 - cluster);
  const pts = [];
  for (let i = 0; i < nPart; i++) {
    const c = cols[Math.floor(r() * cols.length)];
    let x = c.x + (r() + r() + r() - 1.5) * spread;
    let y = c.y + (r() + r() + r() - 1.5) * spread;
    x = ((x % FIELD) + FIELD) % FIELD;
    y = ((y % FIELD) + FIELD) % FIELD;
    pts.push({ x, y, rad });
  }
  // rasterise once so sampling and drawing agree exactly
  const N = 300, cell = FIELD / N;
  const grid = new Uint8Array(N * N);
  for (const p of pts) {
    const i0 = Math.max(0, Math.floor((p.x - p.rad) / cell));
    const i1 = Math.min(N - 1, Math.ceil((p.x + p.rad) / cell));
    const j0 = Math.max(0, Math.floor((p.y - p.rad) / cell));
    const j1 = Math.min(N - 1, Math.ceil((p.y + p.rad) / cell));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const dx = (i + 0.5) * cell - p.x, dy = (j + 0.5) * cell - p.y;
        if (dx * dx + dy * dy < p.rad * p.rad) grid[j * N + i] = 1;
      }
  }
  let tot = 0;
  for (let k = 0; k < grid.length; k++) tot += grid[k];
  return { grid, N, cell, frac: tot / grid.length };
}

function render({ model, el }) {
  const uid = "sc" + Math.random().toString(36).slice(2, 8);
  const style = document.createElement("style");
  style.textContent = `
.${uid} { --w-panel:#fff; --w-fg:#1a1a1a; --w-muted:#6b7280; --w-border:#d8d5d0;
  --w-accent:#007FFF; --w-phase:#d1495b; font-family:system-ui,sans-serif;
  color:var(--w-fg); display:block; margin-bottom:26px; }
.${uid}.w-dark { --w-panel:#221f1e; --w-fg:#eee; --w-muted:#9ca3af; --w-border:#3a3735;
  --w-accent:#FFF44F; --w-phase:#ff7b8a; }
.${uid} .w-row { display:flex; gap:12px; flex-wrap:wrap; }
.${uid} .w-col { flex:1 1 240px; min-width:210px; }
.${uid} canvas { border:1px solid var(--w-border); border-radius:8px; display:block; width:100%; }
.${uid} .w-ctrls { display:flex; gap:14px; flex-wrap:wrap; margin:10px 0 0 0; align-items:flex-end; }
.${uid} label { font-size:13px; color:var(--w-muted); display:flex; flex-direction:column;
  gap:2px; flex:1 1 170px; }
.${uid} .w-val { color:var(--w-fg); font-weight:600; }
.${uid} input[type=range] { width:100%; accent-color:var(--w-accent); }
.${uid} button { border:1px solid var(--w-border); border-radius:6px; background:var(--w-panel);
  color:var(--w-fg); padding:6px 13px; cursor:pointer; font-size:13px; }
.${uid} button:hover { border-color:var(--w-accent); color:var(--w-accent); }
.${uid} .w-out { display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; }
.${uid} .w-stat { flex:1 1 130px; border:1px solid var(--w-border); border-radius:8px;
  padding:7px 10px; background:var(--w-panel); }
.${uid} .w-stat .k { font-size:11.5px; text-transform:uppercase; letter-spacing:0.05em;
  color:var(--w-muted); }
.${uid} .w-stat .v { font-size:17px; font-weight:700; }
.${uid} .w-stat.warn .v { color:var(--w-accent); }
.${uid} .w-note { margin-top:10px; font-size:13.5px; line-height:1.5; color:var(--w-muted); }
.${uid} .w-note b { color:var(--w-fg); }
`;
  const root = document.createElement("div");
  root.className = uid;
  root.innerHTML = `
<div class="w-row">
  <div class="w-col"><canvas class="w-map" height="300"></canvas></div>
  <div class="w-col"><canvas class="w-plot" height="300"></canvas></div>
</div>
<div class="w-ctrls">
  <label>regions scanned <span class="w-val w-nrv"></span>
    <input class="w-nr" type="range" min="1" max="60" step="1" value="4"></label>
  <label>region size <span class="w-val w-rsv"></span>
    <input class="w-rs" type="range" min="20" max="120" step="5" value="50"></label>
  <label>clustering of the phase <span class="w-val w-clv"></span>
    <input class="w-cl" type="range" min="0" max="1" step="0.05" value="0.6"></label>
  <button class="w-re">New sample positions</button>
</div>
<div class="w-out">
  <div class="w-stat"><div class="k">true area fraction</div><div class="v w-tf"></div></div>
  <div class="w-stat"><div class="k">your estimate</div><div class="v w-es"></div></div>
  <div class="w-stat w-cstat"><div class="k">95% interval</div><div class="v w-ci"></div></div>
  <div class="w-stat"><div class="k">area covered</div><div class="v w-cov"></div></div>
</div>
<div class="w-note"></div>`;
  el.appendChild(style); el.appendChild(root);

  const cvM = root.querySelector(".w-map"), cvP = root.querySelector(".w-plot");
  const inN = root.querySelector(".w-nr"), inR = root.querySelector(".w-rs");
  const inC = root.querySelector(".w-cl"), btn = root.querySelector(".w-re");
  const note = root.querySelector(".w-note");
  let seed = 7, cache = null, cacheKey = null;

  function dark() { return document.documentElement.classList.contains("dark"); }
  function syncTheme() { root.classList.toggle("w-dark", dark()); draw(); }
  const obs = new MutationObserver(syncTheme);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  function getMap(cluster) {
    const key = cluster.toFixed(2);
    if (cacheKey !== key) { cache = buildMap(cluster); cacheKey = key; }
    return cache;
  }
  // fraction of minority phase inside one square region
  function measure(map, x, y, size) {
    const { grid, N, cell } = map;
    const i0 = Math.max(0, Math.floor(x / cell)), i1 = Math.min(N - 1, Math.ceil((x + size) / cell));
    const j0 = Math.max(0, Math.floor(y / cell)), j1 = Math.min(N - 1, Math.ceil((y + size) / cell));
    let hit = 0, tot = 0;
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) { tot++; hit += grid[j * N + i]; }
    return tot ? hit / tot : 0;
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1, isD = dark();
    const nReg = +inN.value, size = +inR.value, cluster = +inC.value;
    const map = getMap(cluster);
    const r = rng(seed);
    const regions = [], vals = [];
    for (let i = 0; i < nReg; i++) {
      const x = r() * (FIELD - size), y = r() * (FIELD - size);
      regions.push({ x, y });
      vals.push(measure(map, x, y, size));
    }
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    let sd = 0;
    if (vals.length > 1) {
      const v = vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (vals.length - 1);
      sd = Math.sqrt(v);
    }
    const sem = vals.length > 1 ? sd / Math.sqrt(vals.length) : NaN;
    const ci = isNaN(sem) ? NaN : 1.96 * sem;

    // ---------- left: the field with the scanned regions ----------
    {
      const w = cvM.clientWidth || 260, h = 300;
      cvM.width = w * dpr; cvM.height = h * dpr;
      const g = cvM.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = isD ? "#221f1e" : "#fff"; g.fillRect(0, 0, w, h);
      const im = Math.min(w - 12, h - 44), x0 = (w - im) / 2, y0 = 26, sc = im / FIELD;
      g.fillStyle = isD ? "#33302e" : "#eceae6";
      g.fillRect(x0, y0, im, im);
      const { grid, N, cell } = map;
      g.fillStyle = isD ? "#ff7b8a" : "#d1495b";
      for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++)
          if (grid[j * N + i])
            g.fillRect(x0 + i * cell * sc, y0 + j * cell * sc, cell * sc + 0.5, cell * sc + 0.5);
      // dim everything outside the scanned regions
      g.save();
      g.beginPath();
      g.rect(x0, y0, im, im);
      for (const rg of regions)
        g.rect(x0 + rg.x * sc, y0 + rg.y * sc, size * sc, size * sc);
      g.fillStyle = isD ? "rgba(34,31,30,0.78)" : "rgba(255,255,255,0.76)";
      g.fill("evenodd");
      g.restore();
      g.strokeStyle = isD ? "#FFF44F" : "#007FFF"; g.lineWidth = 1.4;
      for (const rg of regions)
        g.strokeRect(x0 + rg.x * sc, y0 + rg.y * sc, size * sc, size * sc);
      g.fillStyle = isD ? "#ddd" : "#333"; g.font = "13px system-ui";
      g.fillText("specimen, with the regions you scanned", 6, 16);
      g.fillText(nReg + (nReg === 1 ? " region" : " regions"), 6, h - 6);
    }
    // ---------- right: convergence of the estimate ----------
    {
      const w = cvP.clientWidth || 260, h = 300;
      cvP.width = w * dpr; cvP.height = h * dpr;
      const g = cvP.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = isD ? "#221f1e" : "#fff"; g.fillRect(0, 0, w, h);
      const L = 46, R = w - 12, T = 30, B = h - 34;
      const yMax = 0.30;
      const px = (i) => L + (i - 1) / 59 * (R - L);
      const py = (v) => B - (v / yMax) * (B - T);
      // running estimate over an independent draw, so the curve is smooth
      const r2 = rng(seed + 991);
      const run = [];
      let s = 0;
      for (let i = 1; i <= 60; i++) {
        const x = r2() * (FIELD - size), y = r2() * (FIELD - size);
        s += measure(map, x, y, size);
        run.push(s / i);
      }
      g.strokeStyle = isD ? "#555" : "#ccc"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(L, T); g.lineTo(L, B); g.lineTo(R, B); g.stroke();
      g.fillStyle = isD ? "#9ca3af" : "#6b7280"; g.font = "12px system-ui";
      for (const v of [0, 0.1, 0.2, 0.3]) {
        g.fillText((v * 100).toFixed(0) + "%", 8, py(v) + 4);
        g.strokeStyle = isD ? "#332f2d" : "#f1efec";
        g.beginPath(); g.moveTo(L, py(v)); g.lineTo(R, py(v)); g.stroke();
      }
      // true value
      g.strokeStyle = isD ? "#ff7b8a" : "#d1495b"; g.lineWidth = 1.6;
      g.setLineDash([5, 4]);
      g.beginPath(); g.moveTo(L, py(map.frac)); g.lineTo(R, py(map.frac)); g.stroke();
      g.setLineDash([]);
      g.fillStyle = isD ? "#ff7b8a" : "#d1495b";
      g.fillText("truth", R - 34, py(map.frac) - 6);
      // running estimate
      g.strokeStyle = isD ? "#FFF44F" : "#007FFF"; g.lineWidth = 2;
      g.beginPath();
      run.forEach((v, i) => (i ? g.lineTo(px(i + 1), py(v)) : g.moveTo(px(1), py(v))));
      g.stroke();
      // marker at the chosen number of regions
      g.fillStyle = isD ? "#FFF44F" : "#007FFF";
      g.beginPath(); g.arc(px(nReg), py(run[nReg - 1]), 4, 0, 6.3); g.fill();
      g.fillStyle = isD ? "#ddd" : "#333"; g.font = "13px system-ui";
      g.fillText("running estimate against regions scanned", 6, 16);
      g.fillStyle = isD ? "#9ca3af" : "#6b7280"; g.font = "12px system-ui";
      g.fillText("1", L - 3, B + 16);
      g.fillText("60 regions", R - 62, B + 16);
    }
    root.querySelector(".w-nrv").textContent = nReg;
    root.querySelector(".w-rsv").textContent = size + " units";
    root.querySelector(".w-clv").textContent =
      cluster < 0.33 ? "dispersed" : cluster < 0.7 ? "patchy" : "strongly clustered";
    root.querySelector(".w-tf").textContent = (map.frac * 100).toFixed(1) + "%";
    root.querySelector(".w-es").textContent = (mean * 100).toFixed(1) + "%";
    root.querySelector(".w-ci").textContent = isNaN(ci) ? "n/a" : "±" + (ci * 100).toFixed(1) + "%";
    const cov = nReg * size * size / (FIELD * FIELD);
    root.querySelector(".w-cov").textContent = (cov * 100).toFixed(1) + "%";
    const bad = isNaN(ci) || ci > 0.02;
    root.querySelector(".w-cstat").classList.toggle("warn", bad);
    note.innerHTML = (isNaN(ci)
      ? "<b>A single region gives no uncertainty.</b> One field of view provides no "
        + "estimate of the variance between regions, so the area fraction it reports "
        + "cannot be assigned a confidence interval."
      : (bad
        ? "<b>The interval is wider than two percentage points.</b> An estimate at this "
          + "precision cannot distinguish a real difference between two specimens from "
          + "the variation between regions within one specimen."
        : "<b>The interval is below two percentage points.</b> At this precision a "
          + "difference between two specimens larger than the interval can be reported "
          + "as a measured difference."))
      + " Increasing the clustering slider concentrates the phase into colonies at fixed "
      + "area fraction, which raises the variance between regions and therefore the number "
      + "of regions required for the same interval.";
  }
  for (const i of [inN, inR, inC]) i.addEventListener("input", draw);
  btn.addEventListener("click", () => { seed = (seed * 7 + 13) % 99991; draw(); });
  new ResizeObserver(draw).observe(cvM);
  syncTheme();
  return () => obs.disconnect();
}
export default { render };
