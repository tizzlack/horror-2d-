// Same Shape — Chalk's notebook page, shown before every night. Owner: day agent.
import { h, sleep } from '../core/dom.js';
import { NOTES, DAY_TEXT } from '../data/story.js';
import { snd, hash01 } from './day.js';

const T = DAY_TEXT.note;
const PENCIL = '#5b5147';

// Margin doodles, one per night. viewBox 0 0 140 110, drawn in pencil.
const DOODLES = {
  1: `<rect x="40" y="10" width="60" height="92" rx="26" /><circle cx="70" cy="42" r="8"/><path d="M70 38 v8 M66 42 h8" stroke-width="1.4"/><path d="M104 40 q10 6 0 14 M112 34 q16 12 0 26 M24 40 q-10 6 0 14 M16 34 q-16 12 0 26"/><circle cx="92" cy="72" r="3" fill="${PENCIL}"/>`,
  2: `<g transform="rotate(-24 70 55)"><rect x="16" y="46" width="52" height="18" rx="5"/><path d="M68 42 L92 30 V80 L68 68 Z"/><path d="M26 52 v6 M34 52 v6"/></g><path d="M100 24 L132 4 M104 48 L138 44 M104 70 L136 86" stroke-dasharray="5 5"/>`,
  3: `<circle cx="36" cy="40" r="22"/><circle cx="104" cy="40" r="22"/><circle cx="28" cy="36" r="3" fill="${PENCIL}"/><circle cx="44" cy="36" r="3" fill="${PENCIL}"/><circle cx="96" cy="36" r="3" fill="${PENCIL}"/><circle cx="112" cy="36" r="3" fill="${PENCIL}"/><path d="M28 48 q8 6 16 0 M96 48 q8 6 16 0"/><path d="M62 38 h16 M62 46 h16"/><path d="M24 84 v18 M32 84 v18 M40 84 v18 M48 84 v18 M20 96 l34 -8"/>`,
  4: `<ellipse cx="62" cy="48" rx="34" ry="42"/><ellipse cx="62" cy="48" rx="27" ry="35" stroke-width="1.4"/><path d="M62 90 L62 106 M52 106 h20"/><path d="M42 48 q20 -20 40 0 q-20 20 -40 0 Z"/><circle cx="62" cy="48" r="7" fill="${PENCIL}"/><path d="M96 26 l12 -6 M98 40 l16 0"/>`,
  5: `<path d="M24 100 Q18 64 28 46 Q22 18 40 14 Q58 18 52 46 Q62 64 56 100 Z"/><path d="M84 100 Q78 64 88 46 Q82 18 100 14 Q118 18 112 46 Q122 64 116 100 Z" stroke-dasharray="1 0"/><circle cx="34" cy="38" r="2.6" fill="${PENCIL}"/><circle cx="46" cy="38" r="2.6" fill="${PENCIL}"/><circle cx="94" cy="38" r="2.6" fill="${PENCIL}"/><circle cx="106" cy="38" r="2.6" fill="${PENCIL}"/><path d="M64 48 h16 M64 56 h16"/><path d="M62 6 q8 -8 16 0 q4 8 -6 12" stroke-width="1.8"/>`,
  6: `<path d="M56 100 V56 H84 V100 Z"/><path d="M70 56 V46"/><path d="M70 12 Q86 30 80 42 Q70 48 60 42 Q54 30 70 12 Z"/><path d="M96 20 q4 -6 8 0 M20 30 q4 -6 8 0 M104 70 q4 -6 8 0" stroke-width="1.6"/><circle cx="24" cy="76" r="2.4" fill="${PENCIL}"/><circle cx="34" cy="76" r="2.4" fill="${PENCIL}"/>`,
  7: `<path d="M26 104 Q20 70 34 50 Q26 20 52 12 Q76 8 82 36 Q94 56 88 104 Z"/><path d="M42 50 Q54 58 68 50" stroke-width="1.2" opacity=".6"/><path d="M96 30 q14 -8 20 6 M100 52 q14 -6 22 8" stroke-dasharray="2 5"/>`,
};

function doodleSvg(n) {
  const body = DOODLES[n] ?? DOODLES[1];
  return `<svg viewBox="0 0 140 110" width="140" height="110" fill="none" stroke="${PENCIL}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g filter="url(#sketch)">${body}</g></svg>`;
}

