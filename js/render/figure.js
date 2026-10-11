// Figure rendering: living figure views, shadows, mirror reflections, portraits.
// Contract: docs/ARCHITECTURE.md#rendering. Owner: render.
//
// All drawing happens in "design units": the 400x560 canvas the figure PNGs are made on.
// Anchors from figures.js (normalised 0..1) are multiplied by DW/DH and scaled to the view.

export const DW = 400;
export const DH = 560;
const RATIO = DW / DH;
const INK = '#1a1511';
const TAU = Math.PI * 2;

/** Every effect the renderer knows about (must cover the "Tell effects" table). */
export const TELL_EFFECTS = Object.freeze([
  'drip', 'smear', 'pixels', 'extraEye', 'eyeGlow', 'crack', 'spikes', 'bubbles', 'frost',
  'teeth', 'spores', 'smoke', 'static', 'stars', 'wetPrints', 'rust', 'vine',
  'mirrored', 'tilt', 'tooClose', 'noBlink', 'jitter', 'translucent', 'shadowOnly',
  'knockExtra', 'ticking', 'distort', 'textDrip', 'typo', 'shout', 'impatient',
]);

/* ------------------------------------------------------------------ helpers */

const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const strHash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100003; return h; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOut = (x) => { const k = clamp(x, 0, 1); return 1 - (1 - k) * (1 - k); };
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const rand = (a, b) => a + Math.random() * (b - a);

function prefersReduced() {
  try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

function anchorPx(figure, name) {
  const a = figure?.anchors?.[name] ?? figure?.anchors?.face ?? [0.5, 0.36];
  return [a[0] * DW, a[1] * DH];
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** Closed smooth path through points (quadratic midpoints). */
function closedSmooth(ctx, pts) {
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  ctx.closePath();
}

function openSmooth(ctx, pts) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const l = pts[pts.length - 1];
  ctx.lineTo(l[0], l[1]);
}

function blobPts(cx, cy, rx, ry, n, seed, amp, wob = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const r = 1 + (hash(seed + i * 1.7) - 0.5) * amp + Math.sin(a * 2 + wob * 3 + i) * 0.04 * wob;
    pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
  }
  return pts;
}

/** Fill + double pencil stroke. build(ctx, jitterSeed) must create the path. */
function pencil(ctx, build, { fill = null, stroke = INK, w = 2, seed = 1, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (fill) { ctx.beginPath(); build(ctx, seed); ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) {
    ctx.beginPath(); build(ctx, seed); ctx.strokeStyle = stroke; ctx.lineWidth = w; ctx.globalAlpha *= 0.9; ctx.stroke();
    ctx.save(); ctx.translate(0.9, -0.7); ctx.beginPath(); build(ctx, seed + 9); ctx.lineWidth = w * 0.55; ctx.globalAlpha *= 0.5; ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}

function hatch(ctx, clipBuild, cx, cy, r, color, alpha, seed, spacing = 6, angle = -0.8) {
  ctx.save();
  ctx.beginPath(); clipBuild(ctx); ctx.clip();
  ctx.strokeStyle = color; ctx.globalAlpha *= alpha; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
  const ca = Math.cos(angle), sa = Math.sin(angle);
  ctx.beginPath();
  for (let d = -r; d <= r; d += spacing) {
    const j = (hash(seed + d) - 0.5) * 2;
    const px = cx - sa * (d + j), py = cy + ca * (d + j);
    ctx.moveTo(px - ca * r, py - sa * r); ctx.lineTo(px + ca * r, py + sa * r);
  }
  ctx.stroke();
  ctx.restore();
}

function teardrop(ctx, x, y, r) {
  ctx.moveTo(x, y - r * 2.2);
  ctx.bezierCurveTo(x + r * 0.15, y - r * 1.3, x + r, y - r * 0.7, x + r, y);
  ctx.arc(x, y, r, 0, Math.PI, false);
  ctx.bezierCurveTo(x - r, y - r * 0.7, x - r * 0.15, y - r * 1.3, x, y - r * 2.2);
  ctx.closePath();
}

function star(ctx, x, y, r, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + (i / 10) * TAU;
    const rr = i % 2 ? r * 0.45 : r;
    if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/* ------------------------------------------------------------- image loading */

const probeCache = new Map();
/** Resolves to a loaded HTMLImageElement, or null if it can't be loaded. Never rejects. */
export function loadFigureImage(src) {
  if (!src) return Promise.resolve(null);
  if (!probeCache.has(src)) {
    probeCache.set(src, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    }));
  }
  return probeCache.get(src);
}

const placeholderCache = new Map();
/** Grey sketchy blob in the shared silhouette (round head, stubby body), 400x560. */
export function placeholderCanvas(form = 'standard') {
  if (placeholderCache.has(form)) return placeholderCache.get(form);
  const c = makeCanvas(DW, DH);
  const ctx = c.getContext('2d');
  const monster = form === 'monster';
  const fill = monster ? '#77736f' : '#b9b4aa';
  const shapes = [
    (x) => x.ellipse(200, 172, 128, 120, 0, 0, TAU),
    (x) => { x.moveTo(125, 285); x.bezierCurveTo(100, 380, 105, 500, 130, 530); x.lineTo(270, 530); x.bezierCurveTo(295, 500, 300, 380, 275, 285); x.closePath(); },
    (x) => x.ellipse(112, 372, 24, 52, 0.18, 0, TAU),
    (x) => x.ellipse(288, 372, 24, 52, -0.18, 0, TAU),
    (x) => x.ellipse(162, 530, 38, 14, 0, 0, TAU),
    (x) => x.ellipse(238, 530, 38, 14, 0, 0, TAU),
  ];
  ctx.lineCap = 'round';
  shapes.slice().reverse().forEach((s, i) => {
    ctx.beginPath(); s(ctx); ctx.fillStyle = fill; ctx.fill();
  });
  shapes.forEach((s, i) => {
    ctx.save(); ctx.beginPath(); s(ctx); ctx.clip();
    ctx.strokeStyle = 'rgba(40,36,32,.28)'; ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let k = -600; k < 600; k += 9) { const j = hash(k + i * 31) * 3; ctx.moveTo(k + j, 0); ctx.lineTo(k + 380 + j, 560); }
    ctx.stroke(); ctx.restore();
    for (let p = 0; p < 2; p++) {
      ctx.save(); ctx.translate(p * 1.6 - 0.8, p * 1.1 - 0.5); ctx.beginPath(); s(ctx);
      ctx.strokeStyle = INK; ctx.globalAlpha = p ? 0.5 : 0.85; ctx.lineWidth = p ? 1.4 : 2.6; ctx.stroke(); ctx.restore();
    }
  });
  // sleepy dot eyes
  ctx.fillStyle = 'rgba(26,21,17,.7)';
  ctx.beginPath(); ctx.arc(158, 190, 12, 0, TAU); ctx.arc(242, 190, 12, 0, TAU); ctx.fill();
  placeholderCache.set(form, c);
  return c;
}

/** A visual source for (figure, form): loaded image, or the placeholder canvas. */
async function loadSource(figure, form) {
  const src = figure?.images?.[form === 'monster' ? 'monster' : 'standard'];
  const img = await loadFigureImage(src);
  return img ?? placeholderCanvas(form);
}

/* Baked "line boil" frames: the image passed through #sketch / #sketch2 / #sketch3 once,
   shared between all views, so the animation costs only a drawImage. */
const boilCache = new Map();
const BOIL_IDS = ['sketch', 'sketch2', 'sketch3'];
function bakeBoil(key, source) {
  if (boilCache.has(key)) return boilCache.get(key);
  let frames = null;
  try {
    const probe = makeCanvas(2, 2).getContext('2d');
    if ('filter' in probe) {
      frames = BOIL_IDS.map((id) => {
        const c = makeCanvas(DW, DH);
        const x = c.getContext('2d');
        x.filter = `url(#${id})`;
        x.drawImage(source, 0, 0, DW, DH);
        x.filter = 'none';
        return c;
      });
      // verify the filter actually produced pixels
      const alphaSum = (c) => { const d = c.getContext('2d').getImageData(0, DH / 2 - 40, DW, 80).data; let s = 0; for (let i = 3; i < d.length; i += 16) s += d[i]; return s; };
      const ref = makeCanvas(DW, DH); ref.getContext('2d').drawImage(source, 0, 0, DW, DH);
      if (alphaSum(frames[0]) < alphaSum(ref) * 0.5) frames = null;
    }
  } catch { frames = null; }
  boilCache.set(key, frames);
  return frames;
}

