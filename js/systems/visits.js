// Visit generation: who knocks tonight, who is a monster, which tells they show.
// Pure logic, no DOM. Contract: docs/ARCHITECTURE.md "Rules engine".
import { createRng } from '../core/rng.js';
import { difficultyOf } from '../core/state.js';
import { FIGURE_IDS, getFigure } from '../data/figures.js';

const NIGHT1_POOL = ['nimi', 'bub', 'lume', 'zen', 'miso'];
const TEXT_TELLS = ['textDrip', 'typo', 'shout'];
const WRONG_CHANCE = { 1: 0.7, 2: 0.5, 3: 0.3 };
const INTRO_NIGHT = { doppelganger: 3, pusher: 4, whisperer: 6 };

/* ------------------------------------------------------------------ helpers */

/** Is this tell detectable with the tools available in this night config? */
export function tellUsable(tell, cfg) {
  const tools = cfg?.tools ?? [];
  const has = (t) => tools.includes(t);
  let ok;
  switch (tell?.revealedBy) {
    case 'eye': case 'ear': case 'text': case 'behavior': ok = true; break;
    case 'album': ok = has('album'); break;
    case 'flashlight': ok = has('flashlight'); break;
    case 'mirror': ok = has('mirror'); break;
    case 'candle': ok = !!cfg?.candle && has('candle'); break;
    default: ok = false;
  }
  // Shadow and mirror always show the true form; a "shadow only" tell needs one of them.
  if (ok && tell.effect === 'shadowOnly') ok = has('flashlight') || has('mirror');
  return ok;
}

/** True when the visit has at least one tell the player can actually find tonight. */
export function visitIsFair(visit, cfg) {
  if (!visit.isMonster) return true;
  return visit.tells.some((t) => tellUsable(t, cfg));
}

/** The tell that is easiest to notice (lowest level, visual first). */
export function mostVisibleTell(tells = []) {
  if (!tells.length) return null;
  return [...tells].sort((a, b) =>
    (a.level - b.level) || ((b.kind === 'visual') - (a.kind === 'visual')))[0];
}

export function maxTellLevel(tells = []) {
  return tells.reduce((m, t) => Math.max(m, t.level ?? 1), tells.length ? 1 : 0);
}

/** Real figures turned away that have not come back yet (oldest first). */
export function pendingReturners(run) {
  const counts = new Map();
  for (const id of run.rejectedReal ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const id of run.returned ?? []) counts.set(id, (counts.get(id) ?? 0) - 1);
  const out = [];
  for (const id of run.rejectedReal ?? []) {
    if ((counts.get(id) ?? 0) > 0 && !out.includes(id) && getFigure(id) && id !== 'faceless') out.push(id);
  }
  return out;
}

function figurePool(night, endless) {
  const known = FIGURE_IDS.filter((id) => getFigure(id));
  if (night <= 1) {
    // Story night 1: only the five figures with obvious tells. Endless night 1 has more visits
    // than that, so it uses every figure without an honest oddity.
    const pool = NIGHT1_POOL.filter((id) => getFigure(id));
    if (!endless && pool.length >= 4) return pool;
    const plain = known.filter((id) => !getFigure(id).honestOddity);
    return plain.length ? plain : known;
  }
  return known; // honest oddities only from night 2
}

function genericTell(figure, kind) {
  if (kind === 'impatient') {
    return { id: `${figure.id}_impatient`, level: 2, kind: 'behavior', effect: 'impatient', at: null, params: {},
      revealedBy: 'behavior', desc: 'It was far too impatient.' };
  }
  return { id: `${figure.id}_generic`, level: 1, kind: 'visual', effect: 'drip', at: 'face', params: { color: '#111' },
    revealedBy: 'eye', desc: 'A black drop ran down its face.' };
}

function countTells(diffId, rng) {
  const w = { cozy: [0.2, 0.4], normal: [0.35, 0.4], nightmare: [0.5, 0.35] }[diffId] ?? [0.35, 0.4];
  const r = rng.next();
  return r < w[0] ? 1 : r < w[0] + w[1] ? 2 : 3;
}

