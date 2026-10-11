// Same Shape — procedural audio (Web Audio only, no sample files required).
// Contract: docs/ARCHITECTURE.md#audio.  Design notes: docs/notes/audio.md.
//
// Graph:  sources -> per-call gain -> route (dry | room | hall) -> sfxBus ----\
//         ambience instances -> ambBus -> sfxBus -------------------------------+-> master -> limiter -> soft clip -> out
//         music instances -> lowpass -> musicBus (+ music reverb) --------------/
//
// Everything is created lazily in audio.init() (first user gesture). Before init every method
// is a safe no-op that returns a resolved promise (the last requested music/ambient mode is
// remembered and started on init).
import { bus } from '../core/bus.js';
import { store } from '../core/state.js';

// ---------------------------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------------------------
const EPS = 0.0001;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const NOTE_BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteNum(s) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(s);
  return 12 * (Number(m[3]) + 1) + NOTE_BASE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const numWord = (n) => (n <= 10 ? NUM_WORDS[n] : 'many');
const plural = (n) => (n === 1 ? '' : 's');
const scared = () => !!(store && store.settings && store.settings.reduceScares);

function caption(text) {
  try { bus.emit('caption', text); } catch { /* bus handlers are isolated already */ }
}

// ---------------------------------------------------------------------------------------------
// the lullaby: 16 bars, 3/4, G major.  "Same melody, different soul": night/finale reuse it.
// ---------------------------------------------------------------------------------------------
const MELODY = [
  [['B4', 1], ['D5', 1.5], ['B4', 0.5]],   //  1  G
  [['G4', 1], ['A4', 1], ['B4', 1]],       //  2  G
  [['D5', 1], ['G5', 1.5], ['E5', 0.5]],   //  3  Em
  [['D5', 3]],                             //  4  G
  [['B4', 1], ['D5', 1.5], ['B4', 0.5]],   //  5  G
  [['G4', 1], ['A4', 1], ['B4', 1]],       //  6  G
  [['C5', 1], ['B4', 1], ['A4', 1]],       //  7  D
  [['G4', 3]],                             //  8  G
  [['E5', 1.5], ['F#5', 0.5], ['G5', 1]],  //  9  Em
  [['A5', 1.5], ['G5', 0.5], ['F#5', 1]],  // 10  D
  [['E5', 1.5], ['D5', 0.5], ['C5', 1]],   // 11  C
  [['A4', 1], ['B4', 1], ['D5', 1]],       // 12  D (half cadence)
  [['B4', 1], ['D5', 1.5], ['B4', 0.5]],   // 13  G
  [['G5', 1], ['E5', 1], ['C5', 1]],       // 14  C
  [['D5', 1.5], ['C5', 0.5], ['A4', 1]],   // 15  D
  [['G4', 3]],                             // 16  G
];
const CHORD_OF_BAR = ['G', 'G', 'Em', 'G', 'G', 'G', 'D', 'G', 'Em', 'D', 'C', 'D', 'G', 'C', 'D', 'G'];
const CHORDS = {
  G: { root: 43, tones: [59, 62, 67] },
  Em: { root: 40, tones: [55, 59, 64] },
  D: { root: 38, tones: [57, 62, 66] },
  C: { root: 48, tones: [55, 60, 64] },
};
const BAR_BEATS = 3;
const TOTAL_BEATS = BAR_BEATS * MELODY.length;
// Flattened event list: m = melody note, b = bass, c = chord pluck, p = pad.
const SEQ = (() => {
  const seq = [];
  MELODY.forEach((bar, bi) => {
    const base = bi * BAR_BEATS;
    const ch = CHORDS[CHORD_OF_BAR[bi]];
    seq.push({ pos: base, k: 'p', bar: bi, chord: ch, dur: BAR_BEATS });
    seq.push({ pos: base, k: 'b', bar: bi, midi: [ch.root], dur: 3 });
    seq.push({ pos: base + 1, k: 'c', bar: bi, midi: [ch.tones[1], ch.tones[2]], dur: 2 });
    seq.push({ pos: base + 2, k: 'c', bar: bi, midi: [ch.tones[0], ch.tones[1]], dur: 1 });
    let pos = base;
    for (const [name, beats] of bar) {
      seq.push({ pos, k: 'm', bar: bi, midi: [noteNum(name)], dur: beats });
      pos += beats;
    }
  });
  const order = { m: 0, b: 1, p: 2, c: 3 };
  seq.sort((a, b) => a.pos - b.pos || order[a.k] - order[b.k]);
  return seq;
})();
const FINALE_NOTES = 10; // phrase A, then the box runs out

// ---------------------------------------------------------------------------------------------
// knock styles
// ---------------------------------------------------------------------------------------------
const KNOCK_STYLES = {
  soft: { body: 150, tone: 1500, dur: 0.09, vel: 0.3 },
  hard: { body: 95, tone: 900, dur: 0.2, vel: 0.85 },
  thud: { body: 58, tone: 300, dur: 0.34, vel: 1.0, dull: true },
  roll: { body: 135, tone: 1800, dur: 0.05, vel: 0.34 },
  slow: { body: 55, tone: 350, dur: 0.7, vel: 1.0, dull: true, boom: 0.9 },
  stumble: { body: 120, tone: 1000, dur: 0.13, vel: 0.62 },
};
const KNOCK_TAIL_MS = { soft: 420, hard: 650, thud: 800, roll: 450, slow: 1500, stumble: 1000, scratch: 450, beep: 300 };

