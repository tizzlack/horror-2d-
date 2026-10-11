// Builds the night room DOM: door, peephole, bolt, flap, HUD, resident note and the table with tools.
// Pure view code; the controller (../night.js) decides when to call the setters.
import { h } from '../../core/dom.js';
import { doorSvg, flameSvg, wallDecorSvg, boltPlateSvg, flapHandleSvg, tableSvg, candleSvg, mirrorFrameSvg, pauseGlyph } from './art.js';

export const PEEP = { cx: 740, cy: 270, size: 440 };
export const BOLT = { travel: 84 };

const TOOL_DEFS = {
  album: { key: '1', label: 'Album', icon: 'album' },
  questions: { key: '2', label: 'Ask', icon: 'question' },
  flashlight: { key: '3', label: 'Light', icon: 'flashlight', marks: 5 },
  mirror: { key: '4', label: 'Mirror', icon: 'mirror', marks: 3 },
  callToDoor: { key: 'C', label: 'Call', icon: 'door' },
};

function marksEl(n) {
  const el = h('span', { class: 'marks' });
  for (let i = 0; i < n; i++) el.append(h('i', { class: 'on' }));
  return el;
}

export function buildScene({ run, cfg, deps }) {
  const has = (t) => cfg.tools.includes(t);
  const refs = {};

  // ---------- peephole ----------
  const fogLayer = (cls) => h('div', { class: `pp-fog ${cls}` });
  const cover = h('div', { class: 'pp-cover' },
    h('div', { class: 'cover-plate' }),
    h('div', { class: 'cover-hint' }, 'Peek'),
    h('div', { class: 'cover-key' }, 'Space'));
  const figureHolder = h('div', { class: 'pp-figure' });
  const shadowHolder = h('div', { class: 'pp-shadow' });
  const beam = h('div', { class: 'pp-beam' });
  const peep = h('div', { class: 'peep closed' },
    h('div', { class: 'pp-back' }),
    h('div', { class: 'pp-wall' }),
    h('div', { class: 'pp-glow' }),
    fogLayer('f1'), fogLayer('f2'),
    h('div', { class: 'pp-ground' }),
    shadowHolder, figureHolder, beam,
    fogLayer('f3'),
    h('div', { class: 'pp-vignette' }),
    cover);
  Object.assign(refs, { peep, cover, figureHolder, shadowHolder, beam });

  // ---------- door ----------
  const door = h('div', { class: 'door', html: doorSvg() });
  const cracks = [...door.querySelectorAll('.crack')];
  refs.setDoorDamage = (n) => cracks.forEach((c, i) => c.classList.toggle('show', i < n));

  // ---------- flap handle ----------
  const flapLabel = h('span', { class: 'flap-label' }, 'Peek');
  const flapKey = h('span', { class: 'key' }, 'Space');
  const flap = h('button', { class: 'flap', 'aria-label': 'Flap: open the peephole or slam it shut' },
    h('span', { class: 'flap-art', html: flapHandleSvg() }), h('span', { class: 'flap-tag' }, flapLabel, flapKey));
  refs.flap = flap;
  refs.setFlap = (open) => {
    flap.classList.toggle('slam', open);
    flapLabel.textContent = open ? 'Turn away' : 'Peek';
    flapKey.textContent = open ? 'Q' : 'Space';
  };

  // ---------- bolt ----------
  const knob = h('div', { class: 'bolt-knob' }, h('div', { class: 'bolt-grip' }));
  const boltRing = h('div', { class: 'bolt-ring' });
  const bolt = h('div', { class: 'bolt', role: 'slider', 'aria-label': 'Bolt: drag sideways or hold E to let them in' },
    h('div', { class: 'bolt-plate', html: boltPlateSvg() }), boltRing, knob,
    h('div', { class: 'bolt-tag' }, 'Let in', h('span', { class: 'key' }, 'hold E')));
  refs.bolt = bolt;
  refs.knob = knob;
  refs.boltRing = boltRing;
  refs.setBolt = (p, animate = false) => {
    knob.style.transition = animate ? 'transform .25s cubic-bezier(.3,1.5,.5,1)' : 'none';
    knob.style.transform = `translateX(${-BOLT.travel * p}px)`;
    bolt.style.setProperty('--p', String(p));
  };
  refs.setBolt(0);

  // ---------- knock scribbles ----------
  const knockLayer = h('div', { class: 'knock-layer' });
  refs.knockLayer = knockLayer;

  const scene = h('div', { class: 'scene' }, door, peep, flap, bolt, knockLayer);

  // ---------- HUD left: flames, tally, resident note ----------
  const flames = h('div', { class: 'flames' }, h('div', { class: 'flame-rod' }));
  const flameEls = [];
  for (let i = 0; i < run.maxFlames; i++) {
    const w = h('div', { class: 'flame-slot', html: flameSvg(i < run.flames) });
    flameEls.push(w);
    flames.append(w);
  }
  refs.flameEls = flameEls;
  refs.setFlames = (lit) => flameEls.forEach((el, i) => {
    el.classList.remove('going');
    el.innerHTML = flameSvg(i < lit);
  });
  refs.flameOut = (i) => {
    const el = flameEls[i];
    if (!el) return;
    el.classList.add('going');
    setTimeout(() => { el.classList.remove('going'); el.innerHTML = flameSvg(false); }, 900);
  };

  const tallyMarks = h('div', { class: 'tally-marks' });
  const tally = h('div', { class: 'tally' }, h('div', { class: 'tally-title' }, `Night ${run.night}`), tallyMarks);
  refs.setTally = (total, index) => {
    tallyMarks.replaceChildren();
    for (let i = 0; i < total; i++) {
      tallyMarks.append(h('i', { class: i < index ? 'done' : i === index ? 'now' : '' }));
    }
  };

  const resList = h('ul', { class: 'res-list' });
  const resWarn = h('div', { class: 'res-warn' });
  const residents = h('div', { class: `residents${has('residents') ? '' : ' hidden'}` },
    h('div', { class: 'nail' }),
    h('div', { class: 'res-paper' }, h('div', { class: 'res-title' }, 'Inside tonight', h('span', { class: 'key' }, 'Tab')), resList, resWarn));
  refs.residents = residents;
  refs.setResidents = (names, { highlight = null, beds = run.beds, warn = '' } = {}) => {
    resList.replaceChildren();
    const slots = Math.max(beds, names.length);
    for (let i = 0; i < slots; i++) {
      const n = names[i];
      resList.append(h('li', { class: n ? (n.id === highlight ? 'name hit' : 'name') : 'free', dataset: { id: n?.id ?? '' } }, n ? n.name : 'free bed'));
    }
    resWarn.textContent = warn;
    resWarn.classList.toggle('on', !!warn);
    residents.classList.toggle('alert', !!warn);
  };

  // ---------- question popup ----------
  const qMenu = h('div', { class: 'qmenu hidden' });
  refs.qMenu = qMenu;

  // ---------- table + tools ----------
  const toolEls = {};
  const toolsRow = h('div', { class: 'tools' });
  const table = h('div', { class: 'table' }, h('div', { class: 'table-art', html: tableSvg() }), toolsRow);
  if (cfg.candle || has('candle')) {
    const candle = h('div', { class: 'candle', title: 'Candle', 'aria-label': 'Candle: flickers when a monster is near' }, h('div', { class: 'candle-art', html: candleSvg() }), h('span', { class: 'candle-glow' }));
    toolsRow.append(candle);
    refs.candle = candle;
  }
  for (const id of ['callToDoor', 'album', 'questions', 'flashlight', 'mirror']) {
    if (!has(id === 'callToDoor' ? 'callToDoor' : id)) continue;
    const def = TOOL_DEFS[id];
    const marks = def.marks ? marksEl(def.marks) : id === 'questions' ? marksEl(2) : null;
    const iconNode = h('span', { class: 'tool-icon' });
    try { iconNode.append(deps.icon(def.icon, { size: 52 })); } catch (e) { console.warn('[night] icon failed', def.icon, e); }
    const btn = h('button', { class: `tool tool-${id}${id === 'callToDoor' ? ' hidden' : ''}`, dataset: { tool: id }, 'aria-label': def.label },
      h('span', { class: 'key' }, def.key), iconNode, h('span', { class: 'tool-label' }, def.label), marks);
    toolEls[id] = { el: btn, marks };
    toolsRow.append(btn);
  }
  refs.tools = toolEls;
  refs.setBattery = (battery) => {
    const m = toolEls.flashlight?.marks;
    if (!m) return;
    const n = Math.max(0, Math.ceil(battery / 20));
    [...m.children].forEach((c, i) => c.classList.toggle('on', i < n));
    toolEls.flashlight.el.classList.toggle('empty', n === 0);
  };
  refs.setMirror = (left) => {
    const m = toolEls.mirror?.marks;
    if (!m) return;
    [...m.children].forEach((c, i) => c.classList.toggle('on', i < left));
    toolEls.mirror.el.classList.toggle('empty', left <= 0);
  };
  refs.setQuestions = (left) => {
    const m = toolEls.questions?.marks;
    if (!m) return;
    [...m.children].forEach((c, i) => c.classList.toggle('on', i < left));
    toolEls.questions.el.classList.toggle('empty', left <= 0);
  };
  refs.setCandle = (flicker) => {
    refs.candle?.classList.toggle('flicker', !!flicker);
  };

  // ---------- mirror frame ----------
  const mirrorGlass = h('div', { class: 'mirror-glass' });
  const mirror = h('div', { class: 'mirror-frame' }, h('div', { class: 'mirror-art', html: mirrorFrameSvg() }), mirrorGlass);
  refs.mirror = mirror;
  refs.mirrorGlass = mirrorGlass;

  // ---------- pause + toast ----------
  const pause = h('button', { class: 'pause-btn', 'aria-label': 'Pause', html: pauseGlyph() });
  refs.pause = pause;
  const toast = h('div', { class: 'toast' });
  refs.toast = toast;

  const root = h('div', { class: 'night-screen' },
    h('div', { class: 'room-bg' }),
    h('div', { class: 'wall-decor', html: wallDecorSvg() }),
    scene,
    flames, tally, residents, qMenu, mirror,
    table, toast, pause);
  refs.root = root;
  refs.scene = scene;
  return refs;
}
