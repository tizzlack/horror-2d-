// Title screen: hand-lettered logo, the Lantern House at dusk, creatures flickering into monsters.
import { h, svg, modal } from '../core/dom.js';
import { store, newRun } from '../core/state.js';
import { DIFFICULTY, DIFFICULTY_ORDER } from '../data/difficulty.js';
import { FIGURES } from '../data/figures.js';
import { loadRender, portrait } from './album.js';

/* ------------------------------------------------------------------ */
/* Drawing helpers (exported: the ending screen reuses the house)       */
/* ------------------------------------------------------------------ */

let uid = 0;

/** Seeded pseudo random, stable between visits so the sky does not jump. */
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * The Lantern House, drawn in pencil style. opts: lantern 'on'|'dim'|'off', door 'closed'|'open',
 * windows 'on'|'off'. viewBox 400x420, the door foot is at y = 392.
 */
export function houseSvg({ lantern = 'on', door = 'closed', windows = 'on', tone = 'dusk' } = {}) {
  const id = ++uid;
  const ink = '#14110f';
  const bodyFill = tone === 'dawn' ? '#8c7f86' : tone === 'fog' ? '#4a4c5a' : '#4a3d4f';
  const roofFill = tone === 'dawn' ? '#a2625c' : tone === 'fog' ? '#3f3a47' : '#5b3438';
  const lanternFill = lantern === 'on' ? '#f7c85a' : lantern === 'dim' ? '#85703d' : '#2a2a30';
  const win = windows === 'on' ? '#f6c25a' : '#25212f';
  const doorOpen = door === 'open';
  const g = (attrs, ...kids) => svg('g', attrs, ...kids);
  const p = (d, attrs = {}) => svg('path', { d, ...attrs });
  const stroke = { stroke: ink, 'stroke-width': 3.4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };

  const defs = svg('defs', {},
    svg('radialGradient', { id: `hg${id}`, cx: '50%', cy: '50%', r: '50%' },
      svg('stop', { offset: '0%', 'stop-color': '#ffd780', 'stop-opacity': lantern === 'on' ? 0.85 : lantern === 'dim' ? 0.25 : 0 }),
      svg('stop', { offset: '45%', 'stop-color': '#f2b84b', 'stop-opacity': lantern === 'on' ? 0.3 : 0.08 }),
      svg('stop', { offset: '100%', 'stop-color': '#f2b84b', 'stop-opacity': 0 })),
    svg('pattern', { id: `ht${id}`, width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(38)' },
      svg('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: ink, 'stroke-width': 1.3, opacity: 0.38 })),
    svg('filter', { id: `hb${id}`, x: '-50%', y: '-50%', width: '200%', height: '200%' },
      svg('feGaussianBlur', { stdDeviation: 7 })));

  const bodyPath = 'M84 205 L318 201 L322 392 L80 396 Z';
  const roofPath = 'M46 216 L200 88 L354 214 Z';
  const doorPath = 'M168 392 L168 312 Q168 282 200 282 Q232 282 232 312 L232 392 Z';

  return svg('svg', { class: 'menu-house', viewBox: '-60 -90 520 520', 'aria-hidden': 'true', focusable: 'false' },
    defs,
    lantern !== 'off' && svg('circle', { class: 'menu-lantern-glow', cx: 200, cy: 52, r: 240, fill: `url(#hg${id})` }),
    g({ filter: 'url(#sketch)' },
      // chimney + smoke
      svg('rect', { x: 262, y: 122, width: 30, height: 52, fill: '#3e3340', ...stroke }),
      svg('rect', { x: 262, y: 122, width: 30, height: 52, fill: `url(#ht${id})` }),
      p('M277 116 C 266 96, 290 84, 276 62 C 268 48, 286 40, 280 24', { class: 'menu-smoke', fill: 'none', stroke: '#cfc7d8', 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0.45 }),
      // body
      p(bodyPath, { fill: bodyFill, ...stroke }),
      p(bodyPath, { fill: `url(#ht${id})` }),
      p('M120 207 L121 394 M160 205 L160 393 M240 204 L241 394 M280 203 L281 393', { fill: 'none', stroke: ink, 'stroke-width': 1.6, opacity: 0.35 }),
      // windows
      windows === 'on' && svg('circle', { cx: 126, cy: 270, r: 44, fill: '#f6c25a', opacity: 0.4, filter: `url(#hb${id})` }),
      windows === 'on' && svg('circle', { cx: 274, cy: 270, r: 44, fill: '#f6c25a', opacity: 0.4, filter: `url(#hb${id})` }),
      svg('rect', { x: 104, y: 246, width: 44, height: 46, fill: win, ...stroke }),
      svg('rect', { x: 252, y: 246, width: 44, height: 46, fill: win, ...stroke }),
      p('M126 246 L126 292 M104 269 L148 269 M274 246 L274 292 M252 269 L296 269', { fill: 'none', stroke: ink, 'stroke-width': 2.6, 'stroke-linecap': 'round' }),
      // roof
      p(roofPath, { fill: roofFill, ...stroke }),
      p(roofPath, { fill: `url(#ht${id})` }),
      p('M46 216 L354 214', { fill: 'none', ...stroke, 'stroke-width': 5 }),
      p('M120 160 L200 108 L280 160', { fill: 'none', stroke: ink, 'stroke-width': 1.8, opacity: 0.4 }),
      // door
      p(doorPath, { fill: doorOpen ? '#f6c860' : '#1c1618', ...stroke }),
      doorOpen
        ? p('M182 392 L186 318 Q200 300 214 318 L218 392', { fill: '#fff0b8', opacity: 0.85 })
        : p('M184 300 L184 392 M200 288 L200 392 M216 300 L216 392', { fill: 'none', stroke: '#4a3c3c', 'stroke-width': 2 }),
      !doorOpen && svg('circle', { cx: 221, cy: 342, r: 4.5, fill: lantern === 'on' ? '#f2b84b' : '#9a8f78', stroke: ink, 'stroke-width': 1.6 }),
      lantern === 'on' && !doorOpen && svg('rect', { x: 171, y: 388, width: 58, height: 6, fill: '#f7c85a', opacity: 0.8 }),
      // steps
      svg('rect', { x: 150, y: 392, width: 100, height: 11, fill: '#3b3340', ...stroke, 'stroke-width': 2.6 }),
      svg('rect', { x: 138, y: 402, width: 124, height: 11, fill: '#342d39', ...stroke, 'stroke-width': 2.6 }),
      // lantern on the roof
      p('M200 92 L200 56', { fill: 'none', ...stroke, 'stroke-width': 4 }),
      p('M184 36 L200 18 L216 36 Z', { fill: '#2b2622', ...stroke, 'stroke-width': 2.6 }),
      svg('circle', { cx: 200, cy: 12, r: 4.5, fill: 'none', ...stroke, 'stroke-width': 2.4 }),
      svg('rect', { x: 187, y: 36, width: 26, height: 26, rx: 4, fill: lanternFill, ...stroke, 'stroke-width': 2.8 }),
      lantern !== 'off' && svg('ellipse', { class: 'menu-flame', cx: 200, cy: 50, rx: 4.5, ry: 8, fill: '#fff4cc' }),
      p('M193 36 L193 62 M207 36 L207 62', { fill: 'none', stroke: ink, 'stroke-width': 1.8 }),
      // grass tufts
      p('M70 396 C 66 384, 72 378, 74 372 M80 398 C 80 388, 86 384, 88 378 M262 408 C 266 396, 272 392, 274 386 M326 396 C 322 384, 330 380, 330 372 M340 400 C 342 390, 350 388, 352 380', { fill: 'none', stroke: ink, 'stroke-width': 2.4, 'stroke-linecap': 'round' })));
}

function skySvg() {
  const r = lcg(7);
  const strokes = [];
  for (let i = 0; i < 300; i++) {
    const x = r() * 1280;
    const y = r() * 520;
    const len = 18 + r() * 40;
    const a = 0.9 + r() * 0.5;
    const light = r() > 0.55;
    strokes.push(svg('line', {
      x1: x, y1: y, x2: x + len * Math.cos(a - 0.2), y2: y + len * Math.sin(a - 0.2) * 0.35,
      stroke: light ? 'rgba(255,238,210,0.07)' : 'rgba(5,5,12,0.16)', 'stroke-width': 1.5, 'stroke-linecap': 'round',
    }));
  }
  const stars = [];
  for (let i = 0; i < 34; i++) {
    const x = r() * 1280;
    const y = 12 + r() * 300;
    const s = 3 + r() * 4;
    stars.push(svg('path', {
      class: 'menu-star', d: `M${x - s} ${y} L${x + s} ${y} M${x} ${y - s} L${x} ${y + s}`,
      stroke: '#f3ead6', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0.25 + r() * 0.5,
      style: `animation-delay:${(r() * 5).toFixed(2)}s`,
    }));
  }
  const hatch = [];
  for (let i = 0; i < 90; i++) {
    const x = r() * 1280;
    const y = 520 + r() * 190;
    hatch.push(svg('line', { x1: x, y1: y, x2: x + 22, y2: y - 8, stroke: 'rgba(0,0,0,0.28)', 'stroke-width': 1.6, 'stroke-linecap': 'round' }));
  }
  return svg('svg', { class: 'menu-sky', viewBox: '0 0 1280 720', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    svg('defs', {},
      svg('linearGradient', { id: 'menuSky', x1: 0, y1: 0, x2: 0, y2: 1 },
        svg('stop', { offset: '0', 'stop-color': '#090c18' }),
        svg('stop', { offset: '0.32', 'stop-color': '#191d38' }),
        svg('stop', { offset: '0.52', 'stop-color': '#3a2f55' }),
        svg('stop', { offset: '0.64', 'stop-color': '#7d4a58' }),
        svg('stop', { offset: '0.72', 'stop-color': '#d08850' })),
      svg('radialGradient', { id: 'menuHorizon', cx: 0.78, cy: 0.62, r: 0.5 },
        svg('stop', { offset: '0', 'stop-color': '#f2b84b', 'stop-opacity': 0.4 }),
        svg('stop', { offset: '1', 'stop-color': '#f2b84b', 'stop-opacity': 0 })),
      svg('linearGradient', { id: 'menuGround', x1: 0, y1: 0, x2: 0, y2: 1 },
        svg('stop', { offset: '0', 'stop-color': '#1d1a26' }),
        svg('stop', { offset: '1', 'stop-color': '#0b0a10' }))),
    svg('rect', { width: 1280, height: 720, fill: 'url(#menuSky)' }),
    svg('rect', { width: 1280, height: 720, fill: 'url(#menuHorizon)' }),
    svg('g', {}, strokes),
    svg('g', {}, stars),
    // moon, a scribbled crescent
    svg('g', { filter: 'url(#sketch)' },
      svg('path', { d: 'M1160 60 A 40 40 0 1 0 1200 116 A 32 32 0 1 1 1160 60 Z', fill: '#efe6d3', stroke: '#14110f', 'stroke-width': 2.6, 'stroke-linejoin': 'round', opacity: 0.92 })),
    // far hills
    svg('g', { filter: 'url(#sketch)' },
      svg('path', { d: 'M0 470 C 140 430, 260 450, 380 478 C 520 440, 640 462, 760 482 C 880 452, 1040 440, 1280 474 L1280 720 L0 720 Z', fill: '#2a2440', stroke: '#14110f', 'stroke-width': 3 }),
      svg('path', { d: 'M0 520 C 160 492, 300 508, 460 530 C 620 506, 800 500, 980 528 C 1100 508, 1200 510, 1280 522 L1280 720 L0 720 Z', fill: '#1b1824', stroke: '#14110f', 'stroke-width': 3 })),
    svg('rect', { y: 540, width: 1280, height: 180, fill: 'url(#menuGround)' }),
    svg('g', {}, hatch));
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function scribbleUnderline() {
  return svg('svg', { class: 'menu-underline', viewBox: '0 0 760 40', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    svg('g', { fill: 'none', 'stroke-linecap': 'round', filter: 'url(#sketch)' },
      svg('path', { d: 'M8 24 C 120 8, 250 30, 380 16 S 640 28, 752 10', stroke: '#f2b84b', 'stroke-width': 7 }),
      svg('path', { d: 'M24 32 C 150 20, 270 36, 420 26 S 640 34, 730 24', stroke: '#efe6d3', 'stroke-width': 3, opacity: 0.8 }),
      svg('path', { d: 'M60 18 C 200 28, 330 8, 470 22', stroke: '#14110f', 'stroke-width': 2, opacity: 0.5 })));
}

export default {
  _off: [],
  _timers: [],
  async mount(root, params, ctx) {
    await loadRender();
    ctx.setMood('menu');
    ctx.audio.music?.('menu');

    const run = store.run;
    const canContinue = !!run && run.phase !== 'ending';
    const endlessUnlocked = Object.keys(store.album.endings ?? {}).length > 0;
    const calm = !!store.settings.reduceScares;

    /* ---------- creature row ---------- */
    const crowd = h('div', { class: 'menu-crowd' });
    const picks = shuffle(FIGURES).slice(0, 7);
    const slots = picks.map((f, i) => {
      const std = portrait(f, { form: 'standard', height: 214 });
      const mon = portrait(f, { form: 'monster', height: 214 });
      const monWrap = h('div', { class: 'menu-mon' }, mon);
      const slot = h('div', {
        class: 'menu-slot',
        style: {
          left: `${i * 122}px`,
          bottom: `${[2, -10, 6, -4, 8, -8, 0][i]}px`,
          zIndex: String(i % 2 ? 2 : 1),
          '--tilt': `${[-1.6, 1.2, -0.8, 1.8, -1.4, 0.9, -1][i]}deg`,
          '--bob-delay': `${(i * 0.43).toFixed(2)}s`,
        },
      }, h('div', { class: 'menu-fig' }, std), monWrap);
      crowd.append(slot);
      return slot;
    });

    const flicker = () => {
      const slot = slots[Math.floor(Math.random() * slots.length)];
      const steps = calm ? [[0, 1], [220, 0]] : [[0, 1], [110, 0], [190, 1], [430, 0]];
      for (const [t, on] of steps) {
        this._timers.push(setTimeout(() => slot.classList.toggle('is-monster', !!on), t));
      }
    };
    const loop = () => {
      this._timers.push(setTimeout(() => { flicker(); loop(); }, 3200 + Math.random() * 3800));
    };
    this._timers.push(setTimeout(() => { flicker(); loop(); }, 2200));

    /* ---------- menu buttons ---------- */
    const mkBtn = (label, onclick, { primary = false, sub = null, id = '' } = {}) =>
      h('button', {
        class: `btn menu-btn${primary ? ' primary' : ''}`, type: 'button', id,
        onclick: () => { ctx.audio.sfx?.('uiClick'); onclick(); },
      }, h('span', { class: 'menu-btn-label' }, label), sub && h('small', { class: 'menu-btn-sub' }, sub));

    const diffLabel = DIFFICULTY[run?.difficulty]?.label ?? '';
    const buttons = [];
    if (canContinue) {
      buttons.push(mkBtn('Continue', () => {
        const phase = run.phase === 'night' ? 'note' : run.phase;
        ctx.go(phase, phase === 'note' ? { night: run.night } : {});
      }, { primary: true, sub: `${run.mode === 'endless' ? 'Endless, night' : 'Night'} ${run.night}${diffLabel ? ` · ${diffLabel}` : ''}` }));
    }
    buttons.push(mkBtn('New game', () => openPicker('story'), { primary: !canContinue }));
    if (endlessUnlocked) {
      const best = store.album.endlessBest ?? 0;
      buttons.push(mkBtn('Endless', () => openPicker('endless'), { sub: best ? `Best: ${best} saved` : 'No score yet' }));
    }
    buttons.push(mkBtn('Album', () => ctx.go('album', { back: 'menu' })));
    buttons.push(mkBtn('Settings', () => ctx.go('settings', { back: 'menu' })));
    buttons.push(mkBtn('Credits', () => ctx.go('credits')));

    const menuEl = h('nav', { class: 'menu-buttons', 'aria-label': 'Main menu' }, buttons);
    menuEl.addEventListener('keydown', (e) => {
      const list = [...menuEl.querySelectorAll('button')];
      const i = list.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { list[(i + 1) % list.length].focus(); e.preventDefault(); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { list[(i - 1 + list.length) % list.length].focus(); e.preventDefault(); }
      else if (e.key === 'Home') { list[0].focus(); e.preventDefault(); }
      else if (e.key === 'End') { list[list.length - 1].focus(); e.preventDefault(); }
    });

    /* ---------- difficulty picker ---------- */
    const openPicker = (mode) => {
      let sel = DIFFICULTY[store.settings.lastDifficulty] ? store.settings.lastDifficulty : 'normal';
      const overwrites = !!store.run && store.run.phase !== 'ending';
      const cards = DIFFICULTY_ORDER.map((id) => {
        const d = DIFFICULTY[id];
        return h('button', {
          class: 'menu-diff-card', type: 'button', role: 'radio', 'data-id': id,
          onclick: () => choose(id),
          ondblclick: () => begin(),
        },
        h('span', { class: 'menu-diff-mark', 'aria-hidden': 'true' }),
        h('span', { class: 'menu-diff-name' }, d.label),
        h('span', { class: 'menu-diff-blurb' }, d.blurb),
        h('span', { class: 'menu-diff-facts' }, `${d.flames} flames · ${d.patience} s patience${d.candle ? '' : ' · no candle'}`));
      });
      const choose = (id) => {
        sel = id;
        cards.forEach((c) => {
          const on = c.dataset.id === id;
          c.classList.toggle('is-selected', on);
          c.setAttribute('aria-checked', on ? 'true' : 'false');
        });
      };
      const begin = () => {
        ctx.audio.sfx?.('bolt');
        cleanup();
        if (mode === 'endless') { newRun({ mode: 'endless', difficulty: sel }); ctx.go('night'); }
        else { newRun({ mode: 'story', difficulty: sel }); ctx.go('note', { night: 1 }); }
      };
      const best = store.album.endlessBest ?? 0;
      const content = h('div', { class: 'menu-diff' },
        h('h2', { class: 'menu-diff-title' }, mode === 'endless' ? 'Endless nights' : 'A new night begins'),
        h('p', { class: 'menu-diff-sub' }, mode === 'endless'
          ? `Night after night, harder each time. The score is how many you save.${best ? ` Your best: ${best}.` : ''}`
          : 'Choose how the fog treats you.'),
        h('div', { class: 'menu-diff-cards', role: 'radiogroup', 'aria-label': 'Difficulty' }, cards),
        overwrites && h('p', { class: 'menu-diff-warn' },
          `You have a run in progress (${store.run.mode === 'endless' ? 'endless, ' : ''}night ${store.run.night}). Starting a new one will erase it.`),
        h('div', { class: 'menu-diff-actions' },
          h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, 'Cancel'),
          h('button', { class: `btn ${overwrites ? 'danger' : 'primary'}`, type: 'button', id: 'menu-begin', onclick: begin }, overwrites ? 'Erase it and begin' : 'Begin')));
      const m = modal(content, { className: 'menu-diff-panel' });
      const onKey = (e) => {
        const i = DIFFICULTY_ORDER.indexOf(sel);
        if (e.key === 'Escape') { m.close(); e.preventDefault(); e.stopPropagation(); }
        else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { choose(DIFFICULTY_ORDER[Math.min(i + 1, 2)]); cards[DIFFICULTY_ORDER.indexOf(sel)].focus(); e.preventDefault(); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { choose(DIFFICULTY_ORDER[Math.max(i - 1, 0)]); cards[DIFFICULTY_ORDER.indexOf(sel)].focus(); e.preventDefault(); }
      };
      const cleanup = () => { window.removeEventListener('keydown', onKey, true); m.close(); };
      window.addEventListener('keydown', onKey, true);
      m.closed.then(() => { window.removeEventListener('keydown', onKey, true); menuEl.querySelector('button')?.focus(); });
      this._off.push(() => { window.removeEventListener('keydown', onKey, true); });
      choose(sel);
      cards[DIFFICULTY_ORDER.indexOf(sel)].focus();
    };

    /* ---------- assemble ---------- */
    root.append(h('div', { class: `menu-root${calm ? ' menu-calm' : ''}` },
      skySvg(),
      h('div', { class: 'menu-house-wrap' }, houseSvg({ lantern: 'on' })),
      crowd,
      h('div', { class: 'menu-fog menu-fog-a' }),
      h('div', { class: 'menu-fog menu-fog-b' }),
      h('header', { class: 'menu-title' },
        h('h1', { class: 'menu-logo' }, h('span', { class: 'menu-logo-1' }, 'SAME'), ' ', h('span', { class: 'menu-logo-2' }, 'SHAPE')),
        scribbleUnderline(),
        h('p', { class: 'menu-tag' }, 'Same silhouette. Different souls.')),
      menuEl,
      h('p', { class: 'menu-hint' }, 'Arrow keys and Enter')));

    (menuEl.querySelector('button'))?.focus();
  },
  unmount() {
    for (const t of this._timers.splice(0)) clearTimeout(t);
    for (const off of this._off.splice(0)) off();
  },
};
