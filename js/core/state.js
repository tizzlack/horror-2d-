// Global game state + persistence. Shape is documented in docs/ARCHITECTURE.md.
// Rules logic lives in js/systems/rules.js; this file only creates, stores and loads state.
import { DIFFICULTY } from '../data/difficulty.js';
import { bus } from './bus.js';

const KEYS = {
  run: 'sameshape.v1.run',
  album: 'sameshape.v1.album',
  settings: 'sameshape.v1.settings',
};

export const DEFAULT_SETTINGS = {
  master: 0.8,
  music: 0.6,
  sfx: 0.9,
  reduceScares: false,
  captions: false,
  textScale: 1,
  lastDifficulty: 'normal',
};

export function emptyAlbum() {
  return {
    met: {},          // figureId -> true (standard page stamped "MET")
    monsters: {},     // figureId -> { night, how: 'caught'|'jumpscare'|'returner', tell: string|null }
    facts: {},        // figureId -> [factIndex,...] extra facts unlocked (index 0 is always known)
    rewards: {},      // '25' | '50' | '75' | '100' -> true
    endings: {},      // endingId -> true
    endlessBest: 0,
    runsStarted: 0,
    runsFinished: 0,
  };
}

export const store = {
  run: null,
  album: emptyAlbum(),
  settings: { ...DEFAULT_SETTINGS },
};

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode, previews). The game still runs in memory.
  }
}

export function loadAll() {
  store.settings = { ...DEFAULT_SETTINGS, ...(read(KEYS.settings) ?? {}) };
  store.album = { ...emptyAlbum(), ...(read(KEYS.album) ?? {}) };
  const run = read(KEYS.run);
  store.run = run && run.version === 1 ? run : null;
}

export function saveAll() {
  write(KEYS.settings, store.settings);
  write(KEYS.album, store.album);
  write(KEYS.run, store.run);
}

export function saveSettings() {
  write(KEYS.settings, store.settings);
  bus.emit('settings', store.settings);
}

export function clearRun() {
  store.run = null;
  write(KEYS.run, null);
}

export function resetProgress() {
  store.album = emptyAlbum();
  store.run = null;
  write(KEYS.album, store.album);
  write(KEYS.run, null);
  bus.emit('album', store.album);
}

/** Create a fresh run. The rules engine may adjust it further (rules.startRun). */
export function newRun({ mode = 'story', difficulty = 'normal', seed = Math.floor(Math.random() * 2 ** 31) } = {}) {
  const diff = DIFFICULTY[difficulty] ?? DIFFICULTY.normal;
  store.run = {
    version: 1,
    mode,                 // 'story' | 'endless'
    difficulty: diff.id,
    seed,
    rngState: seed,       // updated by the rules engine between phases
    night: 1,
    phase: 'note',        // 'note' | 'night' | 'morning' | 'day' | 'ending'
    flames: diff.flames,
    maxFlames: diff.flames,
    beds: 4,
    maxBeds: 6,
    battery: 100,
    door: 3,
    maxDoor: 3,
    actionsLeft: 3,
    saved: 0,             // real figures saved, whole run
    guests: [],           // real figures admitted in the current/last night (day residents)
    monstersInside: [],   // monster visits admitted in the current night
    rejectedReal: [],     // real figures turned away; they come back as returners
    returned: [],         // returners that already came back
    met: [],              // real figures met this run
    nightLog: [],         // results of the current night, see ARCHITECTURE.md
    history: [],          // one summary object per finished night
    lastReport: null,     // last morning report
    openedFaceless: null, // true/false once decided in night 7
    endingId: null,
    stats: { monstersCaught: 0, monstersAdmitted: 0, realRejected: 0, realSaved: 0 },
  };
  store.settings.lastDifficulty = diff.id;
  store.album.runsStarted = (store.album.runsStarted ?? 0) + 1;
  saveAll();
  return store.run;
}

/** Fact indices the player knows for a figure (fact 0 comes from Chalk's notes). */
export function knownFacts(figureId) {
  return [0, ...(store.album.facts[figureId] ?? [])].filter((v, i, a) => a.indexOf(v) === i).sort();
}

/** Album completion in percent: met pages + monster pages over 2 per figure. */
export function albumCompletion(figureIds) {
  const total = figureIds.length * 2;
  if (!total) return 0;
  const met = figureIds.filter((id) => store.album.met[id]).length;
  const monsters = figureIds.filter((id) => store.album.monsters[id]).length;
  return Math.round(((met + monsters) / total) * 100);
}

export function difficultyOf(run = store.run) {
  return DIFFICULTY[run?.difficulty] ?? DIFFICULTY.normal;
}
