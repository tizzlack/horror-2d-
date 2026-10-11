# Audio agent notes

Files: `js/systems/audio.js`, `tools/audio_test.html`, `CREDITS.md`. No sample files (everything is
procedural Web Audio), `assets/audio/` stays empty.

## API (as in ARCHITECTURE.md)
`audio.{ready, init, setVolumes, music, ambient, knock, voice, sfx, heartbeat, loop, stopAll}`.
- Every method returns a Promise (resolved no-op before `init()` or if Web Audio is unavailable).
- `music()` / `ambient()` calls made before `init()` are remembered and started on init, so a
  menu screen that calls `audio.music('menu')` on mount gets its music after the first click.
  `stopAll()` forgets them.
- `knock()` / `voice()` resolve when the sound has finished (or immediately on `stopAll()`).
  `sfx(name)` resolves after the sound's length too (ignore it if you do not need it).
- `setVolumes(store.settings)` reads `master`, `music`, `sfx` (0..1, perceptual curve v^1.5).
  `store.settings.reduceScares` is read live at the moment a stinger plays (no call needed).
- Captions are emitted with `bus.emit('caption', '*text*')` (always; the UI decides whether to show):
  knocks ("*three hard knocks*", "*two knocks, then a stumble*", monsters sometimes
  "*..., then scratching*"), hammer, doorOpen, doorSlam, flameOut, reveal, jumpscare1-3, powerOut,
  and loop starts ('ticking', 'static', 'whisper'; none on stop).
- Extra export `createAudioEngine(ctx, {offline, volumes})` is used by `tools/audio_test.html` for
  OfflineAudioContext renders; the game only needs `audio`.

## Behaviour worth knowing
- `music('finale')` plays phrase A with tempo and pitch sagging, then silences; it also switches
  ambience to `night` if it is not already, and swells the wind after the last tine. Call
  `ambient('night')` yourself first if you want a specific timing.
- `music('night')` is the same melody at roughly half the day tempo, pitch-drifting, with missing and
  wrong notes, tape hiss and crackle.
- `heartbeat(level)`: 0 = off; rate 54 to 140 bpm and volume rise with level; call it every frame
  or on change, it smooths itself.
- `loop('ticking'|'static'|'whisper', on)` is idempotent. Use `unmount()` -> `audio.loop(name,false)`.
- Unknown sfx names warn once and do nothing.
- Monster knocks: ~2 semitones lower, grit, faint low rumble; one in three monsters (hash of
  figure id, only soft/hard/thud) also gets a short scratching tail (caption says so).

## Test results (headless Chromium, `tools/audio_test.html`, "Run self-test")
- Pre-init: all 70 calls return promises, no throws. Post-init: same, zero console errors.
- Offline renders at master=sfx=music=1 (worst case): every sfx, knock style (real+monster), voice
  variant, music mode, ambience, heartbeat and loop is non-silent, NaN-free, peak <= 0.80
  (master chain is limiter + tanh soft clip with hard ceiling ~0.80). Everything-at-once peak 0.78.
- Jumpscares peak 0.63-0.80 (rms 0.06-0.10); with reduceScares peak 0.39-0.63 and rms about 0.6x,
  slower attack and low-passed.

## Needs from others
Nothing required. Screens should call `audio.music/ambient` on mount (`day`, `night`, `menu`) and
`audio.stopAll()` on quit to menu. Night screen: `audio.heartbeat()` when patience is low,
`audio.loop('ticking', true)` for ticking tells, etc.