/** Pick 1-3 tells for a monster wearing `figure`'s skin. Guarantees >= 1 usable tell. */
function chooseTells(figure, cfg, rng, kind, diffId) {
  const hi = cfg.tellLevels?.[1] ?? 3;
  const lo = kind === 'returner' ? 1 : (cfg.tellLevels?.[0] ?? 1); // worn-out disguise: obvious tells too
  const pool = (figure.tells ?? []).filter((t) => t && Number.isFinite(t.level));
  const inRange = pool.filter((t) => t.level >= lo && t.level <= hi);
  let fair = inRange.filter((t) => tellUsable(t, cfg));
  let extrasPool = inRange;
  if (!fair.length) {
    // Widen towards easier tells (never above the difficulty cap).
    const wide = pool.filter((t) => t.level <= hi);
    fair = wide.filter((t) => tellUsable(t, cfg));
    extrasPool = wide;
  }
  const chosen = [];
  if (kind === 'pusher') {
    chosen.push(pool.find((t) => t.effect === 'impatient' && t.level <= hi && tellUsable(t, cfg)) ?? genericTell(figure, 'impatient'));
  } else {
    let first = fair;
    if (kind === 'returner') {
      const vis = fair.filter((t) => t.kind === 'visual' && (t.revealedBy === 'eye' || t.revealedBy === 'album'));
      if (vis.length) first = vis;
    } else if (kind === 'whisperer') {
      const aud = fair.filter((t) => t.kind !== 'visual');
      if (aud.length) first = aud;
    }
    chosen.push(first.length ? rng.pick(first) : genericTell(figure));
  }
  let want = kind === 'returner' ? rng.int(2, 3) : kind === 'pusher' ? (rng.chance(0.5) ? 2 : 1) : countTells(diffId, rng);
  const rest = rng.shuffle(extrasPool.filter((t) => !chosen.some((c) => c.id === t.id || c.effect === t.effect)));
  if (kind === 'returner' && !chosen.some((t) => t.kind === 'visual')) {
    const v = rest.findIndex((t) => t.kind === 'visual');
    if (v >= 0) chosen.push(...rest.splice(v, 1));
  }
  while (chosen.length < want && rest.length) {
    const next = rest.shift();
    if (!chosen.some((c) => c.effect === next.effect)) chosen.push(next);
  }
  return chosen.map((t) => ({ ...t, params: { ...(t.params ?? {}) } }));
}

function makeVisit({ night, index, figureId, type, tells, cfg, rng, diffId }) {
  const figure = getFigure(figureId);
  const isMonster = type !== 'real' && type !== 'faceless';
  const level = maxTellLevel(tells);
  const mixed = type === 'imitator' || type === 'doppelganger' || type === 'pusher' || type === 'whisperer';
  const textEffect = tells.find((t) => t.kind === 'text' && TEXT_TELLS.includes(t.effect))?.effect ?? null;
  let candle;
  if (type === 'faceless') candle = false;
  else if (!isMonster) {
    const zipp = figure?.id === 'zipp' || figure?.honestOddity?.effect === 'wind';
    candle = zipp ? true : rng.chance(0.1);
  } else candle = rng.chance(0.85);
  return {
    id: `n${night}-${index}`,
    index,
    figureId,
    isMonster,
    type,
    tells,
    knock: isMonster ? 'monster' : 'real',
    patience: type === 'pusher' ? cfg.pusherPatience : type === 'faceless' ? 120 : cfg.patience,
    answers: mixed ? 'mixed' : 'truth',
    wrongChance: mixed ? (WRONG_CHANCE[level] ?? 0.5) : 0,
    textTell: isMonster ? textEffect : null,
    dark: type === 'whisperer',
    shadowFlicker: isMonster && level >= 3,
    candleFlicker: candle,
    insideConflict: null,
  };
}

/* ------------------------------------------------------------ generateNight */

function planSlots(run, cfg, rng) {
  const night = cfg.night;
  const M = Math.max(0, Math.min(cfg.monsters, cfg.visits - 1));
  const reals = cfg.visits - M;
  const allowed = new Set(cfg.types ?? ['imitator']);

  // 1. pending returners (they are monsters, fixed figure)
  const maxR = night >= 5 ? 2 : night >= 2 ? 1 : 0;
  const returners = allowed.has('returner')
    ? pendingReturners(run).slice(0, Math.min(maxR, M)) : [];
  const slots = returners.map((figureId) => ({ kind: 'returner', figureId }));

  // 2. remaining monster slots: special types first (new ones are guaranteed), then imitators
  let m = M - returners.length;
  const introduced = [];
  const others = [];
  for (const type of ['doppelganger', 'pusher', 'whisperer']) {
    if (!allowed.has(type)) continue;
    if (!cfg.endless && night === INTRO_NIGHT[type]) introduced.push(type);
    else if (rng.chance(0.5)) others.push(type);
  }
  const ordered = [...introduced, ...rng.shuffle(others)];
  // a second doppelganger on late, monster-heavy nights
  if (allowed.has('doppelganger') && night >= 6 && m >= 3 && ordered.includes('doppelganger') && rng.chance(0.5)) {
    ordered.push('doppelganger');
  }
  for (const type of ordered) {
    if (m <= 0) break;
    slots.push({ kind: type });
    m--;
  }
  while (m-- > 0) slots.push({ kind: 'imitator' });
  for (let i = 0; i < reals; i++) slots.push({ kind: 'real' });
  return slots;
}

