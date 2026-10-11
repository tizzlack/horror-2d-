// Credits page on paper. Static credits plus the audio credits read from CREDITS.md.
import { h } from '../core/dom.js';

/** Turn a few markdown bits into plain, readable nodes (no HTML injection). */
function inline(text) {
  const clean = text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/(^|\s)_(.+?)_(?=\s|$)/g, '$1$2');
  const out = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m;
  while ((m = re.exec(clean))) {
    if (m.index > last) out.push(clean.slice(last, m.index));
    out.push(h('span', { class: 'cred-link' }, m[1]), h('small', { class: 'cred-url' }, ` (${m[2]})`));
    last = m.index + m[0].length;
  }
  if (last < clean.length) out.push(clean.slice(last));
  return out;
}

function renderMarkdown(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const nodes = [];
  let list = null;
  const flush = () => { if (list) { nodes.push(list); list = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }
    const head = /^(#{1,6})\s+(.*)$/.exec(line);
    if (head) {
      flush();
      if (head[1].length <= 1) continue; // the file's own title duplicates ours
      nodes.push(h('h4', { class: 'cred-h' }, inline(head[2])));
      continue;
    }
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      list ??= h('ul', { class: 'cred-list' });
      list.append(h('li', {}, inline(line.replace(/^\s*([-*+]|\d+\.)\s+/, ''))));
      continue;
    }
    if (/^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-')) continue; // table rule
    flush();
    if (line.includes('|')) {
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
      nodes.push(h('p', { class: 'cred-row' }, cells.map((c, i) => h('span', { class: i ? 'cred-cell' : 'cred-cell first' }, inline(c)))));
    } else {
      nodes.push(h('p', { class: 'cred-p' }, inline(line)));
    }
  }
  flush();
  return nodes;
}

export default {
  _off: [],
  mount(root, params, ctx) {
    ctx.setMood('day');
    ctx.audio.music?.('menu');
    const back = () => ctx.go('menu');
    const audioBox = h('div', { class: 'cred-audio' }, h('p', { class: 'cred-p cred-dim' }, 'Listening for the audio credits…'));
    const backBtn = h('button', { class: 'btn primary', type: 'button', onclick: back }, 'Back');

    root.append(h('div', { class: 'cred-root' },
      h('div', { class: 'cred-paper' },
        h('h1', { class: 'cred-title' }, 'Credits'),
        h('div', { class: 'cred-scroll' },
          h('section', { class: 'cred-block' },
            h('p', { class: 'cred-line' }, h('span', { class: 'cred-role' }, 'Characters & art'), h('span', { class: 'cred-name' }, 'tizzlack')),
            h('p', { class: 'cred-line' }, h('span', { class: 'cred-role' }, 'Game design & code'), h('span', { class: 'cred-name' }, 'built with Claude')),
            h('p', { class: 'cred-line' }, h('span', { class: 'cred-role' }, 'Lettering'), h('span', { class: 'cred-name' }, 'Patrick Hand and Patrick Hand SC (SIL Open Font License)'))),
          h('section', { class: 'cred-block' },
            h('h2', { class: 'cred-sub' }, 'Sound'),
            audioBox),
          h('p', { class: 'cred-thanks' }, 'Thank you for keeping the lantern lit.')),
        h('div', { class: 'cred-foot' }, backBtn))));

    const staticSound = () => audioBox.replaceChildren(
      h('p', { class: 'cred-p' }, 'The music box, knocks, voices and wind are generated live in your browser. No recordings were harmed.'));
    fetch('CREDITS.md', { cache: 'no-store' })
      .then((res) => {
        const type = res.headers.get('content-type') ?? '';
        if (!res.ok || type.includes('text/html')) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (!text.trim()) throw new Error('empty');
        audioBox.replaceChildren(...renderMarkdown(text));
      })
      .catch(staticSound);

    const onKey = (e) => { if (e.key === 'Escape') { back(); e.preventDefault(); } };
    window.addEventListener('keydown', onKey);
    this._off.push(() => window.removeEventListener('keydown', onKey));
    backBtn.focus();
  },
  unmount() {
    for (const off of this._off.splice(0)) off();
  },
};
