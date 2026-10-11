import { test, assert, done } from './harness.mjs';
import { freshRun, nightConfig, generateNight, prepareVisit, validateNight, mkVisit, createRng, getFigure, FIGURE_IDS, tellUsable } from './util.mjs';
import { FIGURES } from '../js/data/figures.js';
import { pendingReturners } from '../js/systems/visits.js';

function gen(night, { difficulty = 'normal', seed = 1, mode = 'story', setup } = {}) {
  const run = freshRun({ night, difficulty, seed, mode });
  setup?.(run);
  const cfg = nightConfig(run);
  const visits = generateNight(run, cfg);
  return { run, cfg, visits };
}

test('determinism: same seed -> identical night and identical rngState', () => {
  for (const night of [1, 3, 5, 7]) {
    const a = gen(night, { seed: 1234 });
    const b = gen(night, { seed: 1234 });
    assert.deepEqual(a.visits, b.visits);
    assert.equal(a.run.rngState, b.run.rngState);
    const c = gen(night, { seed: 1235 });
    assert.notDeepEqual(a.visits, c.visits);
  }
});

test('rngState advances; explicit rng param is honoured and stored back', () => {
  const run = freshRun({ night: 2, seed: 7 });
  const before = run.rngState;
  generateNight(run, nightConfig(run));
  assert.notEqual(run.rngState, before);
  const run2 = freshRun({ night: 2, seed: 7 });
  const rng = createRng(555);
  const v1 = generateNight(run2, nightConfig(run2), rng);
  assert.equal(run2.rngState, rng.state);
  const v2 = generateNight(freshRun({ night: 2, seed: 7 }), nightConfig(run2), createRng(555));
  assert.deepEqual(v1.map((v) => v.figureId), v2.map((v) => v.figureId));
});

test('visit and monster counts match the config (story, all difficulties)', () => {
  for (const difficulty of ['cozy', 'normal', 'nightmare']) {
    for (let night = 1; night <= 7; night++) {
      for (let seed = 1; seed <= 20; seed++) {
        const { run, cfg, visits } = gen(night, { difficulty, seed });
        const problems = validateNight(run, cfg, visits);
        assert.deepEqual(problems, [], `${difficulty} n${night} s${seed}`);
        assert.equal(run.nightPlan, visits);
      }
    }
  }
});

test('visit shape follows the contract', () => {
  const { visits } = gen(6, { seed: 9 });
  for (const v of visits) {
    for (const k of ['id', 'index', 'figureId', 'isMonster', 'type', 'tells', 'knock', 'patience', 'answers', 'wrongChance', 'textTell', 'dark', 'shadowFlicker', 'candleFlicker', 'insideConflict']) {
      assert.ok(k in v, `missing ${k}`);
    }
    assert.ok(['real', 'imitator', 'returner', 'doppelganger', 'pusher', 'whisperer', 'faceless'].includes(v.type));
    assert.ok(['truth', 'lie', 'mixed'].includes(v.answers));
    assert.equal(v.insideConflict, null);
  }
  assert.equal(new Set(visits.map((v) => v.id)).size, visits.length);
  JSON.stringify(visits); // must be serialisable
});

test('FAIRNESS: every monster has a usable tell (500 runs x 7 nights x 3 difficulties, with returners)', () => {
  let monsters = 0;
  for (const difficulty of ['cozy', 'normal', 'nightmare']) {
    for (let seed = 1; seed <= 500; seed++) {
      const rng = createRng(seed);
      const run = freshRun({ night: 1, difficulty, seed });
      for (let night = 1; night <= 7; night++) {
        run.night = night;
        // random pile of turned-away figures so returners are scheduled
        run.rejectedReal = rng.shuffle(FIGURE_IDS).slice(0, rng.int(0, 3));
        run.returned = [];
        const cfg = nightConfig(run);
        const visits = generateNight(run, cfg);
        const problems = validateNight(run, cfg, visits);
        assert.deepEqual(problems, [], `${difficulty} seed${seed} n${night}`);
        monsters += visits.filter((v) => v.isMonster).length;
      }
    }
  }
  assert.ok(monsters > 10000);
});

