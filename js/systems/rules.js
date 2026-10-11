// Rules engine: resolves decisions, applies losses, album updates, day actions, endings.
// Pure logic, no DOM. Contract: docs/ARCHITECTURE.md "Rules engine".
import { createRng } from '../core/rng.js';
import { bus } from '../core/bus.js';
import { store, knownFacts, difficultyOf } from '../core/state.js';
import { FIGURE_IDS, getFigure } from '../data/figures.js';
import { mostVisibleTell } from './visits.js';

export const TWO_SOULS_MIN_SAVED = 20;
export const DAY_ACTIONS = 3;
const FLASHLIGHT_COST = 20;

/* ------------------------------------------------------------------ helpers */

const useRng = (run, rng) => rng ?? createRng(run.rngState);
const keepRng = (run, rng) => { run.rngState = rng.state; };
const albumChanged = () => bus.emit('album', store.album);

function log(run, entry) {
  run.nightLog ??= [];
  run.nightLog.push(entry);
  return entry;
}

function findLog(run, visit) {
  return (run.nightLog ?? []).find((e) => e.visitId === visit.id && e.final !== false);
}

function figName(figureId) {
  return getFigure(figureId)?.name ?? 'Someone';
}

function tellDesc(tells) {
  return mostVisibleTell(tells ?? [])?.desc ?? null;
}

/** Create the monster page for a figure unless one exists. Returns true if the album changed. */
function monsterPage(run, figureId, how, tells) {
  if (!figureId || figureId === 'faceless') return false;
  store.album.monsters ??= {};
  if (store.album.monsters[figureId]) return false;
  store.album.monsters[figureId] = { night: run.night, how, tell: tellDesc(tells) };
  return true;
}

function markMet(run, figureId) {
  run.met ??= [];
  if (!run.met.includes(figureId)) run.met.push(figureId);
  store.album.met ??= {};
  if (!store.album.met[figureId]) { store.album.met[figureId] = true; return true; }
  return false;
}

function snapshot(visit) {
  return { id: visit.id, figureId: visit.figureId, type: visit.type, tells: visit.tells ?? [] };
}

function occupiedBeds(run) {
  return (run.guests?.length ?? 0) + (run.monstersInside?.length ?? 0);
}

function entry(visit, decision, outcome, extra = {}) {
  return { visitId: visit.id, figureId: visit.figureId, type: visit.type, isMonster: !!visit.isMonster,
    decision, outcome, tells: visit.tells ?? [], ...extra };
}

function lineFor(visit, outcome) {
  const f = getFigure(visit.figureId);
  switch (outcome) {
    case 'saved': return f?.admitLine ?? 'Thank you!';
    case 'realTurnedAway': return f?.rejectLine ?? 'Oh... okay.';
    case 'monsterAdmitted': return f?.admitLine ?? 'Thank you!';
    case 'monsterCaught': return `It was ${f?.monsterTitle ?? 'a monster'}.`;
    case 'noBed': return 'There is no bed left tonight.';
    default: return '';
  }
}

/* --------------------------------------------------------------- night flow */

export function startNight(run, cfg) {
  run.phase = 'night';
  run.nightLog = [];
  run.guests = [];
  run.monstersInside = [];
  run.nightPlan = run.nightPlan ?? null;
  run.tools = {
    flashlightLeft: cfg?.flashlightUses ?? null, // null = only battery limits it
    mirrorLeft: cfg?.mirrorUses ?? 3,
    available: [...(cfg?.tools ?? [])],          // extra: lets useTool refuse locked tools
  };
  return run;
}

export function useTool(run, tool) {
  const t = run.tools ?? (run.tools = { flashlightLeft: null, mirrorLeft: 3 });
  if (Array.isArray(t.available) && ['album', 'questions', 'residents', 'flashlight', 'mirror', 'candle', 'callToDoor'].includes(tool)
    && !t.available.includes(tool)) {
    return { ok: false, reason: 'locked' };
  }
  switch (tool) {
    case 'flashlight': {
      if (t.flashlightLeft != null && t.flashlightLeft <= 0) return { ok: false, reason: 'none-left' };
      if ((run.battery ?? 0) < FLASHLIGHT_COST) return { ok: false, reason: 'battery' };
      run.battery -= FLASHLIGHT_COST;
      if (t.flashlightLeft != null) t.flashlightLeft -= 1;
      return { ok: true, battery: run.battery, left: t.flashlightLeft };
    }
    case 'mirror': {
      if ((t.mirrorLeft ?? 0) <= 0) return { ok: false, reason: 'none-left' };
      t.mirrorLeft -= 1;
      return { ok: true, left: t.mirrorLeft };
    }
    case 'album': case 'questions': case 'residents': case 'candle': case 'callToDoor':
      return { ok: true };
    default:
      return { ok: false, reason: 'unknown' };
  }
}

