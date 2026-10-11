// Settings: volume sliders, comfort toggles, text size, reset. Also usable as an overlay
// (night pause menu) through openSettingsOverlay().
import { h, svg, modal } from '../core/dom.js';
import { store, saveSettings, resetProgress } from '../core/state.js';

const SIZES = [
  { value: 1, label: 'Normal' },
  { value: 1.15, label: 'Large' },
  { value: 1.3, label: 'Larger' },
];

function slider(ctx, key, label, hint) {
  const out = h('span', { class: 'set-value' });
  const input = h('input', {
    class: 'set-range', type: 'range', min: 0, max: 100, step: 5, id: `set-${key}`,
    'aria-label': label,
  });
  const paint = () => {
    const pct = Math.round((store.settings[key] ?? 0) * 100);
    input.value = String(pct);
    input.style.setProperty('--p', `${pct}%`);
    out.textContent = `${pct}%`;
  };
  input.addEventListener('input', () => {
    store.settings[key] = Number(input.value) / 100;
    saveSettings();
    paint();
  });
  input.addEventListener('change', () => ctx.audio.sfx?.(key === 'music' ? 'chime' : 'uiClick'));
  paint();
  return h('div', { class: 'set-row set-slider' },
    h('label', { for: `set-${key}` }, h('span', { class: 'set-label' }, label), hint && h('small', {}, hint)),
    h('div', { class: 'set-range-wrap' }, input, out));
}

