// Same Shape — the night screen: the door, the peephole, the tools and the decision.
// Controller only; drawing lives in ./night/*.js and css/night.css. Contracts: docs/ARCHITECTURE.md.
import { h } from '../core/dom.js';
import { createRng } from '../core/rng.js';
import { knownFacts } from '../core/state.js';
import { getFigure } from '../data/figures.js';
import { createClock, Cancelled } from './night/clock.js';
import { loadDeps } from './night/deps.js';
import { buildScene, BOLT } from './night/scene.js';
import { createBubble, applyTextTell } from './night/bubble.js';
import { openCallPanel } from './night/callpanel.js';
import { openPauseMenu } from './night/pausemenu.js';

const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
const KNOCK_WORDS = { soft: 'knock', hard: 'KNOCK', scratch: 'scritch', beep: 'beep', roll: 'rrrrrr', thud: 'thud', stumble: 'tk-tk', slow: 'knock...' };
const ID = (e) => (typeof e === 'string' ? e : e?.figureId ?? e?.id);

class Night {
  constructor(root, params, ctx, deps) {
    this.root = root;
    this.ctx = ctx;
    this.store = ctx.store;
    this.deps = deps;
    this.audio = ctx.audio;
    this.clock = createClock();
    this.offs = [];
    this.anims = new Set();
    this.loops = new Set();
    const f = Number(ctx.params?.get?.('fast') ?? params?.fast ?? 0);
    this.speed = f > 0 ? (f >= 1 ? 0.1 : f) : 1;
    this.t = 0;
    this.phase = 'init';
    this.visit = null;
    this.figure = null;
    this.view = null;
    this.accepting = false;
    this.waiting = null;
    this.paused = false;
    this.settingsOpen = false;
    this.lightHeld = false;
    this.shadowUntil = 0;
    this.eHold = null;
    this.dead = false;
  }

  get run() { return this.store.run; }
  get reduced() { return !!this.store.settings.reduceScares; }
  say(name, ...args) { try { return this.audio[name]?.(...args); } catch (err) { console.warn('[night] audio', name, err); return undefined; } }
  sfx(name) { this.say('sfx', name); }

  // ------------------------------------------------------------------ setup
  async init() {
    const { ctx, deps } = this;
    const run = this.run;
    ctx.setMood('night');
    this.cfg = deps.nightConfig(run);
    // Resume a night from run.nightPlan (regenerating would advance rngState and give a different night).
    const plan = run.nightPlan;
    const resume = run.phase === 'night' && Array.isArray(plan) && plan.length && String(plan[0]?.id ?? '').startsWith(`n${run.night}-`);
    this.rng = createRng((run.seed ?? 1) * 31 + run.night);
    deps.rules.startNight(run, this.cfg);
    this.visits = resume ? plan.map((v) => ({ ...v })) : deps.generateNight(run, this.cfg);
    const cut = Number(ctx.params?.get?.('cut') ?? 0); // debug: keep only the last N visits
    if (cut > 0) this.visits = this.visits.slice(-cut);
    run.phase = 'night';
    ctx.save();

    this.outageIndex = -1;
    if (this.cfg.events?.includes('powerOutage') && this.visits.length > 2) {
      this.outageIndex = this.rng.int(1, Math.max(1, this.visits.length - 2));
    }

    const S = (this.S = buildScene({ run, cfg: this.cfg, deps }));
    this.bubble = createBubble(this.clock);
    S.root.insertBefore(this.bubble.el, S.table ?? null);
    this.root.append(S.root);
    this.blackout = h('div', { class: 'fade-black' });
    S.root.append(this.blackout);
    this.fogEdge = null;
    try {
      this.fogEdge = deps.effects.createFogEdge(440);
      const host = h('div', { class: 'fog-edge-host' }, this.fogEdge.el);
      S.peep.insertBefore(host, S.cover);
      this.fogEdge.set(0);
    } catch (err) { console.warn('[night] fog edge failed', err); }

    S.setDoorDamage(Math.max(0, run.maxDoor - run.door));
    S.setBattery(run.battery);
    S.setMirror(run.tools?.mirrorLeft ?? this.cfg.mirrorUses ?? 3);
    S.setQuestions(2);
    S.setTally(this.visits.length, 0);
    this.refreshResidents();
    this.bind();
    this.unTick = this.clock.onTick((dt) => this.tick(dt));
    window.__NIGHT = this.debugApi();
    this.say('music', 'night');
    this.say('ambient', 'night');
  }

  debugApi() {
    const self = this;
    return {
      get phase() { return self.phase; },
      get visit() { return self.visit; },
      get index() { return self.index; },
      get total() { return self.visits.length; },
      get cfg() { return self.cfg; },
      get fallbacks() { return self.deps.used; },
      get accepting() { return self.accepting; },
      get pat() { return self.pat ? { ...self.pat } : null; },
      get qLeft() { return self.qLeft; },
      get paused() { return self.paused; },
      get speed() { return self.speed; },
      get outageIndex() { return self.outageIndex; },
      get callOpen() { return !!self.call; },
    };
  }

