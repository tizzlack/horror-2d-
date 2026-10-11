import { test, assert, done } from './harness.mjs';
import { freshRun, rules, store, mkVisit, nightConfig, generateNight, prepareVisit, createRng, getFigure } from './util.mjs';
import { bus } from '../js/core/bus.js';
import { knownFacts } from '../js/core/state.js';

let albumEvents = 0;
bus.on('album', () => { albumEvents++; });

function nightRun(opts = {}) {
  const run = freshRun(opts);
  rules.startNight(run, nightConfig(run));
  return run;
}

/* ------------------------------------------------------------ night start & tools */

test('startNight resets the night state and tool counters', () => {
  const run = freshRun({ night: 5 });
  run.guests = ['nimi']; run.monstersInside = [{ figureId: 'bub' }]; run.nightLog = [{ x: 1 }];
  const cfg = nightConfig(run);
  rules.startNight(run, cfg);
  assert.deepEqual(run.guests, []);
  assert.deepEqual(run.monstersInside, []);
  assert.deepEqual(run.nightLog, []);
  assert.equal(run.tools.flashlightLeft, 2); // power outage night
  assert.equal(run.tools.mirrorLeft, 3);
  assert.equal(run.phase, 'night');
  const run2 = nightRun({ night: 3 });
  assert.equal(run2.tools.flashlightLeft, null);
});

test('flashlight: costs 20 battery, refuses below 20 ("battery")', () => {
  const run = nightRun({ night: 3 });
  for (let i = 0; i < 5; i++) assert.deepEqual({ ok: true }.ok, rules.useTool(run, 'flashlight').ok);
  assert.equal(run.battery, 0);
  assert.deepEqual(rules.useTool(run, 'flashlight'), { ok: false, reason: 'battery' });
  run.battery = 19;
  assert.equal(rules.useTool(run, 'flashlight').reason, 'battery');
  run.battery = 20;
  assert.equal(rules.useTool(run, 'flashlight').ok, true);
  assert.equal(run.battery, 0);
});

test('flashlight on a power-outage night: only 2 uses even with full battery', () => {
  const run = nightRun({ night: 5 });
  assert.equal(rules.useTool(run, 'flashlight').ok, true);
  assert.equal(rules.useTool(run, 'flashlight').ok, true);
  assert.deepEqual(rules.useTool(run, 'flashlight'), { ok: false, reason: 'none-left' });
  assert.equal(run.battery, 60);
});

test('mirror: exactly 3 looks per night, no battery', () => {
  const run = nightRun({ night: 4 });
  for (let i = 0; i < 3; i++) assert.equal(rules.useTool(run, 'mirror').ok, true);
  assert.deepEqual(rules.useTool(run, 'mirror'), { ok: false, reason: 'none-left' });
  assert.equal(run.battery, 100);
  rules.startNight(run, nightConfig(run));
  assert.equal(rules.useTool(run, 'mirror').ok, true);
});

test('locked / unknown tools are refused; free tools are ok', () => {
  const run = nightRun({ night: 1 });
  assert.deepEqual(rules.useTool(run, 'flashlight'), { ok: false, reason: 'locked' });
  assert.equal(run.battery, 100);
  assert.equal(rules.useTool(run, 'mirror').reason, 'locked');
  assert.equal(rules.useTool(run, 'album').ok, true);
  assert.equal(rules.useTool(run, 'questions').ok, true);
  assert.equal(rules.useTool(run, 'banana').reason, 'unknown');
});

/* ------------------------------------------------------------------ questions */

test('answerQuestion: real visitors answer correctly; unknown facts refused', () => {
  const run = nightRun({ night: 2 });
  const f = getFigure('nimi');
  const v = mkVisit({ type: 'real', figureId: 'nimi' });
  const r0 = rules.answerQuestion(run, v, 0, createRng(1));
  assert.deepEqual(r0, { text: f.facts[0].a, correct: true, textTell: null });
  const n = rules.answerQuestion(run, v, 'name', createRng(1));
  assert.equal(n.correct, true);
  assert.ok(n.text.includes(f.name));
  const u = rules.answerQuestion(run, v, 2, createRng(1));
  assert.equal(u.ok, false);
  assert.equal(u.reason, 'unknown-fact');
  store.album.facts.nimi = [2];
  assert.equal(rules.answerQuestion(run, v, 2, createRng(1)).text, f.facts[2].a);
  assert.deepEqual(knownFacts('nimi'), [0, 2]);
});