function toggle(ctx, key, label, hint) {
  const btn = h('button', { class: 'set-switch', type: 'button', role: 'switch', id: `set-${key}`, 'aria-label': label });
  const box = svg('svg', { viewBox: '0 0 44 44', width: 38, height: 38, class: 'set-box', 'aria-hidden': 'true' },
    svg('path', { d: 'M7 8 L37 6 L38 37 L6 38 Z', fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-linejoin': 'round' }),
    svg('path', { class: 'set-check', d: 'M10 22 L19 32 L38 7', fill: 'none', stroke: '#a3231b', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  btn.append(box);
  const paint = () => {
    const on = !!store.settings[key];
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
    btn.classList.toggle('is-on', on);
  };
  btn.addEventListener('click', () => {
    store.settings[key] = !store.settings[key];
    saveSettings();
    paint();
    ctx.audio.sfx?.('uiClick');
    if (key === 'captions' && store.settings.captions) ctx.bus.emit('caption', '*caption test: a soft knock*');
  });
  paint();
  return h('div', { class: 'set-row set-toggle' },
    h('label', { for: `set-${key}`, onclick: () => btn.click() }, h('span', { class: 'set-label' }, label), hint && h('small', {}, hint)),
    btn);
}

function textSize(ctx) {
  const buttons = SIZES.map((s) => h('button', {
    class: 'set-size', type: 'button', role: 'radio', 'data-v': String(s.value),
    style: { fontSize: `${22 * s.value}px` },
    onclick: () => {
      store.settings.textScale = s.value;
      saveSettings();
      paint();
      ctx.audio.sfx?.('uiClick');
    },
  }, h('span', { class: 'set-size-a' }, 'Aa'), h('small', {}, s.label)));
  const paint = () => buttons.forEach((b) => {
    const on = Number(b.dataset.v) === (store.settings.textScale ?? 1);
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  paint();
  return h('div', { class: 'set-row set-sizes' },
    h('div', { class: 'set-label-col' }, h('span', { class: 'set-label' }, 'Text size'), h('small', {}, 'Applies to every screen')),
    h('div', { class: 'set-size-row', role: 'radiogroup', 'aria-label': 'Text size' }, buttons));
}

function confirmReset(ctx, onDone) {
  const m = modal(h('div', { class: 'set-confirm' },
    h('h2', {}, 'Erase everything?'),
    h('p', {}, 'Chalk\'s album, every ending you have seen and any run in progress will be gone. This cannot be undone.'),
    h('div', { class: 'set-confirm-actions' },
      h('button', { class: 'btn', type: 'button', id: 'set-cancel', onclick: () => m.close() }, 'Keep it all'),
      h('button', {
        class: 'btn danger', type: 'button',
        onclick: () => { resetProgress(); ctx.save?.(); m.close(); onDone?.(); },
      }, 'Erase it'))), { className: 'set-confirm-panel' });
  m.el.querySelector('#set-cancel')?.focus();
  const onKey = (e) => { if (e.key === 'Escape') { m.close(); e.preventDefault(); e.stopPropagation(); } };
  window.addEventListener('keydown', onKey, true);
  m.closed.then(() => window.removeEventListener('keydown', onKey, true));
}

function buildPanel(ctx, { onBack, backLabel, allowReset }) {
  const status = h('p', { class: 'set-status', 'aria-live': 'polite' });
  const backBtn = h('button', { class: 'btn primary set-back', type: 'button', onclick: onBack }, backLabel);
  const panel = h('div', { class: 'set-panel' },
    h('h1', { class: 'set-title' }, 'Settings',
      svg('svg', { class: 'set-title-line', viewBox: '0 0 300 16', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
        svg('path', { d: 'M3 10 C 60 2, 120 14, 180 7 S 270 11, 297 5', fill: 'none', stroke: '#f2b84b', 'stroke-width': 6, 'stroke-linecap': 'round' }))),
    h('div', { class: 'set-cols' },
      h('section', { class: 'set-card' },
        h('h2', {}, 'Sound'),
        slider(ctx, 'master', 'Master volume'),
        slider(ctx, 'music', 'Music', 'The music box'),
        slider(ctx, 'sfx', 'Sound effects', 'Knocks, doors, creaks')),
      h('section', { class: 'set-card' },
        h('h2', {}, 'Comfort'),
        toggle(ctx, 'reduceScares', 'Reduce jumpscares', 'Quieter stingers, no screen shake'),
        toggle(ctx, 'captions', 'Sound captions', 'Knocks and sounds shown as text'),
        textSize(ctx))),
    h('div', { class: 'set-foot' },
      allowReset
        ? h('button', {
          class: 'btn danger small set-reset', type: 'button',
          onclick: () => confirmReset(ctx, () => { status.textContent = 'Everything has been erased.'; }),
        }, 'Reset all progress')
        : h('span', { class: 'set-foot-note' }, 'Progress can be reset from the main menu.'),
      status,
      backBtn));
  return { panel, backBtn };
}

export default {
  _off: [],
  mount(root, params, ctx) {
    ctx.setMood('day');
    ctx.audio.music?.('menu');
    const back = () => ctx.go(params?.back ?? 'menu');
    const { panel, backBtn } = buildPanel(ctx, { onBack: back, backLabel: 'Back', allowReset: true });
    root.append(h('div', { class: 'set-root' }, panel));
    const onKey = (e) => {
      if (e.key === 'Escape' && !document.querySelector('#overlay .modal-backdrop')) { back(); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    this._off.push(() => window.removeEventListener('keydown', onKey));
    backBtn.focus();
  },
  unmount() {
    for (const off of this._off.splice(0)) off();
  },
};

/** Same panel as an overlay (night pause menu). Returns { close() }. */
export function openSettingsOverlay(ctx, { onClose } = {}) {
  const host = ctx.overlay ?? document.getElementById('overlay');
  let closed = false;
  const onKey = (e) => {
    if (e.key === 'Escape' && !document.querySelector('#overlay .modal-backdrop')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      api.close();
    }
  };
  const { panel, backBtn } = buildPanel(ctx, { onBack: () => api.close(), backLabel: 'Back to the game', allowReset: false });
  const backdrop = h('div', { class: 'set-ov-backdrop' }, h('div', { class: 'set-ov-sheet' }, panel));
  host.append(backdrop);
  window.addEventListener('keydown', onKey, true);
  backBtn.focus();
  const api = {
    close() {
      if (closed) return;
      closed = true;
      window.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      try { onClose?.(); } catch (err) { console.error(err); }
    },
  };
  return api;
}