test('FAIRNESS also holds for endless nights (every tool, all levels, outages)', () => {
  for (const difficulty of ['cozy', 'normal', 'nightmare']) {
    for (let seed = 1; seed <= 100; seed++) {
      const run = freshRun({ night: 1, difficulty, seed, mode: 'endless' });
      const rng = createRng(seed);
      for (let night = 1; night <= 25; night++) {
        run.night = night;
        run.rejectedReal = rng.shuffle(FIGURE_IDS).slice(0, rng.int(0, 3));
        const cfg = nightConfig(run);
        const visits = generateNight(run, cfg);
        assert.deepEqual(validateNight(run, cfg, visits), [], `${difficulty} s${seed} n${night}`);
        assert.ok(!visits.some((v) => v.type === 'faceless'));
      }
    }
  }
});

test('fairness fallback: hostile tell pools still produce usable tells', () => {
  const saved = FIGURES.map((f) => f.tells);
  try {
    // night 1 figures with ONLY level-3 shadow tells and an album-only level 2 tell: nothing usable in range
    for (const f of FIGURES) {
      f.tells = [
        { id: `${f.id}_sh`, level: 3, kind: 'visual', effect: 'shadowOnly', at: null, params: {}, revealedBy: 'flashlight', desc: 'shadow' },
        { id: `${f.id}_cd`, level: 3, kind: 'visual', effect: 'smoke', at: 'face', params: {}, revealedBy: 'candle', desc: 'candle' },
      ];
    }
    for (let seed = 1; seed <= 60; seed++) {
      for (const night of [1, 2, 4, 6, 7]) {
        const { run, cfg, visits } = gen(night, { seed, difficulty: seed % 2 ? 'normal' : 'cozy' });
        assert.deepEqual(validateNight(run, cfg, visits), [], `n${night} s${seed}`);
      }
    }
    for (const f of FIGURES) f.tells = [];
    const { run, cfg, visits } = gen(3, { seed: 4 });
    assert.deepEqual(validateNight(run, cfg, visits), []);
    assert.ok(visits.filter((v) => v.isMonster).every((v) => v.tells.length >= 1));
  } finally {
    FIGURES.forEach((f, i) => { f.tells = saved[i]; });
  }
});

test('FAIRNESS with randomised realistic tell pools (all levels, kinds, revealers, text tells)', () => {
  const saved = FIGURES.map((f) => f.tells);
  const rng = createRng(2024);
  const revealers = ['eye', 'album', 'flashlight', 'mirror', 'ear', 'text', 'behavior', 'candle'];
  const effects = ['drip', 'smear', 'mirrored', 'shadowOnly', 'knockExtra', 'typo', 'shout', 'textDrip', 'noBlink', 'tooClose', 'impatient'];
  try {
    for (let round = 0; round < 8; round++) {
      for (const f of FIGURES) {
        f.tells = Array.from({ length: rng.int(0, 6) }, (_, i) => {
          const effect = rng.pick(effects);
          const kind = ['typo', 'shout', 'textDrip'].includes(effect) ? 'text' : rng.pick(['visual', 'audio', 'behavior']);
          return { id: `${f.id}_r${round}_${i}`, level: rng.int(1, 3), kind, effect, at: 'face', params: {}, revealedBy: effect === 'shadowOnly' ? rng.pick(['flashlight', 'mirror', 'eye']) : rng.pick(revealers), desc: `tell ${i}` };
        });
      }
      for (let seed = 1; seed <= 25; seed++) {
        for (const night of [1, 2, 3, 4, 5, 6, 7]) {
          const { run, cfg, visits } = gen(night, { seed: seed + round * 100, difficulty: ['cozy', 'normal', 'nightmare'][seed % 3] });
          assert.deepEqual(validateNight(run, cfg, visits), [], `round${round} n${night} s${seed}`);
        }
      }
    }
  } finally { FIGURES.forEach((f, i) => { f.tells = saved[i]; }); }
});