function deskProps(n) {
  // Oil lamp (left), ink bottle + pen (right), album corner (bottom right).
  const lampLit = n < 7;
  return `<svg class="note-props" viewBox="0 0 1280 720" width="1280" height="720" aria-hidden="true">
    <defs>
      <radialGradient id="noteLamp"><stop offset="0" stop-color="#ffcf6b" stop-opacity="${lampLit ? 0.55 : 0.22}"/><stop offset="1" stop-color="#ffcf6b" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse class="note-lampglow" cx="150" cy="520" rx="420" ry="360" fill="url(#noteLamp)"/>
    <g filter="url(#sketch)" stroke="#d9cdb4" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="#2a2430">
      <!-- candle in a dish -->
      <ellipse cx="150" cy="650" rx="74" ry="16" fill="#4a3a2e"/>
      <path d="M92 646 Q150 668 208 646" fill="none" stroke-width="2"/>
      <path d="M126 646 V${lampLit ? 530 : 600} H174 V646 Z" fill="#e9dcc0"/>
      <path d="M134 ${lampLit ? 540 : 610} Q132 566 138 580 M164 ${lampLit ? 548 : 616} Q168 590 162 606" fill="none" stroke-width="2" opacity=".6"/>
      <path d="M150 ${lampLit ? 530 : 600} V${lampLit ? 518 : 588}" fill="none"/>
      <path class="note-lampflame" d="M150 ${lampLit ? 470 : 568} Q176 ${lampLit ? 498 : 580} 166 ${lampLit ? 516 : 586} Q150 ${lampLit ? 526 : 592} 134 ${lampLit ? 516 : 586} Q124 ${lampLit ? 498 : 580} 150 ${lampLit ? 470 : 568} Z" fill="${lampLit ? '#f2b84b' : '#9b7a3a'}"/>
      <!-- ink bottle + pen -->
      <path d="M1060 640 L1056 600 Q1056 584 1074 584 H1100 Q1118 584 1114 600 L1112 640 Z" fill="#1d1a26"/>
      <rect x="1070" y="570" width="30" height="14" rx="3" fill="#3a3030"/>
      <path d="M1150 650 L1230 560 L1244 568 L1166 656 Z" fill="#6b4a2f"/>
      <path d="M1150 650 L1146 664 L1166 656" fill="#d9cdb4"/>
      <!-- album corner -->
      <path d="M1160 700 L1280 690 L1280 740 L1150 740 Z" fill="#6b1f1a" stroke="#d9cdb4"/>
      <path d="M1186 700 L1180 740" stroke-width="2"/>
    </g>
  </svg>`;
}

function inkBlots(n) {
  const blots = n === 6
    ? [[86, 12, 16], [10, 58, 9], [64, 60, 12], [30, 84, 8]]
    : n === 7 ? [[18, 30, 20], [74, 46, 26], [52, 76, 18], [88, 14, 14]] : [];
  return blots.map(([x, y, r], i) => `<i class="note-blot note-blot-${n}" style="left:${x}%;top:${y}%;width:${r * 3}px;height:${r * 3}px;--rot:${Math.round(hash01(`b${i}${n}`) * 360)}deg"></i>`).join('');
}

let N = null;

