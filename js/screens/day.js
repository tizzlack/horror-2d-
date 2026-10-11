// Same Shape — the Lantern House by day. Owner: day agent.
// Also exports a few shared helpers used by morning.js (render loader, figure image fallback,
// small hand-drawn objects and flames).
import { h, svg, sleep, modal, clamp } from '../core/dom.js';
import { createRng } from '../core/rng.js';
import { knownFacts } from '../core/state.js';
import { getFigure } from '../data/figures.js';
import { NOTES, DAY_TEXT } from '../data/story.js';

const T = DAY_TEXT.day;
const INK = '#3a312b';

// ---------------------------------------------------------------------------------------
// Shared helpers (also imported by morning.js)
// ---------------------------------------------------------------------------------------

let renderCache = null;
/** Dynamically load the render modules; resolves to { figure, icons } (either may be null). */
export async function getRender() {
  if (renderCache) return renderCache;
  const out = { figure: null, icons: null };
  try { out.figure = await import('../render/figure.js'); } catch { /* optional */ }
  try { out.icons = await import('../render/icons.js'); } catch { /* optional */ }
  renderCache = out;
  return out;
}

let rulesCache = null;
export async function getRules() {
  if (rulesCache) return rulesCache;
  try {
    const mod = await import('../systems/rules.js');
    rulesCache = mod;
  } catch {
    rulesCache = {};
  }
  return rulesCache;
}

/** Call an audio method without ever throwing. */
export function snd(ctx, kind, arg) {
  try {
    const a = ctx.audio;
    if (!a) return;
    if (kind === 'sfx') a.sfx?.(arg);
    else if (kind === 'music') a.music?.(arg);
    else if (kind === 'ambient') a.ambient?.(arg);
  } catch { /* audio is optional */ }
}

const SOLID_BLOB_COLORS = ['#b9b2a3', '#a9b3a8', '#b6a9a1', '#a3adb6'];
/** A grey placeholder creature, used when an image is missing. */
export function blobSvg(seed = 0, form = 'standard') {
  const c = SOLID_BLOB_COLORS[Math.abs(seed) % SOLID_BLOB_COLORS.length];
  const mon = form === 'monster';
  return svg('svg', { viewBox: '0 0 400 560', class: 'day-blob', 'aria-hidden': 'true' },
    svg('g', { stroke: INK, 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: mon ? '#6c6561' : c },
      svg('path', { d: 'M110 520 Q96 380 120 300 Q104 200 150 140 Q200 90 250 140 Q296 200 280 300 Q304 380 290 520 Q200 548 110 520 Z' }),
      svg('path', { d: 'M120 320 Q70 350 66 420', fill: 'none' }),
      svg('path', { d: 'M280 320 Q330 350 334 420', fill: 'none' })),
    svg('circle', { cx: 168, cy: 215, r: 14, fill: INK }),
    svg('circle', { cx: 232, cy: 215, r: 14, fill: INK }),
    mon ? svg('path', { d: 'M160 270 L176 290 L192 268 L208 290 L224 268 L240 290', fill: 'none', stroke: INK, 'stroke-width': 6, 'stroke-linecap': 'round' })
      : svg('path', { d: 'M180 266 Q200 282 220 266', fill: 'none', stroke: INK, 'stroke-width': 6, 'stroke-linecap': 'round' }));
}

/**
 * A figure image at a given height with a graceful fallback. Aspect is the 400x560 canvas.
 * opts: { form, height, silhouette }
 */
export function figureImg(figure, { form = 'standard', height = 160, silhouette = false } = {}) {
  const w = Math.round(height * 400 / 560);
  const wrap = h('div', { class: 'day-fimg', style: { width: `${w}px`, height: `${height}px` } });
  const src = figure?.images?.[form] ?? figure?.images?.standard;
  const seed = figure?.number ?? 0;
  if (!src) { wrap.append(blobSvg(seed, form)); return wrap; }
  const img = h('img', { src, alt: figure.name ?? '', draggable: 'false' });
  if (silhouette) img.classList.add('is-silhouette');
  img.addEventListener('error', () => { img.remove(); wrap.append(blobSvg(seed, form)); }, { once: true });
  wrap.append(img);
  return wrap;
}

/** Portrait of a figure: render's createPortrait when available, else a plain framed image. */
export async function portrait(figure, { form = 'standard', height = 120, stamp = null, grayscale = false } = {}) {
  const r = await getRender();
  if (r.figure?.createPortrait) {
    try {
      const el = r.figure.createPortrait(figure, { form, height, stamp, grayscale });
      if (el) return el;
    } catch (err) { console.warn('[day] createPortrait failed', err); }
  }
  const el = h('div', { class: `day-portrait${grayscale ? ' gray' : ''}` }, figureImg(figure, { form, height }));
  if (stamp) el.append(h('span', { class: `day-stamp day-stamp-${String(stamp).toLowerCase()}` }, stamp));
  return el;
}

/** An icon from render/icons.js, or a tiny hand-drawn fallback. */
export async function iconEl(name, size = 32) {
  const r = await getRender();
  try {
    if (r.icons?.icon) {
      const el = r.icons.icon(name, { size });
      if (el) return el;
    }
  } catch { /* fall back */ }
  return fallbackIcon(name, size);
}

const FB = {
  battery: '<rect x="6" y="12" width="40" height="26" rx="4"/><rect x="46" y="20" width="6" height="10"/><path d="M14 20h8M14 30h8M26 20h8M26 30h8" />',
  wick: '<rect x="18" y="22" width="16" height="26" rx="3"/><path d="M26 22 L26 16"/><path d="M26 4 Q36 14 26 16 Q16 14 26 4 Z"/>',
  bed: '<path d="M6 40 L6 18 M6 34 L46 34 L46 40 M46 34 L46 24 Q46 22 40 22 L18 22 L18 34"/><path d="M6 40v6M46 40v6"/>',
  door: '<path d="M12 48 V16 Q12 6 26 6 Q40 6 40 16 V48 Z"/><path d="M12 22h28M12 34h28"/><circle cx="34" cy="28" r="1.5"/>',
  album: '<rect x="8" y="8" width="36" height="40" rx="3"/><path d="M14 8v40M22 18h16M22 26h16"/>',
  flame: '<path d="M26 4 Q42 20 36 34 Q32 46 26 46 Q18 46 16 34 Q14 24 26 4 Z"/><path d="M26 24 Q32 32 28 40 Q24 40 22 34 Q22 30 26 24 Z"/>',
  talk: '<path d="M8 10 H44 V34 H26 L16 44 V34 H8 Z"/>',
  friend: '<circle cx="18" cy="18" r="7"/><circle cx="34" cy="20" r="6"/><path d="M6 44 Q8 30 18 30 Q28 30 30 44 M28 44 Q30 34 36 33 Q44 34 46 44"/>',
};
export function fallbackIcon(name, size = 32) {
  const body = FB[name] ?? FB.album;
  return h('span', {
    class: 'day-icon',
    html: `<svg viewBox="0 0 52 52" width="${size}" height="${size}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`,
  });
}