test('shadowOnly tells are only usable when flashlight or mirror exists', () => {
  const t = { effect: 'shadowOnly', revealedBy: 'flashlight', level: 3 };
  assert.equal(tellUsable(t, { tools: ['album'] }), false);
  assert.equal(tellUsable(t, { tools: ['album', 'flashlight'] }), true);
  assert.equal(tellUsable({ ...t, revealedBy: 'eye' }, { tools: ['album'] }), false);
  assert.equal(tellUsable({ ...t, revealedBy: 'eye' }, { tools: ['mirror'] }), true);
  assert.equal(tellUsable({ effect: 'drip', revealedBy: 'candle' }, { tools: ['candle'], candle: false }), false);
  assert.equal(tellUsable({ effect: 'drip', revealedBy: 'candle' }, { tools: ['candle'], candle: true }), true);
  assert.equal(tellUsable({ effect: 'drip', revealedBy: 'album' }, { tools: [] }), false);
  assert.equal(tellUsable({ effect: 'drip', revealedBy: 'eye' }, { tools: [] }), true);
});

test('night 1 only uses nimi/bub/lume/zen/miso; honest oddities only from night 2', () => {
  const oddities = FIGURE_IDS.filter((id) => getFigure(id).honestOddity).length;
  const allowed = ['nimi', 'bub', 'lume', 'zen', 'miso'];
  const seen = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    for (const v of gen(1, { seed }).visits) assert.ok(allowed.includes(v.figureId), v.figureId);
    for (const v of gen(1, { seed, mode: 'endless' }).visits) assert.ok(!getFigure(v.figureId).honestOddity);
    for (const v of gen(2, { seed }).visits) if (getFigure(v.figureId).honestOddity) seen.add(v.figureId);
    for (const v of gen(5, { seed }).visits) if (getFigure(v.figureId).honestOddity) seen.add(v.figureId);
  }
  if (oddities) assert.ok(seen.size > 0, 'oddities should show up from night 2');
});

test('no figure repeats in a night except doppelganger / two-of-them pairs', () => {
  for (let seed = 1; seed <= 300; seed++) {
    for (let night = 1; night <= 7; night++) {
      const { run, cfg, visits } = gen(night, { seed });
      const bad = validateNight(run, cfg, visits).filter((p) => p.startsWith('duplicate'));
      assert.deepEqual(bad, []);
    }
  }
});

test('doppelgangers appear from night 3, copy an EARLIER real visitor, and do occur', () => {
  let count = 0; let pairs = 0;
  for (let seed = 1; seed <= 300; seed++) {
    assert.ok(!gen(2, { seed }).visits.some((v) => v.type === 'doppelganger'));
    for (const night of [3, 4, 5, 6, 7]) {
      const { visits } = gen(night, { seed });
      visits.forEach((v, i) => {
        if (v.type === 'doppelganger') {
          count++;
          assert.ok(visits.slice(0, i).some((u) => u.type === 'real' && u.figureId === v.figureId), 'needs earlier real');
          assert.equal(visits.filter((u) => u.figureId === v.figureId && u.type === 'doppelganger').length, 1);
        }
        if (v.type === 'real' && visits.slice(0, i).some((u) => u.type === 'imitator' && u.figureId === v.figureId)) pairs++;
      });
    }
    // night 3 introduces the doppelganger: guaranteed when 2 monsters are planned
    assert.ok(gen(3, { seed }).visits.some((v) => v.type === 'doppelganger'), 'night 3 doppelganger');
  }
  assert.ok(count > 300 && pairs > 50, `dopp ${count}, pairs ${pairs}`);
});

test('new types are introduced on their night: pusher 4, whisperer 6', () => {
  for (let seed = 1; seed <= 100; seed++) {
    assert.ok(gen(4, { seed }).visits.some((v) => v.type === 'pusher'));
    assert.ok(gen(6, { seed }).visits.some((v) => v.type === 'whisperer'));
    assert.ok(!gen(5, { seed }).visits.some((v) => v.type === 'whisperer'));
  }
  const p = gen(4, { seed: 2 }).visits.find((v) => v.type === 'pusher');
  assert.equal(p.patience, 30);
  assert.ok(p.tells.some((t) => t.effect === 'impatient' && t.kind === 'behavior'));
  assert.equal(gen(4, { seed: 2, difficulty: 'cozy' }).visits.find((v) => v.type === 'pusher').patience, 45);
  const w = gen(6, { seed: 2 }).visits.find((v) => v.type === 'whisperer');
  assert.equal(w.dark, true);
  assert.equal(w.answers, 'mixed');
});

