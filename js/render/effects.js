// Screen effects: jumpscare, monster reveal, shake, flash, light flicker, peephole fog.
// Contract: docs/ARCHITECTURE.md#rendering. Owner: render.
import { loadFigureImage, placeholderCanvas, DW, DH } from './figure.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const rnd = (a, b) => a + Math.random() * (b - a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/* Shared SVG filters for the RGB split. Injected once (own ids, prefixed fx-). */
let defsReady = false;
function ensureDefs() {
  if (defsReady || document.getElementById('fx-defs')) { defsReady = true; return; }
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('id', 'fx-defs'); s.setAttribute('width', '0'); s.setAttribute('height', '0');
  s.setAttribute('aria-hidden', 'true'); s.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  s.innerHTML = `<defs>
    <filter id="fx-red" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/></filter>
    <filter id="fx-cyan" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"/></filter>
  </defs>`;
  document.body.append(s);
  defsReady = true;
}

/** An <img> (or placeholder canvas) element showing the figure's image, 400x560 aspect. */
async function imageEl(figure, form) {
  const src = figure?.images?.[form];
  const img = await loadFigureImage(src);
  if (img) { const el = new Image(); el.src = img.src; el.draggable = false; return el; }
  const c = document.createElement('canvas'); c.width = DW; c.height = DH;
  const ctx = c.getContext('2d'); ctx.drawImage(placeholderCanvas(form), 0, 0);
  if (form === 'monster') { ctx.fillStyle = '#c01a14'; ctx.beginPath(); ctx.arc(158, 190, 14, 0, 7); ctx.arc(242, 190, 14, 0, 7); ctx.fill(); }
  return c;
}

function raf() { return new Promise((r) => requestAnimationFrame(r)); }

/* ---------------------------------------------------------------- jumpscare */

/**
 * Full-stage monster burst (~1.2 s; reduced: ~1.9 s, soft, no shake/strobe).
 * Appends an overlay to stageEl and removes it again. Resolves when finished.
 */