/* Eye sampling for blinking: colour around the eye + eye radius, read from the image. */
const eyeCache = new Map();
function sampleEyes(key, source, figure) {
  if (eyeCache.has(key)) return eyeCache.get(key);
  let result = null;
  try {
    const c = makeCanvas(DW, DH);
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(source, 0, 0, DW, DH);
    const data = x.getImageData(0, 0, DW, DH).data;
    const px = (ix, iy) => { const i = (Math.round(iy) * DW + Math.round(ix)) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };
    const lum = (p) => 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2];
    const one = (name) => {
      const [cx, cy] = anchorPx(figure, name);
      const c0 = lum(px(cx, cy));
      const radii = [];
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * TAU; let r = 0;
        for (; r < 40; r++) {
          const p = px(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          if (p[3] < 120 || lum(p) > c0 + 75) break;
        }
        radii.push(r);
      }
      radii.sort((a, b) => a - b);
      let r = radii[12];
      if (c0 > 110 || r >= 36 || r < 6) r = 17;
      r = clamp(r, 11, 25);
      // skin colour: ring around the eye, ignoring ink-dark pixels when possible
      const all = [];
      for (let k = 0; k < 28; k++) {
        const a = (k / 28) * TAU;
        for (const m of [1.55, 1.9, 2.3]) {
          const p = px(cx + Math.cos(a) * r * m, cy + Math.sin(a) * r * m);
          if (p[3] > 200) all.push(p);
        }
      }
      let use = all.filter((p) => lum(p) > 60);
      if (use.length < 12) use = all;
      if (!use.length) return { x: cx, y: cy, r, color: '#d9d0bd', dark: '#4a413a' };
      const med = (i) => { const v = use.map((p) => p[i]).sort((a, b) => a - b); return v[v.length >> 1]; };
      const R = med(0), G = med(1), B = med(2);
      return { x: cx, y: cy, r, color: `rgb(${R},${G},${B})`, dark: `rgb(${R * 0.35 | 0},${G * 0.35 | 0},${B * 0.35 | 0})` };
    };
    result = { L: one('eyeL'), R: one('eyeR') };
  } catch { result = null; }
  eyeCache.set(key, result);
  return result;
}

/* Outline-only version of an image (for the whisperer: faint outline only). */
function outlineCanvas(source) {
  const c = makeCanvas(DW, DH);
  const x = c.getContext('2d');
  const o = 3;
  for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, o], [-o, o], [o, -o]]) x.drawImage(source, dx, dy, DW, DH);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#c9d3ea'; x.fillRect(0, 0, DW, DH);
  x.globalCompositeOperation = 'destination-out';
  x.drawImage(source, 0, 0, DW, DH);
  return c;
}

/** Param that is a multiplier when small (figures.js uses 0.8..1.4) or an absolute size when large. */
const scaled = (v, base) => (v == null ? base : v <= 4 ? v * base : v);

/* ------------------------------------------------------------- tell effects */

// Each factory gets { x, y, tell, params, level, seed, figure } and returns draw(ctx, t).
// level 2 = subtle: smaller / fewer / fainter, but still >= ~20 px at stage scale.

function fxDrip({ x, y, params, level, seed }) {
  const color = params.color ?? '#111';
  const drips = level >= 2 ? [{ dx: -4, ph: 0, len: 80 }] : [{ dx: -14, ph: 0, len: 105 }, { dx: 16, ph: 0.45, len: 85 }];
  const r0 = level >= 2 ? 6.5 : 8;
  return (ctx, t) => {
    drips.forEach((d, i) => {
      const u = (t / 3 + d.ph) % 1;
      const px = x + d.dx + Math.sin(t * 2 + i) * 0.6;
      let r = r0, py = y, alpha = 1, trail = 0;
      if (u < 0.22) { r = r0 * easeOut(u / 0.22); py = y + r * 0.6; }
      else if (u < 0.85) { const k = (u - 0.22) / 0.63; py = y + r0 * 0.6 + k * k * d.len; trail = py - y; }
      else { const k = (u - 0.85) / 0.15; py = y + r0 * 0.6 + d.len; trail = d.len; alpha = 1 - k; }
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (trail > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = r * 0.9 + 2.2;
        ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, py - r); ctx.stroke();
        ctx.strokeStyle = color; ctx.lineWidth = r * 0.9; ctx.globalAlpha = alpha * 0.9;
        ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + Math.sin(py * 0.2 + i) * 0.8, py - r); ctx.stroke();
        ctx.globalAlpha = alpha;
      }
      const build = (c) => teardrop(c, px, py, r);
      ctx.beginPath(); build(ctx); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 3.6; ctx.stroke();
      pencil(ctx, build, { fill: color, w: 1.8, seed: seed + i });
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.ellipse(px - r * 0.38, py - r * 0.1, r * 0.2, r * 0.38, 0.3, 0, TAU); ctx.fill();
      ctx.restore();
    });
  };
}

function fxSmear({ x, y, params, level, seed }) {
  const size = scaled(params.size, 52) * (level >= 2 ? 0.85 : 1);
  const color = params.color ?? '#1a1416';
  return (ctx, t) => {
    const wob = Math.floor(t * 6);
    const pts = blobPts(x, y, size * 0.55, size * 0.42, 11, seed + wob * 0.05, 0.55, Math.sin(t * 0.8));
    const build = (c) => closedSmooth(c, pts);
    ctx.save();
    ctx.globalAlpha = level >= 2 ? 0.78 : 0.88;
    ctx.beginPath(); build(ctx); ctx.fillStyle = color; ctx.fill();
    hatch(ctx, build, x, y, size, 'rgba(255,255,255,0.35)', 0.55, seed, 5, -0.7);
    ctx.globalAlpha = 1;
    ctx.beginPath(); build(ctx); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3.4; ctx.stroke();
    pencil(ctx, build, { w: 2, seed });
    // a little run of ink down from the blotch
    const k = (t * 0.35) % 1;
    ctx.fillStyle = color; ctx.globalAlpha = 0.85 * (1 - smooth(0.7, 1, k));
    ctx.beginPath(); ctx.ellipse(x + size * 0.18, y + size * 0.36 + k * 14, 3.2, 6 + k * 8, 0, 0, TAU); ctx.fill();
    ctx.restore();
  };
}

function fxPixels({ x, y, params, level, seed }) {
  const colors = params.colors?.length ? params.colors : ['#27d3ff', '#ff2fa8', '#161616', '#58ff7a'];
  const base = (params.size ?? 8) * (level >= 2 ? 0.95 : 1.15);
  const n = level >= 2 ? 11 : 17;
  return (ctx, t) => {
    ctx.save();
    for (let i = 0; i < n; i++) {
      const per = 0.14 + hash(seed + i) * 0.35;
      const step = Math.floor(t / per + i * 3.3);
      const a = hash(seed + step * 1.3 + i * 5) * TAU, d = Math.sqrt(hash(seed + step * 2.1 + i * 7)) * 50;
      const s = base * (0.6 + hash(seed + step + i * 9) * 1.1);
      const on = hash(step * 3.7 + i) > 0.18;
      if (!on) continue;
      const px = Math.round((x + Math.cos(a) * d * 1.15) / 2) * 2, py = Math.round((y + Math.sin(a) * d * 0.85) / 2) * 2;
      ctx.fillStyle = colors[(i + step) % colors.length];
      ctx.fillRect(px - s / 2, py - s / 2, s, s);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1; ctx.strokeRect(px - s / 2, py - s / 2, s, s);
    }
    ctx.restore();
  };
}

