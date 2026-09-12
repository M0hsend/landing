// probe-heterogeneity.js
// AnyWidget: what a bulk average hides in an energy material.
// A synthetic particle carries a majority phase plus minority pockets of a
// second phase and a smooth composition gradient. Growing the probe blurs the
// map, and the histogram of measured values collapses from two peaks to one.
// The readout says whether the minority phase is still detectable, which is
// the practical question behind low-dose local mapping of perovskites,
// cathodes, and supported catalysts.
//
//   :::{anywidget} ./widgets/probe-heterogeneity.js
//   :::

const N = 120;             // map grid
const SPAN = 240;          // nm across the field

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
// Ground truth: value 0 is the majority phase, 1 the minority phase.
// Pocket count is fixed; the slider sets their size at fixed total area.
function buildTruth(pocketNm) {
  const r = rng(99173);
  const rad = pocketNm / (SPAN / N) / 2;            // in grid cells
  const area = 0.10 * N * N;                        // 10% of the field, always
  const nPock = Math.max(1, Math.round(area / (Math.PI * rad * rad)));
  const cen = [];
  for (let i = 0; i < nPock; i++) cen.push({ x: r() * N, y: r() * N });
  const t = new Float32Array(N * N);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      // gentle composition gradient across the particle, plus pockets
      let v = 0.10 * (i / N);
      for (const c of cen) {
        const d = Math.hypot(c.x - i, c.y - j);
        if (d < rad) { v = 1; break; }
      }
      t[j * N + i] = v;
    }
  return t;
}
// Separable Gaussian blur with wrap-around edges, sigma in grid cells.
// Wrapping conserves the mean of the field exactly, so any change in the
// measured distribution comes from the probe size and not from the boundary.
function blur(src, sigma) {
  if (sigma < 0.35) return src.slice();
  const rad = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float32Array(2 * rad + 1);
  let sum = 0;
  for (let i = -rad; i <= rad; i++) {
    k[i + rad] = Math.exp(-(i * i) / (2 * sigma * sigma));
    sum += k[i + rad];
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(N * N), out = new Float32Array(N * N);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let d = -rad; d <= rad; d++) {
        const ii = ((i + d) % N + N) % N;
        s += k[d + rad] * src[j * N + ii];
      }
      tmp[j * N + i] = s;
    }
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let d = -rad; d <= rad; d++) {
        const jj = ((j + d) % N + N) % N;
        s += k[d + rad] * tmp[jj * N + i];
      }
      out[j * N + i] = s;
    }
  return out;
}

