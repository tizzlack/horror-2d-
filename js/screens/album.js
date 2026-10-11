// Chalk's album: an open book on a desk. Also exports small shared helpers used by the other
// meta screens (portrait fallbacks, story text loader, group photo) and the night-screen
// compare overlay `openAlbumOverlay`.
import { h, svg, sleep, modal } from '../core/dom.js';
import { store, knownFacts, albumCompletion } from '../core/state.js';
import { FIGURES, FIGURE_IDS, getFigure } from '../data/figures.js';

/* ------------------------------------------------------------------ */
/* Shared helpers (render module is optional, everything has fallbacks) */
/* ------------------------------------------------------------------ */

let renderMod = null;
let renderLoad = null;
/** Load js/render/figure.js once; resolves with the module or null. */
export function loadRender() {
  renderLoad ??= import('../render/figure.js').then((m) => { renderMod = m; return m; }).catch((err) => {
    console.warn('[meta] render/figure.js unavailable, using plain images', err);
    renderMod = null;
    return null;
  });
  return renderLoad;
}

let iconsMod = null;
let iconsLoad = null;
export function loadIcons() {
  iconsLoad ??= import('../render/icons.js').then((m) => { iconsMod = m; return m; }).catch(() => null);
  return iconsLoad;
}
/** Hand-drawn icon or an empty span if the icon module is missing. */
export function iconEl(name, size = 28) {
  try {
    const node = iconsMod?.icon?.(name, { size });
    if (node) return node;
  } catch { /* fall through */ }
  return h('span', { class: 'meta-noicon' });
}

const BLOB_PATH = 'M200 40 C 290 40 330 120 330 220 C 330 330 360 420 340 500 C 320 545 80 545 60 500 C 40 420 70 330 70 220 C 70 120 110 40 200 40 Z';