function fxExtraEye({ x, y, params, level, seed }) {
  const w = scaled(params.size, 34) * (level >= 2 ? 0.9 : 1.1);
  const h = w * 0.55;
  return (ctx, t) => {
    const c = (t / 5.2) % 1;
    let o = 1;
    if (c < 0.14) o = easeOut(c / 0.14);
    else if (c > 0.52 && c < 0.57) o = 1 - (c - 0.52) / 0.05 * 0.95;
    else if (c >= 0.57 && c < 0.63) o = 0.05 + (c - 0.57) / 0.06 * 0.95;
    else if (c > 0.9) o = 1 - smooth(0.9, 1, c);
    const look = Math.sin(t * 0.9 + seed) * w * 0.12, lookY = Math.sin(t * 0.6 + seed * 2) * h * 0.1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(seed) * 0.18);
    const almond = (c2, s = 1) => {
      c2.moveTo(-w / 2 * s, 0);
      c2.quadraticCurveTo(0, -h * 1.6 * o * s, w / 2 * s, 0);
      c2.quadraticCurveTo(0, h * 1.5 * o * s, -w / 2 * s, 0);
      c2.closePath();
    };
    if (o > 0.1) {
      ctx.beginPath(); almond(ctx); ctx.fillStyle = '#f4eedc'; ctx.fill();
      ctx.save(); ctx.beginPath(); almond(ctx); ctx.clip();
      ctx.fillStyle = '#6b1d33'; ctx.beginPath(); ctx.arc(look, lookY, h * 0.85, 0, TAU); ctx.fill();
      ctx.fillStyle = '#120c10'; ctx.beginPath(); ctx.arc(look, lookY, h * 0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(look - h * 0.25, lookY - h * 0.25, h * 0.17, 0, TAU); ctx.fill();
      ctx.restore();
      // red vein hints
      ctx.strokeStyle = 'rgba(160,40,40,.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-w / 2 + 2, 0); ctx.lineTo(-w / 2 + 9, -2); ctx.moveTo(w / 2 - 2, 0); ctx.lineTo(w / 2 - 9, 2.5); ctx.stroke();
    }
    pencil(ctx, (c2) => almond(c2), { w: 2.4, seed });
    // lashes / crease
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) { ctx.moveTo(i * w * 0.16, -h * 1.2 * o - 1); ctx.lineTo(i * w * 0.2, -h * 1.2 * o - 7 - Math.abs(i) * -1); }
    ctx.stroke();
    ctx.restore();
  };
}

function fxEyeGlow({ params, level, seed, figure, eyes }) {
  const color = params.color ?? '#ff3b2f';
  const pts = [anchorPx(figure, 'eyeL'), anchorPx(figure, 'eyeR')];
  return (ctx, t) => {
    const pulse = 0.7 + 0.3 * Math.sin(t * 2.6);
    pts.forEach(([ex, ey], k) => {
      const er = eyes ? (k ? eyes.R.r : eyes.L.r) : 18;
      const R = er * (level >= 2 ? 1.5 : 1.7) + pulse * 1.5;
      const wob = Math.floor(t * 7);
      const ring = blobPts(ex, ey, R, R, 12, seed + k * 3 + wob * 0.1, 0.1, 0);
      const build = (c) => closedSmooth(c, ring);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = color; ctx.shadowBlur = 16 * pulse;
      ctx.strokeStyle = color; ctx.lineWidth = level >= 2 ? 3 : 4.2; ctx.globalAlpha = 0.55 * pulse;
      ctx.beginPath(); build(ctx); ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = level >= 2 ? 2 : 2.8; ctx.globalAlpha = 0.95; ctx.lineCap = 'round';
      ctx.beginPath(); build(ctx); ctx.stroke();
      ctx.strokeStyle = 'rgba(20,10,10,.6)'; ctx.lineWidth = 1; ctx.beginPath(); closedSmooth(ctx, blobPts(ex, ey, R + 3, R + 3, 12, seed + k + 40 + wob * 0.1, 0.12)); ctx.stroke();
      if (level < 2) { // rays make the glow readable without colour
        ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + t * 0.4 + k;
          const l = 5 + pulse * 5;
          ctx.moveTo(ex + Math.cos(a) * (R + 4), ey + Math.sin(a) * (R + 4));
          ctx.lineTo(ex + Math.cos(a) * (R + 4 + l), ey + Math.sin(a) * (R + 4 + l));
        }
        ctx.stroke();
      }
      ctx.restore();
    });
  };
}

function fxCrack({ x, y, params, level, seed, tell }) {
  const color = params.color ?? '#ffd24a';
  const segs = level >= 2 ? 6 : 8;
  const L = level >= 2 ? 9 : 11;
  const pts = [[x, y]];
  let a = Math.PI / 2 + (hash(seed) - 0.5) * 1.6;
  for (let i = 0; i < segs; i++) {
    a += (hash(seed + i * 2.3) - 0.5) * 1.3;
    const l = L * (0.7 + hash(seed + i * 4.1) * 0.7);
    const p = pts[pts.length - 1];
    pts.push([p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l]);
  }
  const branchFrom = pts[3];
  const bpts = [branchFrom];
  let ba = a + (hash(seed + 5) > 0.5 ? 0.9 : -0.9);
  for (let i = 0; i < 3; i++) {
    ba += (hash(seed + i * 8.1) - 0.5) * 1.1;
    const p = bpts[bpts.length - 1];
    bpts.push([p[0] + Math.cos(ba) * L * 0.8, p[1] + Math.sin(ba) * L * 0.8]);
  }
  const up = [[x, y], [x - Math.cos(a) * 8, y - Math.sin(a) * 8 - 6], [x - 4, y - 16]];
  const lines = [pts, bpts, up];
  return (ctx, t) => {
    const flick = 0.75 + 0.25 * Math.sin(t * 4.1) * Math.sin(t * 1.7 + 1) + (hash(Math.floor(t * 10) + seed) > 0.93 ? 0.3 : 0);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const l of lines) {
      const draw = () => { ctx.beginPath(); ctx.moveTo(l[0][0], l[0][1]); for (let i = 1; i < l.length; i++) ctx.lineTo(l[i][0], l[i][1]); };
      ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.globalAlpha = 0.65; draw(); ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.globalAlpha = 0.35 * flick; draw(); ctx.stroke(); ctx.restore();
      ctx.strokeStyle = color; ctx.lineWidth = level >= 2 ? 3 : 3.8; ctx.globalAlpha = Math.min(1, flick); draw(); ctx.stroke();
      ctx.strokeStyle = '#fffbe8'; ctx.lineWidth = 1.3; ctx.globalAlpha = 0.9; draw(); ctx.stroke();
    }
    ctx.restore();
  };
}

