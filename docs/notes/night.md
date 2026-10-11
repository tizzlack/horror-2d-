# Night agent notes

Files: `js/screens/night.js` (controller), `js/screens/night/{art,bubble,callpanel,clock,deps,fallback,pausemenu,scene}.js`,
`css/night.css`. Runs against the REAL rules / render / album / settings modules (verified, `__NIGHT.fallbacks` is `[]`).
`fallback.js` is only used when one of those modules fails to import (logged as a console warning); it can be deleted
once integration is done (then also drop `loadDeps` in `deps.js` and import the modules directly).

## Behaviour summary

- Layout (stage px): door + 440 px peephole centred at (740, 270), bubble top-right (x 990-1270), bolt (drag the knob left,
  or hold E 0.5 s) and flap handle right of the peephole, flames + "Night N" tally + resident note (night 3+) on the left wall,
  table with tools along the bottom (core tools right-aligned so Album/Ask/Light/Mirror stay clickable while the album overlay
  covers the left half), candle (night 6+, passive), "Call" tile appears only when the visitor's figure is already inside.
- Flow per visit: `prepareVisit` (uses the returned copy) -> knock (`audio.knock` + "KNOCK" scribbles per pattern entry) ->
  peephole closed until Space / click flap / click cover (auto-opens after 6 s) -> figure fades in, greeting in bubble +
  `audio.voice` -> patience (fog edge, heartbeat in the last 30 %, `impatient` tell drains 2x, each question costs 10 s) ->
  decision. Outcomes follow the coordinator's rules notes (hammer then `resolveDecision(...,'timeout')`, `resolveTwoOfThem`
  resolves the whole visit, noBed changes nothing, faceless -> `decideFaceless` + `finishNight` + `go('ending')`).
- End of night: `finishNight`, quiet beat, creak + heartbeat, `jumpscare` (rotating stingers jumpscare1-3), flames go out
  (`flameOut` sfx + animation), fade, then `go('morning', {report})`. Only the finale goes to `ending` itself; every other
  night hands over via the morning screen (as agreed).
- Resuming: if `run.phase==='night'` and `run.nightPlan` belongs to this night (`n<night>-*` ids) the plan is reused, else
  `generateNight(run, cfg)`. `startNight` is always called. Quit-to-menu leaves `run.phase='night'` and calls `audio.stopAll()`.
- Pause (Esc / button) really freezes patience and all animations (own clock in `night/clock.js`); settings overlay opens from it.
- Unmount: clock cancelled (all pending waits reject with `Cancelled`), listeners removed, loops (`ticking/static/whisper`) and
  heartbeat stopped, every figure/shadow/mirror/fog view destroyed. `mount()` returns right after init (the visit loop is not awaited).
- Faceless: "..." bubble, no patience, album "pages are blank", flashlight shows light but no shadow, mirror fogs over, no questions.
- Power outage: random visit index in [1, n-2] (seeded), `lightFlicker` + `powerOut`, room dims, toast with remaining charges.

## Dev / test hooks

- `?fast=1` scales patience (and the auto-open delay) by 0.1; `fast=0.5` -> x0.5. `?cut=N` keeps only the last N visits of the plan
  (handy for testing the finale: `?screen=night&night=7&cut=2`).
- `window.__NIGHT` exposes `{phase, visit, index, total, cfg, accepting, pat, qLeft, paused, speed, outageIndex, callOpen, fallbacks}`.

## Needs / assumptions about other modules

- `openAlbumOverlay` covers ~55 % of the stage from the left; the peephole's left part (x 520-700) is hidden while it is open
  (the figure itself stays mostly visible). Escape closes the overlay first (album stops propagation in capture phase).
- `openSettingsOverlay(ctx, {onClose})`: its Escape handler refuses while a `.modal-backdrop` is in `#overlay`, so the pause menu
  hides its backdrop (and drops the class) while settings are open and restores it on close.
- `audio.knock/voice` are not awaited for pacing beyond the knock pattern length (stub audio resolves instantly).
- Resident note lists `run.guests` + `run.monstersInside` figure ids (monsters show as the creature they imitate) without
  de-duplicating, so two "Sno" lines mean "two of them".

## Known gaps

- Hammer visuals: door shake + reveal flash + new crack; cracks are only 3 fixed drawings (door max 3).
- Keyboard-only flow for the question menu is mouse/Tab based (no number shortcuts to avoid clashing with tool keys).
- The "ending" hand-off for lanternOut on non-finale nights relies on the morning screen (per coordinator).
- Touch: bolt drag, flap, tools use pointer events; flashlight hold works with pointerdown/up. Not tested on a real touch device.
