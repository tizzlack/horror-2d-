// Ending screen: one illustration per ending, text revealed slowly, then stats and the
// optional group photo bonus. Finishing the run (album + clearRun) happens here.
import { h, svg } from '../core/dom.js';
import { store, clearRun, albumCompletion } from '../core/state.js';
import { FIGURES, FIGURE_IDS, FACELESS, getFigure } from '../data/figures.js';
import { houseSvg } from './menu.js';
import { figureImg, loadStory, buildGroupPhoto, updateRewards } from './album.js';

const TONE = { lanternOut: 'dark', dawn: 'light', twoSouls: 'warm', newFog: 'dark' };
const MUSIC = { lanternOut: 'off', dawn: 'finale', twoSouls: 'finale', newFog: 'finale' };
const AMBIENT = { lanternOut: 'off', dawn: 'day', twoSouls: 'day', newFog: 'night' };

const pickFigures = (ids, n, seedShift = 0) => {
  const base = ids.map(getFigure).filter(Boolean);
  const pool = FIGURES.filter((f) => !base.includes(f));
  const out = [...base];
  for (let i = 0; out.length < n && i < pool.length; i++) out.push(pool[(i * 7 + seedShift) % pool.length]);
  return out.slice(0, n);
};

function letIn(run) {
  const reports = [...(run?.history ?? []), run?.lastReport].filter(Boolean);
  const ids = [];
  for (const r of reports) {
    // History entries store counts plus admittedIds; reports store admitted objects.
    const admitted = Array.isArray(r.admitted) ? r.admitted.map((a) => a?.figureId) : (r.admittedIds ?? []);
    for (const id of admitted) if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

const place = (el, style) => { Object.assign(el.style, style); return el; };

/* ------------------------------------------------------------------ */
/* Illustrations                                                       */
/* ------------------------------------------------------------------ */

function sceneLanternOut(run) {
  const monsters = pickFigures(letIn(run), 5, 3).slice(0, 5);
  const layout = [
    { x: 910, h: 560, y: 150, z: 3, d: 0 },
    { x: 640, h: 470, y: 250, z: 2, d: 1.4 },
    { x: 1130, h: 480, y: 240, z: 2, d: 2.2 },
    { x: 780, h: 380, y: 340, z: 1, d: 0.8 },
    { x: 1250, h: 400, y: 330, z: 1, d: 3 },
  ];
  const figs = monsters.map((f, i) => {
    const l = layout[i];
    const wrap = h('div', { class: 'end-looming', style: { left: `${l.x - (l.h * 0.714) / 2}px`, top: `${l.y}px`, zIndex: String(l.z), animationDelay: `${l.d}s` } },
      figureImg(f, 'monster', l.h));
    return wrap;
  });
  return h('div', { class: 'end-scene end-scene-lanternOut' },
    svg('svg', { class: 'end-svg', viewBox: '0 0 1280 720', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
      svg('defs', {},
        svg('radialGradient', { id: 'loBg', cx: 0.7, cy: 0.35, r: 0.8 },
          svg('stop', { offset: '0', 'stop-color': '#171c2c' }),
          svg('stop', { offset: '1', 'stop-color': '#030409' }))),
      svg('rect', { width: 1280, height: 720, fill: 'url(#loBg)' }),
      // a cold slit of moonlight under the door
      svg('path', { d: 'M520 720 L1280 720 L1280 640 Z', fill: 'rgba(154,163,181,0.08)' }),
      // the dead lantern, hanging
      svg('g', { filter: 'url(#sketch)', transform: 'translate(770 0) scale(1.5)' },
        svg('path', { d: 'M60 0 L60 60', stroke: '#6c7488', 'stroke-width': 4, 'stroke-linecap': 'round' }),
        svg('path', { d: 'M36 92 L60 66 L84 92 Z', fill: '#10131c', stroke: '#6c7488', 'stroke-width': 3, 'stroke-linejoin': 'round' }),
        svg('rect', { x: 40, y: 92, width: 40, height: 52, rx: 6, fill: '#0a0c13', stroke: '#6c7488', 'stroke-width': 3 }),
        svg('path', { d: 'M50 92 L50 144 M70 92 L70 144', stroke: '#6c7488', 'stroke-width': 2 }),
        svg('path', { class: 'end-wisp', d: 'M60 86 C 48 64, 74 50, 58 24', fill: 'none', stroke: '#9aa3b5', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.5 }))),
    ...figs,
    h('div', { class: 'end-vignette' }));
}

function sceneDawn() {
  const grass = [];
  for (let i = 0; i < 70; i++) {
    const x = (i * 97) % 1280;
    const y = 520 + ((i * 53) % 190);
    grass.push(svg('line', { x1: x, y1: y, x2: x + 18, y2: y - 7, stroke: 'rgba(60,40,30,0.25)', 'stroke-width': 1.6, 'stroke-linecap': 'round' }));
  }
  const rays = [];
  for (let i = 0; i < 16; i++) {
    const a = Math.PI + (i / 15) * Math.PI;
    rays.push(svg('line', {
      x1: 940 + Math.cos(a) * 150, y1: 470 + Math.sin(a) * 150, x2: 940 + Math.cos(a) * (200 + (i % 3) * 22), y2: 470 + Math.sin(a) * (200 + (i % 3) * 22),
      stroke: '#f2b84b', 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0.6,
    }));
  }
  return h('div', { class: 'end-scene end-scene-dawn' },
    svg('svg', { class: 'end-svg', viewBox: '0 0 1280 720', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
      svg('defs', {},
        svg('linearGradient', { id: 'dwSky', x1: 0, y1: 0, x2: 0, y2: 1 },
          svg('stop', { offset: '0', 'stop-color': '#bfc7d8' }),
          svg('stop', { offset: '0.45', 'stop-color': '#f1cf9d' }),
          svg('stop', { offset: '0.7', 'stop-color': '#f6b97a' })),
        svg('radialGradient', { id: 'dwSun', cx: 0.5, cy: 0.5, r: 0.5 },
          svg('stop', { offset: '0', 'stop-color': '#fff2c4' }),
          svg('stop', { offset: '0.55', 'stop-color': '#f9d27a' }),
          svg('stop', { offset: '1', 'stop-color': '#f2b84b', 'stop-opacity': 0 }))),
      svg('rect', { width: 1280, height: 720, fill: 'url(#dwSky)' }),
      svg('circle', { cx: 940, cy: 470, r: 280, fill: 'url(#dwSun)', opacity: 0.55 }),
      svg('g', { filter: 'url(#sketch)' }, rays,
        svg('circle', { cx: 940, cy: 470, r: 120, fill: '#fbdc8a', stroke: '#14110f', 'stroke-width': 3 }),
        // scribbled clouds
        svg('path', { d: 'M120 130 C 150 96, 210 100, 232 126 C 270 112, 312 130, 306 160 L110 160 C 90 156, 96 136, 120 130 Z', fill: '#f8efe0', stroke: '#14110f', 'stroke-width': 2.6, opacity: 0.85 }),
        svg('path', { d: 'M640 90 C 664 66, 712 70, 726 92 C 760 84, 790 100, 784 122 L630 122 C 614 118, 620 98, 640 90 Z', fill: '#f8efe0', stroke: '#14110f', 'stroke-width': 2.6, opacity: 0.8 })),
      // Fog Hollow, three hills
      svg('g', { filter: 'url(#sketch)' },
        svg('path', { d: 'M0 500 C 150 450, 300 470, 450 500 C 600 460, 760 450, 940 480 C 1080 450, 1200 460, 1280 490 L1280 720 L0 720 Z', fill: '#c4a27e', stroke: '#14110f', 'stroke-width': 3 }),
        svg('path', { d: 'M0 560 C 160 520, 320 540, 520 566 C 700 536, 900 530, 1100 560 C 1180 548, 1240 548, 1280 556 L1280 720 L0 720 Z', fill: '#9b7e63', stroke: '#14110f', 'stroke-width': 3 }),
        svg('path', { d: 'M0 640 C 220 610, 480 626, 720 646 C 960 622, 1120 624, 1280 640 L1280 720 L0 720 Z', fill: '#6f5b49', stroke: '#14110f', 'stroke-width': 3 })),
      svg('g', {}, grass)),
    place(h('div', { class: 'end-house' }, houseSvg({ lantern: 'dim', windows: 'off', tone: 'dawn' })), { left: '760px', top: '190px', width: '340px' }),
    // the faceless one, far away in the last of the fog
    place(h('div', { class: 'end-far' }, figureImg(FACELESS, 'standard', 96)), { left: '1150px', top: '448px' }),
    h('div', { class: 'end-fog end-fog-a' }),
    h('div', { class: 'end-fog end-fog-b' }),
    h('div', { class: 'end-fog end-fog-far' }));
}

function sceneTwoSouls(run) {
  const guests = pickFigures((run?.met ?? []).slice(0, 6), 6, 5);
  const spots = [
    { x: 600, h: 170, y: 520 }, { x: 740, h: 150, y: 540 }, { x: 1110, h: 160, y: 530 },
    { x: 1240, h: 170, y: 520 }, { x: 660, h: 130, y: 450 }, { x: 1170, h: 130, y: 445 },
  ];
  const crowd = guests.map((f, i) => {
    const s = spots[i];
    return h('div', { class: 'end-guest', style: { left: `${s.x - (s.h * 0.714) / 2}px`, top: `${s.y}px`, zIndex: i < 4 ? '3' : '1', animationDelay: `${i * 0.35}s` } },
      figureImg(f, 'standard', s.h));
  });
  const heart = svg('svg', { class: 'end-soul', viewBox: '0 0 40 40', width: 38, height: 38, 'aria-hidden': 'true' },
    svg('path', { d: 'M20 34 C 4 24, 6 8, 16 9 C 19 9.5, 20 12, 20 12 C 20 12, 21 9.5, 24 9 C 34 8, 36 24, 20 34 Z', fill: '#f2b84b', stroke: '#a3231b', 'stroke-width': 2.4, 'stroke-linejoin': 'round' }));
  return h('div', { class: 'end-scene end-scene-twoSouls' },
    svg('svg', { class: 'end-svg', viewBox: '0 0 1280 720', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
      svg('defs', {},
        svg('radialGradient', { id: 'tsBg', cx: 0.72, cy: 0.38, r: 0.75 },
          svg('stop', { offset: '0', 'stop-color': '#f7cf79' }),
          svg('stop', { offset: '0.35', 'stop-color': '#b8743d' }),
          svg('stop', { offset: '1', 'stop-color': '#1f1512' }))),
      svg('rect', { width: 1280, height: 720, fill: 'url(#tsBg)' }),
      svg('g', { filter: 'url(#sketch)' },
        // beams of the wall and the floor
        svg('path', { d: 'M0 560 L1280 540 L1280 720 L0 720 Z', fill: '#3a2519', stroke: '#14110f', 'stroke-width': 3 }),
        svg('path', { d: 'M0 600 L1280 590 M0 650 L1280 646 M300 560 L180 720 M700 552 L640 720 M1100 544 L1180 720', stroke: '#14110f', 'stroke-width': 1.8, opacity: 0.4 }),
        // the lantern, burning in the room
        svg('path', { d: 'M880 0 L880 70', stroke: '#14110f', 'stroke-width': 4, 'stroke-linecap': 'round' }),
        svg('path', { d: 'M856 100 L880 74 L904 100 Z', fill: '#2b2622', stroke: '#14110f', 'stroke-width': 3, 'stroke-linejoin': 'round' }),
        svg('rect', { x: 860, y: 100, width: 40, height: 52, rx: 6, fill: '#ffe08a', stroke: '#14110f', 'stroke-width': 3 }),
        svg('ellipse', { class: 'menu-flame', cx: 880, cy: 128, rx: 8, ry: 15, fill: '#fff8d8' }))),
    place(h('div', { class: 'end-souls-glow' }), { left: '640px', top: '60px' }),
    place(h('div', { class: 'end-soul-a' }, figureImg(FACELESS, 'standard', 400)), { left: '740px', top: '170px' }),
    place(h('div', { class: 'end-soul-b' }, figureImg(FACELESS, 'standard', 380), heart), { left: '900px', top: '190px' }),
    ...crowd);
}

function sceneNewFog() {
  return h('div', { class: 'end-scene end-scene-newFog' },
    svg('svg', { class: 'end-svg', viewBox: '0 0 1280 720', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
      svg('defs', {},
        svg('linearGradient', { id: 'nfBg', x1: 0, y1: 0, x2: 0, y2: 1 },
          svg('stop', { offset: '0', 'stop-color': '#0c0f19' }),
          svg('stop', { offset: '0.6', 'stop-color': '#262c40' }),
          svg('stop', { offset: '1', 'stop-color': '#4c5468' }))),
      svg('rect', { width: 1280, height: 720, fill: 'url(#nfBg)' }),
      svg('g', { filter: 'url(#sketch)' },
        svg('path', { d: 'M0 610 C 200 590, 420 604, 640 612 C 900 598, 1100 600, 1280 606 L1280 720 L0 720 Z', fill: '#171a26', stroke: '#06070c', 'stroke-width': 3 }))),
    place(h('div', { class: 'end-house' }, houseSvg({ lantern: 'dim', windows: 'off', tone: 'fog' })), { left: '700px', top: '90px', width: '560px' }),
    // you, small, in front of the closed door, seen from the outside
    place(h('div', { class: 'end-knocker' }, figureImg(FACELESS, 'standard', 176)), { left: '940px', top: '438px' }),
    place(h('div', { class: 'end-knock' }, h('span', {}, 'knock'), h('span', {}, 'knock')), { left: '1100px', top: '420px' }),
    h('div', { class: 'end-fog end-fog-a' }),
    h('div', { class: 'end-fog end-fog-b' }),
    h('div', { class: 'end-fog end-fog-front' }),
    h('div', { class: 'end-vignette' }));
}

function buildScene(id, run) {
  if (id === 'lanternOut') return sceneLanternOut(run);
  if (id === 'dawn') return sceneDawn(run);
  if (id === 'twoSouls') return sceneTwoSouls(run);
  return sceneNewFog(run);
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export default {
  _timers: [],
  _off: [],
  async mount(root, params, ctx) {
    const story = await loadStory();
    const run = store.run;
    const endingId = [params?.endingId, run?.endingId].find((id) => story.ENDINGS[id]);
    if (!endingId) { ctx.go('menu'); return; }
    const ending = story.ENDINGS[endingId];
    const tone = TONE[endingId] ?? 'dark';

    // Snapshot the stats, then finish the run for good.
    const stats = run?.stats ?? {};
    const rows = [
      // When the lantern goes out, the last night in the history is the one you did not survive.
      ['Nights survived', Math.max(0, (run?.history?.length ?? 0) - (endingId === 'lanternOut' ? 1 : 0))],
      ['Creatures saved', run?.saved ?? stats.realSaved ?? 0],
      ['Monsters caught', stats.monstersCaught ?? 0],
      ['Monsters let in', stats.monstersAdmitted ?? 0],
      ['Real ones turned away', stats.realRejected ?? 0],
    ];
    const endless = run?.mode === 'endless';
    const scene = buildScene(endingId, run);
    store.album.endings[endingId] = true;
    clearRun();
    const pct = updateRewards(ctx);
    ctx.save();
    const complete = albumCompletion(FIGURE_IDS) >= 100 || pct >= 100;
    if (endless) rows.push(['Best endless score', store.album.endlessBest ?? 0]);

    ctx.setMood(tone === 'light' ? 'day' : 'night');
    ctx.audio.music?.(MUSIC[endingId] ?? 'off');
    ctx.audio.ambient?.(AMBIENT[endingId] ?? 'off');
    if (endingId === 'lanternOut') ctx.audio.sfx?.('flameOut');

    const card = h('div', { class: `end-card end-tone-${tone}` });
    const view = h('div', { class: 'end-photo-view hidden' });
    const hint = h('p', { class: 'end-hint' }, 'Click to hurry the words');
    const rootEl = h('div', { class: `end-root end-${endingId}` }, scene, card, hint, view);
    root.append(rootEl);

    /* ---- stage 1: the text, revealed slowly ---- */
    let revealed = false;
    let revealAll = () => {};
    const showText = () => {
      const paras = (ending.paragraphs ?? []).map((p) => h('p', { class: 'end-p' }, p));
      const cont = h('button', { class: 'btn end-next', type: 'button', onclick: showStats }, 'Continue');
      card.replaceChildren(h('h1', { class: 'end-title' }, h('span', {}, ending.title)), ...paras, h('div', { class: 'end-actions' }, cont));
      const items = [card.querySelector('.end-title'), ...paras, cont];
      let t = 500;
      const fire = [];
      items.forEach((el, i) => {
        fire.push(() => el.classList.add('is-in'));
        const len = el.textContent.length;
        this._timers.push(setTimeout(() => { if (!revealed) fire[i](); }, t));
        t += i === 0 ? 1300 : 1500 + len * 16;
      });
      revealAll = () => {
        if (revealed) return;
        revealed = true;
        for (const f of fire) f();
        hint.classList.add('hidden');
        cont.focus();
      };
      this._timers.push(setTimeout(() => hint.classList.add('hidden'), t));
    };

    /* ---- stage 2: stats ---- */
    const showStats = () => {
      revealed = true;
      hint.classList.add('hidden');
      for (const t of this._timers.splice(0)) clearTimeout(t);
      if (endingId !== 'lanternOut') ctx.audio.music?.('menu');
      ctx.audio.sfx?.('pageTurn');
      const menuBtn = h('button', { class: `btn ${complete ? '' : 'primary'}`, type: 'button', onclick: () => ctx.go('menu') }, 'Back to the menu');
      card.replaceChildren(
        h('h2', { class: 'end-stats-title' }, 'The count'),
        h('ul', { class: 'end-stats' }, rows.map(([label, value], i) =>
          h('li', { style: { animationDelay: `${i * 0.12}s` } }, h('span', { class: 'end-stat-label' }, label), h('span', { class: 'end-stat-dots' }), h('b', { class: 'end-stat-value' }, String(value))))),
        h('div', { class: 'end-actions end-actions-final' },
          complete && h('button', { class: 'btn primary', type: 'button', onclick: showPhoto }, 'The group photo'),
          menuBtn));
      (complete ? card.querySelector('.btn.primary') : menuBtn).focus();
    };

    /* ---- stage 3: group photo (album 100 %) ---- */
    const showPhoto = () => {
      ctx.audio.sfx?.('pageTurn');
      view.replaceChildren(
        buildGroupPhoto(story.GROUP_PHOTO),
        h('div', { class: 'end-photo-actions' },
          h('button', { class: 'btn primary', type: 'button', onclick: () => ctx.go('menu') }, 'Back to the menu')));
      view.classList.remove('hidden');
      view.querySelector('button')?.focus();
    };

    showText();

    const onSkip = (e) => {
      if (revealed) return;
      if (e.type === 'keydown' && !['Enter', ' ', 'Escape'].includes(e.key)) return;
      if (e.type === 'keydown') e.preventDefault();
      revealAll();
    };
    rootEl.addEventListener('pointerdown', onSkip);
    window.addEventListener('keydown', onSkip);
    this._off.push(() => window.removeEventListener('keydown', onSkip));
  },
  unmount() {
    for (const t of this._timers.splice(0)) clearTimeout(t);
    for (const off of this._off.splice(0)) off();
  },
};