test('answerQuestion: imitators lie with wrongChance, wrong answers come from fact.wrong', () => {
  const run = nightRun({ night: 2 });
  const f = getFigure('nimi');
  const rng = createRng(42);
  const v = mkVisit({ type: 'imitator', figureId: 'nimi', answers: 'mixed', wrongChance: 0.7 });
  let wrong = 0; const N = 2000;
  for (let i = 0; i < N; i++) {
    const r = rules.answerQuestion(run, v, 0, rng);
    if (!r.correct) { wrong++; assert.ok(f.facts[0].wrong.includes(r.text), r.text); } else assert.equal(r.text, f.facts[0].a);
  }
  assert.ok(Math.abs(wrong / N - 0.7) < 0.05, `wrong ${wrong / N}`);
  const liar = mkVisit({ type: 'imitator', answers: 'lie' });
  assert.equal(rules.answerQuestion(run, liar, 0, rng).correct, false);
});

test('answerQuestion: typo imitators misspell their name; textTell is returned; returners are always right', () => {
  const run = nightRun({ night: 2 });
  const v = mkVisit({ type: 'imitator', figureId: 'lume', textTell: 'typo' });
  for (let i = 0; i < 20; i++) {
    const r = rules.answerQuestion(run, v, 'name', createRng(i));
    assert.equal(r.textTell, 'typo');
    assert.equal(r.correct, false);
    assert.ok(!r.text.includes('Lume'), r.text);
  }
  const shout = mkVisit({ type: 'imitator', figureId: 'lume', textTell: 'shout', answers: 'lie' });
  assert.equal(rules.answerQuestion(run, shout, 'name', createRng(1)).text.includes('Lume'), true);
  assert.equal(rules.answerQuestion(run, shout, 0, createRng(1)).textTell, 'shout');
  const ret = mkVisit({ type: 'returner', figureId: 'lume', answers: 'truth', wrongChance: 0 });
  for (let i = 0; i < 100; i++) assert.equal(rules.answerQuestion(run, ret, 0, createRng(i)).correct, true);
});

test('answerQuestion: facts without wrong answers fall back to evasive text; rngState stored', () => {
  const run = nightRun({ night: 2 });
  const f = getFigure('nimi');
  const saved = f.facts[0].wrong;
  f.facts[0].wrong = [];
  try {
    const r = rules.answerQuestion(run, mkVisit({ figureId: 'nimi', answers: 'lie' }), 0, createRng(3));
    assert.equal(r.correct, false);
    assert.ok(r.text.length > 0);
  } finally { f.facts[0].wrong = saved; }
  const before = run.rngState;
  rules.answerQuestion(run, mkVisit({ answers: 'mixed' }), 0);
  assert.notEqual(run.rngState, before);
});

/* ------------------------------------------------------------------ decisions */

test('admit a real visitor: saved, guest, met, album MET stamp, album event', () => {
  const run = nightRun();
  const before = albumEvents;
  const v = mkVisit({ type: 'real', figureId: 'nimi' });
  const r = rules.resolveDecision(run, v, 'admit');
  assert.equal(r.outcome, 'saved');
  assert.equal(r.reveal, false);
  assert.ok(typeof r.line === 'string');
  assert.deepEqual(run.guests, ['nimi']);
  assert.equal(run.saved, 1);
  assert.deepEqual(run.met, ['nimi']);
  assert.equal(store.album.met.nimi, true);
  assert.ok(albumEvents > before);
  assert.equal(run.stats.realSaved, 1);
});

test('turn away a real visitor: recorded as rejectedReal, NO album monster page yet', () => {
  const run = nightRun();
  for (const d of ['reject', 'timeout']) {
    const r = rules.resolveDecision(run, mkVisit({ type: 'real', figureId: d === 'reject' ? 'nimi' : 'bub' }), d);
    assert.equal(r.outcome, 'realTurnedAway');
    assert.equal(r.reveal, false);
  }
  assert.deepEqual(run.rejectedReal, ['nimi', 'bub']);
  assert.deepEqual(store.album.monsters, {});
  assert.deepEqual(run.guests, []);
  assert.equal(run.stats.realRejected, 2);
});

test('admit a monster: monstersInside, no reveal, no album page until the night ends', () => {
  const run = nightRun();
  const v = mkVisit({ type: 'imitator', figureId: 'bub' });
  const r = rules.resolveDecision(run, v, 'admit');
  assert.equal(r.outcome, 'monsterAdmitted');
  assert.equal(r.reveal, false);
  assert.equal(run.monstersInside.length, 1);
  assert.equal(run.monstersInside[0].figureId, 'bub');
  assert.deepEqual(store.album.monsters, {});
  assert.equal(run.stats.monstersAdmitted, 1);
});