function typo(name, rng) {
  const chars = [...name];
  if (chars.length >= 3) {
    for (let tries = 0; tries < 6; tries++) {
      const i = rng.int(0, chars.length - 2);
      const c = [...chars];
      [c[i], c[i + 1]] = [c[i + 1], c[i]];
      if (c.join('') !== name) return c.join('');
    }
  }
  return `${name}${name.slice(-1).toLowerCase()}h`;
}

const EVASIVE = ["I don't remember.", 'Why do you ask?', 'Hm. Next question?', '...'];

export function answerQuestion(run, visit, factIndex, rng) {
  rng = useRng(run, rng);
  const figure = getFigure(visit.figureId);
  const textTell = visit.textTell ?? null;
  let result;
  if (!figure) {
    result = { text: '...', correct: true, textTell };
  } else if (factIndex === 'name') {
    if (textTell === 'typo') result = { text: `I'm ${typo(figure.name, rng)}.`, correct: false, textTell };
    else result = { text: `I'm ${figure.name}.`, correct: true, textTell };
  } else {
    const fact = figure.facts?.[factIndex];
    if (!fact || !knownFacts(visit.figureId).includes(factIndex)) {
      result = { text: '...', correct: null, textTell, ok: false, reason: 'unknown-fact' };
    } else {
      let wrong = false;
      if (visit.answers === 'lie') wrong = true;
      else if (visit.answers === 'mixed') wrong = rng.chance(visit.wrongChance ?? 0.5);
      if (!wrong) result = { text: fact.a, correct: true, textTell };
      else {
        const pool = fact.wrong?.length ? fact.wrong : EVASIVE;
        result = { text: rng.pick(pool), correct: false, textTell };
      }
    }
  }
  keepRng(run, rng);
  return result;
}

/* ---------------------------------------------------------------- decisions */

function admitReal(run, visit) {
  run.guests.push(visit.figureId);
  run.saved += 1;
  run.stats.realSaved += 1;
  return markMet(run, visit.figureId);
}

function admitMonster(run, visit) {
  run.monstersInside.push(snapshot(visit));
  run.stats.monstersAdmitted += 1;
}

function turnAwayReal(run, visit) {
  run.rejectedReal.push(visit.figureId);
  run.stats.realRejected += 1;
}

function catchMonster(run, visit) {
  run.stats.monstersCaught += 1;
  return monsterPage(run, visit.figureId, 'caught', visit.tells);
}

function returnerSeen(run, visit) {
  if (visit.type !== 'returner') return false;
  run.returned.push(visit.figureId);
  // The returner page is created when the figure actually comes back (even if it was admitted).
  const existing = store.album.monsters?.[visit.figureId];
  if (existing) return false;
  store.album.monsters ??= {};
  store.album.monsters[visit.figureId] = { night: run.night, how: 'returner', tell: tellDesc(visit.tells) };
  return true;
}

/**
 * decision: 'admit' | 'reject' | 'timeout'.
 *  - 'timeout' of a REAL visitor = it gave up and left (same as reject).
 *  - 'timeout' of a MONSTER = it hammered the door and fell out of its role: the screen calls
 *    hammer() first, then resolveDecision(..., 'timeout'). Result: 'monsterCaught' with reveal=true
 *    and an album page (its true form was seen); report.caught entry carries timeout:true.
 *    If hammer() already broke in, the monster counts as admitted and this returns that result.
 *  - calling it twice for the same visit returns the first result without changing anything.
 */