  bind() {
    const S = this.S;
    const on = (el, ev, fn, opts) => { el.addEventListener(ev, fn, opts); this.offs.push(() => el.removeEventListener(ev, fn, opts)); };
    this.on = on;
    on(S.flap, 'click', () => { S.flap.blur(); this.onFlap(); });
    on(S.cover, 'click', () => this.openPeephole());
    on(S.pause, 'click', () => { S.pause.blur(); this.pauseGame(); });
    on(S.residents, 'click', () => S.residents.classList.toggle('big'));

    // bolt: drag the knob sideways
    let drag = null;
    on(S.knob, 'pointerdown', (e) => {
      e.preventDefault();
      if (!this.canDecide(true)) { S.bolt.classList.remove('nudge'); void S.bolt.offsetWidth; S.bolt.classList.add('nudge'); return; }
      S.knob.setPointerCapture?.(e.pointerId);
      drag = { id: e.pointerId, x0: this.ctx.toStage(e.clientX, e.clientY).x, p: 0 };
      this.sfx('uiClick');
    });
    on(S.knob, 'pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const x = this.ctx.toStage(e.clientX, e.clientY).x;
      drag.p = clampN((drag.x0 - x) / BOLT.travel, 0, 1);
      S.setBolt(drag.p);
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const p = drag.p;
      drag = null;
      if (p >= 0.9) this.emit({ kind: 'admit' });
      else S.setBolt(0, true);
    };
    on(S.knob, 'pointerup', end);
    on(S.knob, 'pointercancel', end);

    // tools
    const T = S.tools;
    if (T.album) on(T.album.el, 'click', () => { T.album.el.blur(); this.toggleAlbum(); });
    if (T.questions) on(T.questions.el, 'click', () => { T.questions.el.blur(); this.toggleQuestions(); });
    if (T.mirror) on(T.mirror.el, 'click', () => { T.mirror.el.blur(); this.useMirror(); });
    if (T.callToDoor) on(T.callToDoor.el, 'click', () => { T.callToDoor.el.blur(); this.callToDoor(); });
    if (T.flashlight) {
      on(T.flashlight.el, 'pointerdown', (e) => { e.preventDefault(); this.lightDown(); });
      on(window, 'pointerup', () => this.lightUp());
      on(window, 'pointercancel', () => this.lightUp());
    }
    on(window, 'keydown', (e) => this.onKeyDown(e));
    on(window, 'keyup', (e) => this.onKeyUp(e));
    on(window, 'blur', () => { this.lightUp(); this.eRelease(); });
  }