test('reject a monster: caught, reveal, album page how=caught with the most visible tell', () => {
  const run = nightRun({ night: 3 });
  const tells = [
    { id: 'a', level: 2, kind: 'visual', effect: 'x', revealedBy: 'album', desc: 'Subtle thing.' },
    { id: 'b', level: 1, kind: 'visual', effect: 'y', revealedBy: 'eye', desc: 'Obvious thing.' },
  ];
  const r = rules.resolveDecision(run, mkVisit({ type: 'imitator', figureId: 'zen', tells }), 'reject');
  assert.equal(r.outcome, 'monsterCaught');
  assert.equal(r.reveal, true);
  assert.deepEqual(store.album.monsters.zen, { night: 3, how: 'caught', tell: 'Obvious thing.' });
  assert.equal(run.stats.monstersCaught, 1);
});

test('timeout of a monster (after hammer): monsterCaught + reveal, album page, flagged timeout', () => {
  const run = nightRun();
  const v = mkVisit({ type: 'pusher', figureId: 'miso' });
  assert.equal(rules.hammer(run, v).brokeIn, false);
  const r = rules.resolveDecision(run, v, 'timeout');
  assert.equal(r.outcome, 'monsterCaught');
  assert.equal(r.reveal, true);
  assert.ok(store.album.monsters.miso);
  assert.equal(run.door, 2);
  assert.deepEqual(run.monstersInside, []);
  const rep = rules.finishNight(run);
  assert.deepEqual(rep.caught, [{ figureId: 'miso', type: 'pusher', timeout: true }]);
});

test('resolveDecision is idempotent per visit', () => {
  const run = nightRun();
  const v = mkVisit({ type: 'real', figureId: 'nimi' });
  const a = rules.resolveDecision(run, v, 'admit');
  const b = rules.resolveDecision(run, v, 'admit');
  assert.deepEqual(a, b);
  assert.equal(run.saved, 1);
  assert.equal(run.guests.length, 1);
});

test('beds: full -> noBed and NOTHING changes (monsters occupy beds too)', () => {
  const run = nightRun();
  assert.equal(run.beds, 4);
  for (const id of ['nimi', 'bub', 'lume']) assert.equal(rules.resolveDecision(run, mkVisit({ type: 'real', figureId: id }), 'admit').outcome, 'saved');
  assert.equal(rules.resolveDecision(run, mkVisit({ type: 'imitator', figureId: 'zen' }), 'admit').outcome, 'monsterAdmitted');
  const snap = JSON.stringify([run.guests, run.monstersInside, run.saved, run.met, run.nightLog, store.album.met, run.stats]);
  const v = mkVisit({ type: 'real', figureId: 'miso' });
  const r = rules.resolveDecision(run, v, 'admit');
  assert.equal(r.outcome, 'noBed');
  assert.equal(r.reveal, false);
  assert.equal(JSON.stringify([run.guests, run.monstersInside, run.saved, run.met, run.nightLog, store.album.met, run.stats]), snap);
  assert.equal(rules.resolveDecision(run, mkVisit({ type: 'imitator', figureId: 'kai' }), 'admit').outcome, 'noBed');
  // turning away still works; and the same visit may then be rejected after noBed
  assert.equal(rules.resolveDecision(run, v, 'reject').outcome, 'realTurnedAway');
  run.beds = 5;
  assert.equal(rules.resolveDecision(run, mkVisit({ type: 'real', figureId: 'blip' }), 'admit').outcome, 'saved');
});

test('returner flow: turned-away real comes back; album page how=returner only on return', () => {
  const run = freshRun({ night: 1, seed: 3 });
  let cfg = nightConfig(run);
  const v1 = generateNight(run, cfg);
  rules.startNight(run, cfg);
  const real = v1.find((v) => !v.isMonster);
  rules.resolveDecision(run, prepareVisit(run, real), 'reject');
  assert.deepEqual(run.rejectedReal, [real.figureId]);
  assert.deepEqual(store.album.monsters, {});
  for (const v of v1.filter((x) => x !== real)) rules.resolveDecision(run, prepareVisit(run, v), v.isMonster ? 'reject' : 'admit');
  rules.finishNight(run);
  assert.ok(!store.album.monsters[real.figureId] || store.album.monsters[real.figureId].how !== 'returner');
  rules.startDay(run); rules.endDay(run);
  cfg = nightConfig(run);
  const v2 = generateNight(run, cfg);
  rules.startNight(run, cfg);
  const ret = v2.find((v) => v.type === 'returner');
  assert.ok(ret, 'returner scheduled on night 2');
  assert.equal(ret.figureId, real.figureId);
  assert.equal(run.returned.includes(ret.figureId), false, 'not marked until it knocks');
  rules.resolveDecision(run, prepareVisit(run, ret), 'reject');
  assert.deepEqual(run.returned, [ret.figureId]);
  assert.equal(store.album.monsters[ret.figureId].how, 'returner');
  assert.equal(store.album.monsters[ret.figureId].night, 2);
  // not scheduled again on night 3
  for (const v of v2.filter((x) => x !== ret)) rules.resolveDecision(run, prepareVisit(run, v), v.isMonster ? 'reject' : 'admit');
  rules.finishNight(run); rules.startDay(run); rules.endDay(run);
  assert.ok(!generateNight(run, nightConfig(run)).some((v) => v.type === 'returner'));
});