// ---------------------------------------------------------------------------------------------
// engine factory (the realtime singleton and the offline test renders share it)
// ---------------------------------------------------------------------------------------------
export function createAudioEngine(ctx, opts = {}) {
  const offline = !!opts.offline;
  const rate = ctx.sampleRate;
  const vol = { master: 0.8, music: 0.6, sfx: 0.9, ...(opts.volumes || {}) };
  let volumesApplied = false;

  // ---- noise / impulse buffers -----------------------------------------------------------
  const NB = (() => {
    const len = Math.floor(rate * 4);
    const mk = (l = len) => ctx.createBuffer(1, l, rate);
    const white = mk(), pink = mk(), brown = mk(), crackle = mk(Math.floor(rate * 6));
    const w = white.getChannelData(0);
    for (let i = 0; i < len; i++) w[i] = Math.random() * 2 - 1;
    const normalise = (d, target) => {
      let s = 0;
      for (let i = 0; i < d.length; i++) s += d[i] * d[i];
      const k = target / Math.sqrt(s / d.length || 1);
      for (let i = 0; i < d.length; i++) d[i] = clamp(d[i] * k, -1, 1);
    };
    const seam = (d) => { // crossfade the end into the start so the loop point does not click
      const n = Math.min(2400, d.length >> 2);
      for (let k = 0; k < n; k++) {
        const a = k / n;
        d[d.length - n + k] = d[d.length - n + k] * (1 - a) + d[k] * a;
      }
    };
    const p = pink.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const x = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759;
      b2 = 0.969 * b2 + x * 0.153852; b3 = 0.8665 * b3 + x * 0.3104856;
      b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
      p[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362; b6 = x * 0.115926;
    }
    normalise(p, 0.3); seam(p);
    const br = brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; br[i] = last; }
    normalise(br, 0.3); seam(br);
    const c = crackle.getChannelData(0);
    const bursts = Math.floor(6 * 16);
    for (let n = 0; n < bursts; n++) {
      const pos = Math.floor(Math.random() * (c.length - 2000));
      const big = Math.random() < 0.12;
      const amp = big ? rand(0.35, 0.8) : Math.pow(Math.random(), 2.5) * 0.35 + 0.03;
      const tau = big ? rand(30, 160) : rand(4, 40);
      const l = Math.floor(tau * 6);
      for (let j = 0; j < l; j++) c[pos + j] += (Math.random() * 2 - 1) * amp * Math.exp(-j / tau);
    }
    for (let i = 0; i < c.length; i++) c[i] = clamp(c[i], -1, 1);
    return { white, pink, brown, crackle };
  })();

  function makeIR(seconds, decay, darkness) {
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let y = 0;
      for (let i = 0; i < len; i++) {
        const k = i / len;
        const a = clamp(0.95 - k * darkness, 0.08, 1);
        y += ((Math.random() * 2 - 1) - y) * a;
        d[i] = y * Math.pow(1 - k, decay) * (i < 90 ? i / 90 : 1);
      }
    }
    return buf;
  }

  // ---- main graph ---------------------------------------------------------------------------
  const master = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10; limiter.knee.value = 8; limiter.ratio.value = 14;
  limiter.attack.value = 0.003; limiter.release.value = 0.22;
  const clip = ctx.createWaveShaper(); // gentle tanh stage: unity slope near 0, hard ceiling ~0.80
  {
    const n = 2048, c = new Float32Array(n);
    for (let i = 0; i < n; i++) c[i] = Math.tanh(0.9 * (i / (n - 1) * 2 - 1)) / 0.9;
    clip.curve = c; clip.oversample = '2x';
  }
  master.connect(limiter); limiter.connect(clip); clip.connect(ctx.destination);
  const musicBus = ctx.createGain(); musicBus.connect(master);
  const sfxBus = ctx.createGain(); sfxBus.connect(master);
  const ambBus = ctx.createGain(); ambBus.gain.value = 0.25; ambBus.connect(sfxBus);

  const revRoom = ctx.createConvolver(); revRoom.buffer = makeIR(0.9, 3, 0.7);
  const revHall = ctx.createConvolver(); revHall.buffer = makeIR(3.2, 2.4, 0.9);
  const revMusic = ctx.createConvolver(); revMusic.buffer = makeIR(2.6, 2.6, 0.85);
  const revRoomRet = ctx.createGain(); revRoomRet.gain.value = 0.8; revRoom.connect(revRoomRet); revRoomRet.connect(sfxBus);
  const revHallRet = ctx.createGain(); revHallRet.gain.value = 0.75; revHall.connect(revHallRet); revHallRet.connect(sfxBus);
  const revMusicRet = ctx.createGain(); revMusicRet.gain.value = 0.9; revMusic.connect(revMusicRet); revMusicRet.connect(musicBus);

  const R = { dry: ctx.createGain(), room: ctx.createGain(), hall: ctx.createGain() };
  R.dry.connect(sfxBus);
  R.room.connect(sfxBus); { const s = ctx.createGain(); s.gain.value = 0.22; R.room.connect(s); s.connect(revRoom); }
  R.hall.connect(sfxBus); { const s = ctx.createGain(); s.gain.value = 0.5; R.hall.connect(s); s.connect(revHall); }

  function setVolumes(v = {}) {
    for (const k of ['master', 'music', 'sfx']) if (typeof v[k] === 'number' && Number.isFinite(v[k])) vol[k] = clamp(v[k], 0, 1);
    const targets = [
      [master.gain, Math.pow(vol.master, 1.5)],
      [musicBus.gain, Math.pow(vol.music, 1.5) * 0.6],
      [sfxBus.gain, Math.pow(vol.sfx, 1.5)],
    ];
    const now = ctx.currentTime;
    for (const [p, val] of targets) {
      if (!volumesApplied) p.setValueAtTime(val, now);
      else { p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); p.linearRampToValueAtTime(val, now + 0.06); }
    }
    volumesApplied = true;
  }
  setVolumes(vol);

  // ---- node lifetime helpers ------------------------------------------------------------------
  function finish(endT, srcs, nodes = [], cleanup = null) {
    let remaining = srcs.length;
    for (const s of srcs) {
      try { s.stop(endT); } catch { /* already stopped */ }
      s.addEventListener('ended', () => {
        try { s.disconnect(); } catch { /* */ }
        if (--remaining === 0) {
          for (const n of nodes) { try { n.disconnect(); } catch { /* */ } }
          if (cleanup) { try { cleanup(); } catch { /* */ } }
        }
      });
    }
  }
  function dummySrc() { const s = ctx.createConstantSource(); s.offset.value = 0; s.start(); return s; }
  const waits = new Set();
  function wait(ms) {
    if (offline) return Promise.resolve();
    return new Promise((res) => {
      const w = { res };
      w.timer = setTimeout(() => { waits.delete(w); res(); }, Math.max(0, ms));
      waits.add(w);
    });
  }

  // per-call output so stopAll() can duck everything that is still sounding
  const live = new Set();
  function mkCall(route = 'room', extraHall = 0) {
    const out = ctx.createGain();
    out.connect(R[route] || R.room);
    const nodes = [out];
    if (extraHall) { const s = ctx.createGain(); s.gain.value = extraHall; out.connect(s); s.connect(revHall); nodes.push(s); }
    const call = { out, nodes, timer: null };
    live.add(call);
    return call;
  }
  function endCall(call, endT) {
    const ms = Math.max(0, (endT - ctx.currentTime) * 1000) + 400;
    const done = () => { live.delete(call); for (const n of call.nodes) { try { n.disconnect(); } catch { /* */ } } };
    if (offline) return;
    call.timer = setTimeout(done, ms);
  }

  // ---- synthesis primitives -------------------------------------------------------------------
  function env(p, t, a, peak, d) {
    p.setValueAtTime(EPS, t);
    p.linearRampToValueAtTime(Math.max(peak, EPS * 2), t + a);
    p.exponentialRampToValueAtTime(EPS, t + a + d);
  }
  function chainFilters(src, specs, t, dur, nodes) {
    let prev = src;
    for (const sp of specs || []) {
      const b = ctx.createBiquadFilter();
      b.type = sp.type;
      b.frequency.setValueAtTime(sp.f, t);
      if (sp.f2) b.frequency.exponentialRampToValueAtTime(sp.f2, t + (sp.sweep ?? dur));
      b.Q.value = sp.q ?? 0.707;
      prev.connect(b); prev = b; nodes.push(b);
    }
    return prev;
  }
  function tone(o) {
    const { type = 'sine', f, f2 = null, t, a = 0.004, d = 0.2, g = 0.3, dest, filt, detune = 0, pitch = null, glide = null, pan = null } = o;
    const nodes = [];
    const os = ctx.createOscillator();
    os.type = type;
    os.frequency.setValueAtTime(f, t);
    if (f2 != null) os.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + (glide ?? (a + d)));
    if (detune) os.detune.value = detune;
    if (pitch) pitch.connect(os.detune);
    const gn = ctx.createGain(); env(gn.gain, t, a, g, d); nodes.push(gn);
    chainFilters(os, filt, t, a + d, nodes).connect(gn);
    let outN = gn;
    if (pan != null) { const p = ctx.createStereoPanner(); p.pan.value = pan; gn.connect(p); nodes.push(p); outN = p; }
    outN.connect(dest);
    os.start(t);
    finish(t + a + d + 0.06, [os], nodes, pitch ? () => { try { pitch.disconnect(os.detune); } catch { /* */ } } : null);
    return gn;
  }
  function noiseSrc(kind, t) {
    const s = ctx.createBufferSource();
    s.buffer = NB[kind]; s.loop = true;
    s.start(t, Math.random() * (NB[kind].duration - 0.2));
    return s;
  }
  function noise(o) {
    const { kind = 'white', t, a = 0.003, d = 0.1, g = 0.3, dest, filt, pan = null } = o;
    const nodes = [];
    const s = noiseSrc(kind, t);
    const gn = ctx.createGain(); env(gn.gain, t, a, g, d); nodes.push(gn);
    chainFilters(s, filt, t, a + d, nodes).connect(gn);
    let outN = gn;
    if (pan != null) { const p = ctx.createStereoPanner(); p.pan.value = pan; gn.connect(p); nodes.push(p); outN = p; }
    outN.connect(dest);
    finish(t + a + d + 0.06, [s], nodes);
    return gn;
  }
  function tick(t, out, f = 2000, g = 0.3, d = 0.012) {
    tone({ f, f2: f * 0.6, t, a: 0.0005, d, g: g * 0.8, dest: out });
    noise({ t, a: 0.0003, d: d * 0.8, g: g * 3, dest: out, filt: [{ type: 'bandpass', f: f * 1.3, q: 1.5 }] });
  }
  function crushCurve(levels) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) c[i] = Math.round((i / (n - 1) * 2 - 1) * levels) / levels;
    return c;
  }
  function driveCurve(k) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
    return c;
  }
  function shaper(curve) { const w = ctx.createWaveShaper(); w.curve = curve; w.oversample = '2x'; return w; }

  // wooden door knock: modal ring + door body + knuckle click (+ grit when monster)
  function woodHit(t, out, o = {}) {
    const { body = 100, vel = 0.6, dur = 0.15, tone: bright = 1100, monster = false, dull = false, boom = 0 } = o;
    const b = monster ? body * 0.84 : body;
    const modes = [[1, 1, 1], [2.35, 0.55, 0.62], [3.9, 0.32, 0.4], [6.1, 0.18, 0.25]];
    for (const [r, amp, dm] of modes) {
      const fr = b * r;
      tone({ f: fr * (r === 1 ? 1.25 : 1), f2: fr, t, a: 0.0012, d: dur * dm * 1.6, g: vel * 0.26 * amp, dest: out, glide: 0.03, detune: monster ? rand(-35, 35) : 0 });
    }
    tone({ f: b * 0.52, f2: b * 0.42, t, a: 0.002, d: dur * 2.0, g: vel * 0.4, dest: out });
    if (!dull) noise({ t, a: 0.0006, d: 0.022, g: vel * 1.6, dest: out, filt: [{ type: 'bandpass', f: bright, q: 1.3 }] });
    noise({ t, a: 0.0006, d: 0.012, g: vel * (dull ? 0.15 : 0.45), dest: out, filt: [{ type: dull ? 'bandpass' : 'highpass', f: dull ? 700 : 3000, q: 1 }] });
    if (monster) noise({ t: t + 0.01, a: 0.004, d: dur * 1.4, g: vel * 1.6, dest: out, filt: [{ type: 'bandpass', f: b * 3.2, q: 2.2 }] });
    if (boom) tone({ f: b * 0.62, f2: b * 0.36, t, a: 0.004, d: boom, g: vel * 0.55, dest: out });
  }
  function scratchStroke(t, out, vol = 0.5, dur = 0.24, low = false) {
    const nodes = [];
    const s = noiseSrc('white', t);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = low ? 400 : 800;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.0;
    bp.frequency.setValueAtTime(low ? 1500 : 2300, t); bp.frequency.linearRampToValueAtTime(low ? 2300 : 3400, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(EPS, t);
    const steps = Math.max(4, Math.round(dur * 30));
    for (let i = 0; i < steps; i++) {
      const ti = t + dur * i / steps;
      g.gain.linearRampToValueAtTime(vol * rand(0.5, 1) * Math.sin(Math.PI * (i + 0.5) / steps), ti + dur / steps * 0.45);
      g.gain.linearRampToValueAtTime(vol * 0.12, ti + dur / steps * 0.95);
    }
    g.gain.linearRampToValueAtTime(EPS, t + dur + 0.03);
    s.connect(hp); hp.connect(bp); bp.connect(g); g.connect(out);
    nodes.push(hp, bp, g);
    finish(t + dur + 0.08, [s], nodes);
  }
  function creak(t, dest, { vol = 0.3, dur = rand(0.5, 1.0), base = rand(75, 125), rise = false } = {}) {
    const nodes = [];
    const os = ctx.createOscillator(); os.type = 'sawtooth';
    const g = ctx.createGain();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = rand(420, 720); bp.Q.value = 6;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 160;
    os.frequency.setValueAtTime(base, t); g.gain.setValueAtTime(EPS, t);
    const steps = Math.max(5, Math.round(dur * 14));
    for (let i = 1; i <= steps; i++) {
      const ti = t + dur * i / steps;
      os.frequency.linearRampToValueAtTime(base * (rise ? 1 + i / steps * 0.5 : 1) * rand(0.82, 1.22), ti);
      g.gain.linearRampToValueAtTime(vol * 3 * rand(0.15, 1) * Math.pow(Math.max(0, Math.sin(Math.PI * i / steps)), 0.6), ti);
    }
    g.gain.linearRampToValueAtTime(EPS, t + dur + 0.05);
    os.connect(bp); bp.connect(hp); hp.connect(g); g.connect(dest);
    nodes.push(g, bp, hp);
    os.start(t);
    finish(t + dur + 0.12, [os], nodes);
    return dur;
  }

  // ---------------------------------------------------------------------------------------------
  // music
  // ---------------------------------------------------------------------------------------------
  function boxNote(f, t, vel, dest, o = {}) {
    if (!(f > 20) || f > 9000) return;
    const dec = o.decay ?? clamp(3.1 - f / 800, 0.6, 2.8);
    const cents = o.cents || 0;
    const nodes = [], srcs = [];
    const mix = ctx.createGain(); mix.connect(dest); nodes.push(mix);
    const parts = [[1, 1, dec], [2.0, 0.26, dec * 0.5], [4.1, 0.09, dec * 0.2], [6.7, 0.035, dec * 0.1]];
    for (const [r, amp, dd] of parts) {
      const fr = f * r;
      if (fr > 14000) continue;
      const os = ctx.createOscillator();
      os.frequency.value = fr; os.detune.value = cents;
      if (o.pitch) o.pitch.connect(os.detune);
      const gn = ctx.createGain(); env(gn.gain, t, 0.0015, vel * amp * 0.55, dd);
      os.connect(gn); gn.connect(mix); os.start(t);
      srcs.push(os); nodes.push(gn);
    }
    // tiny tine click
    const ns = noiseSrc('white', t);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
    const cg = ctx.createGain(); env(cg.gain, t, 0.0005, vel * 0.07, 0.006);
    ns.connect(hp); hp.connect(cg); cg.connect(mix); srcs.push(ns); nodes.push(hp, cg);
    finish(t + dec + 0.25, srcs, nodes, o.pitch ? () => { for (const s of srcs) { try { o.pitch.disconnect(s.detune); } catch { /* */ } } } : null);
  }
  function padChord(c, midis, t, dur, vel) {
    const nodes = [], srcs = [];
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(EPS, t);
    g.gain.linearRampToValueAtTime(vel, t + Math.min(0.7, dur * 0.4));
    g.gain.setValueAtTime(vel, t + dur);
    g.gain.linearRampToValueAtTime(EPS, t + dur + 1.0);
    lp.connect(g); g.connect(c.in); nodes.push(lp, g);
    for (const m of midis) {
      const os = ctx.createOscillator(); os.type = 'triangle';
      os.frequency.value = mtof(m); os.detune.value = rand(-6, 6) + c.baseCents;
      if (c.pitch) c.pitch.connect(os.detune);
      os.connect(lp); os.start(t); srcs.push(os);
    }
    finish(t + dur + 1.05, srcs, nodes, c.pitch ? () => { for (const s of srcs) { try { c.pitch.disconnect(s.detune); } catch { /* */ } } } : null);
  }

  let musicMode = 'off';
  let cur = null;

  function makeMusic(mode) {
    const c = {
      mode, srcs: [], nodes: [], idx: 0, played: 0, done: false, pitch: null, baseCents: 0, nextPop: 0,
      nextTime: ctx.currentTime + 0.12, finishAt: 0,
    };
    c.out = ctx.createGain(); c.out.gain.value = 0; c.out.connect(musicBus);
    c.lp = ctx.createBiquadFilter(); c.lp.type = 'lowpass'; c.lp.frequency.value = mode === 'night' ? 4800 : 12000;
    c.in = ctx.createGain(); c.in.connect(c.lp); c.lp.connect(c.out);
    const send = ctx.createGain(); send.gain.value = mode === 'night' || mode === 'finale' ? 0.6 : 0.32;
    c.lp.connect(send); send.connect(revMusic);
    c.nodes.push(c.out, c.lp, c.in, send);
    if (mode === 'night' || mode === 'finale') {
      const ps = ctx.createConstantSource(); ps.offset.value = 0; ps.start();
      const addLfo = (f, depth) => {
        const o = ctx.createOscillator(); o.frequency.value = f; const g = ctx.createGain(); g.gain.value = depth;
        o.connect(g); g.connect(ps.offset); o.start(); c.srcs.push(o); c.nodes.push(g);
      };
      addLfo(0.37, 16); addLfo(0.11, 13); addLfo(0.031, 20);
      c.pitch = ps; c.srcs.push(ps);
      c.baseCents = mode === 'night' ? -20 : 0;
    }
    if (mode === 'night') {
      // tape hiss + wow in level + low rumble
      const hiss = noiseSrc('white', ctx.currentTime);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
      const l = ctx.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = 9500;
      const hg = ctx.createGain(); hg.gain.value = 0.017;
      const wow = ctx.createOscillator(); wow.frequency.value = 0.23; const wg = ctx.createGain(); wg.gain.value = 0.006; wow.connect(wg); wg.connect(hg.gain); wow.start();
      hiss.connect(hp); hp.connect(l); l.connect(hg); hg.connect(c.out);
      const rum = noiseSrc('brown', ctx.currentTime);
      const rl = ctx.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 110;
      const rg = ctx.createGain(); rg.gain.value = 0.22; rum.connect(rl); rl.connect(rg); rg.connect(c.out);
      c.srcs.push(hiss, wow, rum); c.nodes.push(hp, l, hg, wg, rl, rg);
    }
    return c;
  }
  function retire(inst, fade) {
    const now = ctx.currentTime;
    inst.dead = true;
    inst.out.gain.cancelScheduledValues(now);
    inst.out.gain.setValueAtTime(inst.out.gain.value, now);
    inst.out.gain.linearRampToValueAtTime(0, now + fade);
    finish(now + fade + 0.1, inst.srcs.length ? inst.srcs : [dummySrc()], inst.nodes);
  }

  function beatSec(c) {
    switch (c.mode) {
      case 'menu': return 60 / 96;
      case 'day': return 60 / 112;
      case 'night': return (60 / 60) * (1 + 0.06 * Math.sin(c.nextTime * 0.31) + 0.035 * Math.sin(c.nextTime * 1.7 + 1));
      case 'finale': { const p = clamp(c.played / FINALE_NOTES, 0, 1); return (60 / 66) * (1 + 5.2 * Math.pow(p, 2.2)); }
      default: return 0.55;
    }
  }
  function playEvent(c, ev, t) {
    const night = c.mode === 'night', fin = c.mode === 'finale';
    const prog = fin ? clamp(c.played / FINALE_NOTES, 0, 1) : 0;
    const sag = fin ? -1500 * Math.pow(prog, 1.3) : 0;
    const base = { pitch: c.pitch, cents: c.baseCents + sag };
    if (fin) c.lp.frequency.setTargetAtTime(Math.max(900, 9000 - 8000 * prog), t, 0.6);
    const sc = scared();
    switch (ev.k) {
      case 'm': {
        if (night && Math.random() < 0.1) return;
        let m = ev.midi[0];
        if (night && Math.random() < 0.09) m += pick([1, -1, 6, -2, 11]);
        const vel = fin ? 0.5 * (1 - 0.45 * prog) : night ? rand(0.32, 0.5) : 0.52;
        const when = night ? t + rand(-0.025, 0.045) : t;
        const dec = night ? clamp(3.4 - mtof(m) / 700, 1.0, 3.2) : fin ? clamp(3.4 - mtof(m) / 700, 1.0, 3.2) : undefined;
        boxNote(mtof(m), when, vel, c.in, { ...base, decay: dec });
        if (night && Math.random() < 0.06) boxNote(mtof(m), when + 0.02, vel * 0.5, c.in, { ...base, cents: base.cents + rand(35, 70), decay: dec });
        if (fin) c.played++;
        break;
      }
      case 'b': {
        if (fin && ev.bar > 1) return;
        if (night && Math.random() > 0.6) return;
        const m = night ? ev.midi[0] - 12 : ev.midi[0];
        boxNote(mtof(m), t, night ? 0.35 : 0.3, c.in, { ...base, decay: 2.4 });
        break;
      }
      case 'c': {
        if (fin) return;
        if (night && Math.random() > 0.25) return;
        const vel = night ? 0.14 : 0.2;
        ev.midi.forEach((m, i) => boxNote(mtof(m), t + i * 0.012, vel, c.in, { ...base, decay: 1.5 }));
        break;
      }
      case 'p': {
        if (c.mode === 'menu' || c.mode === 'day') {
          padChord(c, [ev.chord.tones[0] - 12, ev.chord.tones[1], ev.chord.tones[2]], t, ev.dur * beatSec(c), 0.045);
        } else if (night && ev.bar % 4 === 0 && Math.random() < 0.55) {
          // cold drone: root two octaves down + a stray tritone
          padChord(c, [ev.chord.root - 12, ev.chord.root + 6], t, ev.dur * beatSec(c) * 2, sc ? 0.03 : 0.045);
        } else if (fin && ev.bar === 0) {
          padChord(c, [ev.chord.root, ev.chord.tones[1] - 12], t, 12, 0.04);
        }
        break;
      }
      default: break;
    }
  }
  function pumpMusic(until) {
    const c = cur;
    if (!c || c.done) return;
    if (!offline && c.nextTime < ctx.currentTime - 0.05) c.nextTime = ctx.currentTime + 0.05;
    while (c.nextTime < until && !c.done) {
      const ev = SEQ[c.idx];
      playEvent(c, ev, c.nextTime);
      const nxt = SEQ[c.idx + 1];
      const gapBeats = (nxt ? nxt.pos : TOTAL_BEATS) - ev.pos;
      let gap = gapBeats * beatSec(c);
      if (c.mode === 'night' && nxt && nxt.k !== 'm' && nxt.bar % 4 === 0 && nxt.bar !== ev.bar && Math.random() < 0.5) gap += rand(0.1, 0.9);
      c.nextTime += gap;
      c.idx++;
      if (c.idx >= SEQ.length) { c.idx = 0; c.loops = (c.loops || 0) + 1; }
      if (c.mode === 'finale' && c.played >= FINALE_NOTES) {
        // the box has run out: let the last tine ring, then silence; only wind is left
        c.done = true;
        const endT = c.nextTime + 1.5;
        c.out.gain.setValueAtTime(1, endT);
        c.out.gain.linearRampToValueAtTime(0, endT + 3.5);
        finish(endT + 5, c.srcs.length ? c.srcs : [dummySrc()], c.nodes);
        if (amb && amb.boost) {
          amb.boost.gain.setValueAtTime(1, endT);
          amb.boost.gain.linearRampToValueAtTime(1.9, endT + 5);
        }
      }
    }
    if (c.mode === 'night') { // tape crackle
      if (c.nextPop < ctx.currentTime) c.nextPop = ctx.currentTime + rand(0.2, 1.5);
      while (c.nextPop < until) {
        const t = c.nextPop;
        noise({ t, a: 0.0004, d: rand(0.002, 0.008), g: rand(0.04, 0.14), dest: c.out, filt: [{ type: 'highpass', f: 1800 }] });
        c.nextPop += rand(0.25, 1.8);
      }
    }
  }
  function setMusic(mode) {
    const m = ['menu', 'day', 'night', 'finale', 'off'].includes(mode) ? mode : 'off';
    if (m === musicMode) return;
    musicMode = m;
    const now = ctx.currentTime;
    const hadPrev = !!cur;
    if (cur) { retire(cur, m === 'off' ? 1.2 : 1.8); cur = null; }
    if (m === 'off') return;
    if (m === 'finale' && (!amb || amb.kind !== 'night')) setAmbient('night');
    cur = makeMusic(m);
    cur.out.gain.setValueAtTime(0, now);
    cur.out.gain.linearRampToValueAtTime(1, now + (m === 'finale' ? 0.3 : hadPrev ? 1.6 : 0.4));
  }

  // ---------------------------------------------------------------------------------------------
  // ambience
  // ---------------------------------------------------------------------------------------------
  let amb = null;
  let ambMode = 'off';
  function newAmb(kind) {
    const out = ctx.createGain(); out.gain.value = 0; out.connect(ambBus);
    return { kind, out, srcs: [], nodes: [out], next: 0, pump: null };
  }
  function ambLfo(inst, f, depth, param) {
    const o = ctx.createOscillator(); o.frequency.value = f;
    const g = ctx.createGain(); g.gain.value = depth;
    o.connect(g); g.connect(param); o.start();
    inst.srcs.push(o); inst.nodes.push(g);
  }
  function ambNoise(inst, kind) { const s = noiseSrc(kind, ctx.currentTime); inst.srcs.push(s); return s; }
  function makeAmbNight() {
    const a = newAmb('night');
    a.boost = ctx.createGain(); a.boost.gain.value = 1; a.boost.connect(a.out); a.nodes.push(a.boost);
    // low wind body
    const w1 = ambNoise(a, 'brown');
    const bp1 = ctx.createBiquadFilter(); bp1.type = 'bandpass'; bp1.frequency.value = 320; bp1.Q.value = 0.7;
    const g1 = ctx.createGain(); g1.gain.value = 1.0;
    w1.connect(bp1); bp1.connect(g1); g1.connect(a.boost);
    ambLfo(a, 0.07, 160, bp1.frequency); ambLfo(a, 0.09, 0.4, g1.gain); ambLfo(a, 0.23, 0.2, g1.gain);
    // thin whistle
    const w2 = ambNoise(a, 'pink');
    const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 900; bp2.Q.value = 14;
    const g2 = ctx.createGain(); g2.gain.value = 0.8;
    w2.connect(bp2); bp2.connect(g2); g2.connect(a.boost);
    ambLfo(a, 0.05, 220, bp2.frequency); ambLfo(a, 0.13, 0.7, g2.gain);
    // fog hiss
    const w3 = ambNoise(a, 'white');
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
    const g3 = ctx.createGain(); g3.gain.value = 0.02;
    w3.connect(hp); hp.connect(lp); lp.connect(g3); g3.connect(a.out);
    ambLfo(a, 0.19, 0.009, g3.gain);
    a.nodes.push(bp1, g1, bp2, g2, hp, lp, g3);
    a.next = ctx.currentTime + rand(3, 7);
    a.pump = (until) => {
      while (a.next < until) { // rare wood creaks
        const call = mkCall('room');
        call.out.gain.value = 0.55;
        const d = creak(a.next, call.out, { vol: rand(0.12, 0.22) });
        endCall(call, a.next + d + 0.3);
        a.next += rand(6, 15);
      }
    };
    return a;
  }
  function makeAmbDay() {
    const a = newAmb('day');
    // fireplace bed + crackle buffers (two layers, different rates, never in sync)
    const r = ambNoise(a, 'brown');
    const rl = ctx.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 220;
    const rg = ctx.createGain(); rg.gain.value = 0.55;
    r.connect(rl); rl.connect(rg); rg.connect(a.out);
    ambLfo(a, 0.17, 0.12, rg.gain);
    for (const [pr, gv, off] of [[1.0, 0.5, 0.0], [0.83, 0.32, 2.3]]) {
      const s = ctx.createBufferSource(); s.buffer = NB.crackle; s.loop = true; s.playbackRate.value = pr;
      s.start(ctx.currentTime, off);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      const g = ctx.createGain(); g.gain.value = gv;
      s.connect(hp); hp.connect(g); g.connect(a.out);
      a.srcs.push(s); a.nodes.push(hp, g);
    }
    // low murmur from the next room
    const m = ambNoise(a, 'pink');
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 480; f1.Q.value = 5;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 6;
    const mg = ctx.createGain(); mg.gain.value = 0.55;
    const mix = ctx.createGain(); mix.gain.value = 1;
    m.connect(f1); m.connect(f2); f1.connect(mg); f2.connect(mg); mg.connect(mix); mix.connect(a.out);
    ambLfo(a, 3.7, 0.25, mg.gain); ambLfo(a, 0.31, 0.2, mg.gain); ambLfo(a, 0.43, 140, f1.frequency); ambLfo(a, 0.29, 260, f2.frequency);
    a.nodes.push(rl, rg, f1, f2, mg, mix);
    a.next = ctx.currentTime + rand(1.5, 4);
    a.pump = (until) => {
      while (a.next < until) { // soft birds
        const t = a.next;
        const call = mkCall('hall');
        call.out.gain.value = 0.5;
        const pan = rand(-0.8, 0.8);
        const n = 2 + Math.floor(Math.random() * 4);
        const f0 = rand(2600, 4600), dir = Math.random() < 0.5 ? 1 : -1, sp = rand(0.09, 0.16);
        for (let i = 0; i < n; i++) {
          const ti = t + i * sp;
          const fa = f0 * (1 + 0.04 * i * dir);
          tone({ f: fa, f2: fa * (dir > 0 ? 1.28 : 0.78), t: ti, a: 0.008, d: 0.06, g: 0.06, dest: call.out, pan, glide: 0.07 });
        }
        endCall(call, t + n * sp + 0.5);
        a.next += rand(3, 9);
      }
    };
    return a;
  }
  function setAmbient(mode) {
    const m = ['night', 'day', 'off'].includes(mode) ? mode : 'off';
    if (m === ambMode) return;
    ambMode = m;
    const now = ctx.currentTime;
    const hadPrev = !!amb;
    if (amb) { retire(amb, 1.6); amb = null; }
    if (m === 'off') return;
    amb = m === 'night' ? makeAmbNight() : makeAmbDay();
    amb.out.gain.setValueAtTime(0, now);
    amb.out.gain.linearRampToValueAtTime(1, now + (hadPrev ? 1.6 : 0.8));
  }

  // ---------------------------------------------------------------------------------------------
  // knocks
  // ---------------------------------------------------------------------------------------------
  function knockCaption(style, n, monster, scratchTail) {
    const w = numWord(n), s = plural(n);
    let text;
    switch (style) {
      case 'soft': text = `${w} soft knock${s}`; break;
      case 'hard': text = `${w} hard knock${s}`; break;
      case 'thud': text = `${w} heavy thud${s}`; break;
      case 'slow': text = `${w} slow, heavy knock${s}`; break;
      case 'beep': text = `${w} electronic beep${s}`; break;
      case 'scratch': text = n === 1 ? 'a scratch at the door' : 'scratching at the door'; break;
      case 'roll': text = 'a fast drumroll of knocks'; break;
      case 'stumble': text = `${w} knock${s}, then a stumble`; break;
      default: text = `${w} knock${s}`;
    }
    if (scratchTail) text += ', then scratching';
    return `*${text}*`;
  }
  function beep(t, i, monster, out) {
    const f = [1175, 1568, 1319][i % 3] * (monster ? 0.94 : 1);
    tone({ type: 'square', f, f2: monster ? f * 0.78 : null, t, a: 0.002, d: 0.07, g: 0.1, dest: out, filt: [{ type: 'lowpass', f: 3200, q: 0.8 }] });
    if (monster) {
      tone({ type: 'square', f: f * 1.012, t, a: 0.002, d: 0.07, g: 0.07, dest: out, filt: [{ type: 'lowpass', f: 2600 }] });
      noise({ t: t + 0.03, a: 0.001, d: 0.025, g: 0.12, dest: out, filt: [{ type: 'bandpass', f: 4200, q: 3 }] });
    }
    tick(t, out, 3400, 0.08, 0.006);
  }
  function knock(figure, variant) {
    const k = (figure && figure.knock) || {};
    const style = k.style && (KNOCK_STYLES[k.style] || k.style === 'scratch' || k.style === 'beep') ? k.style : 'soft';
    const monster = variant === 'monster';
    let offs = monster ? k.monster : k.real;
    offs = Array.isArray(offs) ? offs.map(Number).filter(Number.isFinite) : [];
    if (!offs.length) offs = [0, 300];
    offs.sort((a, b) => a - b);
    const hash = [...String((figure && figure.id) || 'x')].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const scratchTail = monster && ['soft', 'hard', 'thud'].includes(style) && hash % 3 === 0;
    const t0 = ctx.currentTime + 0.05;
    const call = mkCall('room', style === 'slow' || style === 'thud' ? 0.3 : 0.1);
    const n = offs.length;
    const lastOff = offs[n - 1];
    const st = KNOCK_STYLES[style];
    offs.forEach((off, i) => {
      let t = t0 + off / 1000 + (monster ? rand(-0.012, 0.012) : 0);
      t = Math.max(t, t0);
      const jit = rand(0.88, 1.12);
      if (style === 'scratch') scratchStroke(t, call.out, (monster ? 0.4 : 0.34) * jit, 0.26, monster);
      else if (style === 'beep') beep(t, i, monster, call.out);
      else if (style === 'roll') woodHit(t, call.out, { ...st, vel: st.vel * (0.6 + 0.7 * i / Math.max(1, n - 1)) * jit, monster });
      else woodHit(t, call.out, { ...st, vel: st.vel * jit, monster });
    });
    const tLast = t0 + lastOff / 1000;
    if (style === 'stumble') {
      woodHit(tLast + 0.3, call.out, { body: 55, vel: 0.8, dur: 0.3, dull: true, tone: 300, monster });
      noise({ t: tLast + 0.34, a: 0.03, d: 0.25, g: 1.6, dest: call.out, filt: [{ type: 'bandpass', f: 700, f2: 260, q: 1.1 }] });
      woodHit(tLast + 0.52, call.out, { body: 70, vel: 0.35, dur: 0.15, dull: true, tone: 300, monster });
    }
    if (scratchTail) for (let i = 0; i < 3; i++) scratchStroke(tLast + 0.4 + i * 0.3, call.out, 0.26, 0.24, true);
    if (monster && style !== 'scratch' && style !== 'beep') { // faint low rumble under the wrong ones
      tone({ type: 'sine', f: 48, f2: 36, t: tLast + 0.05, a: 0.05, d: 0.8, g: 0.18, dest: call.out });
    }
    caption(knockCaption(style, n, monster, scratchTail));
    const totalMs = lastOff + (KNOCK_TAIL_MS[style] || 500) + (style === 'stumble' ? 400 : 0) + (scratchTail ? 1100 : 0);
    endCall(call, t0 + totalMs / 1000);
    return wait(totalMs);
  }

  // ---------------------------------------------------------------------------------------------
  // voices (gibberish syllables)
  // ---------------------------------------------------------------------------------------------
  const VOWELS = { a: [800, 1250], e: [520, 1850], i: [330, 2250], o: [520, 950], u: [350, 850], y: [400, 2000] };
  const VOWEL_KEYS = Object.keys(VOWELS);
  const WAVE_GAIN = { sine: 1.2, triangle: 1.0, square: 0.45, sawtooth: 0.4 };
  function parseSpeech(text) {
    const events = [];
    let buf = [], syl = 0, seg = [];
    const flush = () => {
      if (!buf.length || syl >= 40) { buf = []; return; }
      const letters = buf.join('').toLowerCase();
      const vow = [...letters].find((ch) => VOWELS[ch]) || pick(VOWEL_KEYS);
      const e = { type: 'syl', vowel: vow, cons: [...letters].some((ch) => !VOWELS[ch]) };
      events.push(e); seg.push(e); syl++; buf = [];
    };
    const endSeg = (term) => {
      seg.forEach((e, i) => {
        const p = seg.length > 1 ? i / (seg.length - 1) : 0;
        e.contour = term === '?' ? -1 + 4.5 * p : 1.2 * Math.sin(Math.PI * p) - 1.8 * p;
        if (term === '!') e.contour += 1.5;
      });
      seg = [];
    };
    for (const ch of String(text ?? '')) {
      if (/\s/.test(ch)) { flush(); events.push({ type: 'pause', sec: 0.025 }); }
      else if (/[,;:]/.test(ch)) { flush(); events.push({ type: 'pause', sec: 0.11 }); }
      else if (/[.!?]/.test(ch)) { flush(); endSeg(ch); events.push({ type: 'pause', sec: 0.2, term: ch }); }
      else if (/[-—–…]/.test(ch)) { flush(); events.push({ type: 'pause', sec: 0.12 }); }
      else if (/["'`*()[\]]/.test(ch)) { /* ignore */ }
      else { buf.push(ch); if (buf.length >= 2) flush(); }
    }
    flush(); endSeg('.');
    // collapse runs of pauses ("...") but keep them short
    const out = [];
    for (const e of events) {
      const lastE = out[out.length - 1];
      if (e.type === 'pause' && lastE && lastE.type === 'pause') lastE.sec = Math.min(0.45, lastE.sec + e.sec * 0.6);
      else out.push({ ...e });
    }
    return out.filter((e, i) => !(e.type === 'pause' && (i === 0 || i === out.length - 1)));
  }
  function voice(figure, text, o = {}) {
    const v = (figure && figure.voice) || {};
    const monster = !!o.monster, distort = !!o.distort;
    const pitchMul = clamp(Number(v.pitch) || 1, 0.4, 2.6);
    const speed = clamp(Number(v.speed) || 1, 0.5, 2) * (monster ? 0.9 : 1);
    const wave = ['sine', 'triangle', 'square', 'sawtooth'].includes(v.wave) ? v.wave : 'triangle';
    const events = parseSpeech(text);
    const nSyl = events.filter((e) => e.type === 'syl').length;
    if (!nSyl) return Promise.resolve();

    const call = mkCall(monster ? 'hall' : 'room', monster ? 0.4 : 0);
    const nodes = call.nodes, srcs = [];
    const t0 = ctx.currentTime + 0.04;
    const osc = ctx.createOscillator(); osc.type = wave;
    const amp = ctx.createGain(); amp.gain.setValueAtTime(0, t0);
    osc.connect(amp);
    const vin = ctx.createGain(); vin.gain.value = 1;
    const mkPath = (type, q, gain) => {
      const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.value = 800;
      const g = ctx.createGain(); g.gain.value = gain; amp.connect(f); f.connect(g); g.connect(vin); nodes.push(f, g); return f;
    };
    const fm1 = mkPath('bandpass', 5, 2.2), fm2 = mkPath('bandpass', 7, 1.5);
    const body = mkPath('lowpass', 0.7, 0.4); body.frequency.value = 1800;
    const ns = noiseSrc('white', t0);
    const nbp = ctx.createBiquadFilter(); nbp.type = 'bandpass'; nbp.Q.value = 1.4; nbp.frequency.value = 4000;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0, t0);
    ns.connect(nbp); nbp.connect(ng); ng.connect(vin);
    srcs.push(osc, ns);
    nodes.push(amp, vin, nbp, ng);

    let chain = vin;
    if (distort) {
      const pre = ctx.createGain(); pre.gain.value = 3;
      const ws = shaper(crushCurve(7));
      const post = ctx.createGain(); post.gain.value = 0.5;
      chain.connect(pre); pre.connect(ws); ws.connect(post); chain = post; nodes.push(pre, ws, post);
    }
    const level = ctx.createGain(); level.gain.value = monster ? 0.46 : 0.38; nodes.push(level);
    if (monster) {
      // ring-mod grit + slight saturation, then echo
      const dry = ctx.createGain(); dry.gain.value = 0.8;
      const rm = ctx.createGain(); rm.gain.value = 0;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 37; lfo.connect(rm.gain);
      const rmOut = ctx.createGain(); rmOut.gain.value = 0.55;
      const sat = shaper(driveCurve(2.2));
      chain.connect(dry); chain.connect(rm); rm.connect(rmOut); dry.connect(sat); rmOut.connect(sat); sat.connect(level);
      const dl = ctx.createDelay(1); dl.delayTime.value = 0.23;
      const fb = ctx.createGain(); fb.gain.value = 0.36;
      const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 1800;
      const eg = ctx.createGain(); eg.gain.value = 0.5;
      level.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(eg); eg.connect(call.out);
      lfo.start(t0); srcs.push(lfo);
      nodes.push(dry, rm, rmOut, sat, dl, fb, dlp, eg);
    } else chain.connect(level);
    level.connect(call.out);

    // schedule syllables
    const step = 0.085 / speed;
    const base = 230 * pitchMul * (monster ? 0.52 : 1);
    let t = t0;
    let drift = 0;
    for (const e of events) {
      if (e.type === 'pause') { t += e.sec / Math.sqrt(speed); continue; }
      drift = clamp(drift + rand(-1.4, 1.4), -3.5, 3.5);
      let semis = (e.contour || 0) + drift + (Math.random() < 0.2 ? rand(1, 3.5) : 0);
      if (distort && Math.random() < 0.3) semis += pick([-5, 7, -12, 5]);
      const f = clamp(base * Math.pow(2, semis / 12), 60, 2400);
      const dur = step * 0.8;
      const [F1, F2] = VOWELS[e.vowel];
      const j = rand(0.94, 1.06);
      fm1.frequency.setValueAtTime(F1 * j, t); fm2.frequency.setValueAtTime(F2 * j, t);
      osc.frequency.setValueAtTime(f * 0.95, t);
      osc.frequency.linearRampToValueAtTime(f, t + 0.025);
      osc.frequency.linearRampToValueAtTime(f * (e.contour > 1.5 ? 1.03 : 0.975), t + dur);
      if (monster) osc.detune.setValueAtTime(rand(-45, 45), t);
      const dropped = distort && Math.random() < 0.12;
      const peak = dropped ? 0 : (WAVE_GAIN[wave] || 1) * rand(0.85, 1.0);
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(peak, t + 0.008);
      amp.gain.linearRampToValueAtTime(peak * 0.75, t + dur * 0.7);
      amp.gain.linearRampToValueAtTime(0, t + dur);
      if (e.cons && !dropped && Math.random() < 0.75) {
        nbp.frequency.setValueAtTime(rand(2500, 6500), t);
        ng.gain.setValueAtTime(0.01, t);
        ng.gain.linearRampToValueAtTime(0.22, t + 0.004);
        ng.gain.linearRampToValueAtTime(0, t + 0.03);
      }
      t += step;
    }
    const end = t + 0.1;
    osc.start(t0);
    finish(end + (monster ? 2.4 : 0.3), srcs, nodes);
    endCall(call, end + (monster ? 2.4 : 0.3));
    return wait((end - ctx.currentTime) * 1000 + 60);
  }

  // ---------------------------------------------------------------------------------------------
  // one-shot sound effects. Each def: (t, out) -> duration in seconds.
  // ---------------------------------------------------------------------------------------------
  function step(t, out, vel, lp = 600, pan = 0) {
    tone({ f: 115, f2: 62, t, a: 0.003, d: 0.09, g: 0.5 * vel, dest: out, pan });
    noise({ t, a: 0.003, d: 0.07, g: 2.0 * vel, dest: out, pan, filt: [{ type: 'lowpass', f: lp, q: 0.7 }] });
    noise({ t: t + 0.02, a: 0.004, d: 0.06, g: 0.8 * vel, dest: out, pan, filt: [{ type: 'bandpass', f: 900, q: 2 }] });
  }
  function bellPartials(t, out, f, ratios, amps, decs, g = 1) {
    ratios.forEach((r, i) => tone({ f: f * r, t, a: 0.002, d: decs[i], g: amps[i] * g, dest: out }));
  }
  function stinger(t, out, K, kind) {
    const sc = scared();
    const atk = sc ? 0.03 : 0.002;
    const softLp = sc ? [{ type: 'lowpass', f: 2200, q: 0.7 }] : [];
    if (kind === 1) {
      noise({ t, a: atk, d: 0.5, g: 0.5 * K, dest: out, filt: [{ type: 'highpass', f: 1400, q: 0.7 }, ...softLp] });
      for (const [f0, f1, gg] of [[1800, 3300, 0.2], [1850, 3480, 0.16], [2750, 5000, 0.1]]) {
        const os = ctx.createOscillator(); os.type = 'sawtooth';
        os.frequency.setValueAtTime(f0, t); os.frequency.exponentialRampToValueAtTime(f1, t + 0.9);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 38; const lg = ctx.createGain(); lg.gain.value = 220;
        lfo.connect(lg); lg.connect(os.frequency);
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = sc ? 2600 : 6500;
        const g = ctx.createGain(); env(g.gain, t, atk, gg * K, 1.0);
        os.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out);
        os.start(t); lfo.start(t);
        finish(t + 1.1, [os, lfo], [lg, hp, lp, g]);
      }
      tone({ f: 120, f2: 28, t, a: atk, d: 1.1, g: 0.65 * K, dest: out });
      return 1.4;
    }
    if (kind === 2) {
      const ws = shaper(driveCurve(sc ? 3 : 18));
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = sc ? 1800 : 3600;
      const g = ctx.createGain(); env(g.gain, t, atk, 0.7 * K, 1.3);
      ws.connect(lp); lp.connect(g); g.connect(out);
      const srcs = [];
      for (const f of [220, 233.1, 246.9, 311.1, 329.6, 349.2, 466.2]) {
        for (const dt of [-12, 11]) {
          const os = ctx.createOscillator(); os.type = 'sawtooth';
          os.frequency.setValueAtTime(f, t); os.frequency.exponentialRampToValueAtTime(f * 0.78, t + 1.4);
          os.detune.value = dt; const og = ctx.createGain(); og.gain.value = 0.08;
          os.connect(og); og.connect(ws); os.start(t); srcs.push(os);
          srcs.push(og); // disconnected through nodes list below
        }
      }
      const oscs = srcs.filter((s) => s.start);
      finish(t + 1.5, oscs, [ws, lp, g, ...srcs.filter((s) => !s.start)]);
      noise({ t, a: atk, d: 0.14, g: 0.5 * K, dest: out, filt: [{ type: 'lowpass', f: 3000 }] });
      tone({ f: 58, f2: 40, t, a: atk, d: 1.4, g: 0.7 * K, dest: out });
      return 1.6;
    }
    // kind 3: roar
    const ws = shaper(driveCurve(sc ? 2.5 : 14));
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.6;
    bp.frequency.setValueAtTime(250, t + 0.15); bp.frequency.exponentialRampToValueAtTime(950, t + 0.55); bp.frequency.exponentialRampToValueAtTime(300, t + 1.7);
    const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = sc ? 1500 : 4000;
    const g = ctx.createGain(); env(g.gain, t + 0.15, sc ? 0.05 : 0.004, 1.5 * K, 1.5);
    const am = ctx.createGain(); am.gain.value = 0.6;
    const amOsc = ctx.createOscillator(); amOsc.frequency.value = 48;
    const amG = ctx.createGain(); amG.gain.value = 0.4; amOsc.connect(amG); amG.connect(am.gain);
    const srcs = [amOsc];
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.setValueAtTime(64, t + 0.15); o1.frequency.exponentialRampToValueAtTime(48, t + 1.8);
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.setValueAtTime(67.5, t + 0.15); o2.frequency.exponentialRampToValueAtTime(50, t + 1.8);
    const og = ctx.createGain(); og.gain.value = 0.5;
    o1.connect(og); o2.connect(og); og.connect(am); am.connect(ws); ws.connect(bp); bp.connect(lpf); lpf.connect(g); g.connect(out);
    o1.start(t + 0.15); o2.start(t + 0.15); amOsc.start(t + 0.15); srcs.push(o1, o2);
    finish(t + 2.0, srcs, [ws, bp, lpf, g, am, amG, og]);
    // reverse swell before the hit, burst on it, boom under it
    noise({ t, a: 0.15, d: 0.02, g: 0.35 * K, dest: out, filt: [{ type: 'bandpass', f: 900, f2: 2500, q: 0.8, sweep: 0.17 }] });
    noise({ t: t + 0.15, a: sc ? 0.04 : 0.002, d: 0.35, g: 0.6 * K, dest: out, filt: [{ type: 'bandpass', f: 700, q: 0.9 }] });
    tone({ f: 70, f2: 30, t: t + 0.15, a: sc ? 0.04 : 0.003, d: 1.5, g: 0.7 * K, dest: out });
    return 2.0;
  }

  const SFX = {
    peepholeOpen: { gain: 0.7, route: 'room', fn(t, out) {
      noise({ t, a: 0.01, d: 0.14, g: 1.1, dest: out, filt: [{ type: 'bandpass', f: 1200, f2: 2800, q: 1.2 }] });
      tick(t, out, 1700, 0.25); tick(t + 0.15, out, 900, 0.35);
      tone({ f: 160, f2: 110, t: t + 0.15, a: 0.003, d: 0.08, g: 0.3, dest: out });
      return 0.35;
    } },
    peepholeClose: { gain: 0.6, route: 'room', fn(t, out) {
      tick(t, out, 1100, 0.3);
      noise({ t, a: 0.01, d: 0.1, g: 1.0, dest: out, filt: [{ type: 'bandpass', f: 2800, f2: 1200, q: 1.2 }] });
      tone({ f: 190, f2: 100, t: t + 0.11, a: 0.003, d: 0.09, g: 0.45, dest: out });
      tick(t + 0.11, out, 700, 0.4);
      return 0.3;
    } },
    bolt: { gain: 0.75, route: 'room', fn(t, out) {
      noise({ t, a: 0.02, d: 0.25, g: 1.6, dest: out, filt: [{ type: 'bandpass', f: 600, f2: 350, q: 1.4 }] });
      noise({ t: t + 0.05, a: 0.02, d: 0.2, g: 0.5, dest: out, filt: [{ type: 'highpass', f: 2500 }] });
      tick(t + 0.27, out, 1500, 0.5, 0.02);
      tone({ type: 'triangle', f: 330, f2: 220, t: t + 0.27, a: 0.002, d: 0.12, g: 0.3, dest: out });
      tone({ f: 100, f2: 70, t: t + 0.27, a: 0.003, d: 0.22, g: 0.55, dest: out });
      tick(t + 0.33, out, 2200, 0.3);
      bellPartials(t + 0.27, out, 1200, [1, 1.58], [0.06, 0.04], [0.18, 0.12]);
      return 0.7;
    } },
    doorOpen: { gain: 0.8, route: 'room', cap: '*the door creaks open*', fn(t, out) {
      tick(t, out, 900, 0.4);
      creak(t + 0.04, out, { vol: 0.45, dur: 0.95, base: 92, rise: true });
      noise({ kind: 'pink', t: t + 0.1, a: 0.3, d: 0.6, g: 3.5, dest: out, filt: [{ type: 'lowpass', f: 900 }] });
      tone({ f: 80, f2: 60, t: t + 1.0, a: 0.01, d: 0.2, g: 0.25, dest: out });
      return 1.3;
    } },
    doorSlam: { gain: 0.95, route: 'hall', cap: '*the door slams shut*', fn(t, out) {
      tone({ f: 75, f2: 36, t, a: 0.002, d: 0.55, g: 0.8, dest: out });
      woodHit(t, out, { body: 68, vel: 0.9, dur: 0.35, tone: 500 });
      noise({ t, a: 0.002, d: 0.25, g: 2.6, dest: out, filt: [{ type: 'bandpass', f: 300, q: 0.7 }] });
      [0.1, 0.15, 0.2].forEach((dt, i) => tick(t + dt, out, 1800 - i * 200, 0.14));
      return 1.2;
    } },
    footstepsIn: { gain: 0.85, route: 'room', fn(t, out) {
      [0.5, 0.6, 0.72, 0.7, 0.45].forEach((v, i) => step(t + i * 0.46, out, v, 650, i % 2 ? 0.15 : -0.15));
      noise({ kind: 'pink', t: t + 2.1, a: 0.04, d: 0.18, g: 0.9, dest: out, filt: [{ type: 'lowpass', f: 700 }] });
      return 2.5;
    } },
    footstepsAway: { route: 'hall', fn(t, out) {
      [0.6, 0.5, 0.4, 0.3, 0.2, 0.12].forEach((v, i) => step(t + i * 0.5, out, v, 520 - i * 55, i % 2 ? 0.2 : -0.2));
      return 3.2;
    } },
    flashlightOn: { route: 'room', fn(t, out) {
      tick(t, out, 1200, 0.4); tick(t + 0.05, out, 800, 0.3);
      tone({ type: 'sawtooth', f: 130, f2: 200, t: t + 0.05, a: 0.01, d: 0.1, g: 0.06, dest: out, filt: [{ type: 'lowpass', f: 700 }] });
      return 0.25;
    } },
    flashlightOff: { route: 'room', fn(t, out) {
      tick(t, out, 900, 0.35);
      tone({ type: 'sawtooth', f: 190, f2: 80, t, a: 0.005, d: 0.1, g: 0.06, dest: out, filt: [{ type: 'lowpass', f: 700 }] });
      return 0.2;
    } },
    mirror: { route: 'room', fn(t, out) {
      bellPartials(t, out, 1760, [1, 2.32, 4.25, 6.63], [0.16, 0.09, 0.05, 0.025], [0.9, 0.6, 0.35, 0.2]);
      tick(t, out, 5000, 0.14, 0.008);
      return 1.1;
    } },
    candle: { gain: 0.45, route: 'room', fn(t, out) {
      noise({ kind: 'pink', t, a: 0.08, d: 0.35, g: 3.2, dest: out, filt: [{ type: 'bandpass', f: 500, f2: 900, q: 0.8 }] });
      for (let i = 0; i < 4; i++) noise({ t: t + rand(0.05, 0.45), a: 0.0006, d: 0.008, g: 0.22, dest: out, filt: [{ type: 'highpass', f: 2500 }] });
      tone({ f: 170, f2: 120, t, a: 0.05, d: 0.3, g: 0.08, dest: out });
      return 0.6;
    } },
    pageTurn: { gain: 0.55, route: 'room', fn(t, out) {
      noise({ t, a: 0.05, d: 0.22, g: 1.6, dest: out, filt: [{ type: 'bandpass', f: 2200, f2: 1100, q: 0.9 }] });
      for (let i = 0; i < 6; i++) noise({ t: t + rand(0, 0.3), a: 0.0008, d: 0.01, g: 0.2, dest: out, filt: [{ type: 'highpass', f: 3000 }] });
      noise({ t: t + 0.3, a: 0.003, d: 0.04, g: 1.0, dest: out, filt: [{ type: 'lowpass', f: 800 }] });
      return 0.5;
    } },
    penScratch: { gain: 0.8, route: 'room', fn(t, out) {
      for (let i = 0; i < 7; i++) {
        const ti = t + i * 0.11 + rand(0, 0.03);
        const up = i % 2 === 0;
        noise({ t: ti, a: 0.01, d: 0.07, g: 0.6, dest: out, filt: [{ type: 'bandpass', f: up ? 2200 : 3200, f2: up ? 3200 : 2200, q: 1.4 }] });
      }
      return 0.95;
    } },
    hammer: { gain: 0.9, route: 'hall', cap: '*hammering at the door*', fn(t, out) {
      [[0, 1], [0.17, 0.9], [0.35, 1], [0.62, 0.8]].forEach(([dt, v], i) => {
        woodHit(t + dt, out, { body: 85, vel: v * 0.9, dur: 0.22, tone: 800, boom: 0.4 });
        if (i === 0 || i === 2) noise({ t: t + dt, a: 0.002, d: 0.2, g: 1.2, dest: out, filt: [{ type: 'bandpass', f: 1500, q: 1 }] });
      });
      return 1.5;
    } },
    flameOut: { route: 'room', cap: '*a flame goes out*', fn(t, out) {
      noise({ t, a: 0.01, d: 0.35, g: 1.3, dest: out, filt: [{ type: 'bandpass', f: 2400, f2: 500, q: 0.9 }] });
      noise({ t: t + 0.05, a: 0.01, d: 0.5, g: 0.22, dest: out, filt: [{ type: 'highpass', f: 5000 }] });
      for (let i = 0; i < 4; i++) noise({ t: t + rand(0.1, 0.5), a: 0.0005, d: 0.006, g: 0.2, dest: out, filt: [{ type: 'highpass', f: 3500 }] });
      tone({ f: 261, f2: 130, t, a: 0.02, d: 0.9, g: 0.2, dest: out, filt: [{ type: 'lowpass', f: 800 }] });
      return 1.2;
    } },
    reveal: { route: 'hall', cap: '*its true shape shows*', fn(t, out) {
      const sc = scared();
      const K = sc ? 0.4 : 1;
      for (const f of [233.1, 247, 330, 349.2]) {
        tone({ type: 'sawtooth', f, f2: f * 0.85, t, a: sc ? 0.05 : 0.02, d: 0.9, g: 0.13 * K, dest: out, filt: [{ type: 'lowpass', f: sc ? 900 : 1400 }] });
      }
      noise({ kind: 'pink', t, a: 0.03, d: 0.6, g: 3 * K, dest: out, filt: [{ type: 'bandpass', f: 1200, f2: 300, q: 0.7 }] });
      tone({ f: 140, f2: 45, t, a: 0.005, d: 0.9, g: 0.6 * K, dest: out });
      if (!sc) tick(t, out, 3000, 0.3);
      return 1.3;
    } },
    jumpscare1: { route: 'hall', cap: '*a piercing scream*', fn(t, out) { return stinger(t, out, scared() ? 0.4 : 1.25, 1); } },
    jumpscare2: { route: 'hall', cap: '*a harsh blast of noise*', fn(t, out) { return stinger(t, out, scared() ? 0.4 : 1.25, 2); } },
    jumpscare3: { route: 'hall', cap: '*a monstrous roar*', fn(t, out) { return stinger(t, out, scared() ? 0.4 : 1.25, 3); } },
    powerOut: { route: 'hall', cap: '*the power dies*', fn(t, out) {
      tone({ f: 90, f2: 40, t, a: 0.002, d: 0.3, g: 0.6, dest: out });
      tick(t, out, 1400, 0.5);
      tone({ type: 'sawtooth', f: 110, f2: 26, t: t + 0.05, a: 0.01, d: 1.1, g: 0.3, dest: out, filt: [{ type: 'lowpass', f: 400 }] });
      tone({ f: 100, f2: 50, t: t + 0.05, a: 0.01, d: 0.8, g: 0.28, dest: out });
      for (let i = 0; i < 4; i++) noise({ t: t + i * 0.05, a: 0.001, d: 0.03, g: 0.3, dest: out, filt: [{ type: 'highpass', f: 4000 }] });
      return 1.4;
    } },
    uiClick: { route: 'dry', fn(t, out) {
      tone({ f: 880, f2: 520, t, a: 0.001, d: 0.04, g: 0.16, dest: out });
      noise({ t, a: 0.0005, d: 0.006, g: 0.1, dest: out, filt: [{ type: 'bandpass', f: 2500, q: 1 }] });
      return 0.08;
    } },
    uiHover: { route: 'dry', fn(t, out) {
      tone({ f: 1500, t, a: 0.002, d: 0.03, g: 0.035, dest: out });
      return 0.06;
    } },
    chime: { gain: 0.8, route: 'hall', fn(t, out) {
      [784, 987.8, 1174.7, 1568].forEach((f, i) => {
        const ti = t + i * 0.13;
        tone({ f, t: ti, a: 0.002, d: 1.2, g: 0.18, dest: out });
        tone({ f: f * 2, t: ti, a: 0.002, d: 0.5, g: 0.05, dest: out });
        tone({ f: f * 3.01, t: ti, a: 0.002, d: 0.25, g: 0.025, dest: out });
        tick(ti, out, 5200, 0.05, 0.006);
      });
      return 1.9;
    } },
    bell: { gain: 0.8, route: 'room', fn(t, out) {
      bellPartials(t, out, 523.25, [1, 2.0, 2.4, 3.0, 4.1], [0.26, 0.13, 0.1, 0.07, 0.035], [2.2, 1.6, 1.4, 0.9, 0.5]);
      tick(t, out, 3000, 0.1, 0.01);
      return 2.4;
    } },
    creak: { gain: 0.75, route: 'room', fn(t, out) { return creak(t, out, { vol: 0.6, dur: 1.0 }) + 0.2; } },
    gulp: { route: 'room', fn(t, out) {
      tone({ f: 340, f2: 110, t, a: 0.004, d: 0.09, g: 0.3, dest: out });
      tone({ f: 260, f2: 90, t: t + 0.11, a: 0.004, d: 0.08, g: 0.25, dest: out });
      noise({ t, a: 0.01, d: 0.12, g: 1.4, dest: out, filt: [{ type: 'bandpass', f: 700, q: 6 }, { type: 'lowpass', f: 1200 }] });
      return 0.35;
    } },
  };
  const warned = new Set();
  function sfx(name) {
    const def = SFX[name];
    if (!def) {
      if (!warned.has(name)) { warned.add(name); console.warn(`[audio] unknown sfx "${name}"`); }
      return Promise.resolve();
    }
    const t = ctx.currentTime + 0.02;
    const call = mkCall(def.route);
    call.out.gain.value = def.gain ?? 1;
    const dur = def.fn(t, call.out) || 0.5;
    if (def.cap) caption(def.cap);
    endCall(call, t + dur);
    return wait(dur * 1000);
  }

  // ---------------------------------------------------------------------------------------------
  // heartbeat + loops (pump driven)
  // ---------------------------------------------------------------------------------------------
  const hb = { target: 0, level: 0, running: false, next: 0, out: null };
  function beat(t, lvl) {
    if (!hb.out) {
      hb.out = ctx.createGain(); hb.out.gain.value = 0.75;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      hb.out.connect(lp); lp.connect(R.dry);
    }
    const v = 0.22 + 0.65 * lvl;
    const lub = (tt, vv, f) => {
      tone({ f: f * 1.4, f2: f, t: tt, a: 0.004, d: 0.12, g: 0.55 * vv, dest: hb.out });
      tone({ f: f * 2.1, f2: f * 1.6, t: tt, a: 0.004, d: 0.08, g: 0.3 * vv, dest: hb.out });
      noise({ kind: 'brown', t: tt, a: 0.004, d: 0.1, g: 2.0 * vv, dest: hb.out, filt: [{ type: 'lowpass', f: 180 }] });
    };
    lub(t, v, 62);
    lub(t + clamp(0.24 - lvl * 0.07, 0.15, 0.24), v * 0.72, 74);
  }
  function pumpHeartbeat(until) {
    if (!hb.running) return;
    while (hb.next < until) {
      hb.level += (hb.target - hb.level) * 0.4;
      if (hb.target === 0 && hb.level < 0.03) { hb.running = false; hb.level = 0; return; }
      beat(hb.next, hb.level);
      hb.next += 60 / (54 + hb.level * 86);
    }
  }
  function heartbeat(level) {
    const l = clamp(Number(level) || 0, 0, 1);
    hb.target = l;
    if (l > 0 && !hb.running) { hb.running = true; hb.level = Math.max(hb.level, l * 0.6); hb.next = ctx.currentTime + 0.05; }
    return Promise.resolve();
  }

  const loops = { ticking: null, static: null, whisper: null };
  function mkLoop(name) {
    const out = ctx.createGain(); out.gain.value = 0; out.connect(name === 'whisper' ? R.hall : R.room);
    const L = { name, out, srcs: [], nodes: [out], next: 0, n: 0 };
    const now = ctx.currentTime;
    if (name === 'static') {
      const s = noiseSrc('white', now);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      const g = ctx.createGain(); g.gain.value = 0.12; L.g = g;
      s.connect(hp); hp.connect(g); g.connect(out);
      const hum = ctx.createOscillator(); hum.frequency.value = 100; const hg = ctx.createGain(); hg.gain.value = 0.02;
      hum.connect(hg); hg.connect(out); hum.start();
      L.srcs.push(s, hum); L.nodes.push(hp, g, hg);
      L.level = 1;
    } else if (name === 'whisper') {
      const s = noiseSrc('pink', now);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 2.5;
      const g = ctx.createGain(); g.gain.value = 0;
      const pan = ctx.createStereoPanner();
      s.connect(hp); hp.connect(bp); bp.connect(g); g.connect(pan); pan.connect(out);
      L.srcs.push(s); L.nodes.push(hp, bp, g, pan); L.bp = bp; L.g = g; L.pan = pan; L.level = 1;
    }
    L.next = now + 0.05;
    return L;
  }
  function pumpLoop(L, until) {
    if (!L || L.dead) return;
    if (!offline && L.next < ctx.currentTime - 0.1) L.next = ctx.currentTime + 0.02;
    while (L.next < until) {
      const t = L.next;
      if (L.name === 'ticking') {
        const alt = L.n % 2;
        const f = alt ? 1900 : 2600;
        tone({ f, f2: f * 0.75, t, a: 0.0006, d: 0.014, g: 0.3, dest: L.out });
        tone({ type: 'triangle', f: alt ? 650 : 900, t, a: 0.001, d: 0.025, g: 0.22, dest: L.out });
        noise({ t, a: 0.0004, d: 0.006, g: 0.5, dest: L.out, filt: [{ type: 'highpass', f: 3000 }] });
        L.n++;
        L.next += 0.52 + (L.n % 13 === 0 ? 0.07 : 0);
        if (L.n % 17 === 0) { tone({ f: 1500, f2: 1100, t: t + 0.13, a: 0.001, d: 0.012, g: 0.16, dest: L.out }); } // a stray extra tick
      } else if (L.name === 'static') {
        L.g.gain.setValueAtTime(rand(0.04, 0.2), t);
        L.next += rand(0.05, 0.22);
      } else if (L.name === 'whisper') {
        const dur = rand(0.15, 0.4);
        L.bp.frequency.setValueAtTime(rand(1400, 3800), t);
        L.pan.pan.setValueAtTime(rand(-0.9, 0.9), t);
        L.g.gain.setValueAtTime(EPS, t);
        L.g.gain.linearRampToValueAtTime(rand(0.5, 1) * 4.5, t + 0.07);
        L.g.gain.linearRampToValueAtTime(EPS, t + dur);
        L.next += dur + rand(0.05, 0.6);
      }
    }
  }
  function setLoop(name, on) {
    if (!(name in loops)) return Promise.resolve();
    const now = ctx.currentTime;
    if (on) {
      if (loops[name]) return Promise.resolve();
      const L = mkLoop(name);
      L.out.gain.setValueAtTime(0, now);
      L.out.gain.linearRampToValueAtTime(name === 'ticking' ? 0.5 : name === 'static' ? 0.55 : 0.5, now + 0.06);
      loops[name] = L;
      if (name === 'ticking') caption('*clockwork ticking*');
      else if (name === 'static') caption('*TV static*');
      else caption('*whispering*');
    } else if (loops[name]) {
      const L = loops[name];
      loops[name] = null;
      L.dead = true;
      L.out.gain.cancelScheduledValues(now);
      L.out.gain.setValueAtTime(L.out.gain.value, now);
      L.out.gain.linearRampToValueAtTime(0, now + 0.12);
      finish(now + 0.2, L.srcs.length ? L.srcs : [dummySrc()], L.nodes);
    }
    return Promise.resolve();
  }

  // ---------------------------------------------------------------------------------------------
  // scheduler pump + API
  // ---------------------------------------------------------------------------------------------
  function pumpAll(until) {
    pumpMusic(until);
    if (amb && amb.pump && !amb.dead) amb.pump(until);
    pumpHeartbeat(until);
    for (const k of Object.keys(loops)) pumpLoop(loops[k], until);
  }
  let timer = null;
  function startTimer() {
    if (offline || timer) return;
    const loop = () => {
      try {
        const hidden = typeof document !== 'undefined' && document.hidden;
        pumpAll(ctx.currentTime + (hidden ? 1.3 : 0.35));
      } catch (err) { console.warn('[audio] scheduler', err); }
      timer = setTimeout(loop, 30);
    };
    loop();
  }
  function stopAll() {
    const now = ctx.currentTime;
    for (const c of live) {
      try { c.out.gain.cancelScheduledValues(now); c.out.gain.setTargetAtTime(0, now, 0.02); } catch { /* */ }
    }
    for (const w of [...waits]) { clearTimeout(w.timer); w.res(); }
    waits.clear();
    if (cur) { retire(cur, 0.35); cur = null; }
    musicMode = 'off';
    if (amb) { retire(amb, 0.5); amb = null; }
    ambMode = 'off';
    hb.target = 0; hb.running = false; hb.level = 0;
    for (const k of Object.keys(loops)) setLoop(k, false);
    return Promise.resolve();
  }

  const api = {
    ctx,
    setVolumes: (v) => { setVolumes(v); return Promise.resolve(); },
    music: (m) => { setMusic(m); return Promise.resolve(); },
    ambient: (m) => { setAmbient(m); return Promise.resolve(); },
    knock, voice, sfx, heartbeat,
    loop: (n, on) => setLoop(n, !!on),
    stopAll,
    sfxNames: () => Object.keys(SFX),
    pumpTo: pumpAll,
    startTimer,
    get musicMode() { return musicMode; },
    get ambientMode() { return ambMode; },
  };
  return api;
}

