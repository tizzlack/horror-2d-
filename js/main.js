// Same Shape — boot + screen router. Owned by the lead; see docs/ARCHITECTURE.md.
import { bus } from './core/bus.js';
import { store, loadAll, saveAll, newRun, clearRun } from './core/state.js';
import { h, sleep } from './core/dom.js';

const STAGE_W = 1280;
const STAGE_H = 720;

const stage = document.getElementById('stage');
const root = document.getElementById('screen');
const overlay = document.getElementById('overlay');
const captions = document.getElementById('captions');

const params = new URLSearchParams(location.search);

// ---------- Stage scaling (fixed 1280x720 logical stage, letterboxed) ----------
function fitStage() {
  const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
  stage.style.transform = `scale(${scale})`;
  stage.dataset.scale = String(scale);
}
window.addEventListener('resize', fitStage);
fitStage();

/** Convert a pointer event's client coordinates into stage coordinates. */
export function toStage(clientX, clientY) {
  const rect = stage.getBoundingClientRect();
  const scale = rect.width / STAGE_W;
  return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
}

// ---------- Audio (loaded lazily; falls back to a silent stub) ----------
const silent = new Proxy({}, {
  get: (_t, prop) => (prop === 'ready' ? false : () => Promise.resolve()),
});
let audio = silent;
async function loadAudio() {
  try {
    const mod = await import('./systems/audio.js');
    audio = mod.audio ?? silent;
    ctx.audio = audio;
  } catch (err) {
    console.warn('[main] audio module unavailable, running silent', err);
  }
}
// Browsers only allow audio after a user gesture.
let audioUnlocked = false;
window.addEventListener('pointerdown', () => {
  if (audioUnlocked) return;
  audioUnlocked = true;
  try { audio.init?.(); } catch (err) { console.warn(err); }
}, { capture: true });
window.addEventListener('keydown', () => {
  if (audioUnlocked) return;
  audioUnlocked = true;
  try { audio.init?.(); } catch (err) { console.warn(err); }
}, { capture: true });

// ---------- Captions ----------
bus.on('caption', (text) => {
  if (!store.settings.captions || !text) return;
  const el = h('div', { class: 'caption' }, text);
  captions.append(el);
  setTimeout(() => el.remove(), 2900);
  while (captions.children.length > 3) captions.firstChild.remove();
});

// ---------- Settings that affect the whole stage ----------
function applySettings() {
  stage.style.setProperty('--text-scale', String(store.settings.textScale ?? 1));
  stage.classList.toggle('reduce-scares', !!store.settings.reduceScares);
  try { audio.setVolumes?.(store.settings); } catch (err) { console.warn(err); }
}
bus.on('settings', applySettings);

// ---------- Router ----------
let current = null;
let currentName = null;
let navigating = Promise.resolve();

/** Context object handed to every screen's mount(). */
const ctx = {
  go,
  bus,
  store,
  get audio() { return audio; },
  set audio(v) { audio = v; },
  save: saveAll,
  stage,
  overlay,
  params,
  toStage,
  /** Set the overall mood; CSS uses [data-mood] on the stage. */
  setMood(mood) { stage.dataset.mood = mood; },
};

/**
 * Navigate to a screen. Screens live in js/screens/<name>.js and export default
 * { mount(root, params, ctx), unmount?() }.
 */
export function go(name, screenParams = {}) {
  navigating = navigating.then(() => navigate(name, screenParams)).catch((err) => {
    console.error('[router] navigation failed', err);
  });
  return navigating;
}

async function navigate(name, screenParams) {
  if (current?.unmount) {
    try { await current.unmount(); } catch (err) { console.error(`[router] unmount ${currentName} failed`, err); }
  }
  if (currentName) {
    root.classList.add('fade-out');
    await sleep(300);
  }
  root.classList.remove('fade-out');
  root.replaceChildren();
  overlay.replaceChildren();
  root.className = 'screen-root';
  let mod;
  try {
    mod = await import(`./screens/${name}.js`);
  } catch (err) {
    showError(`Screen "${name}" could not be loaded.\n\n${err?.stack ?? err}`);
    current = null;
    currentName = name;
    return;
  }
  current = mod.default;
  currentName = name;
  stage.dataset.screen = name;
  root.dataset.screen = name;
  root.classList.add('fade-in');
  setTimeout(() => root.classList.remove('fade-in'), 500);
  // Don't await mount: screens may run long intros inside it, and the next go()
  // must not wait for them.
  try {
    Promise.resolve(current.mount(root, screenParams, ctx)).catch((err) => {
      showError(`Screen "${name}" crashed while mounting.\n\n${err?.stack ?? err}`);
    });
  } catch (err) {
    showError(`Screen "${name}" crashed while mounting.\n\n${err?.stack ?? err}`);
  }
  bus.emit('screen', name);
}

function showError(message) {
  console.error(message);
  root.append(h('div', { class: 'screen-error' }, message, '\n\n', h('button', { class: 'btn small', onclick: () => go('menu') }, 'Back to menu')));
}

window.addEventListener('error', (e) => console.error('[uncaught]', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => console.error('[unhandled rejection]', e.reason));

// ---------- Boot ----------
async function boot() {
  if (params.has('reset')) {
    try { localStorage.clear(); } catch { /* ignore */ }
  }
  loadAll();
  await loadAudio();
  applySettings();

  // Developer / test entry: ?screen=night&night=3&seed=42&difficulty=normal&mode=story
  const devScreen = params.get('screen');
  if (devScreen) {
    const runScreens = ['note', 'night', 'morning', 'day', 'ending'];
    if (runScreens.includes(devScreen) && (!store.run || params.has('fresh') || params.has('night'))) {
      newRun({
        mode: params.get('mode') ?? 'story',
        difficulty: params.get('difficulty') ?? 'normal',
        seed: Number(params.get('seed') ?? 12345),
      });
      store.run.night = Number(params.get('night') ?? 1);
      store.run.phase = devScreen;
    }
    const extra = Object.fromEntries(params.entries());
    await go(devScreen, extra);
    return;
  }
  await go('menu');
}

// Exposed for automated tests and debugging.
window.__SS = { ctx, go, store, newRun, clearRun, get screen() { return currentName; } };

boot();