function fxSpikes({ x, y, params, level, seed, tell }) {
  const count = params.count ?? (level >= 2 ? 4 : 6);
  const color = params.color ?? '#5b6b34';
  if (tell?.at === 'body') {
    // belly stripes that read as ribs
    return (ctx, t) => {
      ctx.save(); ctx.lineCap = 'round';
      for (let i = 0; i < count; i++) {
        const yy = y - (count - 1) * 7 + i * 14 + Math.sin(t * 1.4 + i) * 0.6;
        const wdt = 30 - Math.abs(i - (count - 1) / 2) * 2.5;
        for (const sgn of [-1, 1]) {
          const build = (c, s2) => { const j = (hash(s2 + i * 3 + sgn) - 0.5) * 2; c.moveTo(x + sgn * 3, yy + j); c.quadraticCurveTo(x + sgn * wdt * 0.7, yy - 7 + j, x + sgn * wdt, yy + 3); };
          ctx.strokeStyle = INK; ctx.lineWidth = 6.4; ctx.beginPath(); build(ctx, seed); ctx.stroke();
          ctx.strokeStyle = color; ctx.lineWidth = 3.8; ctx.beginPath(); build(ctx, seed); ctx.stroke();
        }
      }
      ctx.beginPath(); ctx.moveTo(x, y - (count - 1) * 7 - 6); ctx.lineTo(x, y + (count - 1) * 7 + 6); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = 2.6; ctx.stroke();
      ctx.restore();
    };
  }
  let dir = -Math.PI / 2;
  const dx = x - DW / 2, dy = y - DH * 0.45;
  if (Math.hypot(dx, dy) > 70) dir = Math.atan2(dy, dx);
  const span = Math.min(2.5, 0.35 + count * 0.34) * (count === 1 ? 0 : 1);
  const baseLen = level >= 2 ? 24 : 32;
  return (ctx, t) => {
    ctx.save();
    for (let i = 0; i < count; i++) {
      const f = count === 1 ? 0 : i / (count - 1) - 0.5;
      const a = dir + f * span + Math.sin(t * 1.3 + i) * 0.05 + (count === 1 ? 0.18 : 0);
      const len = baseLen * (0.75 + 0.5 * hash(seed + i * 3)) * (1 + 0.07 * Math.sin(t * 2.2 + i * 1.7));
      const r0 = count === 1 ? 2 : 10;
      const bx = x + Math.cos(a) * r0, by = y + Math.sin(a) * r0;
      const tx = x + Math.cos(a) * (r0 + len), ty = y + Math.sin(a) * (r0 + len);
      const w = count === 1 ? 2.2 : 6;
      const nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
      const build = (c, s) => { const j = (hash(s + i) - 0.5) * 1.6; c.moveTo(bx + nx, by + ny); c.lineTo(tx + j, ty + j); c.lineTo(bx - nx, by - ny); c.closePath(); };
      ctx.beginPath(); build(ctx, seed); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 4.2; ctx.stroke();
      pencil(ctx, build, { fill: color, w: 2.2, seed: seed + i * 5 });
      ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(bx + nx * 0.2, by + ny * 0.2); ctx.lineTo(tx - Math.cos(a) * 3, ty - Math.sin(a) * 3); ctx.stroke();
    }
    ctx.restore();
  };
}

function fxBubbles({ x, y, params, level, seed }) {
  const color = params.color ?? '#9edcff';
  const n = level >= 2 ? 5 : 8;
  return (ctx, t) => {
    ctx.save();
    for (let i = 0; i < n; i++) {
      const per = 2.4 + hash(seed + i) * 1.1;
      const u = (t / per + hash(seed + i * 7)) % 1;
      const bx = x + (hash(seed + i * 3) - 0.5) * 34 + Math.sin(u * 7 + i * 2) * 9;
      const by = y - u * 105;
      const r = (5 + hash(seed + i * 5) * 7) * (0.6 + 0.5 * u) * (level >= 2 ? 0.95 : 1.1);
      ctx.globalAlpha = Math.min(1, u * 8) * (1 - smooth(0.75, 1, u));
      ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.fillStyle = color; ctx.globalAlpha *= 0.4; ctx.fill();
      ctx.globalAlpha = Math.min(1, u * 8) * (1 - smooth(0.75, 1, u));
      pencil(ctx, (c, s) => c.ellipse(bx, by, r + (hash(s) - 0.5), r - (hash(s + 1) - 0.5), 0, 0, TAU), { w: 1.9, seed: seed + i });
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(bx, by, r * 0.62, Math.PI * 1.1, Math.PI * 1.55); ctx.stroke();
    }
    ctx.restore();
  };
}

function fxFrost({ level, seed }) {
  const crystals = [];
  const add = (px, py, ang, len, s) => crystals.push({ px: px + (hash(s * 3 + seed) - 0.5) * 10, py: py + (hash(s * 5 + seed) - 0.5) * 10, ang: ang + (hash(s * 7 + seed) - 0.5) * 0.7, len: len * (0.5 + hash(s * 11 + seed) * 0.9), s, br: 1 + Math.floor(hash(s * 13 + seed) * 3) });
  const step = level >= 2 ? 60 : 38;
  for (let px = 10; px < DW; px += step) { add(px, DH - 2, -Math.PI / 2 + (hash(px + seed) - 0.5) * 0.6, 40 + hash(px) * 40, px); add(px + 11, 2, Math.PI / 2 + (hash(px + 9 + seed) - 0.5) * 0.6, 28 + hash(px + 3) * 34, px + 50); }
  for (let py = 40; py < DH - 20; py += step + 8) { add(2, py, (hash(py + seed) - 0.5) * 0.6, 34 + hash(py) * 36, py + 90); add(DW - 2, py + 12, Math.PI + (hash(py + 5 + seed) - 0.5) * 0.6, 34 + hash(py + 4) * 36, py + 130); }
  const corners = [[0, 0, 0.78], [DW, 0, 2.36], [0, DH, -0.78], [DW, DH, -2.36]];
  corners.forEach(([cx, cy, ca], i) => { for (let k = 0; k < 3; k++) add(cx, cy, ca + (k - 1) * 0.5, 70 + hash(i * 9 + k) * 40, i * 10 + k); });
  const fern = (ctx, c, g) => {
    const L = c.len * g, ex = c.px + Math.cos(c.ang) * L, ey = c.py + Math.sin(c.ang) * L;
    ctx.moveTo(c.px, c.py); ctx.lineTo(ex, ey);
    for (const f of [0.28, 0.5, 0.7, 0.88].slice(0, 1 + (c.br ?? 2))) {
      const bx = c.px + Math.cos(c.ang) * L * f, by = c.py + Math.sin(c.ang) * L * f;
      const bl = L * 0.32 * (1.1 - f * 0.7);
      for (const sgn of [-1, 1]) { const a2 = c.ang + sgn * (0.7 + f * 0.5); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a2) * bl, by + Math.sin(a2) * bl); }
    }
  };
  return (ctx, t) => {
    const g = 0.3 + 0.7 * easeOut(clamp(t / 4.5, 0, 1)) + 0.03 * Math.sin(t);
    ctx.save();
    // glaze patches in the corners
    for (const [cx, cy] of corners) {
      const r = 120 * g;
      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, 'rgba(235,247,255,.7)'); gr.addColorStop(1, 'rgba(235,247,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#4f78a3'; ctx.lineWidth = 4.4; ctx.globalAlpha = 0.6; ctx.beginPath();
    for (const c of crystals) fern(ctx, c, g);
    ctx.stroke();
    ctx.strokeStyle = '#eaf6ff'; ctx.lineWidth = 2.6; ctx.globalAlpha = 0.97; ctx.beginPath();
    for (const c of crystals) fern(ctx, { ...c, px: c.px + 0.8, py: c.py - 0.6 }, g);
    ctx.stroke();
    // sparkles
    ctx.fillStyle = '#fff'; ctx.globalAlpha = 1;
    for (let i = 0; i < 6; i++) {
      const k = (t / 1.8 + hash(seed + i)) % 1;
      const c = crystals[Math.floor(hash(seed + i * 5) * crystals.length)];
      const sx = c.px + Math.cos(c.ang) * c.len * g * 0.8, sy = c.py + Math.sin(c.ang) * c.len * g * 0.8;
      ctx.globalAlpha = Math.sin(k * Math.PI);
      star(ctx, sx, sy, 5 + 3 * Math.sin(k * Math.PI), k); ctx.fill();
    }
    ctx.restore();
  };
}

function fxTeeth({ x, y, level, seed }) {
  const w = level >= 2 ? 38 : 50;
  const n = level >= 2 ? 6 : 7;
  const th = level >= 2 ? 7 : 10;
  return (ctx, t) => {
    const gap = (level >= 2 ? 3 : 6) + 3 * Math.sin(t * 3.1) * Math.sin(t * 1.3) + (level >= 2 ? 0 : 2);
    const x0 = x - w / 2, tw = w / n;
    ctx.save();
    ctx.fillStyle = '#1b0f12';
    ctx.beginPath(); ctx.ellipse(x, y, w / 2 + 3, gap / 2 + th * 0.9, 0, 0, TAU); ctx.fill();
    for (const dir of [-1, 1]) {
      const edge = y + dir * gap / 2;
      const build = (c, s) => {
        c.moveTo(x0, edge - dir * 2);
        for (let i = 0; i < n; i++) {
          const j = (hash(s + i) - 0.5) * 1.6;
          c.lineTo(x0 + i * tw + tw / 2 + j, edge + dir * th);
          c.lineTo(x0 + (i + 1) * tw, edge);
        }
        c.lineTo(x0 + w, edge - dir * 2); c.closePath();
      };
      pencil(ctx, build, { fill: '#f6f1e2', w: 1.8, seed: seed + dir });
    }
    // glint
    const k = (t / 2.4) % 1;
    if (k < 0.35) {
      const gx = x0 + (k / 0.35) * w, gy = y - gap / 2 - th * 0.55;
      ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 8; ctx.globalAlpha = Math.sin((k / 0.35) * Math.PI);
      star(ctx, gx, gy, 7, t * 3); ctx.fill();
    }
    ctx.restore();
  };
}