// ---------------------------------------------------------------------------------------------
// public singleton (contract)
// ---------------------------------------------------------------------------------------------
let engine = null;
const wanted = { music: null, ambient: null };
const volumes = {};
const done = () => Promise.resolve();

function initialVolumes() {
  const s = (store && store.settings) || {};
  return { master: s.master, music: s.music, sfx: s.sfx, ...volumes };
}

export const audio = {
  get ready() { return !!engine; },
  init() {
    if (engine) {
      if (engine.ctx.state === 'suspended') engine.ctx.resume().catch(() => {});
      return Promise.resolve(true);
    }
    try {
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return Promise.resolve(false);
      const ctx = new AC({ latencyHint: 'interactive' });
      engine = createAudioEngine(ctx, { volumes: initialVolumes() });
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      engine.startTimer();
      if (wanted.music) engine.music(wanted.music);
      if (wanted.ambient) engine.ambient(wanted.ambient);
      return Promise.resolve(true);
    } catch (err) {
      console.warn('[audio] init failed, staying silent', err);
      engine = null;
      return Promise.resolve(false);
    }
  },
  setVolumes(v) {
    if (v) for (const k of ['master', 'music', 'sfx']) if (typeof v[k] === 'number') volumes[k] = v[k];
    return engine ? engine.setVolumes(v) : done();
  },
  music(mode) { wanted.music = mode; return engine ? engine.music(mode) : done(); },
  ambient(mode) { wanted.ambient = mode; return engine ? engine.ambient(mode) : done(); },
  knock(figure, variant) { return engine ? engine.knock(figure, variant) : done(); },
  voice(figure, text, opts) { return engine ? engine.voice(figure, text, opts || {}) : done(); },
  sfx(name) { return engine ? engine.sfx(name) : done(); },
  heartbeat(level) { return engine ? engine.heartbeat(level) : done(); },
  loop(name, on) { return engine ? engine.loop(name, on) : done(); },
  stopAll() { wanted.music = null; wanted.ambient = null; return engine ? engine.stopAll() : done(); },
};

export default audio;