test('admitted returner is recorded on return and stays how=returner after the jumpscare', () => {
  const run = nightRun({ night: 2 });
  run.rejectedReal = ['nimi'];
  const v = mkVisit({ type: 'returner', figureId: 'nimi', answers: 'truth' });
  assert.equal(rules.resolveDecision(run, v, 'admit').outcome, 'monsterAdmitted');
  assert.equal(store.album.monsters.nimi.how, 'returner');
  rules.finishNight(run);
  assert.equal(store.album.monsters.nimi.how, 'returner');
  assert.deepEqual(run.returned, ['nimi']);
});

/* ---------------------------------------------------------------------- hammer */

test('hammer: door -1 each time; at 0 the monster breaks in and counts as admitted', () => {
  const run = nightRun({ night: 4 });
  const v1 = mkVisit({ type: 'pusher', figureId: 'nimi' });
  assert.deepEqual(rules.hammer(run, v1), { door: 2, brokeIn: false });
  rules.resolveDecision(run, v1, 'timeout');
  const v2 = mkVisit({ type: 'imitator', figureId: 'bub' });
  assert.deepEqual(rules.hammer(run, v2), { door: 1, brokeIn: false });
  rules.resolveDecision(run, v2, 'timeout');
  const v3 = mkVisit({ type: 'pusher', figureId: 'lume' });
  assert.deepEqual(rules.hammer(run, v3), { door: 0, brokeIn: true });
  assert.equal(run.monstersInside.length, 1);
  assert.equal(run.monstersInside[0].figureId, 'lume');
  assert.equal(rules.resolveDecision(run, v3, 'timeout').outcome, 'monsterAdmitted');
  assert.equal(run.monstersInside.length, 1, 'not admitted twice');
  const v4 = mkVisit({ type: 'imitator', figureId: 'zen' });
  assert.deepEqual(rules.hammer(run, v4), { door: 0, brokeIn: true });
  assert.equal(run.monstersInside.length, 2);
  const rep = rules.finishNight(run);
  assert.equal(rep.admitted.length, 2);
});

test('hammer ignores the bed limit and real visitors', () => {
  const run = nightRun();
  run.beds = 1;
  rules.resolveDecision(run, mkVisit({ type: 'real', figureId: 'nimi' }), 'admit');
  run.door = 1;
  assert.equal(rules.hammer(run, mkVisit({ type: 'imitator', figureId: 'bub' })).brokeIn, true);
  assert.equal(run.monstersInside.length, 1);
  assert.deepEqual(rules.hammer(run, mkVisit({ type: 'real', figureId: 'lume' })), { door: 0, brokeIn: false });
});

/* ----------------------------------------------------------------- two of them */

function twoSetup(insideIsMonster) {
  const run = nightRun({ night: 5 });
  if (insideIsMonster) {
    rules.resolveDecision(run, mkVisit({ id: 'inside', type: 'imitator', figureId: 'bub' }), 'admit');
  } else {
    rules.resolveDecision(run, mkVisit({ id: 'inside', type: 'real', figureId: 'bub' }), 'admit');
  }
  const raw = insideIsMonster ? mkVisit({ id: 'door', type: 'real', figureId: 'bub' }) : mkVisit({ id: 'door', type: 'doppelganger', figureId: 'bub' });
  return { run, visit: prepareVisit(run, raw) };
}

test('two of them: doppelganger at the door, throw out the door -> correct, caught', () => {
  const { run, visit } = twoSetup(false);
  assert.deepEqual(visit.insideConflict, { insideIsMonster: false });
  const r = rules.resolveTwoOfThem(run, visit, 'door');
  assert.equal(r.correct, true);
  assert.equal(r.outcome, 'monsterCaught');
  assert.deepEqual(run.guests, ['bub']);
  assert.equal(run.monstersInside.length, 0);
  assert.ok(store.album.monsters.bub);
});

