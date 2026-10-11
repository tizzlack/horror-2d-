// Shared helpers for the rules tests: run setup, hand-made visits, night validation, bots.
import { createRng } from '../js/core/rng.js';
import { store, newRun, emptyAlbum } from '../js/core/state.js';
import { nightConfig } from '../js/data/nights.js';
import { getFigure, FIGURE_IDS } from '../js/data/figures.js';
import { generateNight, prepareVisit, tellUsable } from '../js/systems/visits.js';
import * as rules from '../js/systems/rules.js';

export { rules, store, nightConfig, generateNight, prepareVisit, tellUsable, createRng, getFigure, FIGURE_IDS };

export function freshRun({ night = 1, mode = 'story', difficulty = 'normal', seed = 1 } = {}) {
  store.album = emptyAlbum();
  const run = newRun({ mode, difficulty, seed });
  run.night = night;
  return run;
}

/** A hand-made visit with sensible defaults. */
export function mkVisit(o = {}) {
  const type = o.type ?? (o.isMonster ? 'imitator' : 'real');
  const isMonster = o.isMonster ?? !['real', 'faceless'].includes(type);
  return {
    id: o.id ?? `t-${Math.random().toString(36).slice(2, 8)}`, index: 0, figureId: 'nimi', isMonster, type,
    tells: isMonster ? [{ id: 'x_t', level: 1, kind: 'visual', effect: 'drip', at: 'face', params: {}, revealedBy: 'eye', desc: 'A drop.' }] : [],
    knock: isMonster ? 'monster' : 'real', patience: 60, answers: isMonster ? 'mixed' : 'truth',
    wrongChance: isMonster ? 0.5 : 0, textTell: null, dark: false, shadowFlicker: false, candleFlicker: false,
    insideConflict: null, ...o,
  };
}

/** Structural checks for a generated night. Returns a list of problem strings. */
export function validateNight(run, cfg, visits) {
  const bad = [];
  const faceless = visits.filter((v) => v.type === 'faceless');
  const regular = visits.filter((v) => v.type !== 'faceless');
  if (regular.length !== cfg.visits) bad.push(`visits ${regular.length} != ${cfg.visits}`);
  const wantFaceless = cfg.events.includes('finale') && !cfg.endless ? 1 : 0;
  if (faceless.length !== wantFaceless) bad.push('faceless count');
  if (wantFaceless && visits[visits.length - 1].type !== 'faceless') bad.push('faceless not last');
  const monsters = regular.filter((v) => v.isMonster);
  if (monsters.length !== Math.min(cfg.monsters, cfg.visits - 1)) bad.push(`monsters ${monsters.length} != ${cfg.monsters}`);
  visits.forEach((v, i) => {
    if (v.index !== i) bad.push('index');
    if (!getFigure(v.figureId)) bad.push(`unknown figure ${v.figureId}`);
    if (v.type !== 'faceless' && !cfg.types.includes(v.type) && v.type !== 'real') bad.push(`type ${v.type} not allowed`);
    if (v.isMonster) {
      if (!v.tells.length || v.tells.length > 3) bad.push(`tell count ${v.tells.length}`);
      if (!v.tells.some((t) => tellUsable(t, cfg))) bad.push(`UNFAIR ${v.type} ${v.figureId}`);
      if (v.tells.some((t) => t.level > cfg.tellLevels[1])) bad.push('tell above cap');
      if (v.knock !== 'monster') bad.push('knock');
      const max = Math.max(...v.tells.map((t) => t.level));
      if (v.shadowFlicker !== (max >= 3)) bad.push('shadowFlicker');
      if (v.type === 'whisperer' !== v.dark) bad.push('dark');
      if (v.type === 'pusher' && (v.patience !== cfg.pusherPatience || !v.tells.some((t) => t.effect === 'impatient'))) bad.push('pusher');
      if (v.type === 'returner' && (v.tells.length < 2 && getFigure(v.figureId).tells.length >= 2)) bad.push('returner tells');
    } else if (v.tells.length) bad.push('real with tells');
    if (v.type !== 'pusher' && v.type !== 'faceless' && v.patience !== cfg.patience) bad.push('patience');
    if ((v.type === 'real' || v.type === 'returner') && v.answers !== 'truth') bad.push('answers');
  });
  // duplicates only as (real, later doppelganger) or (imitator, later real)
  const seen = new Map();
  visits.forEach((v, i) => {
    const prev = seen.get(v.figureId);
    if (prev) {
      const ok = (prev.type === 'real' && v.type === 'doppelganger') || (prev.isMonster && prev.type === 'imitator' && v.type === 'real');
      if (!ok) bad.push(`duplicate ${v.figureId} ${prev.type}->${v.type}`);
    }
    seen.set(v.figureId, v);
    if (v.type === 'doppelganger') {
      const earlier = visits.slice(0, i).find((u) => u.figureId === v.figureId && u.type === 'real');
      if (!earlier) bad.push('doppelganger without earlier real');
    }
  });
  const night = cfg.night;
  if (night === 1 && !cfg.endless) for (const v of visits) if (!['nimi', 'bub', 'lume', 'zen', 'miso'].includes(v.figureId)) bad.push(`night1 pool ${v.figureId}`);
  if (night < 2) for (const v of visits) if (getFigure(v.figureId)?.honestOddity) bad.push('oddity on night 1');
  if (!cfg.endless && night < 3 && visits.some((v) => v.type === 'doppelganger')) bad.push('doppelganger early');
  if (!cfg.endless && night < 4 && visits.some((v) => v.type === 'pusher')) bad.push('pusher early');
  if (!cfg.endless && night < 6 && visits.some((v) => v.type === 'whisperer')) bad.push('whisperer early');
  const returners = monsters.filter((v) => v.type === 'returner').length;
  const maxR = night >= 5 ? 2 : night >= 2 ? 1 : 0;
  if (returners > maxR) bad.push('too many returners');
  return bad;
}

