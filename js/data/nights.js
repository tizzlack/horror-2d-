// Night configuration: the 7 story nights (GDD "Nights") and generated endless nights.
// Pure data + one pure function. nightConfig(run) is a deterministic function of
// (run.seed, run.night, run.mode, run.difficulty): it does NOT consume run.rngState, so the
// screens can call it as often as they like (also after a reload) and get the same config.
import { hashString, createRng } from '../core/rng.js';
import { difficultyOf } from '../core/state.js';

export const ALL_TOOLS = ['album', 'questions', 'residents', 'flashlight', 'mirror', 'candle', 'callToDoor'];

/** Types a night may use, in order of introduction (the faceless is the night-7 finale). */
export const STORY_NIGHTS = [
  { night: 1, visits: 4, monsters: [1, 1], tellLevels: [1, 1], newTools: ['album', 'questions'],
    types: ['imitator'], events: [], theme: "Let no one in you don't recognise." },
  { night: 2, visits: 5, monsters: [1, 2], tellLevels: [1, 2], newTools: ['flashlight'],
    types: ['imitator', 'returner'], events: [], theme: 'The shadow never lies.' },
  { night: 3, visits: 6, monsters: [2, 2], tellLevels: [1, 2], newTools: ['residents'],
    types: ['imitator', 'returner', 'doppelganger'], events: [], theme: 'Someone at the door twice.' },
  { night: 4, visits: 6, monsters: [2, 2], tellLevels: [2, 3], newTools: ['mirror'],
    types: ['imitator', 'returner', 'doppelganger', 'pusher'], events: [], theme: 'A voice in the fog.' },
  { night: 5, visits: 7, monsters: [2, 3], tellLevels: [2, 3], newTools: ['callToDoor'],
    types: ['imitator', 'returner', 'doppelganger', 'pusher'], events: ['powerOutage', 'twoOfThem'],
    theme: 'He wants to find the shadow.' },
  { night: 6, visits: 7, monsters: [3, 3], tellLevels: [2, 3], newTools: ['candle'],
    types: ['imitator', 'returner', 'doppelganger', 'pusher', 'whisperer'], events: ['twoOfThem'],
    theme: 'Shaky handwriting.' },
  // Night 7: 8 regular visits; the faceless is an EXTRA 9th visit (always last).
  { night: 7, visits: 8, monsters: [3, 4], tellLevels: [1, 3], newTools: [],
    types: ['imitator', 'returner', 'doppelganger', 'pusher', 'whisperer', 'faceless'],
    events: ['twoOfThem', 'finale'], theme: 'The last note.' },
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function configRng(run, night) {
  return createRng(hashString(`${run.seed ?? 0}:cfg:${night}:${run.mode ?? 'story'}`));
}

function storyTools(night, diff) {
  const set = new Set();
  for (const s of STORY_NIGHTS) if (s.night <= night) s.newTools.forEach((t) => set.add(t));
  if (!diff.candle) set.delete('candle');
  return ALL_TOOLS.filter((t) => set.has(t));
}

function capLevels([lo, hi], cap) {
  const h = Math.min(hi, cap);
  return [Math.min(lo, h), h];
}

/** Number of monsters for a story night, shifted a little by difficulty.monsterRatioBonus. */
function storyMonsters(s, diff, rng) {
  const [lo, hi] = s.monsters;
  if (s.night === 1) return lo; // tutorial night stays at one monster
  const shift = (diff.monsterRatioBonus ?? 0) * s.visits;
  let n;
  if (hi > lo) {
    n = rng.chance(clamp(0.5 + shift, 0.1, 0.9)) ? hi : lo;
  } else {
    n = lo;
    if (shift !== 0 && rng.chance(Math.abs(shift))) n += Math.sign(shift);
  }
  return clamp(n, 1, s.visits - 2);
}

/** Endless mode types ramp with the night number. */
function endlessTypes(night) {
  const types = ['imitator'];
  if (night >= 2) types.push('returner', 'doppelganger');
  if (night >= 3) types.push('pusher');
  if (night >= 4) types.push('whisperer');
  return types;
}

export function nightConfig(run) {
  const diff = difficultyOf(run);
  const night = Math.max(1, Math.floor(run?.night ?? 1));
  const endless = run?.mode === 'endless' || night > STORY_NIGHTS.length;
  const rng = configRng(run ?? {}, night);
  const base = { night, patience: diff.patience, pusherPatience: diff.pusherPatience, mirrorUses: 3, endless };

  if (!endless) {
    const s = STORY_NIGHTS[night - 1];
    const tools = storyTools(night, diff);
    const events = [...s.events];
    return {
      ...base,
      visits: s.visits,
      monsters: storyMonsters(s, diff, rng),
      tellLevels: capLevels(s.tellLevels, diff.maxTellLevel),
      tools,
      types: [...s.types],
      events,
      candle: tools.includes('candle'),
      flashlightUses: events.includes('powerOutage') ? 2 : null,
    };
  }

  // Endless: all tools from night 1, occasional events, never a finale / faceless.
  const tools = ALL_TOOLS.filter((t) => t !== 'candle' || diff.candle);
  const visits = Math.min(10, 6 + Math.floor(night / 2));
  const ratio = clamp(0.35 + (night - 1) * 0.02, 0.35, 0.55) + (diff.monsterRatioBonus ?? 0);
  const monsters = clamp(Math.round(visits * ratio), 1, visits - 2);
  const events = [];
  if (night >= 2 && rng.chance(0.18)) events.push('powerOutage');
  if (night >= 2 && rng.chance(0.35)) events.push('twoOfThem');
  return {
    ...base,
    visits,
    monsters,
    tellLevels: [1, diff.maxTellLevel],
    tools,
    types: endlessTypes(night),
    events,
    candle: tools.includes('candle'),
    flashlightUses: events.includes('powerOutage') ? 2 : null,
  };
}