test('two of them: doppelganger at the door, throw out the one inside -> wrong, real lost, monster in', () => {
  const { run, visit } = twoSetup(false);
  const r = rules.resolveTwoOfThem(run, visit, 'inside');
  assert.equal(r.correct, false);
  assert.equal(r.outcome, 'monsterAdmitted');
  assert.deepEqual(run.guests, []);
  assert.equal(run.saved, 0);
  assert.deepEqual(run.rejectedReal, ['bub']);
  assert.equal(run.monstersInside.length, 1);
  const rep = rules.finishNight(run);
  assert.equal(rep.flames, 2);
  assert.deepEqual(rep.turnedAway, ['bub']);
});

test('two of them: imitator inside, real at the door, throw out inside -> correct, real saved', () => {
  const { run, visit } = twoSetup(true);
  assert.deepEqual(visit.insideConflict, { insideIsMonster: true });
  const r = rules.resolveTwoOfThem(run, visit, 'inside');
  assert.equal(r.correct, true);
  assert.equal(r.outcome, 'saved');
  assert.deepEqual(run.guests, ['bub']);
  assert.equal(run.saved, 1);
  assert.equal(run.monstersInside.length, 0);
  assert.equal(run.stats.monstersAdmitted, 0);
  assert.equal(store.album.monsters.bub.how, 'caught');
  const rep = rules.finishNight(run);
  assert.equal(rep.flames, 3);
  assert.deepEqual(rep.saved, ['bub']);
  assert.deepEqual(rep.caught.map((c) => c.figureId), ['bub']);
  assert.equal(rep.jumpscare, null);
});

test('two of them: imitator inside, real at the door, throw out the door -> wrong, real turned away', () => {
  const { run, visit } = twoSetup(true);
  const r = rules.resolveTwoOfThem(run, visit, 'door');
  assert.equal(r.correct, false);
  assert.equal(r.outcome, 'realTurnedAway');
  assert.deepEqual(run.rejectedReal, ['bub']);
  assert.equal(run.monstersInside.length, 1);
  assert.equal(rules.finishNight(run).flames, 2);
});

test('two of them: invalid calls do not change anything', () => {
  const run = nightRun({ night: 5 });
  const v = mkVisit({ type: 'real', figureId: 'nimi' });
  const r = rules.resolveTwoOfThem(run, v, 'door');
  assert.equal(r.outcome, null);
  assert.deepEqual(run.nightLog, []);
});

/* ---------------------------------------------------------------- faceless */

test('decideFaceless stores the choice; resolveDecision on the faceless never costs flames or guests', () => {
  const run = nightRun({ night: 7 });
  rules.decideFaceless(run, true);
  assert.equal(run.openedFaceless, true);
  rules.decideFaceless(run, false);
  assert.equal(run.openedFaceless, false);
  const f = mkVisit({ type: 'faceless', figureId: 'faceless', isMonster: false });
  rules.resolveDecision(run, f, 'admit');
  assert.equal(run.openedFaceless, true);
  assert.deepEqual(run.monstersInside, []);
  assert.deepEqual(run.guests, []);
  assert.equal(run.saved, 0);
  const rep = rules.finishNight(run);
  assert.equal(rep.flames, 3);
  assert.deepEqual(rep.turnedAway, []);
});

/* ---------------------------------------------------------------- finishNight */

function admitMonsters(run, ids) {
  ids.forEach((id) => rules.resolveDecision(run, mkVisit({ type: 'imitator', figureId: id }), 'admit'));
}

test('finishNight: each admitted monster costs a flame and a random guest; one jumpscare; album pages', () => {
  const run = nightRun({ night: 3 });
  for (const id of ['nimi', 'bub']) rules.resolveDecision(run, mkVisit({ type: 'real', figureId: id }), 'admit');
  admitMonsters(run, ['lume', 'zen']);
  assert.equal(run.saved, 2);
  const rep = rules.finishNight(run, createRng(5));
  assert.equal(rep.flames, 1);
  assert.equal(run.flames, 1);
  assert.equal(rep.lost.length, 2);
  assert.deepEqual(rep.lost.map((l) => l.by), ['lume', 'zen']);
  assert.deepEqual([...rep.lost.map((l) => l.id)].sort(), ['bub', 'nimi']);
  assert.deepEqual(rep.saved, []);
  assert.equal(run.saved, 0);
  assert.deepEqual(rep.jumpscare, { figureId: 'lume' });
  assert.equal(rep.gameOver, false);
  assert.equal(rep.endingId, null);
  assert.equal(rep.admitted.length, 2);
  assert.equal(store.album.monsters.lume.how, 'jumpscare');
  assert.equal(store.album.monsters.zen.how, 'jumpscare');
  assert.equal(run.phase, 'morning');
  assert.equal(run.lastReport, rep);
  assert.equal(run.history.length, 1);
  assert.equal(rep.night, 3);
  assert.equal(rep.maxFlames, 3);
});

