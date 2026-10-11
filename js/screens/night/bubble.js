// Hand-drawn speech bubble with a typewriter reveal and the three text tells
// ('textDrip' letters drip, 'typo' misspells the creature's name, 'shout' is CAPS and shaky).
import { h } from '../../core/dom.js';
import { tailSvg } from './art.js';

/** Misspell a name the same way every time ("Nimi" -> "Nimmi"). */
export function typoName(name) {
  if (!name || name.length < 3) return `${name ?? ''}${(name ?? '').slice(-1)}`;
  const i = name.length - 2;
  return name.slice(0, i) + name[i] + name.slice(i);
}

/** Apply a text tell to a line of speech. Returns the text to show. */
export function applyTextTell(text, tell, name, { greeting = false } = {}) {
  if (!text) return text;
  if (tell === 'typo' && name) {
    const t = typoName(name);
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    if (re.test(text)) return text.replace(re, t);
    return greeting ? `It's ${t}! ${text}` : text;
  }
  if (tell === 'shout') return text.toUpperCase().replace(/[.]+$/g, '!');
  return text;
}

export function createBubble(clock) {
  const textEl = h('div', { class: 'bubble-text' });
  const qEl = h('div', { class: 'bubble-q' });
  const body = h('div', { class: 'bubble-body' }, qEl, textEl);
  const tail = h('div', { class: 'bubble-tail', html: tailSvg() });
  const el = h('div', { class: 'bubble hidden', 'aria-live': 'polite' }, body, tail);
  let stopTick = null;
  let token = 0;
  let resolver = null;

  function stop() {
    token++;
    if (resolver) { const r = resolver; resolver = null; r(); }
    if (stopTick) { stopTick(); stopTick = null; }
  }

  function build(text, effect) {
    textEl.replaceChildren();
    el.classList.toggle('shout', effect === 'shout');
    el.classList.toggle('drippy', effect === 'textDrip');
    const chars = [];
    const words = String(text).split(/(\s+)/);
    for (const w of words) {
      if (!w) continue;
      if (/^\s+$/.test(w)) { textEl.append(document.createTextNode(' ')); continue; }
      const word = h('span', { class: 'w' });
      for (const c of w) {
        const s = h('span', { class: 'ch' }, c);
        if (effect === 'textDrip') s.style.setProperty('--d', `${(Math.random() * 2.2).toFixed(2)}s`);
        if (effect === 'shout') s.style.setProperty('--d', `${(-Math.random()).toFixed(2)}s`);
        word.append(s);
        chars.push(s);
      }
      textEl.append(word);
    }
    return chars;
  }

  return {
    el,
    /** Show a line. Resolves when fully typed. opts: { effect, question, speed (ms/char) } */
    say(text, { effect = null, question = null, speed = 32 } = {}) {
      stop();
      const my = token;
      el.classList.remove('hidden');
      qEl.textContent = question ? `You: ${question}` : '';
      qEl.classList.toggle('hidden', !question);
      const chars = build(text, effect);
      chars.forEach((c) => c.classList.add('pending'));
      return new Promise((resolve) => {
        resolver = resolve;
        if (!chars.length) { stop(); return; }
        let acc = 0;
        let shown = 0;
        stopTick = clock.onTick((dt) => {
          if (my !== token) return;
          acc += dt * 1000;
          while (acc >= speed && shown < chars.length) {
            acc -= speed;
            chars[shown++].classList.remove('pending');
          }
          if (shown >= chars.length) stop();
        });
      });
    },
    hide() { stop(); el.classList.add('hidden'); },
    destroy() { stop(); el.remove(); },
  };
}
