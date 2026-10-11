// Hand-drawn inline SVG icons (ink style: round caps, slight irregularity, stroke currentColor).
// ICONS[name] is a complete <svg> string (usable with innerHTML); icon(name, {size}) returns a node.
// Owner: render.

const NS = 'http://www.w3.org/2000/svg';

// Inner markup on a 48x48 grid. class="f" parts get a faint currentColor fill (see css/figure.css).
const BODY = {
  album: `<path d="M8.5 10.5C15 8 20 9 24 12.5C28 9 33.5 8 40 10.5L40.5 37C33.5 35 28.5 36 24 39.5C19.5 36 14.5 35.2 8 37.2Z" class="f"/>
    <path d="M24 12.5L24.4 39"/><path d="M13 16.5L20 16.2L19.6 24.3L12.8 24Z"/><path d="M28.5 17L36 16.4M28.4 22L35.4 22.3M28.6 27L36.2 27.4"/>`,
  question: `<path d="M15.5 17.5C15 8.5 32.5 8 32.5 17C32.5 23.5 24 23.5 24.2 29.5"/><circle cx="24.2" cy="37.6" r="1.7" fill="currentColor"/>`,
  flashlight: `<path d="M14.5 9L33.5 8.4L29.3 17.3L19 17.6Z" class="f"/><path d="M19 17.6L19.6 40C22.8 42.8 26.2 42.6 28.6 40L29.3 17.3"/>
    <path d="M24 23.5L24.3 30"/><path d="M9.5 6.5L5.5 3.2M24 4.6L24.3 1M38.8 6.2L42.8 3"/>`,
  mirror: `<path d="M24 5C33.6 4.6 40 11.8 40 20C40.2 28.6 33 34.2 24.2 34C15 34.4 8 28 8 20C7.6 11.6 14.6 5.2 24 5Z" class="f"/>
    <path d="M24.2 34L23.8 43.4M19.6 43.8L28.6 43.2"/><path d="M14.8 15C16 11.4 18.6 9.6 21.4 9"/><path d="M15.6 21.5L20 15.8" opacity=".7"/>`,
  candle: `<path d="M17.2 22L16.8 41.2L31.2 41L30.8 22.4" class="f"/><path d="M17.2 22C21 24.6 27 24.6 30.8 22.4"/>
    <path d="M24 22.2L23.8 18.2"/><path d="M24 6.5C28.4 11 29 14.6 24 18.2C19 14.6 19.8 11 24 6.5Z"/><path d="M12.6 41.8L35.6 41.6"/><path d="M17.6 29.5Q15.6 32.5 17.4 35"/>`,
  residents: `<circle cx="17.5" cy="15.5" r="6.4" class="f"/><path d="M6.6 38.4C6.2 27.4 28.4 27.2 28.8 38.2Z" class="f"/>
    <circle cx="33" cy="19" r="4.9"/><path d="M28.6 33.4C30.4 26.6 41.8 27 42 36.6"/>`,
  flame: `<path d="M24 5C29.6 12 36.4 16.8 36 27C35.8 35 30 41.2 24 41.2C17.6 41 12 35 12.2 27.4C12.2 22.6 15 19.2 17 16.2C18 20 20 21.4 22.2 20.4C21 15.4 21 10 24 5Z" class="f"/>
    <path d="M24 27.2C27.4 30.2 28.2 34.4 24 37.4C19.8 34.4 20.6 30.2 24 27.2Z"/>`,
  flameOut: `<path d="M24 20C28 25 31.6 28 31.4 33.4C31.2 38 28 41.2 24 41.2C20 41 16.8 38 16.8 33.6C16.8 30.8 18.4 28.8 19.8 27" stroke-dasharray="3.2 3.2"/>
    <path d="M22.2 15C17.6 11.4 26.6 8.6 22 3.6"/><path d="M30.2 17C26.6 13.6 33.8 11.4 30 7.2" opacity=".8"/><path d="M14 43L34.4 42.6"/>`,
  bed: `<path d="M5 17.5L4.8 38.5"/><path d="M5 31.4L43 31.2L43.2 38.4"/><path d="M43 31.2L43.2 26C43.2 22.6 40 22.2 37.6 22.4L19.8 22.5L19.6 31.2" class="f"/>
    <path d="M8 22.4C7.4 16.6 18.6 16.4 19.6 22.4Z" class="f"/>`,
  battery: `<path d="M6.8 15.8L36.4 16.2L36 34.2L7.2 33.8Z" class="f"/><path d="M36.2 21.4L40.6 21.2L40.4 28.8L36.2 28.6"/>
    <path d="M12 21.4L12.4 28.6M18.2 21L18 29M24.2 21.6L24.4 28.4"/>`,
  door: `<path d="M12 42.2L11.6 16.4C11.6 6.6 36.2 6.8 36.4 16.6L36.2 42.2Z" class="f"/><path d="M7.4 42.6L41 42.2"/>
    <path d="M24.2 9.4L24 42"/><circle cx="31" cy="28.6" r="1.8" fill="currentColor"/>`,
  wick: `<path d="M24 42.4C19.6 36.6 28.4 32.8 24 26.4C19.8 20.4 28 17 24.2 11.2" stroke-width="3"/><path d="M24.2 2.6C27.8 6 27.8 8.6 24.2 11.4C20.6 8.6 20.6 6 24.2 2.6Z" class="f"/>
    <path d="M16.4 42.8L32 42.4"/>`,
  talk: `<path d="M6.6 12.4C6.8 8 12 7.2 24 7.2C36.4 7.2 41.4 8 41.2 12.6L41.4 25C41.2 29.2 36.4 30 30.2 30.2L21.4 38L21.2 30.2C11.6 30 6.8 29.4 6.8 25Z" class="f"/>
    <circle cx="15.6" cy="18.6" r="1.6" fill="currentColor"/><circle cx="24" cy="18.4" r="1.6" fill="currentColor"/><circle cx="32.4" cy="18.6" r="1.6" fill="currentColor"/>`,
  friend: `<circle cx="16" cy="14.6" r="5.6" class="f"/><circle cx="33" cy="14.8" r="5.6" class="f"/>
    <path d="M8.6 41.4C8 27.6 23.6 27.8 23.2 41.4Z" class="f"/><path d="M24.8 41.2C24.6 27.6 40.2 27.8 39.6 41.6Z" class="f"/><path d="M21.6 34.6C23.4 36.4 25.6 36.4 27.4 34.6"/>`,
  bolt: `<path d="M9.6 21L38.4 20.6L38.2 27.4L9.8 27.8Z" class="f"/><path d="M19.6 21L19.8 12.6"/><circle cx="19.8" cy="9.6" r="3.2"/>
    <path d="M38.6 14.6L38.4 33.6"/><path d="M5.6 17.4L5.4 31"/>`,
  flap: `<path d="M10.4 8.6L38 8.2"/><path d="M13.6 8.6L14 23.4C14.2 28.4 33.8 28.4 34.2 23.2L34.4 8.4" class="f"/>
    <path d="M21.2 28.2L21.6 33.8L27 33.8L27 28.4"/><circle cx="24" cy="39.6" r="2.2"/><path d="M9.6 12.6C8.6 15 8.6 17 9.4 19.4" opacity=".7"/>`,
  gear: null, // generated below
  back: `<path d="M39.6 24.4C31 24.8 21.4 24 11.4 24.2"/><path d="M21.6 13.2C17.2 17.6 14.4 20.8 11.2 24.2C14.6 27.6 17.6 30.8 21.8 35"/>`,
  play: `<path d="M15.8 8.8C22.4 13.2 30 18.8 36.4 24C30.2 29.4 22 35 15.6 39.4C15 29.8 15.2 18.4 15.8 8.8Z" class="f"/>`,
  sound: `<path d="M7.8 19.2L15 19L24.2 11L24 37L15.2 29L8 29.2Z" class="f"/><path d="M30 18.2C33.4 21.4 33.4 26.8 30.2 30"/><path d="M35 12.8C41.4 18.8 41.4 29 35.2 35.2"/>`,
  lock: `<path d="M10.2 22.2L38 22L38.2 41.2L10 41.4Z" class="f"/><path d="M15.2 22L15 16C15 5.6 33.2 5.4 33 16.4L33.2 22"/>
    <circle cx="24" cy="30" r="2.8" fill="currentColor"/><path d="M24 32.6L24.2 36.2"/>`,
  star: `<path d="M24 4.6L29.4 17.6L43.2 18.8L32.8 28L36.2 42.2L24 34.8L11.8 41.8L15.4 28L5 19.2L18.6 17.8Z" class="f"/>`,
  moon: `<path d="M31.6 6.4C19.8 7.6 11.8 17.4 14 29.4C16 39.6 28 44.6 38.2 38.2C28.4 37.6 22.4 28.4 24.4 19.2C25.2 13.6 28.2 9.2 31.6 6.4Z" class="f"/>
    <path d="M36.4 10.4L36.6 15.6M34 13L39 13.2" opacity=".8"/>`,
  sun: `<circle cx="24" cy="24" r="8.4" class="f"/><path d="M24 4.6L24.2 11M24 37L23.8 43.6M4.6 24.2L11 23.8M37 24.2L43.6 23.8M10.2 10.4L14.6 14.8M33.4 33.4L37.8 37.8M37.6 10.2L33.2 14.6M14.4 33.6L10 38"/>`,
  house: `<path d="M5.6 24.4L24 8.2L42.4 24.2"/><path d="M11 21.4L11.4 41.6L37 41.4L37.2 21.2" class="f"/><path d="M33.2 14.2L33.4 9L37.6 8.8L37.4 17.8"/>
    <path d="M20.8 41.6L21 30.4L28 30.2L28.2 41.4"/><circle cx="24.4" cy="22" r="2.2"/>`,
  eye: `<path d="M3.8 24.2C11.6 11.4 36.4 11.6 44.4 24.4C36.4 36.4 12 36.8 3.8 24.2Z" class="f"/><circle cx="24" cy="24.2" r="6.6"/><circle cx="24.2" cy="24.4" r="2.6" fill="currentColor"/>
    <path d="M24 8.6L23.8 5M12.4 12.2L10.2 9.4M35.8 12L38 9.2" opacity=".75"/>`,
};