/** Hand-drawn flame, lit or burnt out. Returns an HTMLElement. */
export function flameEl(lit = true, size = 34) {
  const col = lit ? '#f2b84b' : 'none';
  const inner = lit ? '#fff0b8' : 'none';
  const stroke = lit ? INK : '#8a7f72';
  return h('span', {
    class: `day-flame ${lit ? 'lit' : 'out'}`,
    html: `<svg viewBox="0 0 40 52" width="${size}" height="${Math.round(size * 1.3)}" stroke="${stroke}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M20 3 Q36 20 31 34 Q28 48 20 48 Q10 48 8 34 Q6 22 20 3 Z" fill="${col}" ${lit ? '' : 'stroke-dasharray="4 4"'}/>
      ${lit ? `<path d="M20 22 Q27 31 23 41 Q18 43 15 36 Q14 29 20 22 Z" fill="${inner}" stroke-width="1.8"/>` : '<path d="M12 30 L28 44 M28 30 L12 44" stroke-width="2.4"/>'}
    </svg>`,
  });
}

// Small hand-drawn objects (viewBox 0 0 60 60), left behind by lost guests.
const OBJ_STYLE = `stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"`;
export const OBJECTS = {
  scarf: `<path d="M8 22 Q30 12 52 24 L50 38 Q30 28 10 38 Z" fill="#c7584b" ${OBJ_STYLE}/><path d="M16 22 L14 36 M26 20 L24 33 M36 21 L35 34 M45 24 L44 37" stroke="#f4eee0" stroke-width="3.5" stroke-linecap="round"/><path d="M44 36 L50 52 L40 50 L38 38" fill="#c7584b" ${OBJ_STYLE}/>`,
  halo: `<ellipse cx="30" cy="30" rx="22" ry="9" fill="none" stroke="#e1b64a" stroke-width="6"/><ellipse cx="30" cy="30" rx="22" ry="9" fill="none" ${OBJ_STYLE} stroke-width="1.6" transform="translate(0 -3)"/>`,
  goggles: `<path d="M4 30 Q30 18 56 30" fill="none" stroke="#6b4a2f" stroke-width="5" stroke-linecap="round"/><circle cx="19" cy="31" r="12" fill="#bcd8de" ${OBJ_STYLE}/><circle cx="41" cy="31" r="12" fill="#bcd8de" ${OBJ_STYLE}/><circle cx="19" cy="31" r="6" fill="none" stroke="${INK}" stroke-width="1.6"/><circle cx="41" cy="31" r="6" fill="none" stroke="${INK}" stroke-width="1.6"/>`,
  cap: `<path d="M8 38 Q10 14 32 14 Q50 14 52 38 Z" fill="#7bbfd0" ${OBJ_STYLE}/><path d="M50 38 Q62 38 58 46 L36 44 Z" fill="#5aa3b7" ${OBJ_STYLE}/><circle cx="30" cy="14" r="2.5" fill="${INK}"/>`,
  headphones: `<path d="M10 36 Q10 10 30 10 Q50 10 50 36" fill="none" ${OBJ_STYLE} stroke-width="4"/><rect x="5" y="32" width="12" height="18" rx="5" fill="#8a64c8" ${OBJ_STYLE}/><rect x="43" y="32" width="12" height="18" rx="5" fill="#8a64c8" ${OBJ_STYLE}/>`,
  strawberry: `<path d="M10 22 Q30 12 50 22 Q48 44 30 54 Q12 44 10 22 Z" fill="#e0606a" ${OBJ_STYLE}/><path d="M18 20 L24 12 L30 18 L36 12 L42 20 Z" fill="#7ea45a" ${OBJ_STYLE}/><path d="M22 30h0M32 28h0M40 34h0M28 40h0M20 38h0" stroke="#fbe4a8" stroke-width="3.2" stroke-linecap="round"/>`,
  sprout: `<path d="M30 54 Q31 38 30 28" fill="none" ${OBJ_STYLE}/><path d="M30 30 Q16 30 12 16 Q28 14 30 30 Z" fill="#8fbf6a" ${OBJ_STYLE}/><path d="M30 34 Q44 34 48 20 Q32 18 30 34 Z" fill="#8fbf6a" ${OBJ_STYLE}/>`,
  bandage: `<rect x="6" y="20" width="48" height="20" rx="8" fill="#f1d9ae" ${OBJ_STYLE} transform="rotate(-18 30 30)"/><rect x="22" y="21" width="16" height="18" fill="#e7c68e" stroke="${INK}" stroke-width="1.6" transform="rotate(-18 30 30)"/>`,
  moon: `<path d="M38 8 Q16 12 16 32 Q16 50 36 54 Q22 44 24 30 Q26 16 38 8 Z" fill="#f1dd96" ${OBJ_STYLE}/><path d="M44 18l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z" fill="#f1dd96" stroke="${INK}" stroke-width="1.4"/>`,
  button: `<circle cx="30" cy="30" r="17" fill="#d9a85a" ${OBJ_STYLE}/><circle cx="30" cy="30" r="11" fill="none" stroke="${INK}" stroke-width="1.6"/><path d="M25 25h0M35 25h0M25 35h0M35 35h0" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`,
  mitten: `<path d="M16 54 L16 28 Q12 14 22 14 Q30 14 30 24 L36 18 Q42 16 44 22 L44 54 Z" fill="#cf8e7b" ${OBJ_STYLE}/><path d="M16 46 H44" stroke="${INK}" stroke-width="2"/><path d="M20 38 L24 34 L28 38" fill="none" stroke="#f4eee0" stroke-width="3"/>`,
};
const OBJECT_BY_FIGURE = {
  sno: 'scarf', lume: 'halo', roku: 'goggles', zipp: 'cap', pix: 'headphones', miso: 'strawberry',
  dot: 'sprout', tobi: 'bandage', nyx: 'moon', zen: 'mitten', nimi: 'button', bub: 'button',
};
const OBJECT_KEYS = Object.keys(OBJECTS);
export function objectKeyFor(figureId) {
  if (OBJECT_BY_FIGURE[figureId]) return OBJECT_BY_FIGURE[figureId];
  let hsh = 0;
  for (const c of String(figureId)) hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0;
  return ['button', 'mitten', 'scarf'][hsh % 3] ?? OBJECT_KEYS[0];
}
export function objectEl(key, size = 48) {
  return h('span', {
    class: `day-object day-object-${key}`,
    html: `<svg viewBox="0 0 60 60" width="${size}" height="${size}" aria-hidden="true">${OBJECTS[key] ?? OBJECTS.button}</svg>`,
  });
}

/** Deterministic pseudo random 0..1 from a string/number. */
export function hash01(seed) {
  let x = 2166136261 >>> 0;
  for (const c of String(seed)) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619) >>> 0; }
  x ^= x >>> 13; x = Math.imul(x, 0x5bd1e995) >>> 0; x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------------------