  // ------------------------------------------------------------------ input
  onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === 'Escape') {
      e.preventDefault();
      if (this.settingsOpen) return;
      if (this.paused) { this.pauseHandle?.resume(); return; }
      if (this.call) { this.call.cancel(); return; }
      if (this.albumH) { this.albumH.close(); return; }
      if (!this.S.qMenu.classList.contains('hidden')) { this.closeQuestions(); return; }
      if (this.S.residents.classList.contains('big')) { this.S.residents.classList.remove('big'); return; }
      this.pauseGame();
      return;
    }
    if (this.paused || this.settingsOpen) return;
    if (k === ' ' || k === 'Spacebar') { e.preventDefault(); if (!e.repeat) this.openPeephole(); return; }
    if (k === 'Tab') { e.preventDefault(); if (!e.repeat) this.S.residents.classList.toggle('big'); return; }
    if (e.repeat) return;
    switch (k.toLowerCase()) {
      case '1': this.toggleAlbum(); break;
      case '2': this.toggleQuestions(); break;
      case '3': this.lightDown(); break;
      case '4': this.useMirror(); break;
      case 'c': this.callToDoor(); break;
      case 'q': this.onReject(); break;
      case 'e': this.eStart(); break;
      default: break;
    }
  }

  onKeyUp(e) {
    if (e.key === ' ') e.preventDefault();
    const k = e.key.toLowerCase();
    if (k === '3') this.lightUp();
    if (k === 'e') this.eRelease();
  }

  canDecide(toastIt = false) {
    if (this.phase === 'open' && this.accepting && this.t > (this.guardUntil ?? 0)) return true;
    if (toastIt) {
      if (this.phase === 'waitOpen' || this.phase === 'knock') this.toast('Look through the peephole first.');
      else if (this.phase === 'open' && this.t <= (this.guardUntil ?? 0)) { /* too fast: ignore silently */ }
    }
    return false;
  }

  onFlap() {
    if (this.phase === 'waitOpen') this.openPeephole();
    else this.onReject();
  }

  onReject() {
    if (!this.canDecide(false)) return;
    this.S.flap.classList.add('slammed');
    setTimeout(() => this.S.flap.classList.remove('slammed'), 260);
    this.emit({ kind: 'reject' });
  }

  eStart() {
    if (this.eHold) return;
    if (!this.canDecide(true)) return;
    this.eHold = { t: 0 };
  }

  eRelease() {
    if (!this.eHold) return;
    this.eHold = null;
    this.S.setBolt(0, true);
  }

  // ------------------------------------------------------------------ per-frame
  tick(dt) {
    this.t += dt;
    if (this.eHold) {
      this.eHold.t += dt;
      const p = clampN(this.eHold.t / 0.5, 0, 1);
      this.S.setBolt(p);
      if (p >= 1) { this.eHold = null; if (this.canDecide(false)) this.emit({ kind: 'admit' }); else this.S.setBolt(0, true); }
    }
    if (this.pat && this.phase === 'open' && !this.call) {
      this.pat.left -= dt * this.pat.drain;
      const progress = clampN(1 - this.pat.left / this.pat.total, 0, 1);
      this.fogEdge?.set(progress);
      const level = clampN((progress - 0.7) / 0.3, 0, 1);
      if (Math.abs(level - (this.hbLevel ?? 0)) > 0.04 || (level === 0 && this.hbLevel)) { this.hbLevel = level; this.say('heartbeat', level); }
      if (this.pat.left <= 0 && this.accepting) this.emit({ kind: 'timeout' });
    }
    if (this.lit && !this.lightHeld && this.t >= this.shadowUntil) this.hideLight();
    if (this.lit && this.visit?.dark && this.view) this.view.setDark(false);
  }

  // ------------------------------------------------------------------ events
  emit(ev) {
    if (!this.accepting || this.dead) return;
    this.accepting = false;
    const w = this.waiting;
    this.waiting = null;
    w?.(ev);
  }

  nextEvent() {
    this.accepting = true;
    return new Promise((resolve) => { this.waiting = resolve; });
  }

  // ------------------------------------------------------------------ small helpers
  toast(text, { bad = false, ms = 2300 } = {}) {
    const el = this.S.toast;
    el.textContent = text;
    el.classList.toggle('bad', bad);
    el.classList.add('on');
    this.cancelToast?.();
    this.cancelToast = this.clock.later(ms, () => el.classList.remove('on'));
  }

  loop(name, on) {
    if (on) this.loops.add(name); else this.loops.delete(name);
    this.say('loop', name, on);
  }

  stopLoops() {
    for (const n of [...this.loops]) this.say('loop', n, false);
    this.loops.clear();
    this.say('heartbeat', 0);
    this.hbLevel = 0;
  }

  async anim(el, keyframes, ms, opts = {}) {
    const a = el.animate(keyframes, { duration: ms, fill: 'forwards', easing: 'ease-in-out', ...opts });
    this.anims.add(a);
    await this.clock.wait(ms);
    return a;
  }

  speak(text, extra = {}) {
    if (!text || !this.figure) return;
    const distort = !!this.visit?.tells?.some((t) => t.effect === 'distort');
    Promise.resolve(this.say('voice', this.figure, text, { monster: distort, distort, ...extra })).catch(() => {});
  }

  insideList() {
    const run = this.run;
    const out = [];
    const add = (e) => { const id = ID(e); if (id) out.push({ id, name: getFigure(id)?.name ?? id }); };
    (run.guests ?? []).forEach(add);
    (run.monstersInside ?? []).forEach(add);
    return out;
  }

  refreshResidents(highlight = null, warn = '') {
    this.S.setResidents(this.insideList(), { highlight, warn, beds: this.run.beds });
  }

  // ------------------------------------------------------------------ the night
  async play() {
    try {
      await this.intro();
      for (let i = 0; i < this.visits.length; i++) {
        this.index = i;
        try {
          const finished = await this.runVisit(this.visits[i], i);
          if (finished === 'end') return;
        } catch (err) {
          if (err instanceof Cancelled) throw err;
          console.error('[night] visit failed', err);
          this.cleanupVisit();
        }
        this.ctx.save();
        await this.clock.wait(550);
      }
      await this.endNight();
    } catch (err) {
      if (!(err instanceof Cancelled)) console.error('[night] night failed', err);
    }
  }

  async intro() {
    const el = h('div', { class: 'night-intro' }, h('h1', {}, `Night ${this.run.night}`));
    this.S.root.append(el);
    this.say('sfx', 'creak');
    await this.clock.wait(1900);
    el.remove();
    await this.clock.wait(500);
  }

  cleanupVisit() {
    this.stopLoops();
    this.hideLight(true);
    this.hideMirror(true);
    this.closeQuestions();
    this.albumH?.close();
    this.albumH = null;
    this.call?.cancel();
    for (const a of this.anims) { try { a.cancel(); } catch { /* ignore */ } }
    this.anims.clear();
    this.view?.destroy?.();
    this.view = null;
    this.S.figureHolder.replaceChildren();
    this.S.figureHolder.classList.remove('in', 'lit');
    this.S.peep.classList.add('closed');
    this.S.peep.classList.remove('lit', 'beam-on', 'slamming');
    this.S.setFlap(false);
    this.S.setBolt(0);
    this.S.setCandle(false);
    this.S.tools.callToDoor?.el.classList.add('hidden');
    this.bubble.hide();
    this.fogEdge?.set(0);
    this.pat = null;
    this.lightHeld = false;
    this.eHold = null;
    this.accepting = false;
    this.waiting = null;
  }

  async runVisit(raw, idx) {
    const { deps, S, run } = this;
    const visit = deps.prepareVisit(run, raw) ?? raw;
    this.visits[idx] = visit;
    this.phase = 'between';
    this.visit = visit;
    this.figure = getFigure(visit.figureId) ?? getFigure('nimi');
    this.qLeft = 2;
    this.t0 = this.t;
    this.guardUntil = 0;
    S.setQuestions(2);
    S.setTally(this.visits.length, idx);
    S.setBattery(run.battery);
    S.setMirror(run.tools?.mirrorLeft ?? 3);
    S.setDoorDamage(Math.max(0, run.maxDoor - run.door));
    const faceless = visit.type === 'faceless';
    this.faceless = faceless;
    S.root.classList.toggle('finale', faceless);

    if (idx === this.outageIndex) await this.powerOutage();

    // knock
    this.phase = 'knock';
    if (faceless) this.say('music', 'finale');
    await this.knock();
    this.phase = 'waitOpen';
    S.cover.classList.add('wait');
    this.openRequested = false;
    const autoMs = 6000 * (this.speed < 1 ? 0.25 : 1);
    this.autoOpenOff = this.clock.later(autoMs, () => this.openPeephole());
    await new Promise((resolve) => { this.openResolve = resolve; if (this.openRequested) resolve(); });
    this.autoOpenOff?.();
    if (this.dead) throw new Cancelled();

    await this.openSequence();

    // wait for the decision
    let outcome = null;
    while (!outcome) {
      if (this.dead) throw new Cancelled();
      const ev = await this.nextEvent();
      if (this.dead) throw new Cancelled();
      if (ev.kind === 'call') {
        outcome = await this.handleCall();
        if (outcome === 'cancel') outcome = null;
      } else if (faceless) {
        outcome = await this.handleFaceless(ev.kind === 'admit');
      } else if (ev.kind === 'admit') {
        outcome = await this.handleAdmit();
      } else if (ev.kind === 'reject') {
        outcome = await this.handleReject('reject');
      } else if (ev.kind === 'timeout') {
        outcome = visit.isMonster ? await this.handleMonsterTimeout() : await this.handleReject('timeout');
      }
    }
    this.cleanupVisit();
    if (outcome === 'finale') {
      await this.endNight();
      return 'end';
    }
    return outcome;
  }

  // ------------------------------------------------------------------ visit parts
  async powerOutage() {
    const { S } = this;
    this.sfx('powerOut');
    try { this.deps.effects.lightFlicker(S.root, { duration: 900 }); } catch (err) { console.warn(err); }
    await this.clock.wait(900);
    S.root.classList.add('outage');
    this.outage = true;
    const left = this.run.tools?.flashlightLeft;
    this.toast(left != null ? `The lights went out. Only ${left} charge${left === 1 ? '' : 's'} left for tonight...` : 'The lights went out.', { ms: 3200 });
    await this.clock.wait(700);
  }

  async knock() {
    const { visit, figure, S } = this;
    const pattern = figure.knock?.[visit.knock] ?? figure.knock?.real ?? [0, 260];
    const word = KNOCK_WORDS[figure.knock?.style] ?? 'knock';
    const dur = (pattern[pattern.length - 1] ?? 0) + 500;
    pattern.forEach((off, i) => {
      this.clock.later(off, () => {
        const el = h('div', { class: 'knock-word', style: {
          left: `${382 + (i % 3) * 38 + Math.random() * 20}px`, top: `${300 + ((i * 53) % 150) + Math.random() * 20}px`,
        } }, word);
        el.style.setProperty('--r', `${(Math.random() * 14 - 7).toFixed(1)}deg`);
        S.knockLayer.append(el);
        setTimeout(() => el.remove(), 1500);
      });
    });
    const played = Promise.resolve(this.say('knock', figure, visit.knock)).catch(() => {});
    await this.clock.wait(dur);
    await Promise.race([played, this.clock.wait(1500)]);
  }

  openPeephole() {
    if (this.phase !== 'waitOpen' || this.openRequested) return;
    this.openRequested = true;
    this.openResolve?.();
  }

  async openSequence() {
    const { S, visit, figure, deps } = this;
    this.phase = 'open';
    this.guardUntil = this.t + 0.75;
    this.sfx('peepholeOpen');
    S.setFlap(true);
    S.peep.classList.remove('closed');
    S.cover.classList.remove('wait');

    try {
      this.view = deps.createFigureView(figure, {
        form: 'standard', tells: visit.tells ?? [], height: 400, blink: true, honestOddity: !visit.isMonster, dark: !!visit.dark,
      });
      S.figureHolder.replaceChildren(this.view.el);
      if (visit.dark) this.view.setDark(true);
    } catch (err) {
      console.error('[night] figure view failed', err);
    }
    requestAnimationFrame(() => S.figureHolder.classList.add('in'));

    // audio tells
    if (visit.tells?.some((t) => t.effect === 'ticking')) this.loop('ticking', true);
    if (visit.dark) this.loop('whisper', true);
    if (figure.id === 'glitch') this.loop('static', true);
    if (S.candle) {
      const flick = !!visit.candleFlicker || figure.id === 'zipp';
      S.setCandle(flick);
      if (flick) this.sfx('candle');
    }

    // greeting
    let text;
    if (this.faceless) text = '...';
    else if (visit.dark) text = `It's me, ${figure.name}...`;
    else if (visit.type === 'returner') text = figure.returnerLine ?? figure.greeting;
    else text = figure.greeting;
    const tell = visit.textTell;
    text = applyTextTell(text, tell, figure.name, { greeting: true });
    this.bubble.say(text, { effect: tell === 'typo' ? null : tell });
    if (!this.faceless) this.speak(text);

    // patience
    if (this.faceless) this.pat = null;
    else {
      const total = (visit.patience ?? 60) * this.speed;
      this.pat = { total, left: total, drain: visit.tells?.some((t) => t.effect === 'impatient') ? 2 : 1 };
    }
    this.fogEdge?.set(0);

    // resident list / call to the door
    const inside = this.insideList();
    const hit = inside.find((r) => r.id === visit.figureId);
    if (hit && !this.faceless) {
      this.refreshResidents(hit.id, `${hit.name} is already inside!`);
      if (this.cfg.tools.includes('residents')) {
        this.sfx('penScratch');
        this.S.residents.classList.add('big');
        this.clock.later(2200, () => this.S.residents.classList.remove('big'));
      }
      if (this.cfg.tools.includes('callToDoor')) S.tools.callToDoor?.el.classList.remove('hidden');
    } else {
      this.refreshResidents();
      if (visit.insideConflict && this.cfg.tools.includes('callToDoor')) S.tools.callToDoor?.el.classList.remove('hidden');
    }
  }

  // ------------------------------------------------------------------ decisions
  async handleAdmit() {
    const { visit, run, S } = this;
    const res = this.deps.rules.resolveDecision(run, visit, 'admit');
    if (res.outcome === 'noBed') {
      this.sfx('creak');
      this.toast("There's no bed left.", { bad: true });
      this.bubble.say(res.line && res.line.length < 60 ? res.line : "There's no bed left.", { speed: 22 });
      S.setBolt(0, true);
      await this.clock.wait(500);
      return null;
    }
    await this.playAdmit();
    return 'done';
  }

  async playAdmit() {
    const { S, figure } = this;
    this.hideLight(true);
    S.figureHolder.classList.remove('lit');
    this.loop('ticking', false);
    this.loop('whisper', false);
    this.bubble.say(figure.admitLine ?? 'Thank you!');
    this.speak(figure.admitLine ?? 'Thank you!');
    this.sfx('bolt');
    S.setBolt(1, true);
    await this.clock.wait(550);
    this.sfx('doorOpen');
    try { this.deps.effects.flash(this.ctx.stage, { color: this.reduced ? 'rgba(242,184,75,.25)' : 'rgba(242,184,75,.55)', duration: 450 }); } catch { /* ignore */ }
    this.view?.setDark?.(false);
    this.fogEdge?.set(0);
    await this.clock.wait(350);
    this.sfx('footstepsIn');
    await this.anim(S.figureHolder, [
      { transform: 'translateX(-50%) scale(1)', filter: 'none', opacity: 1 },
      { transform: 'translateX(calc(-50% + 30px)) scale(1.07)', filter: 'brightness(0.45)', opacity: 1, offset: 0.3 },
      { transform: 'translateX(calc(-50% + 380px)) scale(1.28)', filter: 'brightness(0)', opacity: 0.9 },
    ], 1000, { easing: 'ease-in' });
    this.refreshResidents();
    this.sfx('penScratch');
    await this.clock.wait(450);
    this.sfx('peepholeClose');
  }

  async playWalkAway({ sad = true, ms = 1500 } = {}) {
    const { S } = this;
    this.hideLight(true);
    S.figureHolder.classList.remove('lit');
    this.sfx('footstepsAway');
    this.fogEdge?.set(sad ? 0.55 : 0.4);
    await this.anim(S.figureHolder, [
      { transform: 'translateX(-50%) translateY(0) scale(1)', opacity: 1, filter: 'none' },
      { transform: 'translateX(-50%) translateY(10px) scale(0.97, 0.94)', opacity: 1, filter: 'none', offset: 0.2 },
      { transform: 'translateX(calc(-50% - 20px)) translateY(8px) scale(0.75)', opacity: 0.75, filter: 'blur(1.5px)', offset: 0.65 },
      { transform: 'translateX(calc(-50% - 50px)) translateY(-6px) scale(0.5)', opacity: 0, filter: 'blur(5px)' },
    ], ms);
  }

  async handleReject(kind) {
    const { visit, run, S, figure } = this;
    const res = this.deps.rules.resolveDecision(run, visit, kind === 'timeout' ? 'timeout' : 'reject');
    this.loop('ticking', false);
    this.loop('whisper', false);
    this.say('heartbeat', 0);
    if (kind === 'reject') this.sfx('peepholeClose');
    const caught = res.outcome === 'monsterCaught' || res.reveal;
    if (caught) {
      this.bubble.hide();
      this.sfx('reveal');
      this.view?.setDark?.(false);
      if (!this.reduced) this.speak('AAAAAAH!', { monster: true, distort: true });
      try { await this.deps.effects.reveal(S.peep, figure, { reduced: this.reduced }); } catch (err) { console.warn(err); }
      await this.anim(S.figureHolder, [{ opacity: 1 }, { opacity: 0 }], 450);
      this.toast('It was a monster.', { ms: 1800 });
      await this.clock.wait(500);
    } else {
      const line = kind === 'timeout' ? '... okay. Goodnight.' : (figure.rejectLine ?? 'Oh... okay.');
      this.bubble.say(line);
      this.speak(line);
      await this.playWalkAway({ sad: true });
      await this.clock.wait(300);
    }
    return 'done';
  }

  async handleMonsterTimeout() {
    const { visit, run, S, figure } = this;
    this.loop('ticking', false);
    this.say('heartbeat', 0);
    this.hbLevel = 0;
    const res = this.deps.rules.hammer(run, visit);
    this.bubble.hide();
    this.sfx('hammer');
    if (!this.reduced) { try { this.deps.effects.shake(S.scene, { intensity: 10, duration: 500 }); } catch { /* ignore */ } }
    S.setDoorDamage(Math.max(0, run.maxDoor - (res.door ?? run.door)));
    this.view?.setDark?.(false);
    try { await this.deps.effects.reveal(S.peep, figure, { reduced: this.reduced }); } catch (err) { console.warn(err); }
    if (res.brokeIn) {
      this.sfx('doorSlam');
      this.toast('The door gave way!', { bad: true, ms: 2600 });
      try { this.deps.effects.flash(this.ctx.stage, { color: this.reduced ? 'rgba(163,35,27,.25)' : 'rgba(163,35,27,.6)', duration: 500 }); } catch { /* ignore */ }
        this.refreshResidents();
      await this.anim(S.figureHolder, [
        { transform: 'translateX(-50%) scale(1)', opacity: 1 },
        { transform: 'translateX(-50%) scale(1.5)', filter: 'brightness(0)', opacity: 0.9 },
      ], 700, { easing: 'ease-in' });
      this.sfx('footstepsIn');
    } else {
      this.deps.rules.resolveDecision(run, visit, 'timeout');
        this.toast(`Something hammered at the door.`, { bad: true, ms: 2200 });
      await this.playWalkAway({ sad: false, ms: 900 });
    }
    await this.clock.wait(400);
    return 'done';
  }

  async handleFaceless(open) {
    const { S, run } = this;
    this.deps.rules.decideFaceless(run, open);
    this.say('heartbeat', 0);
    this.bubble.hide();
    if (open) {
      this.sfx('bolt');
      S.setBolt(1, true);
      await this.clock.wait(900);
      this.sfx('doorOpen');
      this.sfx('footstepsIn');
      this.blackout.style.transition = 'opacity 2.4s';
      this.blackout.style.background = '#e9e2cf';
      this.blackout.classList.add('on');
      await this.anim(S.figureHolder, [
        { transform: 'translateX(-50%) scale(1)', opacity: 1 },
        { transform: 'translateX(calc(-50% + 40px)) scale(1.15)', opacity: 1, offset: 0.4 },
        { transform: 'translateX(calc(-50% + 300px)) scale(1.3)', opacity: 0.6 },
      ], 2400, { easing: 'ease-in' });
    } else {
      this.sfx('peepholeClose');
      this.sfx('doorSlam');
      this.blackout.style.transition = 'opacity 2.4s';
      this.blackout.classList.add('on');
      await this.anim(S.figureHolder, [{ opacity: 1 }, { opacity: 0.2 }], 2400);
    }
    return 'finale';
  }

  async handleCall() {
    const { visit, figure, S } = this;
    if (!this.cfg.tools.includes('callToDoor')) return 'cancel';
    const inside = this.insideList();
    if (!inside.some((r) => r.id === visit.figureId)) { this.toast('Nobody by that name is inside.'); return 'cancel'; }
    const insideIsMonster = !!visit.insideConflict?.insideIsMonster;
    const insideEntry = (this.run.monstersInside ?? []).find((e) => ID(e) === visit.figureId);
    const insideTells = insideIsMonster ? (insideEntry?.tells ?? []) : [];
    const doorTells = visit.isMonster ? (visit.tells ?? []) : [];
    this.albumH?.close();
    this.closeQuestions();
    this.sfx('chime');
    this.call = openCallPanel(S.root, { figure, doorTells, insideTells, insideIsMonster, doorIsMonster: !!visit.isMonster, reduced: this.reduced, deps: this.deps, clock: this.clock });
    const side = await this.call.choice;
    if (!side) { this.call.close(); this.call = null; this.accepting = false; return 'cancel'; }
    const res = this.deps.rules.resolveTwoOfThem(this.run, visit, side);
    const monsterSide = insideIsMonster ? 'inside' : 'door';
    this.sfx('reveal');
    await this.call.showResult(res, monsterSide, side);
    this.call.close();
    this.call = null;
    this.refreshResidents();
    if (side === 'inside') {
      // The one at the door is believed: they come in.
      await this.playAdmit();
      this.refreshResidents();
    } else {
      this.bubble.say(res?.correct ? '...' : (figure.rejectLine ?? 'Oh...'));
      await this.playWalkAway({ sad: !res?.correct });
    }
    return 'done';
  }

  // ------------------------------------------------------------------ tools
  setToolActive(id, on) { this.S.tools[id]?.el.classList.toggle('active', on); }

  needOpen() {
    if (this.phase === 'open') return true;
    this.toast('Look through the peephole first.');
    return false;
  }

  toggleAlbum() {
    if (!this.S.tools.album || this.call) return;
    if (this.albumH) { this.albumH.close(); return; }
    if (!this.needOpen()) return;
    if (this.faceless) { this.toast('The pages are blank.'); this.sfx('pageTurn'); return; }
    this.closeQuestions();
    this.sfx('pageTurn');
    this.setToolActive('album', true);
    try {
      this.albumH = this.deps.openAlbumOverlay(this.ctx, {
        figureId: this.visit.figureId, compare: true,
        onClose: () => { this.albumH = null; this.setToolActive('album', false); },
      }) ?? null;
      if (!this.albumH) this.setToolActive('album', false);
    } catch (err) {
      console.error('[night] album overlay failed', err);
      this.setToolActive('album', false);
    }
  }

  closeQuestions() {
    this.S.qMenu.classList.add('hidden');
    this.setToolActive('questions', false);
  }

  toggleQuestions() {
    const { S } = this;
    if (!S.tools.questions || this.call) return;
    if (!S.qMenu.classList.contains('hidden')) { this.closeQuestions(); return; }
    if (!this.needOpen()) return;
    if (this.faceless) { this.toast('It does not answer.'); return; }
    if (this.qLeft <= 0) { this.toast('You have asked enough.'); S.tools.questions.el.classList.add('shake'); setTimeout(() => S.tools.questions.el.classList.remove('shake'), 400); return; }
    this.albumH?.close();
    this.setToolActive('questions', true);
    const figure = this.figure;
    const idxs = knownFacts(figure.id).filter((i) => figure.facts?.[i]);
    const items = [{ which: 'name', q: "What's your name?" }, ...idxs.map((i) => ({ which: i, q: figure.facts[i].q }))];
    S.qMenu.replaceChildren(
      h('div', { class: 'q-title' }, 'Ask', h('small', {}, `${this.qLeft} left`)),
      ...items.map((it) => h('button', { class: 'q-item', onclick: () => this.ask(it) }, it.q)));
    S.qMenu.classList.remove('hidden');
  }

  ask(item) {
    if (this.qLeft <= 0 || this.phase !== 'open') return;
    this.closeQuestions();
    this.qLeft--;
    this.S.setQuestions(this.qLeft);
    if (this.pat) this.pat.left -= 10 * this.speed;
    this.sfx('penScratch');
    let res;
    try { res = this.deps.rules.answerQuestion(this.run, this.visit, item.which); } catch (err) { console.error(err); }
    const name = this.figure.name;
    let text = res?.text ?? '...';
    const tell = res?.textTell ?? null;
    text = applyTextTell(text, tell, name);
    this.bubble.say(text, { effect: tell === 'typo' ? null : tell, question: item.q });
    this.speak(text);
  }

  lightDown() {
    const { S } = this;
    if (!S.tools.flashlight || this.lightHeld || this.call) return;
    if (this.phase !== 'open') { if (this.phase !== 'init') this.toast('Nothing to light up yet.'); return; }
    this.lightHeld = true;
    this.setToolActive('flashlight', true);
    const stillShowing = this.lit && this.t < this.shadowUntil;
    if (this.faceless) {
      this.sfx('flashlightOn');
      S.peep.classList.add('beam-on', 'lit');
      S.figureHolder.classList.add('lit');
      this.lit = true;
      this.shadowUntil = this.t + 1.5;
      this.toast('Only light. No shadow.');
      return;
    }
    if (!stillShowing) {
      const r = this.deps.rules.useTool(this.run, 'flashlight');
      if (!r?.ok) {
        this.lightHeld = false;
        this.setToolActive('flashlight', false);
        this.sfx('uiClick');
        const outage = this.run.tools?.flashlightLeft != null && this.cfg.flashlightUses != null;
        this.toast(r?.reason === 'none-left' && outage ? 'No charges left. The outage allows only a few tonight.' : 'The battery is dead.', { bad: true });
        S.tools.flashlight.el.classList.add('shake');
        setTimeout(() => S.tools.flashlight.el.classList.remove('shake'), 400);
        return;
      }
      S.setBattery(this.run.battery);
      this.shadowUntil = this.t + 1.5;
      this.showShadow();
    }
    this.sfx('flashlightOn');
    S.peep.classList.add('beam-on');
    this.lit = true;
  }

  showShadow() {
    const { S, visit, figure } = this;
    this.hideShadowView();
    try {
      if (typeof this.deps.createShadowView === 'function') {
        this.shadowView = this.deps.createShadowView(figure, { form: visit.isMonster ? 'monster' : 'standard', height: 410, flicker: !!visit.shadowFlicker });
        S.shadowHolder.replaceChildren(this.shadowView.el);
      }
    } catch (err) { console.warn('[night] shadow view failed', err); }
    S.shadowHolder.classList.add('on');
    S.peep.classList.add('lit');
    S.figureHolder.classList.add('lit');
    this.lit = true;
  }

  hideShadowView() {
    try { this.shadowView?.destroy?.(); } catch { /* ignore */ }
    this.shadowView = null;
    this.S.shadowHolder.replaceChildren();
  }

  lightUp() {
    if (!this.lightHeld) return;
    this.lightHeld = false;
    this.setToolActive('flashlight', false);
    this.sfx('flashlightOff');
    this.S.peep.classList.remove('beam-on');
    if (this.faceless) this.shadowUntil = 0;
  }

  hideLight(force = false) {
    const { S } = this;
    S.peep.classList.remove('lit', 'beam-on');
    S.shadowHolder.classList.remove('on');
    S.figureHolder.classList.remove('lit');
    this.lit = false;
    if (force) this.hideShadowView();
    else this.clock.later(250, () => { if (!this.lit) this.hideShadowView(); });
    if (this.visit?.dark && this.view && !this.lit) this.view.setDark(true);
  }

  useMirror() {
    const { S } = this;
    if (!S.tools.mirror || this.call || this.mirrorShowing) return;
    if (!this.needOpen()) return;
    const fogged = this.faceless;
    if (!fogged) {
      const r = this.deps.rules.useTool(this.run, 'mirror');
      if (!r?.ok) {
        this.toast('No looks left tonight.', { bad: true });
        S.tools.mirror.el.classList.add('shake');
        setTimeout(() => S.tools.mirror.el.classList.remove('shake'), 400);
        return;
      }
      S.setMirror(this.run.tools?.mirrorLeft ?? 0);
    }
    this.sfx('mirror');
    this.mirrorShowing = true;
    this.setToolActive('mirror', true);
    S.mirrorGlass.replaceChildren();
    S.mirror.classList.toggle('fogged', fogged);
    if (fogged) this.toast('The mirror fogs over.');
    else {
      try {
        this.mirrorView = this.deps.createMirrorView(this.figure, { form: this.visit.isMonster ? 'monster' : 'standard', size: 190 });
        S.mirrorGlass.append(this.mirrorView.el);
      } catch (err) { console.warn('[night] mirror view failed', err); }
    }
    S.mirror.classList.add('on');
    this.mirrorOff = this.clock.later(2100, () => this.hideMirror());
  }

  hideMirror(force = false) {
    this.mirrorOff?.();
    this.mirrorOff = null;
    this.S.mirror.classList.remove('on');
    this.setToolActive('mirror', false);
    this.mirrorShowing = false;
    const cleanup = () => { try { this.mirrorView?.destroy?.(); } catch { /* ignore */ } this.mirrorView = null; this.S.mirrorGlass.replaceChildren(); };
    if (force) cleanup(); else this.clock.later(350, () => { if (!this.mirrorShowing) cleanup(); });
  }

  callToDoor() {
    const { S } = this;
    if (!S.tools.callToDoor || S.tools.callToDoor.el.classList.contains('hidden')) return;
    if (this.phase === 'open' && this.accepting) this.emit({ kind: 'call' });
  }

  // ------------------------------------------------------------------ pause
  pauseGame() {
    if (this.paused || this.dead) return;
    this.paused = true;
    this.clock.pause(true);
    this.say('heartbeat', 0);
    this.lightUp();
    this.pauseHandle = openPauseMenu({
      ctx: this.ctx,
      deps: this.deps,
      onResume: () => { this.paused = false; this.clock.pause(false); this.pauseHandle = null; this.hbLevel = -1; },
      onQuit: () => { this.paused = false; this.quit(); },
      onSettings: (v) => { this.settingsOpen = v; },
    });
  }

  quit() {
    this.say('stopAll');
    this.ctx.save();
    this.ctx.go('menu');
  }

  // ------------------------------------------------------------------ end of night
  async endNight() {
    const { run, S } = this;
    this.phase = 'end';
    this.cleanupVisit();
    const prevFlames = run.flames;
    const wasFinale = this.faceless;
    const report = this.deps.rules.finishNight(run);
    this.bubble.hide();
    this.hbLevel = 0;
    if (!wasFinale) {
      this.toast('The night goes quiet...', { ms: 1800 });
      await this.clock.wait(1200);
    }
    if (report?.jumpscare) {
      this.sfx('creak');
      this.say('heartbeat', 0.9);
      await this.clock.wait(1100);
      this.say('heartbeat', 0);
      this.jumpIdx = ((this.jumpIdx ?? run.night) % 3) + 1;
      this.sfx(`jumpscare${this.jumpIdx}`);
      const fig = getFigure(report.jumpscare.figureId) ?? this.figure;
      try { await this.deps.effects.jumpscare(this.ctx.stage, fig, { reduced: this.reduced }); } catch (err) { console.error('[night] jumpscare failed', err); }
      await this.clock.wait(300);
    }
    const lost = Math.max(0, prevFlames - (report?.flames ?? prevFlames));
    for (let k = 0; k < lost; k++) {
      this.sfx('flameOut');
      S.flameOut(prevFlames - 1 - k);
      await this.clock.wait(700);
    }
    if (lost) await this.clock.wait(500);
    this.ctx.save();
    if (!wasFinale || !this.blackout.classList.contains('on')) {
      this.blackout.style.transition = 'opacity 1s';
      this.blackout.classList.add('on');
      await this.clock.wait(1000);
    } else {
      await this.clock.wait(600);
    }
    this.finish(report);
  }

  finish(report) {
    const ending = report?.endingId;
    if (ending && this.faceless) this.ctx.go('ending', { endingId: ending });
    else this.ctx.go('morning', { report });
  }

  // ------------------------------------------------------------------ teardown
  destroy() {
    if (this.dead) return;
    this.dead = true;
    this.unTick?.();
    this.offs.forEach((off) => off());
    this.offs = [];
    this.stopLoops();
    this.waiting?.({ kind: 'cancel' });
    this.openResolve?.();
    this.pauseHandle?.close?.();
    try { this.albumH?.close?.(); } catch { /* ignore */ }
    this.call?.close?.();
    this.hideShadowView();
    try { this.mirrorView?.destroy?.(); } catch { /* ignore */ }
    try { this.view?.destroy?.(); } catch { /* ignore */ }
    try { this.fogEdge?.destroy?.(); } catch { /* ignore */ }
    for (const a of this.anims) { try { a.cancel(); } catch { /* ignore */ } }
    this.anims.clear();
    this.bubble?.destroy();
    this.clock.destroy();
    this.S?.root.remove();
    if (window.__NIGHT && window.__NIGHT.phase !== undefined) delete window.__NIGHT;
  }
}

let current = null;
let mountId = 0;

export default {
  async mount(root, params, ctx) {
    const my = ++mountId;
    const run = ctx.store.run;
    if (!run) { ctx.go('menu'); return; }
    const deps = await loadDeps();
    if (my !== mountId) return; // unmounted while loading
    const night = new Night(root, params, ctx, deps);
    current = night;
    await night.init();
    if (night.dead) return;
    night.play().catch((err) => { if (!(err instanceof Cancelled)) console.error(err); }); // not awaited: the router must not block
  },
  unmount() {
    mountId++;
    current?.destroy();
    current = null;
  },
};