export function resolveDecision(run, visit, decision) {
  const prior = findLog(run, visit);
  if (prior) return { outcome: prior.outcome, reveal: !!prior.reveal, line: prior.line ?? lineFor(visit, prior.outcome) };

  if (visit.type === 'faceless') {
    decideFaceless(run, decision === 'admit');
    const outcome = decision === 'admit' ? 'saved' : 'realTurnedAway';
    const res = { outcome, reveal: false, line: decision === 'admit' ? 'You open the door.' : 'You keep the door shut.' };
    log(run, entry(visit, decision, outcome, { reveal: false, line: res.line, faceless: true }));
    return res;
  }

  let changed = false;
  let result;
  if (decision === 'admit') {
    if (occupiedBeds(run) >= run.beds) {
      return { outcome: 'noBed', reveal: false, line: lineFor(visit, 'noBed') };
    }
    if (visit.isMonster) {
      admitMonster(run, visit);
      changed = returnerSeen(run, visit);
      result = { outcome: 'monsterAdmitted', reveal: false };
    } else {
      changed = admitReal(run, visit);
      result = { outcome: 'saved', reveal: false };
    }
  } else if (visit.isMonster) {
    changed = returnerSeen(run, visit); // before catchMonster: a returner's page is how 'returner'
    changed = catchMonster(run, visit) || changed;
    result = { outcome: 'monsterCaught', reveal: true };
  } else {
    turnAwayReal(run, visit);
    result = { outcome: 'realTurnedAway', reveal: false };
  }
  result.line = lineFor(visit, result.outcome);
  log(run, entry(visit, decision, result.outcome, {
    reveal: result.reveal, line: result.line, ...(decision === 'timeout' ? { timeout: true } : {}),
  }));
  if (changed) albumChanged();
  return result;
}

export function hammer(run, visit) {
  const prior = findLog(run, visit);
  if (!visit.isMonster || prior) return { door: run.door, brokeIn: false };
  run.door = Math.max(0, (run.door ?? 0) - 1);
  const brokeIn = run.door <= 0;
  if (brokeIn) {
    admitMonster(run, visit); // forced entry ignores the bed limit
    const changed = returnerSeen(run, visit);
    const line = 'The door gives way.';
    log(run, entry(visit, 'brokeIn', 'monsterAdmitted', { reveal: false, line, brokeIn: true }));
    if (changed) albumChanged();
  }
  return { door: run.door, brokeIn };
}

/**
 * "Two of them": the visitor claims to be X while X is inside. The player throws out one.
 * visit.insideConflict.insideIsMonster tells which one is the monster:
 *  - false: inside is the real X, the door is a doppelganger. Correct = 'door'.
 *    Wrong ('inside'): the real guest is thrown out (turned away, returns later) and the monster walks in.
 *  - true: inside is an imitator of X, the door is the real X. Correct = 'inside'
 *    (imitator counts as caught, the real X is let in). Wrong ('door'): real X is turned away.
 * This resolves the whole visit.
 */
export function resolveTwoOfThem(run, visit, throwOut) {
  const prior = findLog(run, visit);
  if (prior) return { correct: prior.correct ?? false, outcome: prior.outcome, line: prior.line ?? '' };
  const conflict = visit.insideConflict;
  if (!conflict || (throwOut !== 'door' && throwOut !== 'inside')) {
    return { correct: false, outcome: null, line: 'There is nobody to compare.' };
  }
  let changed = false;
  let outcome;
  let correct;
  if (!conflict.insideIsMonster) {
    if (throwOut === 'door') {
      correct = true;
      changed = catchMonster(run, visit);
      outcome = 'monsterCaught';
    } else {
      correct = false;
      const i = run.guests.indexOf(visit.figureId);
      if (i >= 0) {
        run.guests.splice(i, 1);
        run.saved = Math.max(0, run.saved - 1);
        run.rejectedReal.push(visit.figureId);
        run.stats.realRejected += 1;
        log(run, entry({ ...visit, id: `${visit.id}:inside`, type: 'real', isMonster: false, tells: [] },
          'thrownOut', 'realTurnedAway', { reveal: false, thrownOut: true }));
      }
      admitMonster(run, visit);
      outcome = 'monsterAdmitted';
    }
  } else if (throwOut === 'inside') {
    correct = true;
    const i = run.monstersInside.findIndex((m) => m.figureId === visit.figureId);
    if (i >= 0) {
      const [gone] = run.monstersInside.splice(i, 1);
      run.stats.monstersAdmitted = Math.max(0, run.stats.monstersAdmitted - 1);
      run.stats.monstersCaught += 1;
      changed = monsterPage(run, gone.figureId, 'caught', gone.tells);
      const prev = (run.nightLog ?? []).find((e) => e.visitId === gone.id);
      if (prev) { prev.outcome = 'monsterCaught'; prev.thrownOut = true; prev.reveal = true; }
    }
    changed = admitReal(run, visit) || changed;
    outcome = 'saved';
  } else {
    correct = false;
    turnAwayReal(run, visit);
    outcome = 'realTurnedAway';
  }
  const line = {
    monsterCaught: 'The one at the door was the monster.',
    monsterAdmitted: 'You threw out the real one. The other stays.',
    saved: 'The one inside was the monster.',
    realTurnedAway: 'You turned away the real one.',
  }[outcome];
  log(run, entry(visit, 'twoOfThem', outcome, { reveal: outcome === 'monsterCaught', line, correct, twoOfThem: true }));
  if (changed) albumChanged();
  return { correct, outcome, line };
}