// Local rules fallback (only used when js/systems/rules.js is missing)
// ---------------------------------------------------------------------------------------
const fallbackRules = {
  startDay(run) { run.actionsLeft = 3; },
  dayAction(run, action, arg) {
    if ((run.actionsLeft ?? 0) <= 0) return { ok: false, message: T.refuse.noActions };
    const spend = (message, extra = {}) => { run.actionsLeft -= 1; return { ok: true, message, ...extra }; };
    switch (action) {
      case 'charge': if (run.battery >= 100) return { ok: false, message: T.refuse.charge }; run.battery = 100; return spend(T.actions.charge.done);
      case 'wick': if (run.flames >= run.maxFlames) return { ok: false, message: T.refuse.wick }; run.flames += 1; return spend(T.actions.wick.done);
      case 'bed': if (run.beds >= run.maxBeds) return { ok: false, message: T.refuse.bed }; run.beds += 1; return spend(T.actions.bed.done);
      case 'door': if (run.door >= run.maxDoor) return { ok: false, message: T.refuse.door }; run.door = run.maxDoor; return spend(T.actions.door.done);
      case 'talk': case 'askFriend': {
        const figId = action === 'talk' ? arg : null;
        const fig = getFigure(figId ?? arg);
        if (!fig) return { ok: false, message: T.refuse.generic };
        const known = knownFacts(fig.id);
        const next = [0, 1, 2].find((i) => !known.includes(i));
        if (next == null) return { ok: true, message: T.albumNothing };
        return spend(`${fig.name} tells you something.`, { factUnlocked: { figureId: fig.id, index: next } });
      }
      default: return { ok: false, message: T.refuse.generic };
    }
  },
  endDay(run) { run.guests = []; run.night += 1; run.phase = 'note'; },
};

// ---------------------------------------------------------------------------------------
// The room
// ---------------------------------------------------------------------------------------

const BED_SLOTS = [
  { x: 50, side: 'L' }, { x: 835, side: 'R' }, { x: 162, side: 'L' },
  { x: 947, side: 'R' }, { x: 274, side: 'L' }, { x: 1059, side: 'R' },
];
const BLANKETS = ['#d98f86', '#8fb3c9', '#e0c068', '#9ec39a', '#b79bd0', '#e3a374'];

function bedMarkup(i, isNew) {
  const slot = BED_SLOTS[i];
  if (!slot) return '';
  const col = BLANKETS[i % BLANKETS.length];
  const tf = slot.side === 'L' ? `translate(${slot.x} 385)` : `translate(${slot.x + 100} 385) scale(-1 1)`;
  return `<g class="day-bed${isNew ? ' day-bed-new' : ''}"><g transform="${tf}">
    <path d="M6 64 V85 M94 64 V85" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>
    <rect x="0" y="56" width="100" height="12" rx="3" fill="#a07a4c" stroke="${INK}" stroke-width="2.6"/>
    <rect x="4" y="40" width="92" height="18" rx="5" fill="#f3ead4" stroke="${INK}" stroke-width="2.4"/>
    <path d="M28 36 L96 36 Q99 36 99 40 L99 62 L28 62 Q22 49 28 36 Z" fill="${col}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M36 44 H92 M36 52 H92" stroke="${INK}" stroke-width="1.4" stroke-dasharray="4 5" opacity=".55"/>
    <rect x="5" y="30" width="26" height="15" rx="7" fill="#fffaf0" stroke="${INK}" stroke-width="2.4"/>
    <rect x="-3" y="14" width="11" height="54" rx="3" fill="#8d6a45" stroke="${INK}" stroke-width="2.6"/>
    <path d="M1 22 V60 M4 26 V58" stroke="${INK}" stroke-width="1" opacity=".5"/>
  </g></g>`;
}

function doorPlanksMarkup(n, newest) {
  const ys = [212, 302, 392];
  let s = '';
  for (let i = 0; i < Math.min(n, 3); i++) {
    const y = ys[i];
    s += `<g class="day-plank${newest === i ? ' day-plank-new' : ''}">
      <rect x="1166" y="${y}" width="112" height="22" rx="2" fill="#8a6a43" stroke="${INK}" stroke-width="2.6"/>
      <path d="M1172 ${y + 8} H1272 M1172 ${y + 15} H1272" stroke="${INK}" stroke-width="1" opacity=".45"/>
      <circle cx="1180" cy="${y + 11}" r="2.6" fill="${INK}"/><circle cx="1262" cy="${y + 11}" r="2.6" fill="${INK}"/><circle cx="1222" cy="${y + 11}" r="2.6" fill="${INK}"/>
    </g>`;
  }
  return s;
}

function stoneLines() {
  let s = '';
  let row = 0;
  for (let y = 150; y < 470; y += 34) {
    s += `<path d="M500 ${y} H810" />`;
    const off = row % 2 ? 24 : 0;
    for (let x = 500 + 52 + off; x < 810; x += 58) s += `<path d="M${x} ${y} V${Math.min(y + 34, 470)}" />`;
    row += 1;
  }
  return s;
}

function plankLines() {
  let s = '';
  [492, 520, 556, 602, 660].forEach((y) => { s += `<path d="M0 ${y} H1280" />`; });
  // staggered seams
  [[492, 520, 140], [492, 520, 760], [492, 520, 1100], [520, 556, 60], [520, 556, 430], [520, 556, 900],
    [556, 602, 250], [556, 602, 700], [556, 602, 1160], [602, 660, 120], [602, 660, 560], [602, 660, 980],
    [660, 720, 330], [660, 720, 800], [660, 720, 20]].forEach(([a, b, x]) => { s += `<path d="M${x} ${a} V${b}" />`; });
  return s;
}