test('finishNight: a monster with no guests inside takes only a flame', () => {
  const run = nightRun({ night: 2 });
  admitMonsters(run, ['lume']);
  const rep = rules.finishNight(run);
  assert.equal(rep.flames, 2);
  assert.deepEqual(rep.lost, []);
});

test('finishNight: a clean night changes nothing; saved/turnedAway/caught reported', () => {
  const run = nightRun({ night: 2 });
  rules.resolveDecision(run, mkVisit({ type: 'real', figureId: 'nimi' }), 'admit');
  rules.resolveDecision(run, mkVisit({ type: 'real', figureId: 'bub' }), 'reject');
  rules.resolveDecision(run, mkVisit({ type: 'imitator', figureId: 'lume' }), 'reject');
  const rep = rules.finishNight(run);
  assert.deepEqual(rep.saved, ['nimi']);
  assert.deepEqual(rep.turnedAway, ['bub']);
  assert.deepEqual(rep.caught, [{ figureId: 'lume', type: 'imitator' }]);
  assert.equal(rep.flames, 3);
  assert.equal(rep.jumpscare, null);
  assert.equal(run.saved, 1);
});

test('finishNight: flames reach 0 -> gameOver + lanternOut, album ending, phase morning', () => {
  const run = nightRun({ night: 3, difficulty: 'nightmare' });
  admitMonsters(run, ['lume', 'zen']);
  const rep = rules.finishNight(run);
  assert.equal(rep.flames, 0);
  assert.equal(rep.gameOver, true);
  assert.equal(rep.endingId, 'lanternOut');
  assert.equal(run.endingId, 'lanternOut');
  assert.equal(store.album.endings.lanternOut, true);
  assert.equal(run.phase, 'morning');
  assert.equal(store.album.runsFinished, 1);
});

test('morning hints per difficulty: all / missed / none', () => {
  const tells = [{ id: 't', level: 1, kind: 'visual', effect: 'drip', revealedBy: 'eye', desc: 'A drop.' }];
  const play = (difficulty) => {
    const run = nightRun({ night: 2, difficulty });
    rules.resolveDecision(run, mkVisit({ type: 'imitator', figureId: 'lume', tells }), 'reject'); // caught
    rules.resolveDecision(run, mkVisit({ type: 'imitator', figureId: 'zen', tells }), 'admit');  // missed
    return rules.finishNight(run).missedTells;
  };
  assert.deepEqual(play('cozy').map((m) => m.figureId).sort(), ['lume', 'zen']);
  assert.deepEqual(play('normal').map((m) => m.figureId), ['zen']);
  assert.deepEqual(play('nightmare'), []);
  assert.deepEqual(play('normal')[0].tells, tells);
});

test('finishNight rngState is stored, and results are reproducible from the same state', () => {
  const make = () => {
    const run = nightRun({ night: 3, seed: 77 });
    for (const id of ['nimi', 'bub', 'lume']) rules.resolveDecision(run, mkVisit({ type: 'real', figureId: id }), 'admit');
    admitMonsters(run, ['zen']);
    return run;
  };
  const a = make(); const b = make();
  const ra = rules.finishNight(a); const rb = rules.finishNight(b);
  assert.deepEqual(ra, rb);
  assert.notEqual(a.rngState, 77);
  assert.equal(a.rngState, b.rngState);
});

/* ---------------------------------------------------------------- endings */

test('computeEnding table', () => {
  const run = freshRun({ night: 7 });
  run.flames = 0;
  assert.equal(rules.computeEnding(run), 'lanternOut');
  run.flames = 1; run.openedFaceless = false; run.saved = 25;
  assert.equal(rules.computeEnding(run), 'dawn');
  run.openedFaceless = null;
  assert.equal(rules.computeEnding(run), 'dawn');
  run.openedFaceless = true; run.saved = 20;
  assert.equal(rules.computeEnding(run), 'twoSouls');
  run.saved = 19;
  assert.equal(rules.computeEnding(run), 'newFog');
  run.flames = 0; run.openedFaceless = true; run.saved = 30;
  assert.equal(rules.computeEnding(run), 'lanternOut');
});