function fxSpores({ x, y, params, level, seed }) {
  const color = params.color ?? '#dcc050';
  const n = level >= 2 ? 8 : 13;
  return (ctx, t) => {
    ctx.save();
    for (let i = 0; i < n; i++) {
      const u = (t * (0.1 + hash(seed + i) * 0.08) + hash(seed + i * 3)) % 1;
      const px = x + (hash(seed + i * 5) - 0.5) * 70 + Math.sin(t * 0.7 + i * 2) * 14;
      const py = y + 26 - u * 90;
      const r = 3 + hash(seed + i * 9) * 3.2;
      ctx.globalAlpha = Math.sin(u * Math.PI) * 0.95;
      ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke();
      if (i % 3 === 0) { ctx.globalAlpha *= 0.55; ctx.beginPath(); ctx.arc(px, py, r + 4 + Math.sin(t * 2 + i) * 1.5, 0, TAU); ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.stroke(); }
    }
    ctx.restore();
  };
}

function fxSmoke({ x, y, level, seed }) {
  const n = level >= 2 ? 7 : 11;
  return (ctx, t) => {
    ctx.save();
    const wob = Math.floor(t * 6) * 0.01;
    for (let i = 0; i < n; i++) {
      const u = (t / 3.4 + i / n) % 1;
      const px = x + Math.sin(u * 5 + i * 1.3) * 11 + u * 16 + (hash(seed + i) - 0.5) * 12;
      const py = y - u * 96;
      const r = 8 + u * 17;
      const a = Math.sin(Math.min(u * 6, 1) * Math.PI / 2) * (1 - u) * (level >= 2 ? 0.8 : 0.95);
      ctx.globalAlpha = a;
      const pts = blobPts(px, py, r, r * 0.85, 8, seed + i + wob, 0.45);
      ctx.beginPath(); closedSmooth(ctx, pts); ctx.fillStyle = '#1d1a20'; ctx.fill();
      ctx.strokeStyle = 'rgba(235,240,255,.5)'; ctx.lineWidth = 1.6; ctx.stroke();
    }
    // curly wisp lines
    ctx.globalAlpha = 0.7; ctx.strokeStyle = '#0c0a0d'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    for (let w = 0; w < (level >= 2 ? 1 : 2); w++) {
      ctx.beginPath();
      for (let s = 0; s <= 18; s++) {
        const u = s / 18; const px = x + (w ? 10 : -9) + Math.sin(u * 7 + t * 1.6 + w * 2) * (6 + u * 9) , py = y - 8 - u * 78;
        s ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.save(); ctx.strokeStyle = 'rgba(235,240,255,.35)'; ctx.lineWidth = 4.6; ctx.stroke(); ctx.restore();
      ctx.stroke();
    }
    ctx.restore();
  };
}

function fxStatic({ x, y, level, seed }) {
  const nw = 30, nh = 20;
  const noise = makeCanvas(nw, nh);
  const nctx = noise.getContext('2d');
  const img = nctx.createImageData(nw, nh);
  let lastStep = -1;
  const W = level >= 2 ? 50 : 64, H = level >= 2 ? 34 : 44;
  return (ctx, t) => {
    const step = Math.floor(t * 14);
    if (step !== lastStep) {
      lastStep = step;
      for (let i = 0; i < nw * nh; i++) {
        const v = Math.random() < 0.5 ? 20 + Math.random() * 60 : 150 + Math.random() * 105;
        img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v * 1.03; img.data[i * 4 + 3] = 255;
      }
      nctx.putImageData(img, 0, 0);
    }
    const jx = (hash(step + seed) - 0.5) * 3, jy = (hash(step * 1.7 + seed) - 0.5) * 3;
    ctx.save();
    ctx.translate(x + jx, y + jy); ctx.rotate((hash(seed) - 0.5) * 0.2);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(noise, -W / 2, -H / 2, W, H);
    // rolling band
    const k = (t * 0.8) % 1;
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-W / 2, -H / 2 + k * H, W, 5);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    for (let yy = -H / 2; yy < H / 2; yy += 4) ctx.fillRect(-W / 2, yy, W, 1);
    pencil(ctx, (c, s) => { c.rect(-W / 2 + (hash(s) - 0.5), -H / 2 + (hash(s + 1) - 0.5), W, H); }, { w: 2.6, seed });
    ctx.restore();
  };
}

function fxStars({ x, y, params, level, seed }) {
  const color = params.color ?? '#ffe27a';
  const n = level >= 2 ? 6 : 9;
  return (ctx, t) => {
    ctx.save();
    for (let i = 0; i < n; i++) {
      const u = (t * 0.22 + i / n) % 1;
      const a = t * 1.6 + i * 2.1 + u * 5;
      const r = 12 + u * 44;
      const px = x + Math.cos(a) * r * 1.25, py = y + Math.sin(a) * r * 0.8;
      const sz = (level >= 2 ? 6.5 : 8.5) * (0.8 + hash(seed + i) * 0.5);
      ctx.globalAlpha = Math.sin(u * Math.PI);
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 6;
      star(ctx, px, py, sz, t + i); ctx.fill();
      ctx.shadowBlur = 0; ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke();
    }
    ctx.restore();
  };
}

function fxWetPrints({ x, y, level, seed }) {
  const prints = [{ dx: -42, dy: -14, rot: -0.15, ph: 0 }, { dx: 44, dy: -20, rot: 0.15, ph: 0.5 }];
  if (level < 2) prints.push({ dx: -74, dy: -4, rot: -0.35, ph: 0.25 }, { dx: 76, dy: -6, rot: 0.3, ph: 0.75 });
  return (ctx, t) => {
    ctx.save();
    // puddle
    ctx.fillStyle = 'rgba(40,64,92,.45)';
    ctx.beginPath(); closedSmooth(ctx, blobPts(x, y - 6, level >= 2 ? 70 : 92, 15, 10, seed + Math.floor(t * 3) * 0.02, 0.35)); ctx.fill();
    ctx.strokeStyle = 'rgba(190,220,255,.6)'; ctx.lineWidth = 1.4;
    const rp = (t * 0.5) % 1; ctx.globalAlpha = 1 - rp;
    ctx.beginPath(); ctx.ellipse(x, y - 6, 30 + rp * 55, 5 + rp * 8, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
    for (const p of prints) {
      const u = (t / 3.6 + p.ph) % 1;
      ctx.globalAlpha = smooth(0, 0.1, u) * (1 - smooth(0.7, 1, u));
      ctx.save(); ctx.translate(x + p.dx, y + p.dy); ctx.rotate(p.rot);
      const foot = (c) => { c.ellipse(0, 4, 13, 20, 0, 0, TAU); };
      ctx.beginPath(); foot(ctx); ctx.fillStyle = 'rgba(32,52,80,.7)'; ctx.fill();
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-9 + i * 6, -19 - Math.abs(i - 1.5) * -1.2, 3.4, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = 'rgba(190,220,255,.85)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(0, 4, 13, 20, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = INK; ctx.globalAlpha *= 0.6; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0.8, 4.5, 13, 20, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    // dripping
    const d = (t * 1.1) % 1; ctx.globalAlpha = 1 - d; ctx.fillStyle = 'rgba(60,100,150,.9)';
    ctx.beginPath(); teardrop(ctx, x + 10, y - 44 + d * 30, 3.2); ctx.fill();
    ctx.restore();
  };
}

function fxRust({ x, y, params, level, seed }) {
  const size = scaled(params.size, 48) * (level >= 2 ? 0.85 : 1);
  return (ctx, t) => {
    const wob = Math.floor(t * 4) * 0.01;
    const grow = 1 + 0.04 * Math.sin(t * 0.7);
    const pts = blobPts(x, y, size * 0.55 * grow, size * 0.45 * grow, 12, seed + wob, 0.5);
    const build = (c) => closedSmooth(c, pts);
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 2, x, y, size * 0.6);
    g.addColorStop(0, '#c8702d'); g.addColorStop(0.65, '#9a4a1b'); g.addColorStop(1, '#5e2b10');
    ctx.globalAlpha = level >= 2 ? 0.82 : 0.92;
    ctx.beginPath(); build(ctx); ctx.fillStyle = g; ctx.fill();
    hatch(ctx, build, x, y, size, 'rgba(60,24,8,.6)', 0.7, seed, 5, 0.6);
    ctx.globalAlpha = 1;
    ctx.beginPath(); build(ctx); ctx.strokeStyle = '#4a200c'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); closedSmooth(ctx, blobPts(x, y, size * 0.62 * grow, size * 0.52 * grow, 12, seed + 5 + wob, 0.7)); ctx.strokeStyle = 'rgba(40,18,6,.6)'; ctx.lineWidth = 1.2; ctx.stroke();
    // flecks
    ctx.fillStyle = '#7a3913';
    for (let i = 0; i < 7; i++) { const a = hash(seed + i) * TAU, d = size * (0.55 + hash(seed + i * 3) * 0.25); ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.85, 1.6 + hash(i + seed) * 2, 0, TAU); ctx.fill(); }
    // falling flake
    const k = (t * 0.5) % 1; ctx.globalAlpha = 1 - k; ctx.fillStyle = '#8a431a';
    ctx.fillRect(x + size * 0.2 + Math.sin(k * 6) * 3, y + size * 0.3 + k * 28, 3.4, 3.4);
    ctx.restore();
  };
}

