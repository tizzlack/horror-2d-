// Hand-drawn SVG artwork for the night screen (door, table, flames, bolt, mirror, candle).
// Everything is inline SVG with round caps; the shared #rough filter is applied by the callers.

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wavy vertical grain line from (x, y0) to y1. */
function grain(r, x, y0, y1, amp) {
  let d = `M${x.toFixed(1)} ${y0}`;
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    const y = y0 + ((y1 - y0) * i) / steps;
    const dx = (r() - 0.5) * amp;
    d += ` Q${(x + dx * 2).toFixed(1)} ${(y - (y1 - y0) / steps / 2).toFixed(1)} ${(x + dx).toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

/** The door, 800 x 640 (frame posts included). Peephole centre is (400, 300), ring radius 228. */
export function doorSvg() {
  const r = rng(7);
  const planks = 6;
  const left = 22;
  const w = (800 - 44) / planks;
  const tones = ['#3b2a1e', '#35261b', '#40301f', '#33241a', '#3c2b1e', '#37281c'];
  let body = '';
  for (let i = 0; i < planks; i++) {
    const x = left + i * w;
    body += `<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="640" fill="${tones[i]}"/>`;
    for (let g = 0; g < 6; g++) {
      const gx = x + 12 + r() * (w - 24);
      body += `<path d="${grain(r, gx, -5, 645, 10)}" stroke="#6a4c35" stroke-opacity="${(0.25 + r() * 0.3).toFixed(2)}" stroke-width="${(1 + r() * 1.4).toFixed(1)}" fill="none" stroke-linecap="round"/>`;
    }
    const kx = x + 20 + r() * (w - 40);
    const ky = 40 + r() * 560;
    body += `<ellipse cx="${kx.toFixed(1)}" cy="${ky.toFixed(1)}" rx="${(7 + r() * 5).toFixed(1)}" ry="${(11 + r() * 7).toFixed(1)}" fill="#241810" stroke="#6a4c35" stroke-opacity=".5" stroke-width="2"/>`;
    body += `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="640" stroke="#07060a" stroke-width="5" stroke-linecap="round"/>`;
  }
  // Scribbly pencil hatching in the lower half (shadow side) for the sketchbook look.
  let hatch = '';
  for (let i = 0; i < 90; i++) {
    const x = r() * 780;
    const y = 300 + r() * 340;
    hatch += `M${x.toFixed(0)} ${y.toFixed(0)}l${(14 + r() * 18).toFixed(0)} ${(-10 - r() * 12).toFixed(0)}`;
  }
  // Iron bands + hinge straps.
  const band = (y) => `
    <rect x="22" y="${y}" width="756" height="34" fill="#15171d" stroke="#05060a" stroke-width="3"/>
    <path d="M22 ${y + 6}H778" stroke="#4a5060" stroke-opacity=".5" stroke-width="2"/>
    ${[60, 150, 250, 560, 650, 740].map((x) => `<circle cx="${x}" cy="${y + 17}" r="5.5" fill="#2b2f3a" stroke="#05060a" stroke-width="2"/><circle cx="${x - 1.5}" cy="${y + 15}" r="1.6" fill="#8d94a6"/>`).join('')}`;
  const strap = (y) => `<path d="M22 ${y - 4} H190 Q214 ${y + 17} 190 ${y + 38} H22 Z" fill="#1b1e26" stroke="#05060a" stroke-width="3"/>
    <circle cx="190" cy="${y + 17}" r="8" fill="#2b2f3a" stroke="#05060a" stroke-width="2.5"/>`;
  // Cracks (revealed by door damage).
  const cracks = `
    <g class="crack" data-i="0"><path d="M400 70 L372 30 L384 4 L356 -12" stroke="#050403" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M372 30 L340 36" stroke="#050403" stroke-width="3" fill="none" stroke-linecap="round"/></g>
    <g class="crack" data-i="1"><path d="M610 330 L660 352 L650 392 L706 420 L700 470" stroke="#050403" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M650 392 L612 410" stroke="#050403" stroke-width="3" fill="none" stroke-linecap="round"/></g>
    <g class="crack" data-i="2"><path d="M200 380 L240 430 L214 470 L262 520 L248 600" stroke="#050403" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M240 430 L286 440" stroke="#050403" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
  // Ring of the peephole with rivets.
  let rivets = '';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.2;
    rivets += `<circle cx="${(400 + Math.cos(a) * 241).toFixed(1)}" cy="${(300 + Math.sin(a) * 241).toFixed(1)}" r="4.5" fill="#8a6b34" stroke="#05060a" stroke-width="2"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 640" width="800" height="640" class="door-svg" aria-hidden="true">
    <rect x="0" y="-20" width="800" height="700" fill="#15100c"/>
    ${body}
    <path d="${hatch}" stroke="#05040a" stroke-opacity=".32" stroke-width="2" stroke-linecap="round" fill="none"/>
    ${band(104)}${band(468)}
    ${strap(104)}${strap(468)}
    <rect x="0" y="-20" width="22" height="700" fill="#241911" stroke="#05060a" stroke-width="4"/>
    <rect x="778" y="-20" width="22" height="700" fill="#241911" stroke="#05060a" stroke-width="4"/>
    <circle cx="400" cy="300" r="246" fill="#0a0907" stroke="#05060a" stroke-width="6"/>
    <circle cx="400" cy="300" r="236" fill="none" stroke="#8a6b34" stroke-width="12"/>
    <circle cx="400" cy="300" r="229" fill="none" stroke="#e6c87a" stroke-opacity=".5" stroke-width="2.5" stroke-dasharray="90 60"/>
    <circle cx="400" cy="300" r="243" fill="none" stroke="#05060a" stroke-width="3"/>
    ${rivets}
    <circle cx="400" cy="584" r="24" fill="none" stroke="#14161c" stroke-width="9"/><circle cx="400" cy="584" r="24" fill="none" stroke="#4a5060" stroke-opacity=".5" stroke-width="2"/>
    <rect x="388" y="548" width="24" height="16" rx="4" fill="#1b1e26" stroke="#05060a" stroke-width="2.5"/>
    ${cracks}
  </svg>`;
}