export default {
  async mount(root, params, ctx) {
    const run = ctx.store.run;
    const night = Math.max(1, Math.min(7, Number(params?.night) || run?.night || 1));
    ctx.setMood('night');
    N = { dead: false, skipped: false, ac: new AbortController(), timers: new Set() };
    const st = N;

    const go = () => {
      if (st.left) return;
      st.left = true;
      if (run) { run.phase = 'night'; ctx.save(); }
      ctx.go('night');
    };

    // Endless mode has no notes; straight into the night.
    if (run?.mode === 'endless') { go(); return; }

    const note = NOTES[night] ?? NOTES[1];
    snd(ctx, 'sfx', 'pageTurn');
    snd(ctx, 'music', 'night');

    // -------- DOM --------
    const page = h('div', { class: 'note-page', dataset: { night: String(night) } });
    const bg = h('div', { class: 'note-paper' });
    const inner = h('div', { class: 'note-inner' });
    const title = h('h1', { class: 'note-title' }, note.title);
    const textBox = h('div', { class: 'note-text' });
    const rule = h('p', { class: 'note-rule' }, h('span', {}, note.rule));
    const sign = h('div', { class: 'note-sign' }, T.signoff);
    const pageNo = h('div', { class: 'note-pageno' }, T.pageOf(night));
    inner.append(pageNo, title, textBox, rule, sign);

    page.append(bg);
    page.insertAdjacentHTML('beforeend', `
      <i class="note-tape note-tape-a"></i><i class="note-tape note-tape-b"></i>
      <svg class="note-ring" viewBox="0 0 120 120" width="120" height="120" aria-hidden="true"><g filter="url(#rough)" fill="none" stroke-linecap="round">
        <path d="M60 10 C92 8 112 34 108 62 C104 94 76 112 48 106 C20 100 8 74 14 46 C20 22 40 12 60 10" stroke="#8a5a2c" stroke-width="5" opacity=".34"/>
        <path d="M60 18 C86 18 102 38 98 62 C94 86 72 102 50 98" stroke="#8a5a2c" stroke-width="2" opacity=".3"/></g></svg>
      <div class="note-doodle">${doodleSvg(night)}</div>
      ${inkBlots(night)}`);
    page.append(inner);

    const wrap = h('div', { class: 'note-wrap' }, page);
    const goBtn = h('button', { class: 'btn primary note-go', type: 'button', onclick: go }, T.button);
    const hint = h('div', { class: 'note-hint' }, T.skip);
    const desk = h('div', { class: 'note-root', dataset: { night: String(night) } });
    desk.insertAdjacentHTML('beforeend', '<div class="note-desk"></div><div class="note-window"></div>');
    desk.insertAdjacentHTML('beforeend', deskProps(night));
    if (night === 6) {
      desk.insertAdjacentHTML('beforeend', `<svg class="note-scrap" viewBox="0 0 150 120" width="150" height="120" aria-hidden="true"><g filter="url(#rough)">
        <path d="M6 14 L48 6 L74 16 L110 4 L144 20 L138 56 L146 86 L110 100 L84 110 L50 98 L14 106 L2 70 L10 40 Z" fill="#eadfc0" stroke="#5b5147" stroke-width="2" stroke-linejoin="round"/>
        <path d="M18 34 H128 M18 54 H132 M18 74 H122 M18 94 H100" stroke="rgba(80,100,150,.35)" stroke-width="1.2"/></g>
        <text x="22" y="30" font-family="Patrick Hand, Comic Sans MS, cursive" font-size="20" fill="#2f2a38" transform="rotate(-3 22 30)">…skin. Don’t</text></svg>`);
    }
    desk.append(wrap, goBtn, hint);
    root.append(desk);

    // -------- words --------
    const words = [];
    const shaky = night === 6;
    const smudgy = night === 7;
    note.paragraphs.forEach((p, pi) => {
      const para = h('p', { class: 'note-p' });
      p.split(/\s+/).forEach((w, wi, arr) => {
        const gi = words.length;
        const span = h('span', { class: 'note-w' }, w);
        if (shaky) {
          const rot = (hash01(`r${gi}`) - 0.5) * 7;
          const dy = (hash01(`y${gi}`) - 0.5) * 7;
          span.style.transform = `translateY(${dy.toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`;
        } else if (smudgy && hash01(`s${gi}`) > 0.82) {
          span.style.filter = 'blur(0.9px)';
          span.style.opacity = '0.75';
        } else {
          const rot = (hash01(`r${gi}`) - 0.5) * 1.6;
          span.style.transform = `rotate(${rot.toFixed(2)}deg)`;
        }
        words.push({ span, p: pi, w: wi });
        para.append(span, wi < arr.length - 1 ? ' ' : '');
      });
      textBox.append(para);
    });

    // Fit the text to the page: shrink the handwriting until the whole page fits.
    const fit = () => {
      for (let fs = night === 7 || night === 6 ? 26 : 30; fs >= 18; fs -= 1) {
        page.style.setProperty('--fs', `${fs}px`);
        page.style.setProperty('--lh', `${Math.round(fs * 1.28)}px`);
        if (inner.scrollHeight <= inner.clientHeight + 1) break;
      }
    };
    await document.fonts?.ready?.catch?.(() => {});
    fit();

    // Group words into visual lines for the reveal.
    const lineMap = new Map();
    words.forEach((wd) => {
      const key = `${wd.p}:${Math.round(wd.span.offsetTop / 6)}`;
      if (!lineMap.has(key)) lineMap.set(key, []);
      lineMap.get(key).push(wd);
    });
    const lines = [...lineMap.values()];

    // -------- reveal --------
    const keydown = (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (st.done) go(); else st.skipped = true;
      }
    };
    window.addEventListener('keydown', keydown, { signal: st.ac.signal });
    page.addEventListener('pointerdown', () => { if (!st.done) st.skipped = true; }, { signal: st.ac.signal });
    desk.addEventListener('pointerdown', (e) => { if (!st.done && !e.target.closest('.note-go')) st.skipped = true; }, { signal: st.ac.signal });

    const showRule = () => {
      rule.classList.add('on');
      sign.classList.add('on');
      st.done = true;
      goBtn.classList.add('on');
      hint.classList.add('hidden');
    };

    // The router awaits mount(), so the reveal runs in the background.
    (async () => {
      await sleep(550);
      let lastPara = -1;
      for (let li = 0; li < lines.length && !st.skipped && !st.dead; li++) {
        const line = lines[li];
        if (line[0].p !== lastPara) { lastPara = line[0].p; if (li) snd(ctx, 'sfx', 'penScratch'); }
        line.forEach((wd, i) => { wd.span.style.transitionDelay = `${i * 38}ms`; wd.span.classList.add('on'); });
        await sleep(Math.min(1100, 240 + line.length * 70));
      }
      if (st.dead) return;
      words.forEach((wd) => { wd.span.style.transitionDelay = '0ms'; wd.span.classList.add('on'); });
      if (st.skipped) await sleep(120);
      if (st.dead) return;
      snd(ctx, 'sfx', 'penScratch');
      showRule();
    })();
  },

  unmount() {
    if (!N) return;
    N.dead = true;
    N.ac.abort();
    N.timers.forEach((t) => clearTimeout(t));
    N = null;
  },
};
