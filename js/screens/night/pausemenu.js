// Pause menu: Resume / Settings / Quit to menu. Lives in #overlay so it sits above the whole stage.
import { h, modal } from '../../core/dom.js';

export function openPauseMenu({ ctx, deps, onResume, onQuit, onSettings }) {
  let settingsHandle = null;
  let btn = null;
  const m = modal(h('div', {},
    h('h2', {}, 'Paused'),
    h('button', { class: 'btn primary', onclick: () => resume() }, 'Resume'),
    h('button', { class: 'btn', onclick: () => openSettings() }, 'Settings'),
    h('button', { class: 'btn danger', onclick: () => { m.close(); onQuit(); } }, 'Quit to menu')),
  { dismissable: false, className: 'pause-panel' });

  function resume() { m.close(); onResume(); }
  function openSettings() {
    onSettings(true);
    const backdrop = m.el.parentElement;
    if (backdrop) { backdrop.style.display = 'none'; backdrop.classList.remove('modal-backdrop'); } // settings' Esc handler ignores a visible modal
    const done = () => { if (backdrop) { backdrop.style.display = ''; backdrop.classList.add('modal-backdrop'); } onSettings(false); settingsHandle = null; btn?.focus?.({ preventScroll: true }); };
    try {
      settingsHandle = deps.openSettingsOverlay(ctx, { back: 'night', onClose: done });
      if (!settingsHandle) done();
    } catch (err) {
      console.warn('[night] settings overlay failed', err);
      done();
    }
  }
  btn = m.el.querySelector('.btn');
  setTimeout(() => btn?.focus({ preventScroll: true }), 30);
  return { resume, close: () => { try { settingsHandle?.close?.(); } catch { /* ignore */ } m.close(); } };
}