/** Lantern flame; lit = glowing, otherwise a dead wick with a wisp of smoke. */
export function flameSvg(lit = true) {
  if (lit) {
    return `<svg viewBox="0 0 44 64" width="44" height="64" class="flame-svg lit" aria-hidden="true">
      <path d="M10 62 H34 L31 52 H13 Z" fill="#6b5226" stroke="#2b2622" stroke-width="2.5" stroke-linejoin="round"/>
      <g class="flame-body"><path d="M22 3 C32 17 38 26 35 39 C33 49 27 54 22 54 C16 54 9 49 8 39 C7 29 15 24 17 13 C20 18 21 11 22 3Z" fill="#f2b84b" stroke="#2b2622" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M22 24 C27 31 29 36 27 42 C26 47 24 49 22 49 C19 49 17 46 17 42 C17 36 20 33 22 24Z" fill="#fff0b8" stroke="#a8721b" stroke-width="1.5" stroke-linejoin="round"/></g>
      <path d="M12 20l-5-3M33 18l5-4M8 34l-6 1M37 33l6-1" stroke="#f2b84b" stroke-width="2" stroke-linecap="round" opacity=".8"/>
    </svg>`;
  }
  return `<svg viewBox="0 0 44 64" width="44" height="64" class="flame-svg dead" aria-hidden="true">
      <path d="M10 62 H34 L31 52 H13 Z" fill="#3c3320" stroke="#2b2622" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M22 52 Q20 44 23 38" stroke="#151515" stroke-width="3.5" stroke-linecap="round" fill="none"/>
      <path class="smoke" d="M23 36 Q16 28 24 20 Q31 12 22 4" stroke="#6b7388" stroke-opacity=".55" stroke-width="3" stroke-linecap="round" fill="none"/>
    </svg>`;
}

/** The bolt plate (the knob is a separate DOM element so it can be dragged). 150 x 56. */
export function boltPlateSvg() {
  return `<svg viewBox="0 0 150 56" width="150" height="56" aria-hidden="true">
    <rect x="3" y="6" width="144" height="44" rx="10" fill="#1c1f27" stroke="#05060a" stroke-width="3.5"/>
    <rect x="12" y="20" width="126" height="16" rx="8" fill="#07080b" stroke="#3b4150" stroke-width="2"/>
    <path d="M14 11H136" stroke="#5a6074" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/>
    ${[12, 138].map((x) => `<circle cx="${x}" cy="12" r="3" fill="#3a3f4f" stroke="#05060a" stroke-width="1.5"/><circle cx="${x}" cy="44" r="3" fill="#3a3f4f" stroke="#05060a" stroke-width="1.5"/>`).join('')}
  </svg>`;
}