test('faceless: last visit of story night 7, extra, never elsewhere', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const { cfg, visits } = gen(7, { seed });
    assert.equal(visits.length, cfg.visits + 1);
    const last = visits[visits.length - 1];
    assert.equal(last.type, 'faceless');
    assert.equal(last.figureId, 'faceless');
    assert.equal(last.isMonster, false);
    assert.deepEqual(last.tells, []);
    assert.equal(visits.filter((v) => v.type === 'faceless').length, 1);
    for (const n of [1, 2, 3, 4, 5, 6]) assert.ok(!gen(n, { seed }).visits.some((v) => v.type === 'faceless'));
  }
  assert.ok(!gen(7, { seed: 3, mode: 'endless' }).visits.some((v) => v.type === 'faceless'));
});

test('returners: scheduled after a real was turned away, count limits, they are monsters', () => {
  const rejected = ['nimi', 'bub', 'lume'];
  const setup = (run) => { run.rejectedReal = [...rejected]; };
  for (let seed = 1; seed <= 50; seed++) {
    assert.ok(!gen(1, { seed, setup }).visits.some((v) => v.type === 'returner'), 'none on night 1');
    for (const night of [2, 3, 4]) {
      const { cfg, visits } = gen(night, { seed, setup });
      const r = visits.filter((v) => v.type === 'returner');
      assert.equal(r.length, 1, `n${night} exactly 1 returner`);
      assert.equal(r[0].figureId, 'nimi', 'oldest first');
      assert.equal(r[0].isMonster, true);
      assert.equal(r[0].answers, 'truth');
      assert.equal(r[0].wrongChance, 0);
      assert.ok(r[0].tells.length >= 2 || getFigure('nimi').tells.length < 2);
      assert.ok(r[0].tells.some((t) => t.kind === 'visual'), 'visual tell');
      assert.equal(visits.filter((v) => v.isMonster).length, cfg.monsters);
      assert.equal(visits.filter((v) => v.figureId === 'nimi').length, 1);
    }
    for (const night of [5, 6, 7]) {
      assert.equal(gen(night, { seed, setup }).visits.filter((v) => v.type === 'returner').length, 2, `n${night}`);
    }
  }
});

test('returners already returned are not scheduled again; pendingReturners counts multiplicity', () => {
  const run = freshRun({ night: 3 });
  run.rejectedReal = ['nimi', 'bub'];
  run.returned = ['nimi'];
  assert.deepEqual(pendingReturners(run), ['bub']);
  run.rejectedReal.push('nimi'); // rejected again after returning
  assert.deepEqual(pendingReturners(run), ['nimi', 'bub']);
  run.rejectedReal.push('ghost'); // unknown figure ids are ignored
  assert.deepEqual(pendingReturners(run), ['nimi', 'bub']);
  const cfg = nightConfig(run);
  const visits = generateNight(run, cfg);
  assert.ok(visits.filter((v) => v.type === 'returner').every((v) => v.figureId !== 'ghost'));
});

test('tells: pool membership, level range, textTell, candle odds, wrong chance', () => {
  let candleMonster = 0; let monsters = 0; let candleReal = 0; let reals = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const { cfg, visits } = gen(4, { seed });
    for (const v of visits) {
      const f = getFigure(v.figureId);
      if (v.isMonster) {
        monsters++; if (v.candleFlicker) candleMonster++;
        for (const t of v.tells) {
          assert.ok(f.tells.some((p) => p.id === t.id) || t.id.endsWith('_impatient') || t.id.endsWith('_generic'), `tell ${t.id} from pool`);
        }
        const lvl = Math.max(...v.tells.map((t) => t.level));
        const expect = { 1: 0.7, 2: 0.5, 3: 0.3 }[lvl];
        if (v.answers === 'mixed') assert.equal(v.wrongChance, expect);
        const txt = v.tells.find((t) => t.kind === 'text');
        assert.equal(v.textTell, txt && ['textDrip', 'typo', 'shout'].includes(txt.effect) ? txt.effect : null);
      } else {
        reals++; if (v.candleFlicker) candleReal++;
        assert.equal(v.textTell, null);
        assert.equal(v.knock, 'real');
      }
    }
  }
  assert.ok(candleMonster / monsters > 0.78 && candleMonster / monsters < 0.92);
  assert.ok(candleReal / reals > 0.04 && candleReal / reals < 0.2);
});