export function decideFaceless(run, open) {
  run.openedFaceless = !!open;
  return { openedFaceless: run.openedFaceless };
}

/* ------------------------------------------------------------- finish night */

export function computeEnding(run) {
  if ((run.flames ?? 1) <= 0) return 'lanternOut';
  if (!run.openedFaceless) return 'dawn';
  return (run.saved ?? 0) >= TWO_SOULS_MIN_SAVED ? 'twoSouls' : 'newFog';
}

export function finishNight(run, rng) {
  rng = useRng(run, rng);
  const diff = difficultyOf(run);
  const logEntries = run.nightLog ?? [];
  const admitted = (run.monstersInside ?? []).map((m) => ({ figureId: m.figureId, type: m.type, tells: m.tells ?? [] }));
  const lost = [];
  let changed = false;

  for (const m of run.monstersInside ?? []) {
    run.flames = Math.max(0, run.flames - 1);
    if (run.guests.length) {
      const i = rng.int(0, run.guests.length - 1);
      const [id] = run.guests.splice(i, 1);
      run.saved = Math.max(0, run.saved - 1);
      lost.push({ id, by: m.figureId });
    }
    changed = monsterPage(run, m.figureId, 'jumpscare', m.tells) || changed;
  }

  const caught = logEntries.filter((e) => e.outcome === 'monsterCaught')
    .map((e) => ({ figureId: e.figureId, type: e.type, ...(e.timeout ? { timeout: true } : {}) }));
  const turnedAway = logEntries.filter((e) => e.outcome === 'realTurnedAway' && !e.faceless).map((e) => e.figureId);

  let missedTells = [];
  if (diff.morningHints === 'all') {
    missedTells = logEntries.filter((e) => e.isMonster && (e.outcome === 'monsterCaught' || e.outcome === 'monsterAdmitted'))
      .filter((e) => e.tells?.length)
      .map((e) => ({ figureId: e.figureId, tells: e.tells }));
    // an admitted monster later thrown out is already 'monsterCaught'; nothing is listed twice
  } else if (diff.morningHints === 'missed') {
    missedTells = admitted.filter((m) => m.tells.length).map((m) => ({ figureId: m.figureId, tells: m.tells }));
  }

  const gameOver = run.flames <= 0;
  let endingId = null;
  if (gameOver) endingId = 'lanternOut';
  else if (run.mode !== 'endless' && run.night >= 7) endingId = computeEnding(run);

  const report = {
    night: run.night,
    saved: [...run.guests],
    lost,
    caught,
    admitted,
    turnedAway,
    missedTells,
    flames: run.flames,
    maxFlames: run.maxFlames,
    jumpscare: admitted.length ? { figureId: admitted[0].figureId } : null,
    gameOver,
    endingId,
  };

  run.lastReport = report;
  run.history ??= [];
  run.history.push({
    night: run.night, saved: report.saved.length, lost: lost.length, caught: caught.length,
    admitted: admitted.length, turnedAway: turnedAway.length, flames: run.flames,
    admittedIds: admitted.map((a) => a.figureId),
  });
  run.phase = 'morning';
  if (endingId) {
    run.endingId = endingId;
    store.album.endings ??= {};
    store.album.endings[endingId] = true;
    store.album.runsFinished = (store.album.runsFinished ?? 0) + 1;
    changed = true;
  }
  if (run.mode === 'endless' && run.saved > (store.album.endlessBest ?? 0)) {
    store.album.endlessBest = run.saved;
    changed = true;
  }
  keepRng(run, rng);
  if (changed) albumChanged();
  return report;
}

/* ---------------------------------------------------------------------- day */

export function startDay(run) {
  run.actionsLeft = DAY_ACTIONS;
  run.phase = 'day';
  return run;
}

