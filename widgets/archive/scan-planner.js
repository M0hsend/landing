// scan-planner.js
// AnyWidget: the design trade-off behind an automated 4D-STEM scan.
// The left panel shows the true microstructure with the scan grid on top;
// the right panel shows what that grid actually records. Sliders set the
// field of view, the step size, and the dwell time. The readout gives the
// number of diffraction patterns, the data volume, and the wall-clock time,
// which is what decides whether an experiment is feasible in a session.
//
//   :::{anywidget} ./widgets/scan-planner.js
//   :::

const SEED0 = 20260912;
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
// Synthetic microstructure: Voronoi grains plus small precipitates on the
// boundaries. Returns a function giving a value in 0..1 at (x, y) in nm.
function makeSample() {
  const r = rng(SEED0);
  const grains = [];
  for (let i = 0; i < 150; i++)
    grains.push({ x: r() * 2000, y: r() * 2000, v: 0.25 + 0.6 * r() });
  const ppt = [];
  for (let i = 0; i < 420; i++)
    ppt.push({ x: r() * 2000, y: r() * 2000, rad: 3 });   // 6 nm across
  return (x, y) => {
    let best = 1e9, second = 1e9, val = 0;
    for (const g of grains) {
      const d = (g.x - x) * (g.x - x) + (g.y - y) * (g.y - y);
      if (d < best) { second = best; best = d; val = g.v; }
      else if (d < second) second = d;
    }
    // darken close to a boundary
    const edge = Math.sqrt(second) - Math.sqrt(best);
    let v = val * (edge < 6 ? 0.5 + 0.083 * edge : 1);
    for (const p of ppt) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < p.rad) v = 1.0;
    }
    return Math.max(0, Math.min(1, v));
  };
}
const sample = makeSample();

function fmtBytes(b) {
  if (b > 1e12) return (b / 1e12).toFixed(2) + " TB";
  if (b > 1e9) return (b / 1e9).toFixed(2) + " GB";
  if (b > 1e6) return (b / 1e6).toFixed(0) + " MB";
  return (b / 1e3).toFixed(0) + " kB";
}
function fmtTime(s) {
  if (s < 90) return s.toFixed(0) + " s";
  if (s < 5400) return (s / 60).toFixed(1) + " min";
  return (s / 3600).toFixed(1) + " h";
}