function fxVine({ x, y, params, level, seed }) {
  const color = params.color ?? '#3f7a31';
  const dir = x < DW / 2 ? -1 : 1;
  const reach = level >= 2 ? 44 : 56;
  return (ctx, t) => {
    const ph = t % 8;
    const g = easeOut(clamp(ph / 2.4, 0, 1)) * (1 - smooth(7.2, 8, ph));
    if (g <= 0.01) return;
    const sway = Math.sin(t * 1.3) * 3;
    const pts = [];
    const N = 18, E = [reach * g, -30 * g];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const ox = u * E[0] + Math.sin(u * 8 + t * 1.6) * 2.2 * u;
      const oy = E[1] * u * u * (3 - 2 * u) - Math.sin(u * Math.PI) * 12 * g + sway * u * u;
      pts.push([ox, oy]);
    }
    const r0 = 12 * g, cx = E[0], cy = E[1] - r0;
    const M = 16;
    for (let i = 1; i <= M; i++) {
      const k = i / M, a = Math.PI / 2 - k * Math.PI * 1.85, r = r0 * (1 - k * 0.8);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r + sway * 0.4]);
    }
    const P = pts.map(([ox, oy]) => [x + dir * ox, y + oy]);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const path = () => { ctx.beginPath(); openSmooth(ctx, P); };
    ctx.strokeStyle = INK; ctx.lineWidth = 5.6; ctx.globalAlpha = 0.9; path(); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 3.2; ctx.globalAlpha = 1; path(); ctx.stroke();
    const leaf = (idx, flip) => {
      const p = P[idx], q = P[idx + 1]; if (!p || !q) return;
      const ang = Math.atan2(q[1] - p[1], q[0] - p[0]) + flip * 0.9;
      ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(ang + Math.sin(t * 2 + idx) * 0.08);
      pencil(ctx, (c) => { c.moveTo(0, 0); c.quadraticCurveTo(9, -8, 20, 0); c.quadraticCurveTo(9, 7, 0, 0); }, { fill: '#5a9a42', w: 1.8, seed: seed + idx });
      ctx.restore();
    };
    if (g > 0.5) { leaf(5, -1); leaf(10, 1); }
    ctx.restore();
  };
}

/** Whole-figure effects have no overlay draw; overlay effects are factories above. */
const OVERLAY_FX = {
  drip: fxDrip, smear: fxSmear, pixels: fxPixels, extraEye: fxExtraEye, eyeGlow: fxEyeGlow,
  crack: fxCrack, spikes: fxSpikes, bubbles: fxBubbles, frost: fxFrost, teeth: fxTeeth,
  spores: fxSpores, smoke: fxSmoke, static: fxStatic, stars: fxStars, wetPrints: fxWetPrints,
  rust: fxRust, vine: fxVine,
};

/* Honest oddities --------------------------------------------------------- */

function oddityWind(seed) {
  const n = 5;
  return (ctx, t) => {
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const per = 1.5 + hash(seed + i) * 0.7;
      const u = (t / per + hash(seed + i * 3)) % 1;
      const y = 140 + hash(seed + i * 5) * 330;
      const len = 70 + hash(seed + i * 7) * 50;
      const x = DW + 30 - u * (DW + len + 60);
      ctx.globalAlpha = Math.sin(u * Math.PI) * 0.95;
      const path = () => {
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + len * 0.3, y - 6, x + len * 0.6, y + 6, x + len, y - 2);
        ctx.arc(x + len, y - 8, 6, Math.PI / 2, -Math.PI * 1.1, true);
      };
      ctx.strokeStyle = 'rgba(30,36,50,.6)'; ctx.lineWidth = 7; path(); ctx.stroke();
      ctx.strokeStyle = '#e4ecf7'; ctx.lineWidth = 4; path(); ctx.stroke();
    }
    ctx.restore();
  };
}

/* ------------------------------------------------------------ figure view */