function finishStory(saved, open, flames = 3) {
  const run = nightRun({ night: 7 });
  run.saved = saved; run.flames = flames;
  if (open != null) rules.decideFaceless(run, open);
  return { run, rep: rules.finishNight(run) };
}

test('story night 7 finishes with the right ending id and album entry', () => {
  let { run, rep } = finishStory(25, true);
  assert.equal(rep.endingId, 'twoSouls'); assert.equal(rep.gameOver, false); assert.equal(store.album.endings.twoSouls, true);
  assert.equal(run.endingId, 'twoSouls');
  ({ run, rep } = finishStory(5, true)); assert.equal(rep.endingId, 'newFog');
  ({ run, rep } = finishStory(25, false)); assert.equal(rep.endingId, 'dawn');
  ({ run, rep } = finishStory(25, null)); assert.equal(rep.endingId, 'dawn');
  ({ run, rep } = finishStory(25, true, 0)); assert.equal(rep.endingId, 'lanternOut');
  assert.equal(store.album.endings.lanternOut, true);
});

test('night 6 never ends the story; endless never produces a story ending', () => {
  const run = nightRun({ night: 6 });
  assert.equal(rules.finishNight(run).endingId, null);
  const e = nightRun({ night: 9, mode: 'endless' });
  e.saved = 40;
  assert.equal(rules.finishNight(e).endingId, null);
});

test('endless: album.endlessBest tracks the maximum saved', () => {
  const run = nightRun({ night: 2, mode: 'endless' });
  rules.resolveDecision(run, mkVisit({ type: 'real', figureId: 'nimi' }), 'admit');
  rules.resolveDecision(run, mkVisit({ type: 'real', figureId: 'bub' }), 'admit');
  rules.finishNight(run);
  assert.equal(store.album.endlessBest, 2);
  const run2 = nightRun({ night: 2, mode: 'endless' });
  store.album.endlessBest = 10;
  rules.finishNight(run2);
  assert.equal(store.album.endlessBest, 10);
});

/* ------------------------------------------------------------------------- day */

function dayRun(guests = ['nimi', 'bub']) {
  const run = freshRun({ night: 2 });
  run.guests = [...guests];
  rules.startDay(run);
  return run;
}

test('startDay gives 3 actions; every action costs 1; refusal at 0', () => {
  const run = dayRun();
  assert.equal(run.actionsLeft, 3);
  assert.equal(run.phase, 'day');
  run.beds = 4;
  assert.equal(rules.dayAction(run, 'bed').ok, true);
  assert.equal(run.actionsLeft, 2);
  run.flames = 1;
  assert.equal(rules.dayAction(run, 'wick').ok, true);
  run.battery = 40;
  assert.equal(rules.dayAction(run, 'charge').ok, true);
  assert.equal(run.actionsLeft, 0);
  run.door = 1;
  const r = rules.dayAction(run, 'door');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'noActions');
  assert.equal(run.door, 1);
});

test('charge / wick / bed / door effects and refusals when already full (no cost)', () => {
  const run = dayRun();
  for (const a of ['charge', 'wick', 'bed', 'door']) {
    const r = rules.dayAction(run, a);
    if (a === 'bed') { assert.equal(r.ok, true); assert.equal(run.beds, 5); run.actionsLeft = 3; continue; }
    assert.equal(r.ok, false, a);
    assert.equal(r.reason, 'full');
    assert.equal(run.actionsLeft, 3, `${a} refusal is free`);
  }
  run.beds = 6;
  assert.equal(rules.dayAction(run, 'bed').ok, false);
  run.battery = 20; run.flames = 1; run.door = 0;
  assert.equal(rules.dayAction(run, 'charge').ok, true); assert.equal(run.battery, 100);
  assert.equal(rules.dayAction(run, 'wick').ok, true); assert.equal(run.flames, 2);
  run.actionsLeft = 3;
  assert.equal(rules.dayAction(run, 'door').ok, true); assert.equal(run.door, 3);
  run.flames = 3; run.maxFlames = 3;
  assert.equal(rules.dayAction(run, 'wick').ok, false);
  const nm = freshRun({ difficulty: 'nightmare' }); rules.startDay(nm); nm.flames = 1;
  rules.dayAction(nm, 'wick'); assert.equal(nm.flames, 2);
  assert.equal(rules.dayAction(nm, 'wick').ok, false, 'nightmare max flames is 2');
  assert.equal(rules.dayAction(run, 'dance').ok, false);
});