function spend(run) { run.actionsLeft = Math.max(0, run.actionsLeft - 1); }
const refuse = (run, reason, message) => ({ ok: false, reason, message, actionsLeft: run.actionsLeft });

function unlockFact(figureId, index) {
  store.album.facts ??= {};
  const list = store.album.facts[figureId] ?? (store.album.facts[figureId] = []);
  if (!list.includes(index)) list.push(index);
}

function friendsNamedIn(guest, candidates) {
  const fact = (guest.facts ?? []).find((f) => f.cat === 'friend');
  if (!fact) return [];
  const text = `${fact.a} ${fact.q}`.toLowerCase();
  return candidates.filter((id) => {
    const n = getFigure(id)?.name?.toLowerCase();
    return n && new RegExp(`\\b${n.replace(/[^a-z0-9]/g, '')}\\b`).test(text);
  });
}

export function dayAction(run, action, arg, rng) {
  rng = useRng(run, rng);
  const result = dayActionInner(run, action, arg, rng);
  keepRng(run, rng);
  if (result.ok) result.actionsLeft = run.actionsLeft;
  return result;
}

function dayActionInner(run, action, arg, rng) {
  if (run.actionsLeft <= 0) return refuse(run, 'noActions', 'No actions left today.');
  switch (action) {
    case 'talk': {
      const guest = getFigure(arg);
      if (!guest || !run.guests.includes(arg)) return refuse(run, 'noGuest', 'Nobody by that name is here.');
      const known = knownFacts(arg);
      const next = (guest.facts ?? []).findIndex((_, i) => !known.includes(i));
      if (next < 0) return refuse(run, 'nothingNew', `${guest.name} has told you everything.`);
      unlockFact(arg, next);
      spend(run);
      albumChanged();
      const fact = guest.facts[next];
      const chatter = guest.talkLines?.length ? rng.pick(guest.talkLines) : null;
      return { ok: true, message: `${guest.name} tells you: "${fact.a}"`, line: chatter, fact, factUnlocked: { figureId: arg, index: next } };
    }
    case 'askFriend': {
      const guest = getFigure(arg);
      if (!guest || !run.guests.includes(arg)) return refuse(run, 'noGuest', 'Nobody by that name is here.');
      const open = FIGURE_IDS.filter((id) => {
        const f = getFigure(id);
        if (!f || id === arg || run.met.includes(id)) return false;
        const known = knownFacts(id);
        return [1, 2].some((i) => f.facts?.[i] && !known.includes(i));
      });
      if (!open.length) return refuse(run, 'nothingNew', `${guest.name} has no more stories about the others.`);
      const named = friendsNamedIn(guest, open);
      const friendId = rng.pick(named.length ? named : open);
      const friend = getFigure(friendId);
      const known = knownFacts(friendId);
      const idxs = [1, 2].filter((i) => friend.facts?.[i] && !known.includes(i));
      const index = rng.pick(idxs);
      unlockFact(friendId, index);
      spend(run);
      albumChanged();
      return {
        ok: true,
        message: `${guest.name} tells you about ${friend.name}: "${friend.facts[index].a}"`,
        fact: friend.facts[index],
        factUnlocked: { figureId: friendId, index },
      };
    }
    case 'charge':
      if (run.battery >= 100) return refuse(run, 'full', 'The battery is already full.');
      run.battery = 100; spend(run);
      return { ok: true, message: 'The flashlight is fully charged.' };
    case 'wick':
      if (run.flames >= run.maxFlames) return refuse(run, 'full', 'The lantern is burning at full strength.');
      run.flames += 1; spend(run);
      return { ok: true, message: 'A flame returns to the lantern.' };
    case 'bed':
      if (run.beds >= run.maxBeds) return refuse(run, 'full', 'There is no room for another bed.');
      run.beds += 1; spend(run);
      return { ok: true, message: 'You build another bed.' };
    case 'door':
      if (run.door >= run.maxDoor) return refuse(run, 'full', 'The door is already strong.');
      run.door = run.maxDoor; spend(run);
      return { ok: true, message: 'You reinforce the door.' };
    default:
      return refuse(run, 'unknown', 'You cannot do that.');
  }
}

export function endDay(run) {
  run.guests = [];
  run.monstersInside = [];
  run.night += 1;
  run.actionsLeft = DAY_ACTIONS;
  run.phase = run.mode === 'endless' ? 'night' : 'note';
  return run;
}