function orderSlots(slots, cfg, rng) {
  const base = rng.shuffle(slots.filter((s) => s.kind !== 'doppelganger'));
  const doppels = slots.filter((s) => s.kind === 'doppelganger');
  // "Two of them" pair: an imitator of X comes first, then the real X.
  if (cfg.events?.includes('twoOfThem') && rng.chance(0.65)) {
    const imitIdx = base.findIndex((s) => s.kind === 'imitator');
    const realIdx = base.findIndex((s) => s.kind === 'real');
    if (imitIdx >= 0 && realIdx >= 0) {
      base[imitIdx].pair = true;
      base[realIdx].pair = true;
      if (realIdx < imitIdx) [base[imitIdx], base[realIdx]] = [base[realIdx], base[imitIdx]];
    }
  }
  // Doppelgangers go after at least one (non-pair) real visitor.
  for (const d of doppels) {
    const first = base.findIndex((s) => s.kind === 'real' && !s.pair);
    if (first < 0) { d.kind = 'imitator'; base.splice(rng.int(0, base.length), 0, d); continue; }
    base.splice(rng.int(first + 1, base.length), 0, d);
  }
  return base;
}

export function generateNight(run, cfg, rng) {
  rng = rng ?? createRng(run.rngState);
  const diffId = difficultyOf(run).id;
  const night = cfg.night ?? run.night ?? 1;
  const slots = orderSlots(planSlots(run, cfg, rng), cfg, rng);
  const pool = figurePool(night, !!cfg.endless);
  const used = new Set(slots.filter((s) => s.kind === 'returner').map((s) => s.figureId));
  const realsSoFar = []; // figure ids of real visits already placed (doppelganger sources)
  const copied = new Set();
  let pairFigure = null;

  const fresh = (monster) => {
    let cands = pool.filter((id) => !used.has(id));
    if (!cands.length) cands = pool.length ? pool : FIGURE_IDS; // robustness: allow repeats
    cands = rng.shuffle(cands);
    if (monster) {
      const [lo, hi] = [cfg.tellLevels?.[0] ?? 1, cfg.tellLevels?.[1] ?? 3];
      const good = cands.find((id) => (getFigure(id).tells ?? []).some((t) => t.level >= lo && t.level <= hi && tellUsable(t, cfg)));
      if (good) return good;
    }
    return cands[0];
  };

  const visits = [];
  for (const slot of slots) {
    const index = visits.length;
    let type = slot.kind;
    let figureId = slot.figureId;
    if (type === 'real') {
      if (slot.pair && pairFigure) figureId = pairFigure;
      else figureId = fresh(false);
      used.add(figureId);
      if (!slot.pair) realsSoFar.push(figureId);
    } else if (type === 'doppelganger') {
      const cands = realsSoFar.filter((id) => !copied.has(id));
      if (cands.length) { figureId = rng.pick(cands); copied.add(figureId); }
      else { type = 'imitator'; figureId = fresh(true); used.add(figureId); }
    } else if (type !== 'returner') {
      figureId = fresh(true);
      used.add(figureId);
      if (slot.pair) pairFigure = figureId;
    }
    const figure = getFigure(figureId);
    const isMonster = type !== 'real';
    const tells = isMonster ? chooseTells(figure, cfg, rng, type, diffId) : [];
    visits.push(makeVisit({ night, index, figureId, type, tells, cfg, rng, diffId }));
  }

  // Story finale: the faceless knocks last (extra visit, not counted in cfg.visits).
  if (cfg.events?.includes('finale') && !cfg.endless) {
    visits.push(makeVisit({ night, index: visits.length, figureId: 'faceless', type: 'faceless', tells: [], cfg, rng, diffId }));
  }

  run.rngState = rng.state;
  run.nightPlan = visits; // so a screen can resume a night without regenerating it
  return visits;
}

/* ------------------------------------------------------------- prepareVisit */

/**
 * Adapt a planned visit to what happened earlier tonight. Returns a new visit object.
 * - a doppelganger whose original is not inside (was turned away / thrown out) becomes a plain imitator
 * - a visitor whose figure is already inside sets insideConflict:
 *     { insideIsMonster: true }  an imitator of that figure was admitted earlier
 *     { insideIsMonster: false } the real one is inside, the door one is the doppelganger
 */
export function prepareVisit(run, visit, rng) { // eslint-disable-line no-unused-vars
  const v = { ...visit, tells: (visit.tells ?? []).map((t) => ({ ...t })), insideConflict: null };
  if (v.type === 'faceless') return v;
  const guests = run.guests ?? [];
  const monstersInside = (run.monstersInside ?? []).map((m) => m.figureId);
  if (v.type === 'doppelganger' && !guests.includes(v.figureId) && !monstersInside.includes(v.figureId)) {
    v.type = 'imitator';
    return v;
  }
  if (monstersInside.includes(v.figureId)) v.insideConflict = { insideIsMonster: true };
  else if (guests.includes(v.figureId)) v.insideConflict = { insideIsMonster: false };
  return v;
}