export async function jumpscare(stageEl, figure, { reduced = false } = {}) {
  ensureDefs();
  const sw = stageEl.clientWidth || 1280, sh = stageEl.clientHeight || 720;
  const root = document.createElement('div');
  root.className = 'fx-jump';
  const group = document.createElement('div'); group.className = 'fx-j-group';
  const make = async () => imageEl(figure, 'monster');
  const main = await make();
  main.className = 'fx-j-img fx-j-main';
  const ghosts = [];
  const layers = [main];
  if (!reduced) {
    for (const [cls, f] of [['fx-j-r', 'url(#fx-red)'], ['fx-j-c', 'url(#fx-cyan)']]) {
      const g = await make(); g.className = `fx-j-img ${cls}`; g.style.filter = f; ghosts.push(g); layers.push(g);
    }
  } else {
    // softer: a single faint red ghost
    const g = await make(); g.className = 'fx-j-img fx-j-r'; g.style.filter = 'url(#fx-red)'; g.style.opacity = '0.35'; ghosts.push(g); layers.push(g);
  }
  const slices = [];
  if (!reduced) {
    for (let i = 0; i < 6; i++) {
      const w = document.createElement('div'); w.className = 'fx-j-slice';
      const im = await make(); im.className = 'fx-j-img'; w.append(im);
      slices.push({ w, im }); layers.push(im);
    }
  }
  const redFlash = document.createElement('div'); redFlash.className = 'fx-j-red';
  const black = document.createElement('div'); black.className = 'fx-j-black';
  const vig = document.createElement('div'); vig.className = 'fx-j-vig';
  group.append(main, ...ghosts, ...slices.map((s) => s.w));
  root.append(group, vig, redFlash, black);
  stageEl.append(root);

  const fa = figure?.monsterAnchors?.face ?? [0.5, 0.36];
  // Image height at 100 % = stage height * 1.0 ; face placed slightly above stage centre
  const baseH = sh * 1.1, baseW = baseH * (DW / DH);
  const place = (el) => {
    el.style.width = `${baseW}px`; el.style.height = `${baseH}px`;
    el.style.left = `${sw / 2 - fa[0] * baseW}px`; el.style.top = `${sh * 0.46 - fa[1] * baseH}px`;
    el.style.transformOrigin = `${fa[0] * 100}% ${fa[1] * 100}%`;
  };
  layers.forEach(place);
  slices.forEach((s) => { s.w.style.width = `${sw}px`; });

  const total = reduced ? 1900 : 1200;
  const t0 = performance.now();
  let flashes = reduced ? [] : [[0.19, 0.24], [0.4, 0.45], [0.58, 0.62]];
  const sc0 = reduced ? 0.6 : 0.7, sc1 = reduced ? 0.95 : 1.4;
  let lastSlice = -1;

  await new Promise((resolve) => {
    const step = (now) => {
      const t = (now - t0) / total; // 0..1
      if (t >= 1) { resolve(); return; }
      let sc, ox = 0, oy = 0, a = 1, black_ = 0, red = 0, split = 0;
      if (!reduced) {
        if (t < 0.09) { a = 0; black_ = 1; }
        else if (t < 0.8) {
          const k = (t - 0.09) / 0.71;
          sc = lerp(sc0, sc1, k * k * (0.4 + 0.6 * k) + 0.0);
          const amp = 6 + 26 * k;
          ox = rnd(-amp, amp); oy = rnd(-amp, amp);
          split = 4 + 20 * k * Math.random();
        } else if (t < 0.87) { sc = sc1 * 1.03; ox = rnd(-30, 30); oy = rnd(-24, 24); split = 24; red = 0.55; }
        else { a = 0; black_ = 1; sc = sc1; }
        for (const [a0, a1] of flashes) if (t >= a0 && t < a1) { red = 0.7; if (t > (a0 + a1) / 2) black_ = 0.85; }
        if (sc == null) sc = sc1;
      } else {
        // gentle: fade in, slow grow, tinted, fade out. No shake, no strobe.
        if (t < 0.3) { a = t / 0.3; sc = lerp(sc0, 0.8, a); }
        else if (t < 0.75) { a = 1; sc = lerp(0.8, sc1, (t - 0.3) / 0.45); red = 0.12 * Math.sin(((t - 0.3) / 0.45) * Math.PI); }
        else { a = 1 - (t - 0.75) / 0.25; sc = sc1; }
        split = 3;
      }
      group.style.transform = `translate(${ox.toFixed(1)}px,${oy.toFixed(1)}px)`;
      main.style.transform = `scale(${sc.toFixed(3)})`;
      main.style.opacity = a;
      const g0 = ghosts[0], g1 = ghosts[1];
      if (g0) { g0.style.transform = `translate(${-split}px,0) scale(${sc.toFixed(3)})`; g0.style.opacity = reduced ? 0.3 * a : a * (split > 6 ? 0.8 : 0); }
      if (g1) { g1.style.transform = `translate(${split}px,0) scale(${sc.toFixed(3)})`; g1.style.opacity = a * (split > 6 ? 0.8 : 0); }
      // glitch slices (a few strips jump sideways at times)
      if (!reduced) {
        const si = Math.floor(t * 30);
        if (si !== lastSlice) {
          lastSlice = si;
          const active = t > 0.15 && t < 0.88 && Math.random() < 0.7;
          slices.forEach((s, i) => {
            if (!active || Math.random() < 0.4) { s.w.style.display = 'none'; return; }
            const y0 = rnd(0, 0.85) * sh, hh = rnd(0.04, 0.16) * sh;
            s.w.style.display = 'block'; s.w.style.top = `${y0}px`; s.w.style.height = `${hh}px`;
            s.im.style.transform = `translate(${rnd(-90, 90)}px, 0) scale(${sc.toFixed(3)})`;
            s.im.style.transformOrigin = `${fa[0] * 100}% ${fa[1] * 100}%`;
            s.im.style.top = `${sh * 0.46 - fa[1] * baseH - y0}px`;
            s.im.style.left = `${sw / 2 - fa[0] * baseW}px`;
            s.im.style.filter = i % 2 ? 'url(#fx-cyan)' : 'url(#fx-red)';
          });
        }
      }
      redFlash.style.opacity = red;
      black.style.opacity = black_;
      vig.style.opacity = 0.35 + 0.4 * t;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  // cut to black, then remove
  group.style.display = 'none'; redFlash.style.opacity = 0; black.style.opacity = 1; vig.style.opacity = 0;
  await wait(reduced ? 120 : 60);
  root.remove();
}

/* ------------------------------------------------------------------- reveal */

/**
 * Inside a container (peephole): glitch slices morph the figure into its monster image for
 * ~0.8 s, then fade out. If the container holds a .fig-view the overlay lines up with it;
 * otherwise the monster is centred, as tall as the container.
 */
export async function reveal(container, figure, { reduced = false } = {}) {
  ensureDefs();
  const cs = getComputedStyle(container);
  if (cs.position === 'static') container.style.position = 'relative';
  const root = document.createElement('div');
  root.className = 'fx-reveal';
  const cr = container.getBoundingClientRect();
  const scale = container.offsetWidth ? cr.width / container.offsetWidth : 1;
  let L, T, W, H;
  const fv = container.querySelector('.fig-view');
  if (fv) {
    const r = fv.getBoundingClientRect();
    L = (r.left - cr.left) / scale; T = (r.top - cr.top) / scale; W = r.width / scale; H = r.height / scale;
  } else {
    H = container.clientHeight; W = H * (DW / DH); L = (container.clientWidth - W) / 2; T = 0;
  }
  const main = await imageEl(figure, 'monster');
  const place = (el) => { el.style.cssText += `;position:absolute;left:${L}px;top:${T}px;width:${W}px;height:${H}px;`; };
  main.classList.add('fx-r-img'); place(main);
  const red = await imageEl(figure, 'monster'); red.classList.add('fx-r-img'); place(red); red.style.filter = 'url(#fx-red)';
  const cyan = await imageEl(figure, 'monster'); cyan.classList.add('fx-r-img'); place(cyan); cyan.style.filter = 'url(#fx-cyan)';
  const strips = [];
  const N = 7;
  for (let i = 0; i < N; i++) {
    const s = await imageEl(figure, 'monster'); s.classList.add('fx-r-img'); place(s);
    s.style.clipPath = `inset(${(i / N) * 100}% 0 ${(1 - (i + 1) / N) * 100}% 0)`;
    s.style.opacity = 0; strips.push(s);
  }
  const tint = document.createElement('div'); tint.className = 'fx-r-tint';
  root.append(main, red, cyan, ...strips, tint);
  main.style.opacity = 0; red.style.opacity = 0; cyan.style.opacity = 0;
  container.append(root);

  const total = reduced ? 1200 : 800;
  const t0 = performance.now();
  const order = [...Array(N).keys()].sort(() => Math.random() - 0.5);
  await new Promise((resolve) => {
    const step = (now) => {
      const t = (now - t0) / total;
      if (t >= 1) { resolve(); return; }
      if (reduced) {
        const a = t < 0.3 ? t / 0.3 : t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;
        main.style.opacity = a; root.style.opacity = 1; tint.style.opacity = 0.0;
      } else {
        const morph = clamp(t / 0.4, 0, 1);             // strips pop in one by one
        const fade = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
        strips.forEach((s, i) => {
          const at = order.indexOf(i) / N;
          const on = morph > at;
          const settled = morph >= 1;
          s.style.opacity = on && !settled ? 1 : 0;
          s.style.transform = on && !settled ? `translateX(${rnd(-26, 26)}px)` : 'none';
        });
        main.style.opacity = morph >= 1 ? fade : 0;
        const split = morph >= 1 ? 3 + Math.random() * 7 : 8;
        const ghost = morph >= 1 ? 0.38 : 0.7;
        red.style.opacity = morph > 0.2 ? ghost * fade : 0; cyan.style.opacity = morph > 0.2 ? ghost * fade : 0;
        red.style.transform = `translateX(${-split}px)`; cyan.style.transform = `translateX(${split}px)`;
        tint.style.opacity = (morph >= 1 && Math.random() < 0.25 ? 0.4 : 0) * fade;
        root.style.opacity = t > 0.7 ? fade : 1;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  root.remove();
}

/* -------------------------------------------------------------- small effects */

/** Shake any element (uses the independent CSS `translate` property so it composes). */
export function shake(el, { intensity = 8, duration = 400 } = {}) {
  if (!el || intensity <= 0) return Promise.resolve();
  const steps = Math.max(4, Math.round(duration / 40));
  const frames = [];
  for (let i = 0; i <= steps; i++) {
    const k = 1 - i / steps;
    frames.push({ translate: i === steps ? '0px 0px' : `${(rnd(-1, 1) * intensity * k).toFixed(1)}px ${(rnd(-1, 1) * intensity * k).toFixed(1)}px` });
  }
  try {
    const a = el.animate(frames, { duration, easing: 'linear' });
    return a.finished.then(() => {}, () => {});
  } catch { return Promise.resolve(); }
}

/** Full-stage colour flash. */
export function flash(stageEl, { color = '#ffffff', duration = 160 } = {}) {
  const d = document.createElement('div');
  d.className = 'fx-flash';
  d.style.background = color;
  stageEl.append(d);
  const a = d.animate([{ opacity: 0.0 }, { opacity: 0.85, offset: 0.18 }, { opacity: 0 }], { duration, easing: 'ease-out' });
  return a.finished.then(() => d.remove(), () => d.remove());
}

/** Irregular brightness flicker on an element (lights failing). Never faster than ~3 Hz for long. */
export function lightFlicker(el, { duration = 900 } = {}) {
  if (!el) return Promise.resolve();
  const levels = [1, 0.25, 0.9, 0.12, 0.6, 0.08, 0.85, 0.3, 1];
  const frames = levels.map((b, i) => ({ filter: `brightness(${b})`, offset: i / (levels.length - 1) }));
  try {
    const a = el.animate(frames, { duration, easing: 'steps(1, end)' });
    return a.finished.then(() => {}, () => {});
  } catch { return Promise.resolve(); }
}

/* ---------------------------------------------------------------------- fog */

/**
 * Round fog mask for the peephole. set(0..1): fog creeps in from the rim; at 1 the peephole
 * is almost fully fogged. Cheap: 96x96 canvas, per-pixel moving noise, scaled up by CSS.
 */
export function createFogEdge(size = 360) {
  const N = 96;
  const el = document.createElement('div');
  el.className = 'fx-fog';
  el.style.width = `${size}px`; el.style.height = `${size}px`;
  const cv = document.createElement('canvas'); cv.width = N; cv.height = N; cv.className = 'fx-fog-cv';
  el.append(cv);
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(N, N);

  // tileable value noise, 64x64
  const T = 64;
  const lattice = new Float32Array(8 * 8).map((_, i) => hash(i * 1.37 + 5));
  const noise = new Float32Array(T * T);
  const smoothstep = (x) => x * x * (3 - 2 * x);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    let v = 0, amp = 0.55, tot = 0;
    for (const [freq, a] of [[4, 0.6], [8, 0.3], [16, 0.1]]) {
      const gx = (x / T) * freq, gy = (y / T) * freq;
      const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = smoothstep(gx - x0), fy = smoothstep(gy - y0);
      const g = (ix, iy) => hash(((ix % freq) + freq) % freq * 7.13 + (((iy % freq) + freq) % freq) * 3.77 + freq * 11.1);
      const top = lerp(g(x0, y0), g(x0 + 1, y0), fx), bot = lerp(g(x0, y0 + 1), g(x0 + 1, y0 + 1), fx);
      v += lerp(top, bot, fy) * a; tot += a;
    }
    noise[y * T + x] = v / tot;
  }
  void lattice; void smoothstep;
  const rad = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) rad[y * N + x] = Math.hypot(x - N / 2 + 0.5, y - N / 2 + 0.5) / (N / 2);

  const sample = (x, y) => {
    const fx = ((x % T) + T) % T, fy = ((y % T) + T) % T;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = (x0 + 1) % T, y1 = (y0 + 1) % T, ax = fx - x0, ay = fy - y0;
    return lerp(lerp(noise[y0 * T + x0], noise[y0 * T + x1], ax), lerp(noise[y1 * T + x0], noise[y1 * T + x1], ax), ay);
  };

  let progress = 0, shown = 0, destroyed = false, id = 0, last = 0;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const render = (t) => {
    const p = shown;
    const edge = 1.12 - p * 1.32;       // radius where fog starts (1.12 = off rim, -0.2 = past centre)
    const d = img.data;
    const o1x = t * 5, o1y = t * 3, o2x = -t * 4, o2y = t * 6;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const n1 = sample(x * 0.7 + o1x, y * 0.7 + o1y), n2 = sample(x * 1.3 + o2x + 17, y * 1.3 + o2y + 31);
      const n = n1 * 0.65 + n2 * 0.35;
      const r = rad[i] + (n - 0.5) * 0.7 * (0.35 + 0.65 * Math.min(1, p * 1.6));
      let a = smoothstep(clamp((r - edge) / 0.3, 0, 1)) * 0.93;
      if (r > 1) a = Math.max(a, p > 0 ? 0.95 : 0); // the rim itself is always misty once it begins
      a *= p > 0 ? 1 : 0;
      const shade = 0.82 + n * 0.34;
      d[i * 4] = 154 * shade; d[i * 4 + 1] = 163 * shade; d[i * 4 + 2] = 181 * shade; d[i * 4 + 3] = a * 255;
    }
    ctx.putImageData(img, 0, 0);
  };
  const loop = (now) => {
    id = requestAnimationFrame(loop);
    if (destroyed || !el.isConnected) return;
    if (now - last < 55) return;       // ~18 fps is plenty for fog
    last = now;
    shown += (progress - shown) * 0.35;
    if (Math.abs(progress - shown) < 0.002) shown = progress;
    if (shown <= 0 && progress <= 0) { if (!el.classList.contains('fx-fog-off')) { ctx.clearRect(0, 0, N, N); el.classList.add('fx-fog-off'); } return; }
    el.classList.remove('fx-fog-off');
    render(reduced ? 0 : now / 1000);
  };
  el.classList.add('fx-fog-off');
  id = requestAnimationFrame(loop);
  return {
    el,
    set(p) { progress = clamp(Number(p) || 0, 0, 1); },
    destroy() { destroyed = true; cancelAnimationFrame(id); el.remove(); },
  };
}
