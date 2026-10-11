import { test, assert, done } from './harness.mjs';
import { freshRun, nightConfig } from './util.mjs';
import { STORY_NIGHTS } from '../js/data/nights.js';
import { DIFFICULTY } from '../js/data/difficulty.js';

const cfgFor = (night, difficulty = 'normal', seed = 1, mode = 'story') => nightConfig(freshRun({ night, difficulty, seed, mode }));

test('STORY_NIGHTS has 7 entries following the GDD table', () => {
  assert.equal(STORY_NIGHTS.length, 7);
  assert.deepEqual(STORY_NIGHTS.map((n) => n.visits), [4, 5, 6, 6, 7, 7, 8]);
});

test('visits, tell levels, tools and events per story night (normal)', () => {
  const tools = {
    1: ['album', 'questions'],
    2: ['album', 'questions', 'flashlight'],
    3: ['album', 'questions', 'residents', 'flashlight'],
    4: ['album', 'questions', 'residents', 'flashlight', 'mirror'],
    5: ['album', 'questions', 'residents', 'flashlight', 'mirror', 'callToDoor'],
    6: ['album', 'questions', 'residents', 'flashlight', 'mirror', 'candle', 'callToDoor'],
  };
  tools[7] = tools[6];
  const levels = { 1: [1, 1], 2: [1, 2], 3: [1, 2], 4: [2, 3], 5: [2, 3], 6: [2, 3], 7: [1, 3] };
  const visits = { 1: 4, 2: 5, 3: 6, 4: 6, 5: 7, 6: 7, 7: 8 };
  for (let n = 1; n <= 7; n++) {
    const c = cfgFor(n);
    assert.equal(c.night, n);
    assert.equal(c.visits, visits[n], `visits n${n}`);
    assert.deepEqual(c.tellLevels, levels[n], `levels n${n}`);
    assert.deepEqual([...c.tools].sort(), [...tools[n]].sort(), `tools n${n}`);
    assert.equal(c.patience, 60);
    assert.equal(c.pusherPatience, 30);
    assert.equal(c.mirrorUses, 3);
    assert.equal(c.candle, n >= 6);
    assert.equal(c.flashlightUses, n === 5 ? 2 : null);
    assert.equal(c.events.includes('powerOutage'), n === 5);
    assert.equal(c.events.includes('twoOfThem'), n >= 5);
    assert.equal(c.events.includes('finale'), n === 7);
    assert.equal(c.endless, false);
  }
  assert.ok(cfgFor(5).tools.includes('callToDoor'));
  assert.ok(!cfgFor(4).tools.includes('callToDoor'));
});

test('monster counts stay inside the GDD ranges (normal) over many seeds', () => {
  const range = { 1: [1, 1], 2: [1, 2], 3: [2, 2], 4: [2, 2], 5: [2, 3], 6: [3, 3], 7: [3, 4] };
  for (let seed = 1; seed <= 100; seed++) {
    for (let n = 1; n <= 7; n++) {
      const m = cfgFor(n, 'normal', seed).monsters;
      assert.ok(m >= range[n][0] && m <= range[n][1], `n${n} seed${seed} monsters ${m}`);
    }
  }
});

test('types are unlocked cumulatively', () => {
  assert.deepEqual(cfgFor(1).types, ['imitator']);
  assert.ok(cfgFor(2).types.includes('returner') && !cfgFor(2).types.includes('doppelganger'));
  assert.ok(cfgFor(3).types.includes('doppelganger') && !cfgFor(3).types.includes('pusher'));
  assert.ok(cfgFor(4).types.includes('pusher') && !cfgFor(4).types.includes('whisperer'));
  assert.ok(cfgFor(6).types.includes('whisperer'));
  assert.ok(cfgFor(7).types.includes('faceless'));
});