/** Hinged brass flap handle (the cover over the peephole is separate). 110 x 64. */
export function flapHandleSvg() {
  return `<svg viewBox="0 0 110 64" width="110" height="64" aria-hidden="true">
    <path d="M6 14 Q6 6 14 6 H96 Q104 6 104 14 V38 Q104 46 96 46 H14 Q6 46 6 38Z" fill="#8a6b34" stroke="#05060a" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M14 14 H96" stroke="#e6c87a" stroke-opacity=".7" stroke-width="3" stroke-linecap="round"/>
    <circle cx="16" cy="26" r="3.2" fill="#3b2d12"/><circle cx="94" cy="26" r="3.2" fill="#3b2d12"/>
    <path d="M30 30 H80" stroke="#3b2d12" stroke-width="3" stroke-linecap="round" stroke-dasharray="4 7"/>
    <path d="M40 46 V58 Q55 66 70 58 V46" fill="#6e5324" stroke="#05060a" stroke-width="3" stroke-linejoin="round"/>
  </svg>`;
}

/** Table surface along the bottom of the stage (1280 x 130) with a couple of props. */
export function tableSvg() {
  const r = rng(21);
  let planks = '';
  for (let i = 0; i < 7; i++) {
    planks += `<path d="M${i * 190 - 10} 34 L${i * 190 + 8} 130" stroke="#0d0906" stroke-opacity=".7" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  }
  let grainLines = '';
  for (let i = 0; i < 26; i++) {
    const x = r() * 1280;
    const y = 40 + r() * 80;
    grainLines += `M${x.toFixed(0)} ${y.toFixed(0)} q${(30 + r() * 40).toFixed(0)} ${(r() * 6 - 3).toFixed(1)} ${(70 + r() * 80).toFixed(0)} ${(r() * 4 - 2).toFixed(1)}`;
  }
  let edge = 'M0 12';
  for (let x = 40; x <= 1280; x += 40) edge += ` L${x} ${(10 + r() * 5).toFixed(1)}`;
  edge += ' L1280 130 L0 130 Z';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 130" width="1280" height="130" preserveAspectRatio="none" aria-hidden="true">
    <path d="${edge}" fill="#2f2118" stroke="#05060a" stroke-width="4" stroke-linejoin="round"/>
    <path d="M0 14 H1280" stroke="#a8825a" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>
    <rect x="0" y="22" width="1280" height="108" fill="#251a13"/>
    ${planks}
    <path d="${grainLines}" stroke="#6a4c35" stroke-opacity=".35" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M0 22 H1280" stroke="#05060a" stroke-width="3"/>
    <!-- teacup -->
    <g transform="translate(96 -14)"><path d="M0 22 H54 Q52 54 28 56 Q4 54 0 22Z" fill="#cfc6b3" stroke="#05060a" stroke-width="3" stroke-linejoin="round"/><path d="M54 28 Q74 28 66 44 Q62 50 52 48" fill="none" stroke="#05060a" stroke-width="4" stroke-linecap="round"/><ellipse cx="27" cy="23" rx="27" ry="5" fill="#6b4a2e" stroke="#05060a" stroke-width="2.5"/>
      <path class="steam" d="M18 14 Q10 4 20 -6 M34 14 Q42 2 32 -10" stroke="#9aa3b5" stroke-opacity=".6" stroke-width="3" fill="none" stroke-linecap="round"/></g>
    <!-- keys -->
    <g transform="translate(236 40) rotate(-8)"><circle cx="0" cy="0" r="11" fill="none" stroke="#a88a3c" stroke-width="5"/><path d="M10 2 H50 M40 2 v10 M48 2 v8" stroke="#a88a3c" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M10 2 H50" stroke="#05060a" stroke-width="1.5" opacity=".6"/></g>
    <!-- pencil -->
    <g transform="translate(330 76) rotate(6)"><rect x="0" y="0" width="86" height="9" fill="#d9a441" stroke="#05060a" stroke-width="2.5" stroke-linejoin="round"/><path d="M86 0 L104 4.5 L86 9Z" fill="#e8d7b0" stroke="#05060a" stroke-width="2.5" stroke-linejoin="round"/><path d="M98 3 L104 4.5 L98 6Z" fill="#2b2622"/></g>
  </svg>`;
}

/** Candle on a dish; the flame is animated through CSS classes. 70 x 110. */
export function candleSvg() {
  return `<svg viewBox="0 0 70 110" width="70" height="110" aria-hidden="true">
    <ellipse cx="35" cy="98" rx="30" ry="8" fill="#6b5226" stroke="#05060a" stroke-width="3"/>
    <path d="M22 98 V50 Q22 46 26 46 H44 Q48 46 48 50 V98Z" fill="#e8dcc0" stroke="#2b2622" stroke-width="3" stroke-linejoin="round"/>
    <path d="M30 56 Q29 70 31 82" stroke="#bfae86" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M26 46 Q24 54 27 58" stroke="#bfae86" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M35 46 V38" stroke="#151515" stroke-width="3" stroke-linecap="round"/>
    <g class="candle-flame"><path d="M35 8 C42 18 46 24 43 32 C41 38 38 40 35 40 C31 40 28 38 27 32 C26 25 32 20 33 14 C34 17 35 13 35 8Z" fill="#f2b84b" stroke="#2b2622" stroke-width="2.5" stroke-linejoin="round"/><path d="M35 22 C38 26 39 30 38 33 C37 36 36 37 35 37 C33 37 32 35 32 33 C32 30 34 27 35 22Z" fill="#fff0b8"/></g>
  </svg>`;
}

/** Hand mirror frame, 260 x 330; the glass centre is (130, 130) with radius 104. */
export function mirrorFrameSvg() {
  return `<svg viewBox="0 0 260 330" width="260" height="330" aria-hidden="true">
    <path d="M118 232 L112 318 Q130 330 148 318 L142 232Z" fill="#6b5226" stroke="#05060a" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="130" cy="130" r="118" fill="#a88a3c" stroke="#05060a" stroke-width="5"/>
    <circle cx="130" cy="130" r="104" fill="#0f1420" stroke="#05060a" stroke-width="4"/>
    <path d="M44 70 Q70 30 118 24" stroke="#e6c87a" stroke-opacity=".7" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = (i / 8) * Math.PI * 2; return `<circle cx="${(130 + Math.cos(a) * 111).toFixed(1)}" cy="${(130 + Math.sin(a) * 111).toFixed(1)}" r="3" fill="#e6c87a" opacity=".8"/>`; }).join('')}
  </svg>`;
}

/** Speech bubble tail pointing left (towards the peephole), 40 x 40. */
export function tailSvg() {
  return `<svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true"><path d="M44 4 Q16 8 3 40 Q28 28 44 30" fill="#efe6d3" stroke="#2b2622" stroke-width="3" stroke-linejoin="round"/><path d="M44 8 V28" stroke="#efe6d3" stroke-width="6"/></svg>`;
}

/** Round hand-drawn pause button glyph. */
export function pauseGlyph() {
  return `<svg viewBox="0 0 28 28" width="24" height="24" aria-hidden="true"><path d="M9 5 V23 M19 5 V23" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>`;
}

/** Coat hooks with a coat, a scarf and a hat on the left wall (pure decoration), 200 x 120. */
export function wallDecorSvg() {
  return `<svg viewBox="0 0 200 120" width="200" height="120" aria-hidden="true">
    <rect x="6" y="6" width="188" height="12" rx="3" fill="#2b1e14" stroke="#05060a" stroke-width="3"/>
    ${[40, 100, 160].map((x) => `<path d="M${x} 18 v10 q0 6 7 6" stroke="#8a6b34" stroke-width="5" fill="none" stroke-linecap="round"/>`).join('')}
    <path d="M30 26 Q20 70 24 112 H70 Q74 70 56 26Z" fill="#3a2f3f" stroke="#05060a" stroke-width="3" stroke-linejoin="round"/>
    <path d="M46 30 V110 M32 60 h-6 M52 56 h4" stroke="#1b1621" stroke-width="3" stroke-linecap="round"/>
    <circle cx="46" cy="52" r="2.5" fill="#8a6b34"/><circle cx="46" cy="72" r="2.5" fill="#8a6b34"/><circle cx="46" cy="92" r="2.5" fill="#8a6b34"/>
    <path d="M96 30 Q86 40 98 56 Q92 80 104 100 Q108 80 112 56 Q116 40 106 30Z" fill="#8a2f2b" stroke="#05060a" stroke-width="3" stroke-linejoin="round"/>
    <path d="M92 44 h22 M94 62 h18 M98 80 h12" stroke="#d9a441" stroke-width="3" stroke-linecap="round" opacity=".8"/>
    <path d="M142 30 Q160 4 178 30 Q176 36 160 34 Q144 36 142 30Z" fill="#3b3a2c" stroke="#05060a" stroke-width="3" stroke-linejoin="round"/>
    <path d="M144 32 Q160 38 176 32" stroke="#8a6b34" stroke-width="4" fill="none" stroke-linecap="round"/>
  </svg>`;
}