function render({ model, el }) {
  const uid = "ph" + Math.random().toString(36).slice(2, 8);
  const style = document.createElement("style");
  style.textContent = `
.${uid} { --w-panel:#fff; --w-fg:#1a1a1a; --w-muted:#6b7280; --w-border:#d8d5d0;
  --w-accent:#007FFF; font-family:system-ui,sans-serif; color:var(--w-fg);
  display:block; margin-bottom:26px; }
.${uid}.w-dark { --w-panel:#221f1e; --w-fg:#eee; --w-muted:#9ca3af; --w-border:#3a3735;
  --w-accent:#FFF44F; }
.${uid} .w-row { display:flex; gap:12px; flex-wrap:wrap; }
.${uid} .w-col { flex:1 1 190px; min-width:170px; }
.${uid} canvas { border:1px solid var(--w-border); border-radius:8px; display:block; width:100%; }
.${uid} .w-ctrls { display:flex; gap:14px; flex-wrap:wrap; margin:10px 0 0 0; }
.${uid} label { font-size:13px; color:var(--w-muted); display:flex; flex-direction:column;
  gap:2px; flex:1 1 200px; }
.${uid} .w-val { color:var(--w-fg); font-weight:600; }
.${uid} input[type=range] { width:100%; accent-color:var(--w-accent); }
.${uid} .w-out { display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; }
.${uid} .w-stat { flex:1 1 140px; border:1px solid var(--w-border); border-radius:8px;
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
  <div class="w-col"><canvas class="w-truth" height="230"></canvas></div>
  <div class="w-col"><canvas class="w-meas" height="230"></canvas></div>
  <div class="w-col"><canvas class="w-hist" height="230"></canvas></div>
</div>
<div class="w-ctrls">
  <label>probe size <span class="w-val w-pv"></span>
    <input class="w-p" type="range" min="1" max="120" step="1" value="4"></label>
  <label>size of the minority pockets <span class="w-val w-sv"></span>
    <input class="w-s" type="range" min="4" max="40" step="2" value="10"></label>
</div>
<div class="w-out">
  <div class="w-stat"><div class="k">mean composition</div><div class="v w-mean"></div></div>
  <div class="w-stat"><div class="k">measured spread</div><div class="v w-sd"></div></div>
  <div class="w-stat w-dstat"><div class="k">second phase</div><div class="v w-det"></div></div>
</div>
<div class="w-note"></div>`;
  el.appendChild(style); el.appendChild(root);

  const cvT = root.querySelector(".w-truth"), cvM = root.querySelector(".w-meas");
  const cvH = root.querySelector(".w-hist");
  const inP = root.querySelector(".w-p"), inS = root.querySelector(".w-s");
  const note = root.querySelector(".w-note");
  let truthCache = null, truthKey = null, trueMean = 0;

  function dark() { return document.documentElement.classList.contains("dark"); }
  function syncTheme() { root.classList.toggle("w-dark", dark()); draw(); }
  const obs = new MutationObserver(syncTheme);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  // two-tone map: majority in slate, minority phase in warm red
  function colour(v, isD) {
    const a = isD ? [58, 62, 72] : [222, 226, 233];
    const b = isD ? [255, 123, 138] : [209, 73, 91];
    const t = Math.max(0, Math.min(1, v));
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
  }
  function paint(cv, data, isD, title, sub) {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 200, h = 230;
    cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = isD ? "#221f1e" : "#fff"; g.fillRect(0, 0, w, h);
    const im = Math.min(w - 12, h - 44), x0 = (w - im) / 2, y0 = 26;
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        g.fillStyle = colour(data[j * N + i], isD);
        g.fillRect(x0 + i / N * im, y0 + j / N * im, im / N + 0.6, im / N + 0.6);
      }
    g.fillStyle = isD ? "#ddd" : "#333"; g.font = "13px system-ui";
    g.fillText(title, 6, 16);
    g.fillStyle = isD ? "#9ca3af" : "#6b7280"; g.font = "12px system-ui";
    g.fillText(sub, 6, h - 8);
  }

  function draw() {
    const isD = dark();
    const probeNm = +inP.value, pocketNm = +inS.value;
    const key = String(pocketNm);
    if (truthKey !== key) {
      truthCache = buildTruth(pocketNm);
      truthKey = key;
      trueMean = 0;
      for (let k = 0; k < truthCache.length; k++) trueMean += truthCache[k];
      trueMean /= truthCache.length;
    }
    const truth = truthCache;
    const sigma = probeNm / (SPAN / N) / 2.355;     // FWHM to sigma, in cells
    const meas = blur(truth, sigma);

    paint(cvT, truth, isD, "true structure", SPAN + " nm across");
    paint(cvM, meas, isD, "as measured", probeNm + " nm probe");

    // histogram of measured values
    const NB = 40, hist = new Float64Array(NB);
    let mean = 0;
    for (let k = 0; k < meas.length; k++) {
      mean += meas[k];
      hist[Math.min(NB - 1, Math.max(0, Math.floor(meas[k] * NB)))]++;
    }
    mean /= meas.length;
    let sd = 0;
    for (let k = 0; k < meas.length; k++) sd += (meas[k] - mean) * (meas[k] - mean);
    sd = Math.sqrt(sd / meas.length);
    // how much of the field still reads as clearly second phase
    let hi = 0;
    for (let k = 0; k < meas.length; k++) if (meas[k] > 0.5) hi++;
    const hiFrac = hi / meas.length;
    {
      const dpr = window.devicePixelRatio || 1;
      const w = cvH.clientWidth || 200, h = 230;
      cvH.width = w * dpr; cvH.height = h * dpr;
      const g = cvH.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = isD ? "#221f1e" : "#fff"; g.fillRect(0, 0, w, h);
      const L = 12, R = w - 12, T = 30, B = h - 32;
      let mx = 0;
      for (let b = 0; b < NB; b++) mx = Math.max(mx, hist[b]);
      // log-ish scale so the small minority peak stays visible
      const hgt = (v) => (B - T) * Math.pow(v / mx, 0.38);
      for (let b = 0; b < NB; b++) {
        const x = L + b / NB * (R - L), bw = (R - L) / NB;
        g.fillStyle = colour(b / NB, isD);
        g.fillRect(x, B - hgt(hist[b]), bw - 0.8, hgt(hist[b]));
      }
      g.strokeStyle = isD ? "#555" : "#ccc"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(L, B); g.lineTo(R, B); g.stroke();
      // bulk average marker
      g.strokeStyle = isD ? "#FFF44F" : "#007FFF"; g.lineWidth = 2;
      const xm = L + mean * (R - L);
      g.beginPath(); g.moveTo(xm, T - 6); g.lineTo(xm, B); g.stroke();
      g.fillStyle = isD ? "#FFF44F" : "#007FFF"; g.font = "12px system-ui";
      g.fillText("bulk average", Math.min(xm + 5, R - 78), T + 4);
      g.fillStyle = isD ? "#ddd" : "#333"; g.font = "13px system-ui";
      g.fillText("distribution of measured values", 6, 16);
      g.fillStyle = isD ? "#9ca3af" : "#6b7280"; g.font = "12px system-ui";
      g.fillText("majority", L, B + 16);
      g.fillText("second phase", R - 78, B + 16);
    }
    root.querySelector(".w-pv").textContent = probeNm + " nm";
    root.querySelector(".w-sv").textContent = pocketNm + " nm";
    root.querySelector(".w-mean").textContent = (mean * 100).toFixed(1) + "%";
    root.querySelector(".w-sd").textContent = "±" + (sd * 100).toFixed(1) + "%";
    const detected = hiFrac > 0.01;
    root.querySelector(".w-det").textContent = detected ? "resolved" : "averaged away";
    root.querySelector(".w-dstat").classList.toggle("warn", !detected);
    note.innerHTML = (detected
      ? "<b>The second phase is resolved.</b> At a " + probeNm + " nm probe the measured "
        + "distribution retains two populations, so the pockets can be counted and "
        + "located, and their area fraction can be measured directly."
      : "<b>The second phase is not resolved.</b> At a " + probeNm + " nm probe the probe "
        + "is larger than the " + pocketNm + " nm pockets, so every measurement mixes both "
        + "phases and the distribution has a single population centred on the mean.")
      + " The mean composition is " + (mean * 100).toFixed(1) + "%, against a true value of "
      + (trueMean * 100).toFixed(1) + "%. The probe size does not change the mean, so a bulk "
      + "measurement of composition returns the same value at every probe size shown here.";
  }
  for (const i of [inP, inS]) i.addEventListener("input", draw);
  new ResizeObserver(draw).observe(cvT);
  syncTheme();
  return () => obs.disconnect();
}
export default { render };