function blobSvg() {
  return svg('svg', { viewBox: '0 0 400 560', class: 'meta-blob' },
    svg('path', { d: BLOB_PATH, fill: '#b9b2a3', stroke: '#2b2622', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
    svg('circle', { cx: 160, cy: 200, r: 16, fill: '#2b2622' }),
    svg('circle', { cx: 240, cy: 200, r: 16, fill: '#2b2622' }));
}

/** Plain <img> of a figure image on the shared 400x560 canvas (grey blob if missing). */
export function figureImg(figure, form = 'standard', height = 160, { className = '' } = {}) {
  const w = Math.round((height * 400) / 560);
  const wrap = h('span', { class: `meta-fig ${className}`, style: { width: `${w}px`, height: `${height}px` } });
  const src = figure?.images?.[form] ?? `assets/figures/${figure?.id}_${form}.png`;
  const img = h('img', { src, alt: '', draggable: 'false' });
  img.addEventListener('error', () => img.replaceWith(blobSvg()), { once: true });
  wrap.append(img);
  return wrap;
}

/** Portrait via the render module when present, else a plain image. Supports stamp + grayscale. */
export function portrait(figure, opts = {}) {
  const { form = 'standard', height = 160, stamp = null, grayscale = false } = opts;
  if (renderMod?.createPortrait) {
    try {
      const el = renderMod.createPortrait(figure, { form, height, stamp, grayscale });
      if (el) return el;
    } catch (err) { console.warn('[meta] createPortrait failed', err); }
  }
  const el = figureImg(figure, form, height, { className: `meta-portrait${grayscale ? ' is-gray' : ''}` });
  if (stamp) el.append(h('span', { class: 'meta-stamp' }, stamp));
  return el;
}

/** Story text with local fallbacks, so ending/group photo work even if story.js is missing. */
const FALLBACK_STORY = {
  ENDINGS: {
    lanternOut: { title: 'The Lantern Goes Out', paragraphs: ['The last flame shivers and is gone.', 'The fog does not knock. It simply comes in.'] },
    dawn: { title: 'Dawn', paragraphs: ['The fog lifts from Fog Hollow.', 'Somewhere far away, a pale shape stays behind in the last of it.'] },
    twoSouls: { title: 'Two Souls', paragraphs: ['You open the door. The lantern light finds him.', 'Two equal silhouettes, two different souls.'] },
    newFog: { title: 'The New Fog', paragraphs: ['The lantern was too weak.', 'Now you are the one outside, knocking.'] },
  },
  GROUP_PHOTO: { title: 'The Group Photo', paragraphs: ['Everyone, both faces, in one picture.'] },
};
let storyCache = null;
export async function loadStory() {
  if (storyCache) return storyCache;
  try {
    const m = await import('../data/story.js');
    storyCache = {
      ENDINGS: { ...FALLBACK_STORY.ENDINGS, ...(m.ENDINGS ?? {}) },
      GROUP_PHOTO: m.GROUP_PHOTO ?? FALLBACK_STORY.GROUP_PHOTO,
    };
  } catch (err) {
    console.warn('[meta] story.js unavailable, using fallback text', err);
    storyCache = FALLBACK_STORY;
  }
  return storyCache;
}

const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export const REWARDS = [
  { at: 25, name: 'Cover stickers', text: 'Chalk\'s old album gets stickers on its cover.' },
  { at: 50, name: 'House decorations', text: 'The Lantern House gets cosier.' },
  { at: 75, name: 'Another door', text: 'An alternative door and a music box.' },
  { at: 100, name: 'The Group Photo', text: 'Everyone in both forms, in one picture.' },
];

/** Mark every reward that is reached by now (persisted when something changed). */
export function updateRewards(ctx) {
  const pct = albumCompletion(FIGURE_IDS);
  let changed = false;
  for (const r of REWARDS) {
    if (pct >= r.at && !store.album.rewards[String(r.at)]) {
      store.album.rewards[String(r.at)] = true;
      changed = true;
    }
  }
  if (changed) ctx?.save?.();
  return pct;
}

/* ------------------------------------------------------------------ */
/* Group photo (shared with the ending screen)                         */
/* ------------------------------------------------------------------ */

export function buildGroupPhoto(story) {
  const rowH = [112, 126, 140, 154];
  const per = Math.ceil(FIGURES.length / rowH.length);
  const rows = rowH.map((height, r) => {
    const slice = FIGURES.slice(r * per, r * per + per);
    return h('div', { class: 'end-photo-row', style: { marginTop: r ? `${-Math.round(height * 0.34)}px` : '0' } },
      slice.map((f, i) => h('div', { class: 'end-photo-pair', style: { transform: `translateY(${((i * 7 + r * 3) % 5) - 2}px)` } },
        figureImg(f, 'standard', height, { className: 'end-photo-fig' }),
        figureImg(f, 'monster', height, { className: 'end-photo-fig is-monster' }))));
  });
  const lines = story?.paragraphs ?? [];
  return h('div', { class: 'end-photo' },
    h('div', { class: 'end-photo-frame' },
      h('span', { class: 'end-tape end-tape-l' }),
      h('span', { class: 'end-tape end-tape-r' }),
      h('div', { class: 'end-photo-pic' },
        h('div', { class: 'end-photo-bunting' }),
        h('div', { class: 'end-photo-rows' }, rows),
        h('div', { class: 'end-photo-ground' })),
      h('div', { class: 'end-photo-caption' },
        h('h2', {}, story?.title ?? 'The Group Photo'),
        lines.map((p) => h('p', {}, p)))));
}

async function openGroupPhotoModal(ctx) {
  const story = (await loadStory()).GROUP_PHOTO;
  const close = () => m.close();
  const m = modal(h('div', { class: 'album-photo-wrap' },
    buildGroupPhoto(story),
    h('button', { class: 'btn small', onclick: close }, 'Close')), { className: 'album-photo-modal' });
  ctx?.audio?.sfx?.('pageTurn');
}

/* ------------------------------------------------------------------ */
/* Page content builders                                               */
/* ------------------------------------------------------------------ */

const CAT_LABEL = { food: 'Food', friend: 'Friend', habit: 'Habit' };

function factsBlock(f) {
  const known = knownFacts(f.id);
  return h('ul', { class: 'album-facts' }, (f.facts ?? []).map((fa, i) => {
    const isKnown = known.includes(i);
    return h('li', { class: isKnown ? 'is-known' : 'is-blank' },
      h('span', { class: 'album-fact-cat' }, CAT_LABEL[fa.cat] ?? fa.cat),
      isKnown
        ? h('span', { class: 'album-fact-text' }, h('em', {}, fa.q), ' ', fa.a)
        : h('span', { class: 'album-fact-text' }, '…'));
  }));
}

function oddityBlock(f) {
  if (!f.honestOddity) return null;
  return h('div', { class: 'album-oddity' },
    svg('svg', { viewBox: '0 0 40 40', width: 34, height: 34, class: 'album-oddity-mark', 'aria-hidden': 'true' },
      svg('path', { d: 'M20 5 L37 34 L3 34 Z', fill: 'none', stroke: '#a3231b', 'stroke-width': 3, 'stroke-linejoin': 'round' }),
      svg('path', { d: 'M20 14 L20 25', stroke: '#a3231b', 'stroke-width': 3, 'stroke-linecap': 'round' }),
      svg('circle', { cx: 20, cy: 30, r: 1.8, fill: '#a3231b' })),
    h('p', {}, h('b', {}, 'Careful. '), f.honestOddity.note));
}

function noteBlock(f) {
  return h('div', { class: 'album-note' },
    h('span', { class: 'album-note-label' }, 'Chalk\'s note'),
    h('p', {}, f.personality));
}

function knockButton(ctx, f) {
  return h('button', {
    class: 'btn small album-knock', type: 'button',
    onclick: () => { try { Promise.resolve(ctx.audio.knock(f, 'real')).catch(() => {}); } catch { /* silent */ } },
  }, 'Knock');
}

function figureLeftPage(ctx, f) {
  const met = !!store.album.met[f.id];
  return h('div', { class: 'album-fig-left' },
    h('div', { class: 'album-fig-top' },
      h('div', { class: 'album-photo-col' },
        h('div', { class: 'album-photo' },
          h('span', { class: 'album-tape album-tape-l' }),
          h('span', { class: 'album-tape album-tape-r' }),
          portrait(f, { form: 'standard', height: 272, stamp: met ? 'MET' : null })),
        knockButton(ctx, f)),
      h('div', { class: 'album-name-col' },
        h('div', { class: 'album-no' }, `No. ${f.number}`),
        h('h2', { class: 'album-name' }, f.name),
        noteBlock(f))),
    factsBlock(f),
    oddityBlock(f));
}

const HOW = {
  caught: 'Caught at the door.',
  jumpscare: 'Got in.',
  returner: 'Came back changed.',
};

function tellText(f, raw) {
  if (!raw) return 'I never noticed a tell.';
  const hit = (f.tells ?? []).find((t) => t.id === raw);
  return hit?.desc ?? raw;
}

function figureRightPage(f) {
  const m = store.album.monsters[f.id];
  if (!m) {
    return h('div', { class: 'album-fig-right is-empty' },
      h('div', { class: 'album-ghost' }, figureImg(f, 'standard', 250)),
      h('p', { class: 'album-unseen' }, 'Not seen. Yet.'));
  }
  return h('div', { class: 'album-fig-right' },
    h('div', { class: 'album-monster-frame' },
      h('span', { class: 'album-corner c1' }), h('span', { class: 'album-corner c2' }),
      h('span', { class: 'album-corner c3' }), h('span', { class: 'album-corner c4' }),
      portrait(f, { form: 'monster', height: 300 })),
    h('h3', { class: 'album-monster-title' }, f.monsterTitle),
    h('div', { class: 'album-monster-meta' },
      h('p', {}, h('b', {}, `Seen on night ${m.night ?? '?'}.`), ' ', HOW[m.how] ?? ''),
      h('p', { class: 'album-tell' }, h('span', { class: 'album-note-label' }, 'The tell'), ' ', tellText(f, m.tell))));
}

/* ------------------------------------------------------------------ */
/* Album screen                                                        */
/* ------------------------------------------------------------------ */

function rewardList(pct) {
  return h('ul', { class: 'album-rewards' }, REWARDS.map((r) => {
    const reached = pct >= r.at;
    return h('li', { class: reached ? 'is-reached' : '' },
      h('span', { class: 'album-reward-at' }, `${r.at}%`),
      h('span', { class: 'album-reward-text' }, h('b', {}, r.name), h('small', {}, r.text)),
      h('span', { class: 'album-reward-state' }, reached ? 'Yours' : 'Locked'));
  }));
}

function eyeMark() {
  return svg('svg', { viewBox: '0 0 30 20', width: 26, height: 17, class: 'album-eye', 'aria-label': 'Monster page seen' },
    svg('path', { d: 'M2 10 C 8 1, 22 1, 28 10 C 22 19, 8 19, 2 10 Z', fill: '#fff6e6', stroke: '#a3231b', 'stroke-width': 2, 'stroke-linejoin': 'round' }),
    svg('circle', { cx: 15, cy: 10, r: 4.2, fill: '#a3231b' }),
    svg('circle', { cx: 16.2, cy: 8.8, r: 1.2, fill: '#fff' }));
}

export default {
  _off: [],
  _timers: [],
  async mount(root, params, ctx) {
    await Promise.all([loadRender(), loadIcons()]);
    ctx.setMood('day');
    ctx.audio.music?.('menu');
    const backTo = params?.back ?? 'menu';
    const leaveAlbum = () => ctx.go(backTo);

    let view = { kind: 'index' };
    const startIdx = params?.figureId ? FIGURES.findIndex((f) => f.id === params.figureId) : -1;
    if (startIdx >= 0) view = { kind: 'fig', idx: startIdx };

    let flipping = false;
    const pct = updateRewards(ctx);

    const leftIn = h('div', { class: 'album-page-in' });
    const rightIn = h('div', { class: 'album-page-in' });
    const leftPage = h('section', { class: 'album-page album-page-l' }, leftIn);
    const rightPage = h('section', { class: 'album-page album-page-r' }, rightIn);
    const prevBtn = h('button', { class: 'album-turn album-turn-prev', type: 'button', 'aria-label': 'Previous page', onclick: () => go(-1) },
      svg('svg', { viewBox: '0 0 24 24', width: 22, height: 22 }, svg('path', { d: 'M15 4 L7 12 L15 20', fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })));
    const nextBtn = h('button', { class: 'album-turn album-turn-next', type: 'button', 'aria-label': 'Next page', onclick: () => go(1) },
      svg('svg', { viewBox: '0 0 24 24', width: 22, height: 22 }, svg('path', { d: 'M9 4 L17 12 L9 20', fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })));
    const folio = h('div', { class: 'album-folio' });
    const ribbon = h('button', { class: 'album-ribbon', type: 'button', onclick: () => toIndex() }, 'Index');
    const book = h('div', { class: 'album-book' }, leftPage, rightPage, h('div', { class: 'album-spine' }), prevBtn, nextBtn, folio, ribbon);

    const backBtn = h('button', { class: 'btn album-back', type: 'button', onclick: leaveAlbum }, 'Close the album');
    root.append(h('div', { class: 'album-root' },
      h('div', { class: 'album-desk' }),
      h('div', { class: 'album-lamp' }),
      backBtn,
      book,
      h('div', { class: 'album-hint' }, 'Left / Right turns the page. Esc closes.')));

    function fillIndex() {
      const p = albumCompletion(FIGURE_IDS);
      const metCount = FIGURE_IDS.filter((id) => store.album.met[id]).length;
      const monCount = FIGURE_IDS.filter((id) => store.album.monsters[id]).length;
      leftIn.replaceChildren(
        h('h1', { class: 'album-title' }, 'Chalk\'s Album'),
        h('p', { class: 'album-sub' }, 'Everyone who ever knocked at the Lantern House. Same shape, different souls.'),
        h('div', { class: 'album-complete' },
          h('span', { class: 'album-pct' }, `${p}%`),
          h('div', { class: 'album-meter', role: 'progressbar', 'aria-valuenow': p, 'aria-valuemin': 0, 'aria-valuemax': 100 },
            h('div', { class: 'album-meter-fill', style: { width: `${p}%` } }),
            REWARDS.map((r) => h('span', { class: `album-tick${p >= r.at ? ' is-on' : ''}`, style: { left: `${r.at}%` } })))),
        h('p', { class: 'album-counts' }, `Met ${metCount} of ${FIGURES.length}. Monster pages ${monCount} of ${FIGURES.length}.`),
        rewardList(p),
        ...(p >= 100 ? [h('button', { class: 'btn primary small album-photo-btn', type: 'button', onclick: () => openGroupPhotoModal(ctx) }, 'Look at the group photo')] : []));
      rightIn.replaceChildren(
        h('h2', { class: 'album-grid-title' }, 'Who came to the door'),
        h('div', { class: 'album-grid' }, FIGURES.map((f, i) => {
          const met = !!store.album.met[f.id];
          const mon = !!store.album.monsters[f.id];
          return h('button', {
            class: `album-cell${met ? '' : ' is-unmet'}`, type: 'button', 'data-id': f.id,
            'aria-label': `${f.name}${met ? '' : ', not met yet'}${mon ? ', monster page seen' : ''}`,
            onclick: () => openFigure(i),
          },
          h('span', { class: 'album-cell-pic' }, portrait(f, { form: 'standard', height: 92, grayscale: !met })),
          h('span', { class: 'album-cell-name' }, f.name),
          !met && h('span', { class: 'album-cell-q' }, '?'),
          mon && h('span', { class: 'album-cell-eye' }, eyeMark()));
        })));
      folio.textContent = 'Index';
      ribbon.classList.add('hidden');
      prevBtn.disabled = true;
      nextBtn.disabled = false;
    }

    function fillFigure(idx) {
      const f = FIGURES[idx];
      leftIn.replaceChildren(figureLeftPage(ctx, f));
      rightIn.replaceChildren(figureRightPage(f));
      folio.textContent = `${idx + 1} / ${FIGURES.length}`;
      ribbon.classList.remove('hidden');
      prevBtn.disabled = false;
      nextBtn.disabled = idx >= FIGURES.length - 1;
    }

    function fill() { if (view.kind === 'index') fillIndex(); else fillFigure(view.idx); }

    async function flip(dir, swap) {
      if (flipping || prefersReducedMotion()) { swap(); return; }
      flipping = true;
      ctx.audio.sfx?.('pageTurn');
      const leaf = h('div', { class: `album-leaf ${dir > 0 ? 'is-fwd' : 'is-back'}` }, h('div', { class: 'album-leaf-lines' }));
      book.append(leaf);
      const to = dir > 0 ? 'rotateY(-180deg)' : 'rotateY(180deg)';
      const anim = leaf.animate([
        { transform: 'rotateY(0deg)', opacity: 1 },
        { transform: `${dir > 0 ? 'rotateY(-90deg)' : 'rotateY(90deg)'}`, opacity: 1, offset: 0.5 },
        { transform: to, opacity: 1, offset: 0.85 },
        { transform: to, opacity: 0 },
      ], { duration: 720, easing: 'ease-in-out' });
      await sleep(340);
      swap();
      try { await anim.finished; } catch { /* cancelled */ }
      leaf.remove();
      flipping = false;
    }

    function setView(next) { view = next; fill(); }
    function openFigure(idx) { flip(1, () => setView({ kind: 'fig', idx })); }
    function toIndex() { if (view.kind !== 'index') flip(-1, () => setView({ kind: 'index' })); }
    function go(dir) {
      if (view.kind === 'index') {
        if (dir > 0) flip(1, () => setView({ kind: 'fig', idx: 0 }));
      } else if (dir < 0) {
        if (view.idx === 0) flip(-1, () => setView({ kind: 'index' }));
        else flip(-1, () => setView({ kind: 'fig', idx: view.idx - 1 }));
      } else if (view.idx < FIGURES.length - 1) {
        flip(1, () => setView({ kind: 'fig', idx: view.idx + 1 }));
      }
    }

    const onKey = (e) => {
      if (document.querySelector('#overlay .modal-backdrop')) {
        if (e.key === 'Escape') { document.querySelector('#overlay .modal-backdrop')?.remove(); e.preventDefault(); }
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { go(1); e.preventDefault(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { go(-1); e.preventDefault(); }
      else if (e.key === 'Escape') {
        if (view.kind === 'fig') toIndex(); else leaveAlbum();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    this._off.push(() => window.removeEventListener('keydown', onKey));

    fill();
    void pct;
  },
  unmount() {
    for (const off of this._off.splice(0)) off();
    for (const t of this._timers.splice(0)) clearTimeout(t);
  },
};

/* ------------------------------------------------------------------ */
/* Night-screen compare overlay                                        */
/* ------------------------------------------------------------------ */

/**
 * Album page as a panel over the left ~55 % of the stage (peephole stays visible on the right).
 * Shows the standard photo large plus Chalk's notes, facts and warnings. No monster page.
 */
export function openAlbumOverlay(ctx, { figureId, compare = true, onClose } = {}) {
  const host = ctx.overlay ?? document.getElementById('overlay');
  let idx = Math.max(0, FIGURES.findIndex((f) => f.id === figureId));
  let closed = false;

  const body = h('div', { class: 'album-ov-body' });
  const strip = h('div', { class: 'album-ov-strip', role: 'listbox', 'aria-label': 'Creatures' });
  const title = h('h2', { class: 'album-ov-title' }, compare ? 'Chalk\'s album' : 'Album');
  const closeBtn = h('button', { class: 'btn small album-ov-close', type: 'button', onclick: () => api.close() }, 'Close');
  const panel = h('div', { class: 'album-ov', role: 'dialog', 'aria-label': 'Album' },
    h('div', { class: 'album-ov-head' }, title, closeBtn),
    body,
    strip);
  host.append(panel);

  function fillBody() {
    const f = FIGURES[idx];
    const met = !!store.album.met[f.id];
    body.replaceChildren(
      h('div', { class: 'album-ov-photo' },
        h('div', { class: 'album-photo album-photo-big' },
          h('span', { class: 'album-tape album-tape-l' }),
          h('span', { class: 'album-tape album-tape-r' }),
          portrait(f, { form: 'standard', height: 392, stamp: met ? 'MET' : null })),
        knockButton(ctx, f)),
      h('div', { class: 'album-ov-text' },
        h('div', { class: 'album-no' }, `No. ${f.number}`),
        h('h2', { class: 'album-name' }, f.name),
        noteBlock(f),
        factsBlock(f),
        oddityBlock(f),
        !compare && store.album.monsters[f.id] && h('p', { class: 'album-tell' }, h('span', { class: 'album-note-label' }, f.monsterTitle), ' ', tellText(f, store.album.monsters[f.id].tell))));
    strip.querySelectorAll('.album-ov-chip').forEach((chip, i) => {
      chip.classList.toggle('is-current', i === idx);
      chip.setAttribute('aria-selected', i === idx ? 'true' : 'false');
    });
    strip.children[idx]?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }

  FIGURES.forEach((f, i) => {
    strip.append(h('button', {
      class: `album-ov-chip${store.album.met[f.id] ? '' : ' is-unmet'}`, type: 'button', role: 'option', title: f.name,
      onclick: () => select(i),
    }, portrait(f, { form: 'standard', height: 54, grayscale: !store.album.met[f.id] }), h('span', {}, f.name)));
  });

  function select(i) {
    if (i === idx || i < 0 || i >= FIGURES.length) return;
    idx = i;
    ctx.audio.sfx?.('pageTurn');
    fillBody();
  }

  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      api.close();
    } else if (e.key === 'ArrowRight') { select((idx + 1) % FIGURES.length); e.stopPropagation(); }
    else if (e.key === 'ArrowLeft') { select((idx - 1 + FIGURES.length) % FIGURES.length); e.stopPropagation(); }
  };
  window.addEventListener('keydown', onKey, true);

  const api = {
    close() {
      if (closed) return;
      closed = true;
      window.removeEventListener('keydown', onKey, true);
      panel.classList.add('is-closing');
      setTimeout(() => panel.remove(), 160);
      try { onClose?.(); } catch (err) { console.error(err); }
    },
  };

  loadRender().then(() => { if (!closed) { fillBody(); } });
  fillBody();
  ctx.audio.sfx?.('pageTurn');
  return api;
}

export { getFigure };
