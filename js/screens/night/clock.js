// Pausable clock: all night-screen timing goes through here so that Esc really pauses the game
// and unmount cancels every pending wait.
export class Cancelled extends Error {
  constructor() { super('night screen cancelled'); this.name = 'Cancelled'; }
}

export function createClock() {
  let raf = 0;
  let last = 0;
  let paused = false;
  let dead = false;
  const waits = new Set();
  const tickers = new Set();

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (paused || dead) return;
    for (const w of [...waits]) {
      w.left -= dt * 1000;
      if (w.left <= 0) { waits.delete(w); w.resolve(); }
    }
    for (const fn of [...tickers]) {
      try { fn(dt); } catch (err) { console.error('[night] ticker failed', err); }
    }
  }
  last = performance.now();
  raf = requestAnimationFrame(loop);

  return {
    /** Resolve after `ms` of un-paused time. Rejects with Cancelled when the screen is torn down. */
    wait(ms) {
      if (dead) return Promise.reject(new Cancelled());
      return new Promise((resolve, reject) => {
        waits.add({ left: ms, resolve, reject });
      });
    },
    /** Register a per-frame callback fn(dtSeconds); returns a remover. */
    onTick(fn) { tickers.add(fn); return () => tickers.delete(fn); },
    /** Run fn after ms (un-paused time) unless cancelled; returns cancel(). */
    later(ms, fn) {
      const w = { left: ms, resolve: () => { try { fn(); } catch (err) { console.error(err); } }, reject() {} };
      waits.add(w);
      return () => waits.delete(w);
    },
    pause(v) { paused = !!v; },
    get paused() { return paused; },
    get dead() { return dead; },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      for (const w of waits) w.reject(new Cancelled());
      waits.clear();
      tickers.clear();
    },
  };
}