function eyeGlints(ctx, figure, t, strength, color = '#fff6d8') {
  for (const name of ['eyeL', 'eyeR']) {
    const [ex, ey] = anchorPx(figure, name);
    ctx.save();
    ctx.globalAlpha = strength * (0.75 + 0.25 * Math.sin(t * 1.6 + ex));
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(ex - 5, ey - 6, 4.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(ex + 6, ey + 5, 2, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

/**
 * A living figure: breathing, line boil, blinking, tell overlays. See docs/ARCHITECTURE.md.
 * opts = { form, tells, height, blink, honestOddity, dark, animate }
 */
export function createFigureView(figure, opts = {}) {
  const form = opts.form === 'monster' ? 'monster' : 'standard';
  const H = opts.height ?? 420;
  const W = Math.round(H * RATIO);
  const S = H / DH;
  const tells = Array.isArray(opts.tells) ? opts.tells : [];
  const animate = opts.animate !== false;
  const isStd = form === 'standard';
  const hasEyes = isStd && figure?.id !== 'faceless';

  const el = document.createElement('div');
  el.className = 'fig-view';
  el.dataset.figure = figure?.id ?? '';
  el.style.width = `${W}px`; el.style.height = `${H}px`;
  const pose = document.createElement('div'); pose.className = 'fig-pose';
  const lit = document.createElement('div'); lit.className = 'fig-lit';
  const base = makeCanvas(DW, DH); base.className = 'fig-img';
  const outline = makeCanvas(DW, DH); outline.className = 'fig-outline';
  const fx = document.createElement('canvas'); fx.className = 'fig-fx';
  const RES = Math.min(2, Math.max(1.5, window.devicePixelRatio || 1)); // overlay resolution (the stage is often CSS-scaled up)
  fx.width = Math.round(W * RES); fx.height = Math.round(H * RES);
  lit.append(base, outline);
  pose.append(lit, fx);
  el.append(pose);

  // --- state
  const st = {
    destroyed: false, raf: 0, t0: performance.now(), light: 1, dark: !!opts.dark,
    reduced: prefersReduced(), source: null, frames: null, eyes: null, outlineReady: false,
    boilIdx: 0, boilAt: -1, lastDraw: -1, blinkNext: 2 + Math.random() * 3, blinkStart: -9, blinkDouble: false,
    jitterNext: 1.5 + Math.random() * 2, jitterStart: -9, boilPhase: Math.random() * 0.34,
  };

  // --- classify tells
  const whole = { mirrored: false, tilt: 0, tooClose: false, translucent: false, jitter: false, noBlink: false };
  const draws = [];
  if (isStd) {
    for (const tell of tells) {
      if (!tell || tell.kind === 'audio' || tell.kind === 'text') continue;
      const e = tell.effect;
      if (e === 'mirrored') whole.mirrored = true;
      else if (e === 'tilt') whole.tilt = Number(tell.params?.deg ?? 6) || 6;
      else if (e === 'tooClose') whole.tooClose = true;
      else if (e === 'translucent') whole.translucent = true;
      else if (e === 'jitter') whole.jitter = true;
      else if (e === 'noBlink') whole.noBlink = true;
      else if (OVERLAY_FX[e]) draws.push({ e, tell });
    }
  }
  const oddity = isStd && opts.honestOddity !== false ? figure?.honestOddity?.effect ?? null : null;
  const baseDarken = oddity === 'dark' ? 0.5 : 1;

  let drawers = [];
  const buildDrawers = () => {
    drawers = draws.map(({ e, tell }, i) => {
      const [x, y] = anchorPx(figure, tell.at ?? (e === 'frost' ? 'face' : 'face'));
      const level = tell.level ?? 1;
      const fn = OVERLAY_FX[e]({ x, y, tell, params: tell.params ?? {}, level, seed: strHash(tell.id ?? e) + i * 17, figure, eyes: st.eyes });
      if (e === 'frost' || e === 'eyeGlow') return fn;
      // effects are authored at a small size; scale them up around their anchor so they read at stage scale
      const U = level >= 2 ? 1.25 : 1.45;
      return (ctx, t) => { ctx.save(); ctx.translate(x, y); ctx.scale(U, U); ctx.translate(-x, -y); fn(ctx, t); ctx.restore(); };
    });
  };
  buildDrawers();

  let flickerLayer = null;
  if (oddity === 'flicker') {
    flickerLayer = { c: makeCanvas(200, 280), seed: strHash(figure?.id ?? 'g') };
  }
  const windDraw = oddity === 'wind' ? oddityWind(strHash(figure?.id ?? 'z')) : null;

  // --- lighting
  const applyLight = () => {
    const b = clamp(0.1 + 0.9 * st.light, 0, 1) * baseDarken;
    const sat = 0.55 + 0.45 * st.light;
    base.style.filter = b >= 0.999 && sat >= 0.999 ? '' : `brightness(${b.toFixed(3)}) saturate(${sat.toFixed(3)})`;
    base.style.opacity = st.dark ? '0.05' : '1';
    outline.style.opacity = st.dark ? String(0.55 * st.light) : '0';
    fx.style.opacity = String(clamp(0.25 + 0.75 * st.light, 0, 1));
  };
  applyLight();

  // --- base image drawing
  const bctx = base.getContext('2d');
  const paintBase = (idx) => {
    bctx.clearRect(0, 0, DW, DH);
    const src = idx > 0 && st.frames ? st.frames[idx - 1] : st.source;
    if (src) bctx.drawImage(src, 0, 0, DW, DH);
  };

  loadSource(figure, form).then((source) => {
    if (st.destroyed) return;
    st.source = source;
    const key = (figure?.images?.[form] ?? 'ph') + (source instanceof HTMLCanvasElement ? '#ph' : '');
    st.frames = animate ? bakeBoil(key, source) : null;
    if (hasEyes && opts.blink !== false && !whole.noBlink) st.eyes = sampleEyes(key, source, figure);
    if (st.eyes) buildDrawers();
    try { outline.getContext('2d').drawImage(outlineCanvas(source), 0, 0); } catch { /* ignore */ }
    paintBase(0);
    el.classList.add('fig-loaded');
    if (source instanceof HTMLCanvasElement) el.classList.add('fig-placeholder');
    st.boilIdx = 0;
  });

  // --- the loop
  const fctx = fx.getContext('2d');
  const drawBlink = (t) => {
    if (!st.eyes || st.dark) return;
    const since = t - st.blinkStart;
    let k = 0;
    if (since >= 0 && since < 0.26) k = since < 0.09 ? since / 0.09 : since < 0.15 ? 1 : 1 - (since - 0.15) / 0.11;
    if (t >= st.blinkNext && since > 0.26) { st.blinkStart = t; st.blinkNext = t + (st.blinkDouble ? 0.45 : rand(2, 6)); st.blinkDouble = !st.blinkDouble && Math.random() < 0.18; }
    if (k <= 0.01) return;
    for (const e of [st.eyes.L, st.eyes.R]) {
      const r = e.r * 1.12;
      fctx.save();
      fctx.beginPath(); fctx.rect(e.x - r * 1.5, e.y - r * 1.25, r * 3, r * 2.5 * k); fctx.clip();
      fctx.fillStyle = e.color;
      fctx.beginPath(); fctx.ellipse(e.x, e.y, r * 1.08, r * 1.18, 0, 0, TAU); fctx.fill();
      fctx.restore();
      if (k > 0.55) {
        fctx.save(); fctx.strokeStyle = e.dark; fctx.lineWidth = 2.2; fctx.lineCap = 'round'; fctx.globalAlpha = 0.9;
        fctx.beginPath(); fctx.moveTo(e.x - r * 0.95, e.y + r * 0.1); fctx.quadraticCurveTo(e.x, e.y + r * 0.55, e.x + r * 0.95, e.y + r * 0.1); fctx.stroke();
        fctx.lineWidth = 1.3;
        fctx.beginPath();
        for (const dx of [-0.6, 0, 0.6]) { fctx.moveTo(e.x + dx * r, e.y + r * 0.38 + (dx === 0 ? 0.1 : 0)); fctx.lineTo(e.x + dx * r * 1.15, e.y + r * 0.7); }
        fctx.stroke(); fctx.restore();
      }
    }
  };

  const drawFlicker = (t) => {
    const m = flickerLayer.c, mx = m.getContext('2d');
    mx.setTransform(1, 0, 0, 1, 0, 0); mx.clearRect(0, 0, 200, 280);
    mx.setTransform(0.5, 0, 0, 0.5, 0, 0);
    const [hx, hy] = anchorPx(figure, 'face');
    const step = Math.floor(t * 18);
    const burst = hash(step * 0.37 + flickerLayer.seed) > 0.8;
    // rolling bright band
    const roll = ((t * 0.55) % 1) * 190 - 20;
    mx.fillStyle = 'rgba(255,255,255,0.28)'; mx.fillRect(hx - 130, hy - 100 + roll, 260, 22);
    // scanlines
    mx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let yy = hy - 110; yy < hy + 100; yy += 7) mx.fillRect(hx - 130, yy, 260, 2.4);
    if (burst) {
      mx.fillStyle = 'rgba(255,255,255,0.5)'; mx.fillRect(hx - 130, hy - 110, 260, 210);
      mx.fillStyle = 'rgba(60,200,255,0.4)'; mx.fillRect(hx - 130, hy - 40 + hash(step) * 50, 260, 14);
    }
    if (hash(step * 1.9 + 3) > 0.86) { mx.fillStyle = 'rgba(0,0,0,0.55)'; mx.fillRect(hx - 130, hy - 110, 260, 210); }
    mx.setTransform(1, 0, 0, 1, 0, 0);
    mx.globalCompositeOperation = 'destination-in';
    if (st.source) mx.drawImage(st.source, 0, 0, 200, 280);
    mx.globalCompositeOperation = 'source-over';
    fctx.drawImage(m, 0, 0, DW, DH);
  };

  const frame = (now) => {
    st.raf = requestAnimationFrame(frame);
    if (st.destroyed || !el.isConnected) return;
    const t = Math.max(0, (now - st.t0) / 1000);

    // pose
    const still = st.reduced;
    const b = still ? 0 : 0.5 - 0.5 * Math.cos((t / 3.8) * TAU);
    let sx = 1 + b * 0.009, sy = 1 + b * 0.015;
    let rot = whole.tilt, tx = 0, ty = 0;
    if (whole.tooClose) { sx *= 1.12; sy *= 1.12; }
    if (whole.jitter) {
      if (t >= st.jitterNext) { st.jitterStart = t; st.jitterNext = t + rand(2, 4.5); }
      const u = (t - st.jitterStart) / 0.22;
      if (u >= 0 && u < 1) { const k = Math.sin(u * Math.PI * 3) * (1 - u); tx = k * 5 * S; ty = -Math.abs(k) * 2 * S; rot += k * 1.8; }
    }
    pose.style.transform = `translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${(whole.mirrored ? -sx : sx).toFixed(4)},${sy.toFixed(4)})`;
    if (whole.translucent) base.style.opacity = String(st.dark ? 0.05 : 0.55 + 0.06 * Math.sin(t * 1.7));

    // line boil (swap pre-baked frames; staggered per view)
    if (animate && !st.reduced && st.frames) {
      const idx = 1 + (Math.floor((t + st.boilPhase) / 0.34) % 3);
      if (idx !== st.boilAt) { st.boilAt = idx; paintBase(idx); }
    } else if (st.boilAt !== 0 && st.source) { st.boilAt = 0; paintBase(0); }

    // overlay at ~30 fps
    if (now - st.lastDraw < 33) return;
    st.lastDraw = now;
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.clearRect(0, 0, fx.width, fx.height);
    const sc = (W / DW) * RES;
    fctx.setTransform(sc, 0, 0, sc, 0, 0);
    if (st.dark) { if (hasEyes) eyeGlints(fctx, figure, t, 0.55, '#c9d3ea'); return; }
    if (isStd) {
      drawBlink(t);
      if (oddity === 'dark') eyeGlints(fctx, figure, t, 0.95);
      if (flickerLayer) drawFlicker(t);
      for (const d of drawers) d(fctx, t);
      if (windDraw) windDraw(fctx, t);
    }
  };
  st.raf = requestAnimationFrame(frame);

  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const onMq = () => { st.reduced = prefersReduced(); };
  mq?.addEventListener?.('change', onMq);

  return {
    el,
    setDark(v) { st.dark = !!v; applyLight(); },
    setLight(v) { st.light = clamp(Number(v), 0, 1); applyLight(); },
    destroy() {
      st.destroyed = true;
      cancelAnimationFrame(st.raf);
      mq?.removeEventListener?.('change', onMq);
      el.remove();
    },
  };
}

/* ------------------------------------------------------------ shadow view */

/**
 * The shadow cast on the wall by a flashlight: black silhouette, stretched and leaning,
 * soft edge, ~75 % opacity, slight wobble. With flicker it alternates between the standard
 * and the monster silhouette (level-3 disguise).
 * The element is W x H box (same as a figure view); the shadow overflows upwards/sideways.
 */
export function createShadowView(figure, { form = 'monster', height = 420, flicker = false } = {}) {
  const H = height, W = Math.round(H * RATIO);
  const el = document.createElement('div');
  el.className = 'fig-shadow';
  el.style.width = `${W}px`; el.style.height = `${H}px`;
  const wrap = document.createElement('div'); wrap.className = 'fig-shadow-wrap';
  const make = (f) => { const c = makeCanvas(DW, DH); c.className = `fig-shadow-img fig-shadow-${f}`; return c; };
  const std = make('standard'), mon = make('monster');
  wrap.append(std, mon);
  el.append(wrap);
  let cur = form === 'standard' ? 'standard' : 'monster';
  const show = (f) => { cur = f; std.style.opacity = f === 'standard' ? '1' : '0'; mon.style.opacity = f === 'monster' ? '1' : '0'; };
  show(cur);
  let destroyed = false, raf = 0, nextFlip = 0, flip = flicker;
  const t0 = performance.now(), seed = Math.random() * 10;
  const reduced = prefersReduced();
  for (const [c, f] of [[std, 'standard'], [mon, 'monster']]) {
    loadSource(figure, f).then((src) => { if (!destroyed) c.getContext('2d').drawImage(src, 0, 0, DW, DH); });
  }
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (destroyed || !el.isConnected) return;
    const t = (now - t0) / 1000;
    if (flip && now >= nextFlip) {
      // mostly the standard shape, with short glimpses of the monster one
      const monsterNow = cur === 'standard' ? Math.random() < 0.7 : Math.random() < 0.25;
      show(monsterNow ? 'monster' : 'standard');
      nextFlip = now + (monsterNow ? rand(70, 190) : rand(90, 420));
    }
    const k = reduced ? 0 : 1;
    const sway = Math.sin(t * 1.3 + seed) * 0.9 * k + Math.sin(t * 3.1) * 0.4 * k;
    const sy = 1.32 + Math.sin(t * 0.9 + seed) * 0.025 * k;
    wrap.style.transform = `skewX(${(-9 + sway).toFixed(2)}deg) scale(${(1.12 + Math.sin(t * 1.7) * 0.012 * k).toFixed(3)},${sy.toFixed(3)})`;
  };
  raf = requestAnimationFrame(loop);
  return {
    el,
    setForm(f) { flip = false; show(f === 'standard' ? 'standard' : 'monster'); },
    destroy() { destroyed = true; cancelAnimationFrame(raf); el.remove(); },
  };
}

/* ------------------------------------------------------------ mirror view */

/**
 * Round hand-mirror reflection: circular crop around the face, ~2.2x zoom, slightly blurred,
 * flipped horizontally, glass sheen.
 */
export function createMirrorView(figure, { form = 'monster', size = 240 } = {}) {
  const isMon = form === 'monster';
  const el = document.createElement('div');
  el.className = 'fig-mirror';
  el.style.width = `${size}px`; el.style.height = `${size}px`;
  const glass = document.createElement('div'); glass.className = 'fig-mirror-glass';
  const cv = makeCanvas(Math.round(size * 1.5), Math.round(size * 1.5)); cv.className = 'fig-mirror-img';
  const sheen = document.createElement('div'); sheen.className = 'fig-mirror-sheen';
  glass.append(cv, sheen);
  el.append(glass);
  let destroyed = false;
  loadSource(figure, form).then((src) => {
    if (destroyed) return;
    const a = (isMon ? figure?.monsterAnchors?.face : figure?.anchors?.face) ?? [0.5, 0.36];
    const zoom = 2.2;
    const px = cv.width;                       // canvas pixels for the full circle
    const k = (px / DW) * zoom;                // design -> canvas pixels (canvas = circle diameter)
    const ctx = cv.getContext('2d');
    ctx.save();
    ctx.translate(px / 2, px / 2);
    ctx.scale(-1, 1);                          // mirror
    try { ctx.filter = 'blur(0.8px)'; } catch { /* ignore */ }
    ctx.drawImage(src, -a[0] * DW * k, -a[1] * DH * k, DW * k, DH * k);
    ctx.restore();
  });
  return { el, destroy() { destroyed = true; el.remove(); } };
}

/* ---------------------------------------------------------------- portrait */

/** Static portrait for the album / day / morning screens. */
export function createPortrait(figure, { form = 'standard', height = 160, stamp = null, grayscale = false } = {}) {
  const W = Math.round(height * RATIO);
  const el = document.createElement('div');
  el.className = 'fig-portrait';
  el.style.width = `${W}px`; el.style.height = `${height}px`;
  const holder = document.createElement('div'); holder.className = 'fig-portrait-img';
  if (grayscale) holder.style.filter = 'grayscale(1) contrast(0.95) brightness(0.95)';
  const useCanvas = (c) => { c.style.width = '100%'; c.style.height = '100%'; holder.replaceChildren(c); };
  const src = figure?.images?.[form === 'monster' ? 'monster' : 'standard'];
  const img = new Image();
  img.alt = figure?.name ?? '';
  img.draggable = false;
  img.onerror = () => {
    const c = makeCanvas(DW, DH); c.getContext('2d').drawImage(placeholderCanvas(form), 0, 0); useCanvas(c);
    el.classList.add('fig-placeholder');
  };
  if (src) { img.src = src; holder.append(img); } else img.onerror();
  el.append(holder);
  if (stamp) {
    const s = document.createElement('div');
    s.className = `fig-stamp fig-stamp-${String(stamp).toLowerCase()}`;
    s.textContent = stamp;
    el.append(s);
  }
  return el;
}
