// Small DOM helpers shared by all screens.

/**
 * h('div', {class: 'x', onclick: fn, style: {left: '4px'}, dataset: {id: 'a'}}, 'text', child)
 * Attributes starting with "on" become event listeners. `html` sets innerHTML (trusted strings only).
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class' || key === 'className') el.className = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'html') el.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

/** SVG element helper: svg('circle', {cx: 4, r: 2}) */
export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value == null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wait for the next animation frame(s). */
export const frame = (n = 1) => new Promise((resolve) => {
  const step = () => (--n <= 0 ? resolve() : requestAnimationFrame(step));
  requestAnimationFrame(step);
});

/** Resolve when a CSS animation or transition on `el` ends (or after `fallbackMs`). */
export function animationDone(el, fallbackMs = 1500) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    el.addEventListener('animationend', finish, { once: true });
    el.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, fallbackMs);
  });
}

/**
 * Show a modal panel inside the stage overlay. Returns {el, close, closed}.
 * `content` is a Node; the panel closes on backdrop click when `dismissable`.
 */
export function modal(content, { dismissable = true, className = '' } = {}) {
  const overlay = document.getElementById('overlay');
  const panel = h('div', { class: `panel ${className}` }, content);
  const backdrop = h('div', { class: 'modal-backdrop' }, panel);
  let resolveClosed;
  const closed = new Promise((r) => { resolveClosed = r; });
  const close = (value) => {
    backdrop.remove();
    resolveClosed(value);
  };
  if (dismissable) {
    backdrop.addEventListener('pointerdown', (e) => { if (e.target === backdrop) close(null); });
  }
  overlay.append(backdrop);
  return { el: panel, close, closed };
}

/** Clamp helper. */
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
