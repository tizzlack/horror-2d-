// Same Shape — the morning report, laid out like a page of Chalk's album. Owner: day agent.
import { h, svg, sleep } from '../core/dom.js';
import { difficultyOf } from '../core/state.js';
import { getFigure } from '../data/figures.js';
import { DAY_TEXT } from '../data/story.js';
import { getRules, snd, portrait, figureImg, flameEl, objectEl, objectKeyFor, hash01 } from './day.js';

const T = DAY_TEXT.morning;
const RED = '#a3231b';

// How big a hand-drawn circle is around each anchor, in 400x560 canvas units.
const ANCHOR_R = { head: [96, 84], face: [84, 74], eyeL: [34, 28], eyeR: [34, 28], mouth: [44, 30], body: [128, 150], handL: [40, 40], handR: [40, 40], feet: [96, 40], accessory: [60, 52], top: [66, 52] };
const REVEALED_BY = {
  eye: 'plain to see', album: 'compare with the album', flashlight: 'in the shadow', mirror: 'in the mirror',
  ear: 'heard, not seen', text: 'in the words', behavior: 'in how it acted', candle: 'the candle knew',
};

/** A wobbly hand-drawn ellipse as an SVG path (drawn as two overlapping loops). */
function scribbleCircle(cx, cy, rx, ry, seed) {
  const loops = [];
  for (let l = 0; l < 2; l++) {
    const pts = [];
    const n = 14;
    const start = hash01(`${seed}s${l}`) * Math.PI * 2;
    const grow = 1 + l * 0.07;
    for (let i = 0; i <= n + 2; i++) {
      const a = start + (i / n) * Math.PI * 2;
      const wob = 1 + (hash01(`${seed}w${l}${i}`) - 0.5) * 0.16 + i * 0.006;
      pts.push([cx + Math.cos(a) * rx * wob * grow, cy + Math.sin(a) * ry * wob * grow]);
    }
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ` Q${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
    }
    loops.push(d);
  }
  return loops;
}

function circleTarget(fig, tell) {
  if (tell.kind === 'audio' || tell.kind === 'text') return null;
  if (tell.revealedBy === 'flashlight' || tell.revealedBy === 'mirror' || tell.effect === 'shadowOnly') return null;
  const at = tell.at && fig.anchors?.[tell.at] ? tell.at : null;
  if (at) {
    const [ax, ay] = fig.anchors[at];
    const [rx, ry] = ANCHOR_R[at] ?? [60, 60];
    return { cx: ax * 400, cy: ay * 560, rx, ry };
  }
  if (['mirrored', 'tilt', 'tooClose', 'translucent', 'noBlink', 'jitter'].includes(tell.effect)) return { cx: 200, cy: 300, rx: 175, ry: 262 };
  return null;
}

let M = null;

export default {
  async mount(root, params, ctx) {
    const run = ctx.store.run;
    const report = params?.report ?? run?.lastReport ?? null;
    const rules = await getRules();
    ctx.setMood('day');
    snd(ctx, 'music', 'off');
    snd(ctx, 'ambient', 'day');
    snd(ctx, 'sfx', 'pageTurn');
    M = { dead: false, skipped: false, ac: new AbortController() };
    const st = M;

    const el = h('div', { class: 'morning-root' });
    root.append(el);
    if (!report) {
      el.append(h('div', { class: 'morning-empty' }, h('p', {}, 'No report to show.'), h('button', { class: 'btn', onclick: () => ctx.go('menu') }, 'Back to menu')));
      return;
    }

    const rep = {
      night: report.night ?? run?.night ?? 1,
      saved: report.saved ?? [],
      lost: report.lost ?? [],
      caught: report.caught ?? [],
      admitted: report.admitted ?? [],
      turnedAway: report.turnedAway ?? [],
      missedTells: report.missedTells ?? [],
      flames: report.flames ?? run?.flames ?? 0,
      maxFlames: report.maxFlames ?? run?.maxFlames ?? 3,
      endingId: report.endingId ?? (report.gameOver ? 'lanternOut' : null),
    };
    const endless = run?.mode === 'endless';

    // ---------- header ----------
    const header = h('header', { class: 'morning-head reveal' },
      h('h1', {}, T.heading(rep.night)),
      h('p', {}, T.subtitle[(rep.night - 1) % T.subtitle.length]));
    if (endless) {
      const best = ctx.store.album?.endlessBest ?? 0;
      const saved = run?.saved ?? 0;
      header.append(h('div', { class: 'morning-score' },
        h('span', { class: 'morning-score-n' }, String(saved)),
        h('span', { class: 'morning-score-l' }, T.score.title),
        h('span', { class: 'morning-score-b' }, saved >= best && saved > 0 ? T.score.newBest : T.score.best(best))));
    }

    const sec = (cls, title, count) => h('section', { class: `morning-sec morning-${cls} reveal` },
      h('h2', {}, title, count != null ? h('small', {}, `×${count}`) : null));

    // ---------- Saved ----------
    const secSaved = sec('saved', T.saved.title, rep.saved.length);
    const savedRow = h('div', { class: 'morning-row' });
    secSaved.append(savedRow);
    const savedIds = rep.saved.filter((id) => getFigure(id));
    if (!savedIds.length) savedRow.append(h('p', { class: 'morning-empty-line' }, T.saved.empty));
    const photoH = savedIds.length > 5 ? 80 : savedIds.length > 3 ? 88 : 108;
    for (const [i, id] of savedIds.entries()) {
      const fig = getFigure(id);
      const card = h('figure', { class: 'morning-photo', style: { '--tilt': `${((hash01(id + i) - 0.5) * 4).toFixed(1)}deg` } }, h('figcaption', {}, fig.name));
      portrait(fig, { form: 'standard', height: photoH, stamp: T.saved.stamp }).then((p) => card.prepend(p));
      savedRow.append(card);
    }

    // ---------- Missing ----------
    const secMissing = sec('missing', T.missing.title, rep.lost.length || null);
    const missRow = h('div', { class: 'morning-row' });
    secMissing.append(missRow);
    const lost = rep.lost.map((l) => (typeof l === 'string' ? { id: l } : l)).filter((l) => getFigure(l.id));
    if (!lost.length) missRow.append(h('p', { class: 'morning-empty-line' }, T.missing.empty));
    for (const l of lost) {
      const fig = getFigure(l.id);
      const by = l.by && getFigure(l.by) ? T.missing.by(getFigure(l.by).name) : T.missing.byUnknown;
      const ghost = figureImg(fig, { height: 88, silhouette: true });
      const card = h('figure', { class: 'morning-lost' },
        h('div', { class: 'morning-ghost' }, ghost, h('span', { class: 'morning-lost-obj' }, objectEl(objectKeyFor(l.id), 40))),
        h('figcaption', {}, h('b', {}, fig.name), h('span', {}, by)));
      missRow.append(card);
    }

    // ---------- Caught ----------
    const secCaught = sec('caught', T.caught.title, rep.caught.length);
    const caughtRow = h('div', { class: 'morning-row' });
    secCaught.append(caughtRow);
    const caught = rep.caught.filter((c) => getFigure(c.figureId ?? c));
    if (!caught.length) caughtRow.append(h('p', { class: 'morning-empty-line' }, T.caught.empty));
    for (const [i, c] of caught.entries()) {
      const id = c.figureId ?? c;
      const fig = getFigure(id);
      const card = h('figure', { class: 'morning-photo morning-photo-monster', style: { '--tilt': `${((hash01('c' + id + i) - 0.5) * 5).toFixed(1)}deg` } },
        h('figcaption', {}, h('b', {}, fig.monsterTitle ?? fig.name), h('span', {}, `as ${fig.name}`)));
      portrait(fig, { form: 'monster', height: 96 }).then((p) => card.prepend(p));
      caughtRow.append(card);
    }
    if (caught.length) secCaught.append(h('p', { class: 'morning-note' }, T.caught.line));

    // ---------- Turned away ----------
    const secTurned = sec('turned', T.turned.title, rep.turnedAway.length);
    const turnRow = h('div', { class: 'morning-row' });
    secTurned.append(turnRow);
    const turned = rep.turnedAway.filter((id) => getFigure(id));
    if (!turned.length) turnRow.append(h('p', { class: 'morning-empty-line' }, T.turned.empty));
    for (const [i, id] of turned.entries()) {
      const fig = getFigure(id);
      const walker = figureImg(fig, { height: 94, silhouette: true });
      turnRow.append(h('figure', { class: 'morning-walk', style: { '--d': `${i * 0.35}s` } },
        h('div', { class: 'morning-fog' }, h('div', { class: 'morning-walker' }, walker), h('i', { class: 'morning-mist' })),
        h('figcaption', {}, fig.name)));
    }
    if (turned.length) secTurned.append(h('p', { class: 'morning-note sad' }, T.turned.line));

    // ---------- Missed tells ----------
    const secMissed = sec('missed', T.missed.title, rep.missedTells.length || null);
    const missedList = h('div', { class: 'morning-tells' });
    secMissed.append(missedList);
    const tellEntries = rep.missedTells.filter((m) => getFigure(m.figureId) && m.tells?.length);
    if (tellEntries.length) secMissed.insertBefore(h('p', { class: 'morning-lead' }, T.missed.lead), missedList);
    else {
      const hints = run ? difficultyOf(run).morningHints : 'missed';
      missedList.append(h('p', { class: 'morning-empty-line' }, hints === 'none' && rep.admitted.length ? T.missed.noHints : T.missed.none));
    }
    const circleJobs = [];
    for (const [ei, entry] of tellEntries.entries()) {
      const fig = getFigure(entry.figureId);
      const W = 98; const Hh = 137;
      const holder = h('div', { class: 'morning-tellfig', style: { width: `${W}px`, height: `${Hh}px` } }, figureImg(fig, { height: Hh }));
      const overlay = svg('svg', { viewBox: '0 0 400 560', class: 'morning-circles', 'aria-hidden': 'true' });
      holder.append(overlay);
      const lines = h('ul', { class: 'morning-telllist' });
      entry.tells.forEach((tell, ti) => {
        const tgt = circleTarget(fig, tell);
        const n = ti + 1;
        if (tgt) {
          const loops = scribbleCircle(tgt.cx, tgt.cy, tgt.rx, tgt.ry, `${fig.id}${tell.id}`);
          const g = svg('g', { class: 'morning-circle', fill: 'none', stroke: RED, 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
          loops.forEach((d, li) => g.append(svg('path', { d, pathLength: 1, style: `animation-delay:${(li * 0.35).toFixed(2)}s` })));
          const lx = Math.min(372, tgt.cx + tgt.rx * 0.78);
          const ly = Math.max(52, tgt.cy - tgt.ry * 0.78);
          g.append(svg('text', { x: lx, y: ly, fill: RED, stroke: 'none', 'font-size': 62, 'font-family': 'Patrick Hand, Comic Sans MS, cursive' }, String(n)));
          overlay.append(g);
        }
        const how = REVEALED_BY[tell.revealedBy] ?? null;
        lines.append(h('li', {}, h('span', { class: `morning-n${tgt ? '' : ' noc'}` }, String(n)), h('span', { class: 'morning-tdesc' }, tell.desc ?? 'Something was off.', how ? h('em', {}, ` ${how}`) : null)));
      });
      const card = h('article', { class: 'morning-tellcard', style: { '--tilt': `${((hash01('t' + ei) - 0.5) * 2.4).toFixed(1)}deg` } },
        holder,
        h('div', { class: 'morning-tellbody' }, h('div', { class: 'morning-tellwho' }, `${fig.name}'s skin`), lines));
      circleJobs.push(overlay);
      missedList.append(card);
    }

    // ---------- Flames ----------
    const secFlames = sec('flames', T.flames.title, null);
    const flameRow = h('div', { class: 'morning-flamerow' });
    for (let i = 0; i < rep.maxFlames; i++) flameRow.append(flameEl(i < rep.flames, 34));
    secFlames.append(flameRow, h('p', { class: 'morning-note' }, rep.flames === 1 && rep.maxFlames > 1 ? T.flames.last : T.flames.left(rep.flames, rep.maxFlames)));

    // ---------- layout ----------
    const colA = h('div', { class: 'morning-col morning-col-a' }, secSaved, secMissing);
    const colB = h('div', { class: 'morning-col morning-col-b' }, secCaught, secTurned);
    const colC = h('div', { class: 'morning-col morning-col-c' }, secMissed, secFlames);
    const album = h('div', { class: 'morning-album' }, colA, colB, colC);

    const goOn = () => {
      if (st.left) return;
      st.left = true;
      if (rep.endingId) {
        if (run) { run.phase = 'ending'; run.endingId = run.endingId ?? rep.endingId; ctx.save(); }
        ctx.go('ending', { endingId: rep.endingId });
        return;
      }
      if (run) {
        try { rules.startDay ? rules.startDay(run) : (run.actionsLeft = 3); } catch (err) { console.error('[morning] startDay failed', err); run.actionsLeft = 3; }
        run.phase = 'day';
        ctx.save();
      }
      ctx.go('day');
    };
    const label = rep.endingId ? T.continueEnding : (endless ? T.continueEndless : T.continue);
    const btn = h('button', { class: 'btn primary morning-go', type: 'button', onclick: goOn }, label);

    el.append(h('div', { class: 'morning-sun' }), header, album, btn);

    // ---------- sequential reveal ----------
    const order = [header, secSaved, secMissing, secCaught, secTurned, secMissed, secFlames];
    const skip = () => { st.skipped = true; };
    el.addEventListener('pointerdown', (e) => { if (!e.target.closest('.morning-go')) skip(); }, { signal: st.ac.signal });
    window.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (st.done) goOn(); else skip(); }
    }, { signal: st.ac.signal });

    // The router awaits mount(), so the reveal runs in the background.
    (async () => {
      await sleep(200);
      for (const node of order) {
        if (st.skipped || st.dead) break;
        node.classList.add('on');
        if (node === secSaved && savedIds.length) snd(ctx, 'sfx', 'chime');
        if (node === secMissed && circleJobs.length) {
          snd(ctx, 'sfx', 'penScratch');
          circleJobs.forEach((c) => c.classList.add('draw'));
        }
        await sleep(node === header ? 350 : 480);
      }
      if (st.dead) return;
      order.forEach((n) => n.classList.add('on'));
      circleJobs.forEach((c) => c.classList.add('draw'));
      btn.classList.add('on');
      st.done = true;
    })();
  },

  unmount() {
    if (!M) return;
    M.dead = true;
    M.ac.abort();
    M = null;
  },
};