function roomMarkup() {
  return `<svg class="day-room-svg" viewBox="0 0 1280 720" width="1280" height="720" aria-hidden="true">
  <defs>
    <linearGradient id="dayWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9d7b0"/><stop offset="1" stop-color="#e4cfa2"/></linearGradient>
    <linearGradient id="dayFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfa774"/><stop offset="1" stop-color="#b98f5e"/></linearGradient>
    <linearGradient id="daySky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe5ea"/><stop offset="1" stop-color="#f9efcf"/></linearGradient>
    <pattern id="dayHatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><path d="M0 0V7" stroke="#4a3a2c" stroke-width="1.2" opacity=".42"/></pattern>
    <pattern id="dayHatchLight" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><path d="M0 0V9" stroke="#4a3a2c" stroke-width="1" opacity=".25"/></pattern>
    <clipPath id="dayPanes"><rect x="100" y="115" width="220" height="170"/></clipPath>
    <radialGradient id="dayVignette" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#3b2a1a" stop-opacity=".28"/></radialGradient>
  </defs>

  <g filter="url(#rough)" stroke="${INK}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.6" fill="none">
    <!-- wall + floor -->
    <rect x="-10" y="-10" width="1300" height="482" fill="url(#dayWall)" stroke="none"/>
    <g stroke="#b99b6a" stroke-width="1.2" opacity=".55">
      <path d="M40 40 V470 M130 30 V470 M330 30 V470 M470 30 V470 M830 30 V470 M1120 30 V470 M1240 30 V470"/>
    </g>
    <rect x="-10" y="470" width="1300" height="260" fill="url(#dayFloor)" stroke="none"/>
    <g stroke="#7d5f3b" stroke-width="2" opacity=".75">${plankLines()}</g>
    <path d="M-10 470 H1290" stroke-width="3.5"/>
    <rect x="-10" y="452" width="1300" height="18" fill="#a98458" stroke="none"/>
    <path d="M-10 452 H1290" stroke-width="2.4"/>

    <!-- ceiling beam -->
    <rect x="-10" y="-6" width="1300" height="34" fill="#8a6a47"/>
    <rect x="-10" y="-6" width="1300" height="34" fill="url(#dayHatchLight)" stroke="none"/>
    <path d="M-10 28 H1290" stroke-width="3"/>
    <g stroke-width="1.4" opacity=".5"><path d="M60 12 H200 M300 18 H520 M640 10 H880 M980 16 H1200"/></g>

    <!-- rug -->
    <ellipse cx="640" cy="598" rx="440" ry="66" fill="#bf6f65" opacity=".5" stroke="none"/>
    <ellipse cx="640" cy="598" rx="440" ry="66" stroke-width="3" opacity=".8"/>
    <ellipse cx="640" cy="598" rx="396" ry="54" stroke-width="1.6" stroke-dasharray="9 8" opacity=".6"/>
    <ellipse cx="640" cy="598" rx="340" ry="42" stroke-width="1.4" opacity=".4"/>

    <!-- window -->
    <rect x="86" y="101" width="248" height="198" rx="6" fill="#f2e7c9" stroke-width="3.2"/>
    <g clip-path="url(#dayPanes)" stroke-width="2">
      <rect x="100" y="115" width="220" height="170" fill="url(#daySky)" stroke="none"/>
      <circle cx="278" cy="152" r="21" fill="#fbe39a"/>
      <path d="M278 120 V126 M278 178 V184 M246 152 H252 M304 152 H310 M255 129 l4 4 M297 171 l4 4 M301 129 l-4 4 M259 171 l-4 4" stroke-width="2"/>
      <path d="M130 156 q10 -16 28 -8 q10 -10 24 0 q16 -2 14 12 h-68 q-8 0 -4 -4 z" fill="#fffaf0" stroke-width="1.8"/>
      <path d="M100 252 Q150 208 208 238 T320 218 V285 H100 Z" fill="#b6c88c"/>
      <path d="M100 270 Q170 240 240 262 T320 258 V285 H100 Z" fill="#9fb878"/>
      <path d="M268 262 V240 M268 244 l-12 -14 M268 250 l12 -10" stroke-width="2"/>
      <circle cx="268" cy="228" r="13" fill="#7ea45a" stroke-width="2"/>
      <path d="M232 184 q6 -6 12 0 q6 -6 12 0" stroke-width="2"/>
      <path d="M100 200 H320 M210 115 V285" stroke-width="5"/>
    </g>
    <rect x="100" y="115" width="220" height="170" stroke-width="3.2"/>
    <rect x="76" y="295" width="268" height="14" rx="3" fill="#a98458"/>
    <path d="M78 90 L130 90 Q118 200 134 302 L68 302 Q82 200 78 90 Z" fill="#d9a79b"/>
    <path d="M342 90 L290 90 Q302 200 286 302 L352 302 Q338 200 342 90 Z" fill="#d9a79b"/>
    <path d="M92 108 Q104 200 100 296 M106 100 Q116 200 114 296 M328 108 Q316 200 320 296 M314 100 Q304 200 306 296" stroke-width="1.3" opacity=".5"/>
    <path d="M62 88 H358" stroke-width="5"/>
    <circle cx="60" cy="88" r="6" fill="#8a6a47"/><circle cx="360" cy="88" r="6" fill="#8a6a47"/>

    <!-- hanging lantern (the big one) -->
    <g transform="translate(425 0) scale(1.35) translate(-425 0)">
      <path d="M425 28 V74" stroke-width="3"/>
      <path d="M421 36 q4 4 8 0 M421 46 q4 4 8 0 M421 56 q4 4 8 0 M421 66 q4 4 8 0" stroke-width="1.8"/>
      <circle cx="425" cy="76" r="6" fill="#6b5a45"/>
      <path d="M393 94 L457 94 L441 78 L409 78 Z" fill="#6b5a45"/>
      <rect x="397" y="94" width="56" height="76" rx="8" fill="#ffe6a6" fill-opacity=".62"/>
      <path d="M416 94 V170 M434 94 V170" stroke-width="2"/>
      <path d="M399 100 Q404 130 399 164" stroke-width="1.4" opacity=".4"/>
      <rect x="391" y="170" width="68" height="13" rx="4" fill="#6b5a45"/>
      <path d="M399 183 v6 M451 183 v6" stroke-width="3"/>
    </g>

    <!-- fireplace -->
    <path d="M500 470 V150 Q500 128 522 126 H788 Q810 128 810 150 V470 Z" fill="#c1b6a1" stroke-width="3.2"/>
    <g stroke-width="1.5" opacity=".6">${stoneLines()}</g>
    <path d="M500 126 H810 V150 H500 Z" fill="#a89c88" opacity=".6" stroke="none"/>
    <path d="M580 470 V342 Q580 288 655 288 Q730 288 730 342 V470 Z" fill="#2c211a" stroke-width="3.2"/>
    <path d="M590 470 V344 Q592 300 655 298" stroke="#e9d9bd" stroke-width="2.2" opacity=".5"/>
    <path d="M740 470 V300 M748 470 V330" stroke-width="1.4" opacity=".5"/>
    <rect x="552" y="468" width="206" height="14" rx="3" fill="#8c8271"/>
    <rect x="486" y="262" width="338" height="24" rx="3" fill="#8d6a45" stroke-width="3"/>
    <rect x="486" y="262" width="338" height="24" rx="3" fill="url(#dayHatchLight)" stroke="none"/>
    <path d="M500 286 V296 H810 V286" fill="url(#dayHatch)" stroke="none" opacity=".7"/>
    <!-- clock -->
    <circle cx="655" cy="186" r="38" fill="#f6edd4" stroke-width="3"/>
    <circle cx="655" cy="186" r="31" stroke-width="1.4"/>
    <path d="M655 160 V166 M655 206 V212 M629 186 H635 M675 186 H681" stroke-width="2.4"/>
    <path d="M655 186 V168 M655 186 L668 194" stroke-width="3"/>
    <circle cx="655" cy="186" r="3" fill="${INK}"/>
    <!-- mantel things -->
    <rect x="514" y="252" width="12" height="10" fill="#6b5a45"/>
    <rect x="517" y="222" width="6" height="30" fill="#f6eed8"/><path d="M520 222 V217" stroke-width="2"/>
    <rect x="780" y="252" width="12" height="10" fill="#6b5a45"/>
    <rect x="783" y="226" width="6" height="26" fill="#f6eed8"/><path d="M786 226 V221" stroke-width="2"/>
    <path d="M556 262 V236 Q556 230 562 230 H588 Q594 230 594 236 V262 Z" fill="#cfe3de" fill-opacity=".8"/>
    <path d="M556 240 H594 M560 246 h0 M570 250 h0 M582 246 h0" stroke-width="2"/>
    <path d="M716 262 V222 H752 V262" fill="#f6edd4"/>
    <path d="M724 256 V240 L734 232 L744 240 V256 Z M730 256 V248 H738 V256" stroke-width="1.6" fill="#e3b07a"/>
    <path d="M700 262 Q704 244 716 246 Q722 236 732 244 L722 262" fill="none" stroke="none"/>

    <!-- right shelves -->
    <rect x="850" y="203" width="280" height="10" fill="#8d6a45" stroke-width="2.6"/>
    <rect x="850" y="318" width="280" height="10" fill="#8d6a45" stroke-width="2.6"/>
    <path d="M866 213 V232 L890 213 M1112 213 V232 L1088 213 M866 328 V347 L890 328 M1112 328 V347 L1088 328" stroke-width="2.4"/>
    <!-- books -->
    <rect x="860" y="158" width="14" height="45" fill="#7aa0b6"/><rect x="875" y="150" width="16" height="53" fill="#c9776b"/>
    <rect x="892" y="162" width="12" height="41" fill="#d7b660"/><rect x="905" y="154" width="15" height="49" fill="#8faf7b"/>
    <path d="M922 203 L938 156 L952 160 L938 203 Z" fill="#9b87c0"/>
    <rect x="962" y="140" width="40" height="63" rx="3" fill="#a3382f" stroke-width="3"/>
    <path d="M970 140 V203 M978 156 H996 M978 164 H992" stroke-width="1.8" stroke="#f2dfb2"/>
    <circle cx="1040" cy="186" r="17" fill="#d6e8e5" fill-opacity=".85"/><rect x="1032" y="166" width="16" height="6" fill="#8d6a45"/>
    <path d="M1034 184 h0 M1044 190 h0 M1040 180 h0" stroke="#f2b84b" stroke-width="4"/>
    <path d="M1086 203 L1090 176 H1116 L1120 203 Z" fill="#c78c5e"/>
    <path d="M1103 176 Q1086 150 1082 138 Q1100 140 1103 168 Q1106 140 1124 134 Q1120 156 1103 176 Z" fill="#7ea45a" stroke-width="2.2"/>
    <!-- lower shelf -->
    <path d="M866 318 V292 Q866 284 876 284 H908 Q918 284 918 292 V318 Z" fill="#e3b07a"/>
    <path d="M918 296 Q934 296 934 306 H918 M884 284 V278 H900 V284" stroke-width="2.2"/>
    <rect x="944" y="296" width="24" height="22" rx="4" fill="#d96b78" fill-opacity=".85"/><rect x="974" y="296" width="24" height="22" rx="4" fill="#e1b64a" fill-opacity=".85"/>
    <path d="M944 302 H968 M974 302 H998" stroke-width="1.6"/>
    <rect x="1030" y="296" width="86" height="22" rx="3" fill="#8fb3c9"/><rect x="1038" y="282" width="72" height="14" rx="3" fill="#d98f86"/><rect x="1046" y="270" width="58" height="12" rx="3" fill="#f0dfa0"/>

    <!-- door -->
    <path d="M1170 470 V190 Q1170 128 1224 128 Q1278 128 1278 190 V470 Z" fill="#a37d4e" stroke-width="3.4"/>
    <path d="M1196 140 V470 M1224 128 V470 M1250 134 V470" stroke-width="1.6" opacity=".6"/>
    <path d="M1180 190 Q1182 150 1224 138" stroke-width="1.4" opacity=".5"/>
    <circle cx="1224" cy="262" r="12" fill="#cfa84b" stroke-width="2.6"/><circle cx="1224" cy="262" r="5" fill="#2c211a"/>
    <rect x="1176" y="180" width="26" height="9" fill="#5c4630" stroke-width="2"/><rect x="1176" y="430" width="26" height="9" fill="#5c4630" stroke-width="2"/>
    <rect x="1234" y="338" width="34" height="9" rx="4" fill="#5c4630" stroke-width="2.2"/><circle cx="1238" cy="342" r="4" fill="#cfa84b" stroke-width="1.6"/>

    <!-- plant, stool, wall notes -->
    <path d="M458 470 L464 428 H492 L498 470 Z" fill="#c98f62"/>
    <path d="M478 428 Q462 400 454 372 Q478 384 478 428 Z M478 428 Q494 396 510 380 Q504 410 478 428 Z M478 428 Q478 386 484 358 Q496 392 478 428 Z" fill="#7ea45a" stroke-width="2.2"/>
    <rect x="1130" y="400" width="26" height="70" fill="none" stroke="none"/>
    <!-- soft hatching shadows -->
    <path d="M86 309 H344 V452 H86 Z" fill="url(#dayHatchLight)" stroke="none" opacity=".5"/>
    <path d="M500 134 H520 V452 H500 Z M790 134 H810 V452 H790 Z" fill="url(#dayHatch)" stroke="none" opacity=".45"/>
  </g>
  <rect x="0" y="0" width="1280" height="720" fill="url(#dayVignette)"/>
</svg>`;
}