// Gear: 8 hand-wobbled teeth.
(() => {
  const pts = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const j = Math.sin(i * 7.3) * 0.6;
    const r1 = 12.2 + j * 0.3, r2 = 18.4 + j;
    const da = 0.17;
    for (const [r, d] of [[r1, -0.3], [r2, -da], [r2, da], [r1, 0.3]]) {
      pts.push([24 + Math.cos(a + d * 1.1) * r, 24 + Math.sin(a + d * 1.1) * r]);
    }
  }
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('') + 'Z';
  BODY.gear = `<path d="${d}" class="f"/><circle cx="24.2" cy="24" r="5.6"/>`;
})();

function svgString(name, size) {
  return `<svg xmlns="${NS}" class="ico ico-${name}" viewBox="0 0 48 48" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${BODY[name]}</svg>`;
}

/** name -> complete <svg> string (32 px default; also usable via innerHTML). */
export const ICONS = Object.fromEntries(Object.keys(BODY).map((k) => [k, svgString(k, 32)]));

/** An inline SVG element in the hand-drawn icon style. Unknown names give a question mark. */
export function icon(name, { size = 32, className = '' } = {}) {
  const key = BODY[name] ? name : 'question';
  const tpl = document.createElement('template');
  tpl.innerHTML = svgString(key, size);
  const el = tpl.content.firstElementChild;
  if (className) el.setAttribute('class', `${el.getAttribute('class')} ${className}`);
  return el;
}