test('difficulty: patience, tell-level cap, candle, flames-independent config', () => {
  for (const [id, d] of Object.entries(DIFFICULTY)) {
    for (let n = 1; n <= 7; n++) {
      const c = cfgFor(n, id);
      assert.equal(c.patience, d.patience);
      assert.equal(c.pusherPatience, d.pusherPatience);
      assert.ok(c.tellLevels[1] <= d.maxTellLevel);
      assert.ok(c.tellLevels[0] <= c.tellLevels[1]);
      assert.equal(c.tools.includes('candle'), d.candle && n >= 6);
      assert.equal(c.candle, d.candle && n >= 6);
    }
  }
  assert.deepEqual(cfgFor(4, 'cozy').tellLevels, [2, 2]);
  assert.deepEqual(cfgFor(7, 'cozy').tellLevels, [1, 2]);
  assert.deepEqual(cfgFor(7, 'nightmare').tellLevels, [1, 3]);
  assert.ok(!cfgFor(6, 'nightmare').tools.includes('candle'));
});

test('monsterRatioBonus shifts monster counts the right way', () => {
  const avg = (id, n) => { let s = 0; for (let seed = 1; seed <= 400; seed++) s += cfgFor(n, id, seed).monsters; return s / 400; };
  for (const n of [2, 3, 5, 6, 7]) {
    assert.ok(avg('cozy', n) <= avg('normal', n) + 1e-9, `cozy n${n}`);
    assert.ok(avg('nightmare', n) >= avg('normal', n) - 1e-9, `nightmare n${n}`);
  }
  assert.ok(avg('nightmare', 5) > avg('cozy', 5));
  assert.equal(avg('nightmare', 1), 1); // tutorial night is untouched
});

test('nightConfig is pure: same run -> same config, does not touch rngState', () => {
  const run = freshRun({ night: 5, seed: 99 });
  const before = run.rngState;
  assert.deepEqual(nightConfig(run), nightConfig(run));
  assert.equal(run.rngState, before);
});

test('endless config: all tools, ratio rising, visits capped, no finale', () => {
  let prevRatio = 0;
  for (let n = 1; n <= 40; n++) {
    const c = cfgFor(n, 'normal', 3, 'endless');
    assert.equal(c.endless, true);
    assert.equal(c.visits, Math.min(10, 6 + Math.floor(n / 2)));
    assert.deepEqual([...c.tools].sort(), ['album', 'callToDoor', 'candle', 'flashlight', 'mirror', 'questions', 'residents']);
    assert.ok(!c.events.includes('finale'));
    assert.ok(!c.types.includes('faceless'));
    assert.deepEqual(c.tellLevels, [1, 3]);
    assert.ok(c.monsters >= 1 && c.monsters <= c.visits - 2);
    const ratio = c.monsters / c.visits;
    if (n >= 20) assert.ok(ratio >= 0.4 && ratio <= 0.65, `late ratio ${ratio}`);
    prevRatio = ratio;
    assert.equal(c.flashlightUses, c.events.includes('powerOutage') ? 2 : null);
  }
  assert.ok(prevRatio > 0.4);
  assert.equal(cfgFor(1, 'normal', 3, 'endless').visits, 6);
  assert.equal(cfgFor(8, 'normal', 3, 'endless').visits, 10);
  assert.equal(cfgFor(30, 'nightmare', 3, 'endless').tools.includes('candle'), false);
  assert.equal(cfgFor(30, 'cozy', 3, 'endless').tellLevels[1], 2);
});

test('endless events occur occasionally, not always', () => {
  let outage = 0; let two = 0;
  for (let n = 2; n <= 200; n++) {
    const c = cfgFor(n, 'normal', 11, 'endless');
    if (c.events.includes('powerOutage')) outage++;
    if (c.events.includes('twoOfThem')) two++;
  }
  assert.ok(outage > 5 && outage < 100, `outage ${outage}`);
  assert.ok(two > 20 && two < 150, `two ${two}`);
});

test('story night > 7 falls back to endless-style config without crashing', () => {
  const c = cfgFor(9);
  assert.ok(c.visits >= 6 && !c.events.includes('finale'));
});

await done('config');