function lightMarkup() {
  return `<svg class="day-light-svg" viewBox="0 0 1280 720" width="1280" height="720" aria-hidden="true">
    <defs>
      <linearGradient id="dayBeam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b8" stop-opacity=".55"/><stop offset="1" stop-color="#fff1b8" stop-opacity="0"/></linearGradient>
      <radialGradient id="dayLampGlow"><stop offset="0" stop-color="#ffd877" stop-opacity=".6"/><stop offset=".5" stop-color="#ffd877" stop-opacity=".16"/><stop offset="1" stop-color="#ffd877" stop-opacity="0"/></radialGradient>
      <radialGradient id="dayHearthGlow"><stop offset="0" stop-color="#ff9a3c" stop-opacity=".55"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>
    </defs>
    <polygon class="day-beam" points="104,290 316,290 590,720 250,720" fill="url(#dayBeam)"/>
    <polygon class="day-beam day-beam-2" points="104,290 150,290 330,720 250,720" fill="url(#dayBeam)" opacity=".5"/>
    <circle class="day-lampglow" cx="425" cy="200" r="230" fill="url(#dayLampGlow)"/>
    <ellipse class="day-hearthglow" cx="655" cy="470" rx="230" ry="150" fill="url(#dayHearthGlow)"/>
  </svg>`;
}

function fireMarkup() {
  // Fire in the fireplace + small flame in the big lantern. Animated with CSS, never filtered.
  return `<svg class="day-fire-svg" viewBox="0 0 1280 720" width="1280" height="720" aria-hidden="true">
    <g stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
      <path d="M598 466 L720 454 L716 470 L602 472 Z" fill="#6b4a2d"/>
      <path d="M610 458 L706 436 L712 452 L616 470 Z" fill="#7d5934"/>
      <g class="day-flame-a"><path d="M630 452 Q612 420 636 396 Q640 418 654 410 Q648 380 668 360 Q672 392 690 408 Q704 424 690 452 Z" fill="#f2a43f"/></g>
      <g class="day-flame-b"><path d="M648 452 Q638 430 654 414 Q658 428 668 424 Q668 404 680 396 Q690 420 684 452 Z" fill="#ffd36a" stroke-width="1.8"/></g>
      <g class="day-flame-c"><path d="M662 452 Q658 440 668 432 Q676 442 674 452 Z" fill="#fff3c4" stroke-width="1.4"/></g>
    </g>
    <g transform="translate(425 0) scale(1.35) translate(-425 0)" class="day-lantern-flame">
      <path d="M425 112 Q440 128 435 142 Q432 156 425 156 Q417 156 415 142 Q412 130 425 112 Z" fill="#f2b84b" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M425 130 Q431 138 428 148 Q424 150 421 144 Q421 137 425 130 Z" fill="#fff0b8"/>
    </g>
  </svg>`;
}

// ---------------------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------------------

let S = null; // module-level handle to current instance (for unmount)