test('Zipp real visitors always flicker the candle', () => {
  const zipp = getFigure('zipp');
  const saved = zipp.honestOddity;
  zipp.honestOddity = zipp.honestOddity ?? { effect: 'wind', note: 'x' };
  try {
    let n = 0;
    for (let seed = 1; seed <= 400 && n < 5; seed++) {
      for (const v of gen(6, { seed }).visits) {
        if (v.figureId === 'zipp' && !v.isMonster) { assert.equal(v.candleFlicker, true); n++; }
      }
    }
    assert.ok(n > 0);
  } finally { zipp.honestOddity = saved; }
});

test('shadowFlicker only for level-3 monsters', () => {
  let l3 = 0;
  for (let seed = 1; seed <= 200; seed++) {
    for (const v of gen(5, { seed }).visits) {
      const max = v.tells.length ? Math.max(...v.tells.map((t) => t.level)) : 0;
      assert.equal(v.shadowFlicker, max >= 3);
      if (v.shadowFlicker) l3++;
    }
    for (const v of gen(5, { seed, difficulty: 'cozy' }).visits) assert.equal(v.shadowFlicker, false);
  }
  assert.ok(FIGURES.some((f) => f.tells.some((t) => t.level === 3)) ? l3 > 0 : true);
});

test('prepareVisit: doppelganger whose original is not inside becomes an imitator', () => {
  const run = freshRun({ night: 4 });
  const d = mkVisit({ type: 'doppelganger', figureId: 'bub' });
  const p = prepareVisit(run, d);
  assert.equal(p.type, 'imitator');
  assert.equal(p.insideConflict, null);
  assert.equal(d.type, 'doppelganger', 'input is not mutated');
  assert.notEqual(p, d);
  assert.equal(p.isMonster, true);
});

test('prepareVisit: doppelganger whose original really is inside -> insideIsMonster false', () => {
  const run = freshRun({ night: 4 });
  run.guests = ['bub'];
  const p = prepareVisit(run, mkVisit({ type: 'doppelganger', figureId: 'bub' }));
  assert.equal(p.type, 'doppelganger');
  assert.deepEqual(p.insideConflict, { insideIsMonster: false });
});

test('prepareVisit: real visitor whose imitator is already inside -> insideIsMonster true', () => {
  const run = freshRun({ night: 5 });
  run.monstersInside = [{ id: 'a', figureId: 'bub', type: 'imitator', tells: [] }];
  const p = prepareVisit(run, mkVisit({ type: 'real', figureId: 'bub' }));
  assert.deepEqual(p.insideConflict, { insideIsMonster: true });
  assert.equal(p.type, 'real');
  const q = prepareVisit(run, mkVisit({ type: 'real', figureId: 'nimi' }));
  assert.equal(q.insideConflict, null);
  assert.equal(prepareVisit(run, mkVisit({ type: 'faceless', figureId: 'faceless' })).insideConflict, null);
});

test('prepareVisit: caught imitator -> no conflict for the later real', () => {
  const run = freshRun({ night: 5 });
  assert.equal(prepareVisit(run, mkVisit({ type: 'real', figureId: 'bub' })).insideConflict, null);
});

test('robustness: unknown ids in rejectedReal, nights > 7, empty tells', () => {
  const run = freshRun({ night: 12, seed: 5 });
  run.rejectedReal = ['nope', 'alsoNope'];
  const cfg = nightConfig(run);
  const visits = generateNight(run, cfg);
  assert.deepEqual(validateNight(run, cfg, visits), []);
});

await done('visits');