function render({ model, el }) {
  const uid = "spl" + Math.random().toString(36).slice(2, 8);
  const style = document.createElement("style");
  style.textContent = `
.${uid} { --w-panel:#fff; --w-fg:#1a1a1a; --w-muted:#6b7280; --w-border:#d8d5d0;
  --w-accent:#007FFF; font-family:system-ui,sans-serif; color:var(--w-fg);
  display:block; margin-bottom:26px; }
.${uid}.w-dark { --w-panel:#221f1e; --w-fg:#eee; --w-muted:#9ca3af; --w-border:#3a3735;
  --w-accent:#FFF44F; }
.${uid} .w-row { display:flex; gap:12px; flex-wrap:wrap; }
.${uid} .w-col { flex:1 1 240px; min-width:210px; }
.${uid} canvas { border:1px solid var(--w-border); border-radius:8px; display:block; width:100%; }
.${uid} .w-ctrls { display:flex; gap:14px; flex-wrap:wrap; margin:10px 0 0 0; }
.${uid} label { font-size:13px; color:var(--w-muted); display:flex; flex-direction:column;
  gap:2px; flex:1 1 170px; }
.${uid} .w-val { color:var(--w-fg); font-weight:600; }
.${uid} input[type=range] { width:100%; accent-color:var(--w-accent); }
.${uid} .w-out { display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; }
.${uid} .w-stat { flex:1 1 120px; border:1px solid var(--w-border); border-radius:8px;
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
  <div class="w-col"><canvas class="w-truth" height="280"></canvas></div>
  <div class="w-col"><canvas class="w-meas" height="280"></canvas></div>
</div>
<div class="w-ctrls">
  <label>field of view <span class="w-val w-fovv"></span>
    <input class="w-fov" type="range" min="200" max="2000" step="50" value="600"></label>
  <label>step size <span class="w-val w-stepv"></span>
    <input class="w-step" type="range" min="1" max="40" step="1" value="4"></label>
  <label>dwell time per pattern <span class="w-val w-dwellv"></span>
    <input class="w-dwell" type="range" min="0.2" max="10" step="0.2" value="1"></label>
</div>
<div class="w-out">
  <div class="w-stat"><div class="k">patterns</div><div class="v w-n"></div></div>
  <div class="w-stat"><div class="k">raw data</div><div class="v w-b"></div></div>
  <div class="w-stat"><div class="k">scan time</div><div class="v w-t"></div></div>
  <div class="w-stat w-fstat"><div class="k">smallest feature</div><div class="v w-f"></div></div>
</div>
<div class="w-note"></div>`;
  el.appendChild(style); el.appendChild(root);

  const cvT = root.querySelector(".w-truth"), cvM = root.querySelector(".w-meas");
  const inF = root.querySelector(".w-fov"), inS = root.querySelector(".w-step");
  const inD = root.querySelector(".w-dwell");
  const note = root.querySelector(".w-note");
  const DET = 256, BYTES = 2;      // 256 x 256 detector, 16-bit
  const PPT = 6;                   // typical precipitate size, nm

  function dark() { return document.documentElement.classList.contains("dark"); }
  function syncTheme() { root.classList.toggle("w-dark", dark()); draw(); }
  const obs = new MutationObserver(syncTheme);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  function shade(v, isD) {
    const lo = isD ? 24 : 40, hi = isD ? 235 : 245;
    const g = Math.round(lo + (hi - lo) * v);
    return `rgb(${g},${Math.round(g * 0.97)},${Math.round(g * 0.93)})`;
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1, isD = dark();
    const fov = +inF.value, step = +inS.value, dwell = +inD.value;
    const nSide = Math.max(1, Math.round(fov / step));
    const n = nSide * nSide;
    const bytes = n * DET * DET * BYTES;
    const secs = n * dwell / 1000 * 1.08;     // flyback overhead

    // ---------- left: true microstructure with the scan grid ----------
    {
      const w = cvT.clientWidth || 260, h = 280;
      cvT.width = w * dpr; cvT.height = h * dpr;
      const g = cvT.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = isD ? "#221f1e" : "#fff"; g.fillRect(0, 0, w, h);
      const im = Math.min(w - 12, h - 42), x0 = (w - im) / 2, y0 = 26, NP = 150;
      for (let iy = 0; iy < NP; iy++)
        for (let ix = 0; ix < NP; ix++) {
          g.fillStyle = shade(sample(ix / NP * fov, iy / NP * fov), isD);
          g.fillRect(x0 + ix / NP * im, y0 + iy / NP * im, im / NP + 0.6, im / NP + 0.6);
        }
      // scan grid, drawn only when the lines stay legible
      const pitch = im / nSide;
      if (pitch > 3.5) {
        g.strokeStyle = isD ? "rgba(255,244,79,0.5)" : "rgba(0,127,255,0.45)";
        g.lineWidth = 0.6;
        g.beginPath();
        for (let i = 0; i <= nSide; i++) {
          g.moveTo(x0 + i * pitch, y0); g.lineTo(x0 + i * pitch, y0 + im);
          g.moveTo(x0, y0 + i * pitch); g.lineTo(x0 + im, y0 + i * pitch);
        }
        g.stroke();
      }
      g.fillStyle = isD ? "#ddd" : "#333"; g.font = "13px system-ui";
      g.fillText("sample, with the scan grid", 6, 16);
      g.fillText(fov + " nm field of view", 6, h - 6);
    }
    // ---------- right: what the scan records ----------
    {
      const w = cvM.clientWidth || 260, h = 280;
      cvM.width = w * dpr; cvM.height = h * dpr;
      const g = cvM.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = isD ? "#221f1e" : "#fff"; g.fillRect(0, 0, w, h);
      const im = Math.min(w - 12, h - 42), x0 = (w - im) / 2, y0 = 26;
      const draww = Math.min(nSide, 400);
      const stride = nSide / draww;
      for (let iy = 0; iy < draww; iy++)
        for (let ix = 0; ix < draww; ix++) {
          const sx = (ix * stride + 0.5) * step, sy = (iy * stride + 0.5) * step;
          g.fillStyle = shade(sample(sx, sy), isD);
          g.fillRect(x0 + ix / draww * im, y0 + iy / draww * im,
                     im / draww + 0.6, im / draww + 0.6);
        }
      g.fillStyle = isD ? "#ddd" : "#333"; g.font = "13px system-ui";
      g.fillText("recorded map, one pattern per point", 6, 16);
      g.fillText(nSide + " x " + nSide + " probe positions", 6, h - 6);
    }
    root.querySelector(".w-fovv").textContent = fov + " nm";
    root.querySelector(".w-stepv").textContent = step + " nm";
    root.querySelector(".w-dwellv").textContent = dwell.toFixed(1) + " ms";
    root.querySelector(".w-n").textContent = n.toLocaleString();
    root.querySelector(".w-b").textContent = fmtBytes(bytes);
    root.querySelector(".w-t").textContent = fmtTime(secs);
    const resolved = step <= PPT / 2;
    root.querySelector(".w-f").textContent = resolved ? "sampled" : "missed";
    root.querySelector(".w-fstat").classList.toggle("warn", !resolved);
    note.innerHTML = resolved
      ? "<b>The step samples the precipitates.</b> At " + step + " nm the scan places at "
        + "least two probe positions across a " + PPT + " nm precipitate, so the "
        + "precipitate population is measurable from the recorded map. The cost is the "
        + "data volume and the scan time above, both of which scale as the inverse "
        + "square of the step size."
      : "<b>The step undersamples the precipitates.</b> At " + step + " nm the probe "
        + "positions are spaced more widely than the " + PPT + " nm precipitates, so "
        + "most precipitates fall between measurements and are absent from the recorded "
        + "map. Subsequent analysis cannot recover them, and a particle density measured "
        + "from this scan will be too low.";
  }
  for (const i of [inF, inS, inD]) i.addEventListener("input", draw);
  new ResizeObserver(draw).observe(cvT);
  syncTheme();
  return () => obs.disconnect();
}
export default { render };