/* ---------------------------------------------------------------- bots */

/**
 * Plays one visit. policy: 'perfect' (knows who is a monster) | 'random'.
 */
function playVisit(run, cfg, v0, policy, rng, facelessChoice) {
  const v = prepareVisit(run, v0, rng);
  if (v.type === 'faceless') {
    const open = facelessChoice === 'random' ? rng.chance(0.5) : facelessChoice === 'open';
    return rng.chance(0.5) ? rules.decideFaceless(run, open) : rules.resolveDecision(run, v, open ? 'admit' : 'reject');
  }
  if (rng.chance(0.4)) { // poke the tools a bit
    for (const tool of ['flashlight', 'mirror', 'album', 'questions']) if (rng.chance(0.5)) rules.useTool(run, tool);
    if (v.type !== 'faceless') rules.answerQuestion(run, v, rng.chance(0.5) ? 'name' : rng.pick([0, 1, 2]), rng);
  }
  const skill = policy.startsWith('skilled:') ? Number(policy.slice(8)) : null; // 'skilled:0.8' = right 80% of the time
  if (v.insideConflict && cfg.events.includes('twoOfThem') && (policy === 'perfect' || skill != null || (policy === 'random' && rng.chance(0.6)))) {
    const right = v.insideConflict.insideIsMonster ? 'inside' : 'door';
    const wrong = right === 'inside' ? 'door' : 'inside';
    const pick = policy === 'perfect' ? right : skill != null ? (rng.chance(skill) ? right : wrong) : rng.pick(['door', 'inside']);
    return rules.resolveTwoOfThem(run, v, pick);
  }
  let decision;
  if (policy === 'perfect') decision = v.isMonster ? 'reject' : 'admit';
  else if (skill != null) {
    const right = v.isMonster ? 'reject' : 'admit';
    decision = rng.chance(skill) ? right : (right === 'admit' ? 'reject' : 'admit');
  } else if (policy === 'rejectAll') decision = 'reject';
  else if (policy === 'admitAll') decision = 'admit';
  else {
    const r = rng.next();
    decision = r < 0.5 ? 'admit' : r < 0.9 ? 'reject' : 'timeout';
  }
  if (decision === 'timeout' && v.isMonster) rules.hammer(run, v);
  let res = rules.resolveDecision(run, v, decision);
  if (res.outcome === 'noBed' && v.isMonster === false) res = rules.resolveDecision(run, v, 'reject');
  else if (res.outcome === 'noBed') res = rules.resolveDecision(run, v, 'reject');
  return res;
}

function playDay(run, policy, rng) {
  rules.startDay(run);
  const acts = [];
  if (policy === 'perfect' || policy.startsWith('skilled')) {
    for (let guard = 0; guard < 12 && run.actionsLeft > 0; guard++) {
      let r;
      if (run.flames < run.maxFlames) r = rules.dayAction(run, 'wick', null, rng);
      else if (run.beds < run.maxBeds) r = rules.dayAction(run, 'bed', null, rng);
      else if (run.door < run.maxDoor) r = rules.dayAction(run, 'door', null, rng);
      else if (run.battery < 100) r = rules.dayAction(run, 'charge', null, rng);
      else if (run.guests.length) r = rules.dayAction(run, rng.chance(0.5) ? 'talk' : 'askFriend', rng.pick(run.guests), rng);
      else r = { ok: false };
      acts.push(r);
      if (!r.ok) { if (run.guests.length === 0 && run.beds >= run.maxBeds) break; }
    }
  } else {
    for (let guard = 0; guard < 8 && run.actionsLeft > 0; guard++) {
      const a = rng.pick(['talk', 'askFriend', 'charge', 'wick', 'bed', 'door']);
      acts.push(rules.dayAction(run, a, run.guests.length ? rng.pick(run.guests) : 'nimi', rng));
    }
  }
  return acts;
}

/** Plays a whole run with a bot. Returns { run, reports, problems }. */
export function playRun({ policy = 'perfect', mode = 'story', difficulty = 'normal', seed = 1, faceless = 'open', maxNights = 7 } = {}) {
  const run = freshRun({ mode, difficulty, seed });
  const rng = createRng(seed * 7919 + 13);
  const reports = [];
  const problems = [];
  for (let guard = 0; guard < maxNights + 2; guard++) {
    const cfg = nightConfig(run);
    const visits = generateNight(run, cfg);
    problems.push(...validateNight(run, cfg, visits).map((p) => `n${cfg.night}: ${p}`));
    rules.startNight(run, cfg);
    for (const v of visits) playVisit(run, cfg, v, policy, rng, faceless);
    const report = rules.finishNight(run);
    reports.push(report);
    if (report.endingId || report.gameOver) break;
    if (mode === 'endless' && run.night >= maxNights) break;
    playDay(run, policy, rng);
    rules.endDay(run);
  }
  return { run, reports, problems };
}
