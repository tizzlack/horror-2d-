// Full-run simulations: nothing may throw, invariants must hold, all four endings must be reachable.
// Prints ending / saved-count distributions (run `node tests/sim.test.mjs`).
import { test, assert, done } from './harness.mjs';
import { playRun, store } from './util.mjs';

const RUNS = Number(process.env.SIM_RUNS ?? 2000);

function checkRun(run, reports) {
  assert.ok(run.flames >= 0 && run.flames <= run.maxFlames, `flames ${run.flames}`);
  assert.ok(run.saved >= 0 && (run.mode === 'endless' || run.saved <= 60), `saved ${run.saved}`);
  assert.ok(run.beds >= 4 && run.beds <= run.maxBeds);
  assert.ok(run.door >= 0 && run.door <= run.maxDoor);
  assert.ok(run.battery >= 0 && run.battery <= 100);
  for (const r of reports) {
    assert.ok(r.flames >= 0);
    assert.ok(r.lost.length <= r.admitted.length);
    assert.equal(r.jumpscare === null, r.admitted.length === 0);
    assert.equal(r.gameOver, r.flames <= 0);
  }
  JSON.parse(JSON.stringify(run)); // run state stays serialisable
}

function dist(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return { mean: +mean.toFixed(1), min: sorted[0], p10: q(0.1), median: q(0.5), p90: q(0.9), max: sorted[sorted.length - 1] };
}

function batch(label, opts, n = RUNS) {
  const endings = {}; const saved = []; const nights = [];
  for (let seed = 1; seed <= n; seed++) {
    const difficulty = opts.difficulty ?? ['cozy', 'normal', 'nightmare'][seed % 3];
    const { run, reports, problems } = playRun({ ...opts, difficulty, seed });
    assert.deepEqual(problems, [], `${label} seed ${seed}`);
    checkRun(run, reports);
    const e = reports.at(-1).endingId ?? 'none';
    endings[e] = (endings[e] ?? 0) + 1;
    saved.push(run.saved); nights.push(reports.length);
  }
  console.log(`    [${label}] ${n} runs  endings: ${JSON.stringify(endings)}  saved: ${JSON.stringify(dist(saved))}  nights: ${JSON.stringify(dist(nights))}`);
  return { endings, saved };
}

test(`random player: ${RUNS} full story runs without errors`, () => { batch('random/story/mixed', { policy: 'random', faceless: 'random' }); });

test('random player per difficulty', () => {
  for (const difficulty of ['cozy', 'normal', 'nightmare']) batch(`random/${difficulty}`, { policy: 'random', faceless: 'random', difficulty }, 700);
});

test('perfect player (opens for the faceless): saved distribution and endings', () => {
  const res = {};
  for (const difficulty of ['cozy', 'normal', 'nightmare']) res[difficulty] = batch(`perfect-open/${difficulty}`, { policy: 'perfect', faceless: 'open', difficulty }, 700);
  for (const d of Object.keys(res)) {
    assert.ok(res[d].endings.lanternOut === undefined, `perfect player never loses the lantern (${d})`);
    assert.ok((res[d].endings.twoSouls ?? 0) > 0.9 * 700, `twoSouls is reachable for a perfect player (${d})`);
  }
});

test('perfect player refusing the faceless gets "dawn"', () => {
  const { endings } = batch('perfect-refuse', { policy: 'perfect', faceless: 'refuse' }, 300);
  assert.equal(endings.dawn, 300);
});

test('all four endings are reachable in scripted runs', () => {
  assert.equal(playRun({ policy: 'admitAll', difficulty: 'nightmare', seed: 5 }).reports.at(-1).endingId, 'lanternOut');
  assert.equal(playRun({ policy: 'perfect', faceless: 'refuse', seed: 5 }).reports.at(-1).endingId, 'dawn');
  assert.equal(playRun({ policy: 'perfect', faceless: 'open', seed: 5 }).reports.at(-1).endingId, 'twoSouls');
  const fog = playRun({ policy: 'rejectAll', faceless: 'open', seed: 5 });
  assert.equal(fog.reports.at(-1).endingId, 'newFog');
  assert.equal(fog.run.saved, 0);
  for (const id of ['lanternOut', 'dawn', 'twoSouls', 'newFog']) assert.equal(store.album.endings[id] ?? true, true);
});

test('twoSouls threshold (20) is reachable: perfect-player saved counts leave headroom', () => {
  const saved = [];
  for (let seed = 1; seed <= 400; seed++) saved.push(playRun({ policy: 'perfect', faceless: 'open', seed }).run.saved);
  const d = dist(saved);
  console.log(`    perfect-player saved over 400 runs: ${JSON.stringify(d)}`);
  assert.ok(d.min >= 20, `min saved ${d.min}`);
});

test('skilled players (right 90 / 80 / 70 % of the time, opening for the faceless)', () => {
  for (const acc of [0.9, 0.8, 0.7]) batch(`skilled ${acc}`, { policy: `skilled:${acc}`, faceless: 'open', difficulty: 'normal' }, 700);
});

test('endless: random and perfect players survive 40 nights without errors; best score tracked', () => {
  for (const policy of ['random', 'perfect']) {
    const saved = []; const nights = [];
    for (let seed = 1; seed <= 150; seed++) {
      const difficulty = ['cozy', 'normal', 'nightmare'][seed % 3];
      const { run, reports, problems } = playRun({ policy, mode: 'endless', difficulty, seed, maxNights: 40 });
      assert.deepEqual(problems, [], `endless ${policy} seed ${seed}`);
      checkRun(run, reports);
      assert.ok(store.album.endlessBest >= run.saved);
      saved.push(run.saved); nights.push(reports.length);
    }
    console.log(`    [endless ${policy}] saved ${JSON.stringify(dist(saved))} nights ${JSON.stringify(dist(nights))}`);
  }
});

await done('sim');