export default {
  async mount(root, params, ctx) {
    const run = ctx.store.run;
    const rules = { ...fallbackRules, ...(await getRules()) };
    const render = await getRender();
    const ac = new AbortController();
    const timers = new Set();
    const views = [];
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };

    S = { ac, timers, views };
    ctx.setMood('day');
    snd(ctx, 'music', 'day');
    snd(ctx, 'ambient', 'day');

    if (!run) {
      root.append(h('div', { class: 'day-root' }, h('p', { class: 'day-empty' }, 'No run in progress.'), h('button', { class: 'btn', onclick: () => ctx.go('menu') }, 'Back to menu')));
      return;
    }
    if (typeof run.actionsLeft !== 'number') run.actionsLeft = 3;
    const endless = run.mode === 'endless';

    // -------- scene layers --------
    const room = h('div', { class: 'day-root' });
    root.append(room);
    room.insertAdjacentHTML('beforeend', roomMarkup());
    room.insertAdjacentHTML('beforeend', lightMarkup());
    const dust = h('div', { class: 'day-dust' });
    for (let i = 0; i < 14; i++) {
      dust.append(h('i', { style: { left: `${130 + hash01('d' + i) * 330}px`, top: `${300 + hash01('e' + i) * 300}px`, animationDelay: `${-hash01('f' + i) * 9}s`, animationDuration: `${7 + hash01('g' + i) * 6}s` } }));
    }
    room.append(dust);
    room.insertAdjacentHTML('beforeend', fireMarkup());
    const dyn = h('div', { class: 'day-dyn' });
    room.append(dyn);
    const floorStuff = h('div', { class: 'day-floor' });
    const guestLayer = h('div', { class: 'day-guests' });
    room.append(floorStuff, guestLayer);

    // -------- HUD --------
    const sign = h('div', { class: 'day-sign' },
      h('h1', {}, T.title(run.night)),
      h('p', {}, T.subtitle));
    const notebookBtn = h('button', { class: 'day-notebook', type: 'button', onclick: openNotebook, 'aria-label': T.notebook },
      h('span', { class: 'day-notebook-ico' }), h('span', {}, T.notebook));
    iconEl('album', 30).then((el) => notebookBtn.querySelector('.day-notebook-ico').append(el));
    const hint = h('div', { class: 'day-hint' }, T.guestHint);
    const toast = h('div', { class: 'day-toast hidden', role: 'status' });
    const bubbleLayer = h('div', { class: 'day-bubble-layer' });
    room.append(sign, notebookBtn, hint, toast, bubbleLayer);

    // action board
    const board = h('div', { class: 'day-board' });
    const jobDefs = [
      { id: 'charge', icon: 'battery', rot: -1.4 },
      { id: 'wick', icon: 'wick', rot: 1.1 },
      { id: 'bed', icon: 'bed', rot: -0.8 },
      { id: 'door', icon: 'door', rot: 1.5 },
    ];
    const jobEls = {};
    for (const def of jobDefs) {
      const text = T.actions[def.id];
      const btn = h('button', { class: 'day-job', type: 'button', style: { transform: `rotate(${def.rot}deg)` }, dataset: { job: def.id }, onclick: () => doJob(def.id) },
        h('span', { class: 'day-pin' }),
        h('span', { class: 'day-job-ico' }),
        h('span', { class: 'day-job-body' },
          h('span', { class: 'day-job-label' }, text.label),
          h('span', { class: 'day-job-status' }),
          h('span', { class: 'day-job-note' })));
      iconEl(def.icon, 38).then((el) => btn.querySelector('.day-job-ico').append(el));
      jobEls[def.id] = btn;
      board.append(btn);
    }
    room.append(board);

    // actions + evening
    const apBox = h('div', { class: 'day-ap' },
      h('div', { class: 'day-ap-label' }, T.actionsLabel),
      h('div', { class: 'day-ap-tokens' }));
    const eveningBtn = h('button', { class: 'btn primary day-evening', type: 'button', onclick: askEvening }, T.evening);
    room.append(h('div', { class: 'day-side' }, apBox, eveningBtn));

    // -------- state helpers --------
    const lostReport = (run.lastReport?.lost ?? []).map((l) => l.id ?? l).filter(Boolean);
    let guestIds = (run.guests ?? []).filter((id) => getFigure(id));
    guestIds = guestIds.filter((id) => !lostReport.includes(id));
    const lostIds = lostReport.filter((id) => getFigure(id));
    let selected = null;
    let busy = false;

    function maxFor(key) {
      return { battery: 5, flames: run.maxFlames ?? 3, beds: run.maxBeds ?? 6, door: run.maxDoor ?? 3 }[key];
    }

    function statusViz(id) {
      const wrap = h('span', { class: 'day-viz' });
      if (id === 'charge') {
        const n = Math.round((run.battery ?? 0) / 20);
        for (let i = 0; i < 5; i++) wrap.append(h('i', { class: `day-cell${i < n ? ' on' : ''}` }));
        wrap.append(h('em', {}, T.status.battery(n, 5)));
      } else if (id === 'wick') {
        for (let i = 0; i < maxFor('flames'); i++) wrap.append(flameEl(i < run.flames, 15));
        wrap.append(h('em', {}, T.status.flames(run.flames, maxFor('flames'))));
      } else if (id === 'bed') {
        for (let i = 0; i < maxFor('beds'); i++) wrap.append(h('i', { class: `day-pill${i < run.beds ? ' on' : ''}` }));
        wrap.append(h('em', {}, T.status.beds(run.beds, maxFor('beds'))));
      } else if (id === 'door') {
        for (let i = 0; i < maxFor('door'); i++) wrap.append(h('i', { class: `day-bar${i < run.door ? ' on' : ''}` }));
        wrap.append(h('em', {}, T.status.door(run.door, maxFor('door'))));
      }
      return wrap;
    }

    function jobBlocked(id) {
      if (id === 'charge' && run.battery >= 100) return T.refuse.charge;
      if (id === 'wick' && run.flames >= run.maxFlames) return T.refuse.wick;
      if (id === 'bed' && run.beds >= run.maxBeds) return T.refuse.bed;
      if (id === 'door' && run.door >= run.maxDoor) return T.refuse.door;
      if (run.actionsLeft <= 0) return T.refuse.noActions;
      return null;
    }

    function refreshBoard() {
      for (const def of jobDefs) {
        const el = jobEls[def.id];
        const reason = jobBlocked(def.id);
        el.disabled = !!reason;
        el.classList.toggle('is-blocked', !!reason);
        el.querySelector('.day-job-status').replaceChildren(statusViz(def.id));
        el.querySelector('.day-job-note').textContent = reason ?? T.actions[def.id].desc;
        el.title = reason ?? T.actions[def.id].desc;
      }
    }

    function candleSvg(spent) {
      return `<svg viewBox="0 0 34 62" width="34" height="62" aria-hidden="true" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 24 H25 V54 Q17 58 9 54 Z" fill="${spent ? '#d9d1bd' : '#f6eed8'}"/>
        <path d="M9 32 Q12 38 12 44 M25 30 Q22 36 23 40" fill="none" stroke-width="1.5" opacity=".6"/>
        <path d="M17 24 V19" fill="none"/>
        ${spent ? '<path d="M3 12 L31 52 M31 12 L3 52" stroke="#a3231b" stroke-width="3.4" opacity=".85" fill="none"/>' : '<path class="day-cflame" d="M17 5 Q26 13 22 19 Q17 22 12 19 Q9 13 17 5 Z" fill="#f2b84b"/>'}
      </svg>`;
    }
    function refreshAp(justSpent = false) {
      const tokens = apBox.querySelector('.day-ap-tokens');
      tokens.replaceChildren();
      for (let i = 0; i < 3; i++) {
        const spent = i >= run.actionsLeft;
        const el = h('span', { class: `day-token${spent ? ' spent' : ''}`, html: candleSvg(spent) });
        if (justSpent && i === run.actionsLeft) el.classList.add('just');
        tokens.append(el);
      }
      eveningBtn.classList.toggle('pulse', run.actionsLeft <= 0);
    }

    function renderDyn(newBed = -1, newPlank = -1) {
      dyn.innerHTML = `<svg viewBox="0 0 1280 720" width="1280" height="720" aria-hidden="true"><g filter="url(#rough)">
        ${Array.from({ length: Math.min(run.beds ?? 4, 6) }, (_, i) => bedMarkup(i, i === newBed)).join('')}
        ${doorPlanksMarkup(run.door ?? 0, newPlank)}
      </g></svg>`;
    }

    function showToast(text, kind = 'ok') {
      toast.textContent = text;
      toast.className = `day-toast ${kind}`;
      clearTimeout(showToast.t);
      showToast.t = later(() => toast.classList.add('hidden'), 3200);
    }

    // -------- guests --------
    const entries = guestIds.map((id) => ({ id, kind: 'guest' }));
    for (const id of lostIds) {
      const at = Math.floor(hash01(id + run.night) * (entries.length + 1));
      entries.splice(at, 0, { id, kind: 'lost' });
    }
    const guestEls = new Map();
    const FIG_H = entries.length >= 6 ? 168 : entries.length >= 4 ? 182 : 196;
    const n = entries.length;
    const spanL = n <= 1 ? 640 : n === 2 ? 520 : 190;
    const spanR = n <= 1 ? 640 : n === 2 ? 760 : 1090;
    entries.forEach((entry, i) => {
      const fig = getFigure(entry.id);
      const x = n <= 1 ? 640 : spanL + (i * (spanR - spanL)) / (n - 1);
      const feet = 556 + (i % 2 === 0 ? 8 : -12) + Math.round(hash01(entry.id) * 10);
      entry.x = x; entry.feet = feet;
      if (entry.kind === 'lost') {
        const key = objectKeyFor(entry.id);
        const wrap = h('div', { class: 'day-lost', style: { left: `${x - 70}px`, top: `${feet - FIG_H}px`, width: '140px', height: `${FIG_H}px` }, tabindex: '0', role: 'button', 'aria-label': `${fig.name}'s empty spot`, onclick: () => openLost(entry, wrap) });
        const ghost = figureImg(fig, { height: FIG_H, silhouette: true });
        ghost.classList.add('day-ghost');
        wrap.append(h('div', { class: 'day-fig-inner' }, ghost), h('div', { class: 'day-lost-obj' }, objectEl(key, 52)));
        guestLayer.append(wrap);
        entry.el = wrap;
        return;
      }
      const wrap = h('div', { class: 'day-guest', style: { left: `${x - 80}px`, top: `${feet - FIG_H}px`, width: '160px', height: `${FIG_H}px`, zIndex: String(Math.round(feet)) }, tabindex: '0', role: 'button', 'aria-label': `${fig.name}. Talk.`, onclick: () => selectGuest(entry), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectGuest(entry); } } });
      const bob = h('div', { class: 'day-bob', style: { animationDelay: `${-hash01(entry.id) * 4}s`, animationDuration: `${3.2 + hash01(entry.id + 'x') * 1.6}s` } });
      const inner = h('div', { class: 'day-fig-inner' });
      mountFigure(fig, inner, FIG_H);
      bob.append(inner);
      wrap.append(h('div', { class: 'day-shadow' }), bob, h('div', { class: 'day-name' }, fig.name));
      guestLayer.append(wrap);
      entry.el = wrap;
      guestEls.set(entry.id, wrap);
    });

    function mountFigure(fig, inner, height) {
      if (render.figure?.createFigureView) {
        try {
          const view = render.figure.createFigureView(fig, { form: 'standard', tells: [], height, blink: true, honestOddity: false, dark: false });
          if (view?.el) {
            views.push(view);
            inner.append(view.el);
            return;
          }
        } catch (err) { console.warn('[day] createFigureView failed', err); }
      }
      inner.append(figureImg(fig, { height }));
    }

    if (!n) {
      room.append(h('div', { class: 'day-quiet' }, h('p', {}, T.emptyRoom)));
      hint.classList.add('hidden');
    } else if (!guestIds.length) {
      hint.classList.add('hidden');
    }

    // -------- bubble --------
    function closeBubble() {
      bubbleLayer.replaceChildren();
      guestEls.forEach((el) => el.classList.remove('is-selected'));
      selected = null;
      if (n && guestIds.length) hint.classList.remove('hidden');
    }

    function placeBubble(entry, bubble, tail) {
      const w = 320;
      const left = clamp(entry.x - w / 2, 16, 1280 - w - 16);
      bubble.style.left = `${left}px`;
      bubble.style.width = `${w}px`;
      bubble.style.bottom = `${720 - (entry.feet - FIG_H) + 6}px`;
      tail.style.left = `${clamp(entry.x - left - 12, 18, w - 42)}px`;
    }

    function bubbleButtons(entry) {
      const fig = getFigure(entry.id);
      const noAp = run.actionsLeft <= 0;
      const talkBtn = h('button', { class: 'btn small day-bbtn', type: 'button', disabled: noAp, title: noAp ? T.refuse.noActions : '', onclick: () => doTalk('talk', entry) }, T.talk);
      const askBtn = h('button', { class: 'btn small day-bbtn', type: 'button', disabled: noAp, title: noAp ? T.refuse.noActions : '', onclick: () => doTalk('askFriend', entry) }, T.askFriend);
      const closeBtn = h('button', { class: 'day-bclose', type: 'button', 'aria-label': T.close, onclick: closeBubble }, '×');
      return { talkBtn, askBtn, closeBtn, fig };
    }

    function openBubble(entry, { line, fact = null, message = null }) {
      bubbleLayer.replaceChildren();
      const fig = getFigure(entry.id);
      const { talkBtn, askBtn, closeBtn } = bubbleButtons(entry);
      const tail = h('span', { class: 'day-btail' });
      const body = h('div', { class: 'day-bbody' });
      body.append(h('div', { class: 'day-bwho' }, fig.name));
      if (line) body.append(h('p', { class: 'day-bline' }, `“${line}”`));
      if (message) body.append(h('p', { class: 'day-bmsg' }, message));
      if (fact) body.append(factCard(fact));
      const bubble = h('div', { class: 'day-bubble' }, closeBtn, body, h('div', { class: 'day-bactions' }, talkBtn, askBtn), tail);
      if (run.actionsLeft <= 0) body.append(h('p', { class: 'day-bnote' }, T.actionsNone));
      placeBubble(entry, bubble, tail);
      bubbleLayer.append(bubble);
      hint.classList.add('hidden');
    }

    function factCard(fact) {
      const f = getFigure(fact.figureId);
      const data = f?.facts?.[fact.index];
      return h('div', { class: 'day-fact' },
        h('div', { class: 'day-fact-head' }, T.album, h('span', { class: 'day-fact-star' }, '★')),
        h('div', { class: 'day-fact-who' }, f?.name ?? '?'),
        data ? h('p', { class: 'day-fact-q' }, data.q) : null,
        data ? h('p', { class: 'day-fact-a' }, data.a) : null);
    }

    function randomLine(fig) {
      const lines = fig.talkLines?.length ? fig.talkLines : T.bubbleFallback;
      const rng = createRng((run.rngState ?? run.seed ?? 1) + (selected?.turn ?? 0));
      return lines[Math.floor(rng.next() * lines.length)];
    }

    function selectGuest(entry) {
      if (busy) return;
      snd(ctx, 'sfx', 'uiClick');
      guestEls.forEach((el) => el.classList.remove('is-selected'));
      entry.el.classList.add('is-selected');
      selected = entry;
      entry.turn = (entry.turn ?? 0) + 1;
      openBubble(entry, { line: randomLine(getFigure(entry.id)) });
    }

    function openLost(entry) {
      snd(ctx, 'sfx', 'uiClick');
      guestEls.forEach((el) => el.classList.remove('is-selected'));
      bubbleLayer.replaceChildren();
      const fig = getFigure(entry.id);
      const key = objectKeyFor(entry.id);
      const what = DAY_TEXT.morning.missing.leftBehind[key] ?? 'something';
      const tail = h('span', { class: 'day-btail' });
      const bubble = h('div', { class: 'day-bubble day-bubble-lost' },
        h('button', { class: 'day-bclose', type: 'button', 'aria-label': T.close, onclick: closeBubble }, '×'),
        h('div', { class: 'day-bbody' }, h('p', { class: 'day-bmsg' }, T.leftBehind(fig.name, what.replace(/^an? /, ''))), tail));
      placeBubble(entry, bubble, tail);
      bubbleLayer.append(bubble);
      hint.classList.add('hidden');
    }

    async function doTalk(action, entry) {
      if (busy) return;
      busy = true;
      const fig = getFigure(entry.id);
      const res = callAction(action, entry.id);
      busy = false;
      if (!res.ok) {
        snd(ctx, 'sfx', 'uiClick');
        openBubble(entry, { line: null, message: res.message || T.refuse.generic });
        return;
      }
      snd(ctx, 'sfx', 'bell');
      if (res.factUnlocked) {
        later(() => { snd(ctx, 'sfx', 'chime'); snd(ctx, 'sfx', 'penScratch'); }, 140);
        entry.el.classList.add('did-talk');
        openBubble(entry, { line: res.line ?? null, message: null, fact: res.factUnlocked });
      } else {
        openBubble(entry, { line: randomLine(fig), message: res.message || T.albumNothing });
      }
      refreshAp(true);
      refreshBoard();
    }

    // -------- actions --------
    function callAction(action, arg) {
      const rng = createRng(run.rngState ?? run.seed ?? 1);
      let res;
      try {
        res = rules.dayAction(run, action, arg, rng) ?? { ok: false, message: T.refuse.generic };
      } catch (err) {
        console.error('[day] dayAction failed', err);
        res = { ok: false, message: T.refuse.generic };
      }
      try { run.rngState = rng.state; } catch { /* ignore */ }
      ctx.save();
      return res;
    }

    function doJob(id) {
      if (busy) return;
      const blocked = jobBlocked(id);
      if (blocked) { showToast(blocked, 'no'); return; }
      const before = { beds: run.beds, door: run.door };
      const res = callAction(id, null);
      if (!res.ok) { showToast(res.message || T.refuse.generic, 'no'); refreshBoard(); return; }
      snd(ctx, 'sfx', id === 'door' ? 'hammer' : 'bell');
      showToast(res.message || T.actions[id].done, 'ok');
      closeBubble();
      refreshAp(true);
      refreshBoard();
      const newBed = id === 'bed' && run.beds > before.beds ? run.beds - 1 : -1;
      const newPlank = id === 'door' ? Math.max(0, (before.door ?? 0)) : -1;
      renderDyn(newBed, newPlank);
      if (id === 'wick') flare();
      jobEls[id].classList.add('did');
      later(() => jobEls[id].classList.remove('did'), 700);
    }

    function flare() {
      room.classList.add('day-flare');
      later(() => room.classList.remove('day-flare'), 1400);
    }

    // -------- notebook --------
    function openNotebook() {
      snd(ctx, 'sfx', 'pageTurn');
      const total = clamp(run.night, 1, 7);
      let page = total;
      const title = h('h2', { class: 'day-nb-title' });
      const text = h('div', { class: 'day-nb-text' });
      const rule = h('p', { class: 'day-nb-rule' });
      const count = h('span', { class: 'day-nb-count' });
      const prev = h('button', { class: 'btn small', type: 'button', 'aria-label': 'Previous page' }, '‹');
      const next = h('button', { class: 'btn small', type: 'button', 'aria-label': 'Next page' }, '›');
      const closeBtn = h('button', { class: 'btn small primary', type: 'button' }, T.close);
      const paper = h('div', { class: 'day-nb' }, h('div', { class: 'day-nb-tape' }), title, text, rule,
        h('div', { class: 'day-nb-nav' }, prev, count, next, closeBtn));
      const m = modal(paper, { className: 'day-nb-panel' });
      const draw = () => {
        const note = NOTES[page];
        title.textContent = note?.title ?? '';
        text.replaceChildren(...(note?.paragraphs ?? [T.notebookEmpty]).map((p) => h('p', {}, p)));
        rule.textContent = note?.rule ?? '';
        count.textContent = T.notebookPage(page, total);
        prev.disabled = page <= 1;
        next.disabled = page >= total;
        paper.dataset.night = String(page);
      };
      prev.onclick = () => { page = Math.max(1, page - 1); snd(ctx, 'sfx', 'pageTurn'); draw(); };
      next.onclick = () => { page = Math.min(total, page + 1); snd(ctx, 'sfx', 'pageTurn'); draw(); };
      closeBtn.onclick = () => m.close();
      draw();
    }

    // -------- evening --------
    function askEvening() {
      if (busy) return;
      if (run.actionsLeft > 0) {
        const yes = h('button', { class: 'btn primary', type: 'button' }, T.eveningYes);
        const no = h('button', { class: 'btn', type: 'button' }, T.eveningNo);
        const m = modal(h('div', { class: 'day-confirm' }, h('p', {}, T.eveningConfirm(run.actionsLeft)), h('div', { class: 'day-confirm-btns' }, no, yes)), { className: 'day-confirm-panel' });
        yes.onclick = () => { m.close(); evening(); };
        no.onclick = () => m.close();
        return;
      }
      evening();
    }

    async function evening() {
      if (busy) return;
      busy = true;
      closeBubble();
      snd(ctx, 'sfx', 'bell');
      room.classList.add('day-dusk');
      try { rules.endDay(run); } catch (err) { console.error('[day] endDay failed', err); fallbackRules.endDay(run); }
      if (endless) run.phase = 'night';
      ctx.save();
      await sleep(1300);
      if (endless) ctx.go('night');
      else ctx.go('note', { night: run.night });
    }

    // Esc closes the bubble.
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && bubbleLayer.firstChild) closeBubble();
    }, { signal: ac.signal });
    room.addEventListener('pointerdown', (e) => {
      if (!bubbleLayer.firstChild) return;
      if (e.target.closest('.day-bubble, .day-guest, .day-lost')) return;
      closeBubble();
    }, { signal: ac.signal });

    renderDyn();
    refreshBoard();
    refreshAp();
  },

  unmount() {
    if (!S) return;
    S.ac.abort();
    S.timers.forEach((t) => clearTimeout(t));
    S.views.forEach((v) => { try { v.destroy?.(); } catch { /* ignore */ } });
    S = null;
  },
};