test('talk unlocks the next unknown fact in order, then refuses', () => {
  const run = dayRun();
  const r1 = rules.dayAction(run, 'talk', 'nimi', createRng(1));
  assert.equal(r1.ok, true);
  assert.deepEqual(r1.factUnlocked, { figureId: 'nimi', index: 1 });
  assert.ok(r1.message.length > 0);
  assert.deepEqual(knownFacts('nimi'), [0, 1]);
  const r2 = rules.dayAction(run, 'talk', 'nimi', createRng(1));
  assert.deepEqual(r2.factUnlocked, { figureId: 'nimi', index: 2 });
  assert.equal(run.actionsLeft, 1);
  const r3 = rules.dayAction(run, 'talk', 'nimi', createRng(1));
  assert.equal(r3.ok, false);
  assert.equal(run.actionsLeft, 1, 'no cost when nothing new');
  assert.equal(rules.dayAction(run, 'talk', 'zen').ok, false, 'not a guest');
  assert.equal(rules.dayAction(run, 'talk', 'nobody').ok, false);
});

test('askFriend: unlocks fact 1 or 2 of a figure NOT met yet, never the guest or met ones', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const run = dayRun(['nimi', 'bub']);
    run.met = ['nimi', 'bub', 'lume'];
    const r = rules.dayAction(run, 'askFriend', 'nimi', createRng(seed));
    assert.equal(r.ok, true);
    const { figureId, index } = r.factUnlocked;
    assert.ok(!run.met.includes(figureId), figureId);
    assert.ok(index === 1 || index === 2);
    assert.ok(knownFacts(figureId).includes(index));
    assert.equal(run.actionsLeft, 2);
  }
});

test('askFriend prefers friends named in the guest friend fact; refuses when nothing is left', () => {
  const nimi = getFigure('nimi');
  const friend = nimi.facts.find((f) => f.cat === 'friend');
  const saved = friend.a;
  friend.a = 'Mostly Kai, and sometimes Roku.';
  try {
    const counts = {};
    for (let seed = 1; seed <= 100; seed++) {
      const run = dayRun(['nimi']);
      run.met = ['nimi'];
      const r = rules.dayAction(run, 'askFriend', 'nimi', createRng(seed));
      counts[r.factUnlocked.figureId] = (counts[r.factUnlocked.figureId] ?? 0) + 1;
      assert.ok(['kai', 'roku'].includes(r.factUnlocked.figureId), r.factUnlocked.figureId);
    }
    assert.ok(counts.kai > 0 && counts.roku > 0);
  } finally { friend.a = saved; }
  const run = dayRun(['nimi']);
  run.met = ['nimi'];
  for (const id of Object.keys(store.album.met)) delete store.album.met[id];
  // every other figure fully known -> nothing new
  for (const f of ['blip', 'roku', 'zen', 'kai', 'miso', 'shady', 'bub', 'tobi', 'lume', 'pix', 'crag', 'sno', 'vee', 'kuro', 'dot', 'glitch', 'maru', 'nyx', 'zipp']) store.album.facts[f] = [1, 2];
  const r = rules.dayAction(run, 'askFriend', 'nimi', createRng(1));
  assert.equal(r.ok, false);
  assert.equal(run.actionsLeft, 3);
});

test('day actions emit album events for facts and store the rng state', () => {
  const run = dayRun();
  const before = albumEvents; const rs = run.rngState;
  rules.dayAction(run, 'talk', 'nimi');
  assert.ok(albumEvents > before);
  rules.dayAction(run, 'askFriend', 'nimi');
  assert.notEqual(run.rngState, rs);
});

test('endDay: guests go home, night++, phase note (story) / night (endless)', () => {
  const run = dayRun();
  rules.endDay(run);
  assert.deepEqual(run.guests, []);
  assert.equal(run.night, 3);
  assert.equal(run.phase, 'note');
  const e = freshRun({ night: 4, mode: 'endless' });
  e.guests = ['nimi'];
  rules.endDay(e);
  assert.equal(e.night, 5);
  assert.equal(e.phase, 'night');
});

test('resource state persists across nights until refilled', () => {
  const run = nightRun({ night: 3 });
  rules.useTool(run, 'flashlight'); rules.useTool(run, 'flashlight');
  rules.hammer(run, mkVisit({ type: 'pusher' }));
  rules.finishNight(run);
  rules.startDay(run); rules.endDay(run);
  assert.equal(run.battery, 60);
  assert.equal(run.door, 2);
  rules.startNight(run, nightConfig(run));
  assert.equal(run.battery, 60);
});

await done('rules');
