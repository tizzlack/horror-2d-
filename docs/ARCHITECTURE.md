# Same Shape — Architecture & module contracts

Plain HTML/CSS/JavaScript (ES modules, no build step, no framework). Runs from any static
server. Logical stage 1280×720 px, scaled to fit the window (`js/main.js`).
Game rules: `docs/GDD.md`. **Read both files before writing code.**

## File ownership

Several agents work in parallel. **Only edit files you own.** Need something from another
module that is missing or broken? Add a small local fallback in your own file and write
what you need into `docs/notes/<your-agent>.md`. Never run git commands that change state
(no commit, no checkout, no stash) — the lead commits.

| Owner | Files |
|---|---|
| lead | `index.html`, `js/main.js`, `js/core/*`, `css/base.css`, `js/data/difficulty.js`, `docs/ARCHITECTURE.md`, `docs/GDD.md`, `README.md` |
| figures | `js/data/figures.js`, `tools/extract_figures.py`, `assets/figures/**`, `tools/contact_sheet.*` |
| audio | `js/systems/audio.js`, `assets/audio/**`, `CREDITS.md`, `tools/audio_test.html` |
| rules | `js/data/nights.js`, `js/systems/visits.js`, `js/systems/rules.js`, `tests/**` |
| render | `js/render/figure.js`, `js/render/effects.js`, `js/render/icons.js`, `css/figure.css`, `tools/figure_test.html` |
| day | `js/screens/note.js`, `js/screens/morning.js`, `js/screens/day.js`, `js/data/story.js`, `css/day.css` |
| meta | `js/screens/menu.js`, `js/screens/settings.js`, `js/screens/album.js`, `js/screens/ending.js`, `js/screens/credits.js`, `css/meta.css` |
| night | `js/screens/night.js`, `js/screens/night/*.js` (helpers), `css/night.css` |

## Core (lead)

- `js/core/bus.js` — `bus.on(event, fn) → off`, `bus.emit(event, payload)`.
  Events: `screen` (name), `caption` (text, shown when captions setting is on),
  `settings` (settings object), `album` (album object changed).
- `js/core/rng.js` — `createRng(seed)` → `{next, range, int, chance, pick, shuffle, state}`.
- `js/core/dom.js` — `h(tag, attrs, ...children)`, `svg(...)`, `$`, `$$`, `sleep(ms)`,
  `frame(n)`, `animationDone(el)`, `modal(content, opts) → {el, close, closed}`, `clamp`.
- `js/core/state.js` — `store = {run, album, settings}`, `loadAll()`, `saveAll()`,
  `saveSettings()`, `newRun({mode, difficulty, seed})`, `clearRun()`, `resetProgress()`,
  `knownFacts(figureId) → [indices]`, `albumCompletion(figureIds) → %`, `difficultyOf(run)`.
  The run object's fields are listed in `newRun()` — read it.
- `js/data/difficulty.js` — `DIFFICULTY[id]` presets.

## Screens

`js/screens/<name>.js` exports `default { mount(root, params, ctx), unmount?() }`.
The router (`ctx.go(name, params)`) clears `#screen` and `#overlay`, then mounts.
`unmount` must stop timers, loops, audio loops and listeners on `window`/`document`.

`ctx` = `{ go, bus, store, audio, save, stage, overlay, params, toStage(clientX, clientY), setMood('day'|'night'|'menu') }`.
`ctx.audio` is always callable (silent stub if the audio module is missing).

Screen names and flow:

```
menu ──New game──▶ note(night 1) ─▶ night ─▶ morning ─▶ day ─▶ note(night n+1) ─▶ night …
                                         └─(ending decided)─▶ ending ─▶ menu
menu ─▶ album | settings | credits | (Continue: resumes store.run.phase) | (Endless, unlocked)
```

| Screen | Owner | Params |
|---|---|---|
| `menu` | meta | — |
| `settings` | meta | `{ back: screenName }` |
| `album` | meta | `{ back: screenName, figureId? }` — also opened as overlay from the night screen via `openAlbumOverlay` (see below) |
| `credits` | meta | — |
| `ending` | meta | `{ endingId }` (falls back to `store.run.endingId`) |
| `note` | day | `{ night }` (falls back to `store.run.night`) → continues to `night` |
| `night` | night | — (reads `store.run`) |
| `morning` | day | `{ report }` (falls back to `store.run.lastReport`) |
| `day` | day | — |

**Shared album component**: `js/screens/album.js` must also export
`openAlbumOverlay(ctx, { figureId, compare: true, onClose })` which renders the album as
a panel over the left half of the stage inside `#overlay` (night screen keeps the
peephole visible on the right) and returns `{ close() }`.

Dev / test URLs: `index.html?screen=night&night=3&seed=42&difficulty=normal` starts a
fresh run at that night. `?reset=1` clears saved data. `window.__SS` exposes
`{ctx, go, store, newRun, screen}`.

## Figures (`js/data/figures.js`, owner: figures)

```js
export const FIGURES = [Figure, ...]   // the 20 launch figures, Sheet A order
export const FIGURE_BY_ID, FIGURE_IDS, FACELESS
export function getFigure(id)          // also returns FACELESS for 'faceless'

Figure = {
  id: 'lume', name: 'Lume', number: 10, sheet: 'A',
  monsterTitle: 'The Fallen',
  personality: 'Kind, gentle, a little holy',
  greeting: "I bring light. May I stay?",
  admitLine: "...", rejectLine: "...", returnerLine: "...",   // short spoken lines
  talkLines: ["...", "..."],            // day-phase chatter (2–4 lines)
  facts: [ { cat: 'food'|'friend'|'habit', q: 'Question?', a: 'Answer.', wrong: ['Wrong answer', ...] } ×3 ],
  knock: { style: 'soft'|'hard'|'scratch'|'beep'|'roll'|'thud'|'stumble'|'slow',
           real: [msOffsets...], monster: [msOffsets...] },
  voice: { pitch: 0.6–1.8, speed: 0.7–1.4, wave: 'sine'|'triangle'|'square'|'sawtooth' },
  honestOddity: null | { effect: 'flicker'|'dark'|'wind', note: "Chalk's warning text" },
  images: { standard: 'assets/figures/lume_standard.png', monster: 'assets/figures/lume_monster.png' },
  anchors: { head, face, eyeL, eyeR, mouth, body, handL, handR, feet, accessory?, top? }, // [x, y] normalised 0..1 on the STANDARD image canvas
  monsterAnchors: { face, eyeL, eyeR, mouth },   // same, on the MONSTER image (used by the mirror)
  tells: [Tell, ...],                   // pool; rules pick 1–3 per monster visit
}

Tell = {
  id: 'lume_halo_tilt', level: 1|2|3, kind: 'visual'|'audio'|'text'|'behavior',
  effect: <one of TELL EFFECTS below>, at: <anchor name or null>, params: {...},
  revealedBy: 'eye'|'album'|'flashlight'|'mirror'|'ear'|'text'|'behavior'|'candle',
  desc: 'Short English sentence for the morning report, e.g. "Its halo was crooked."',
}
```

**Image spec** (all figure PNGs): identical canvas **400×560 px**, transparent background,
the same uniform scale for every figure, feet on the baseline y = 540, body centred at
x = 200. Monster images use the same canvas/scale so standard and monster line up.
`assets/figures/faceless.png`: a bare, faceless pale silhouette on the same canvas.

### Tell effects (implemented by render, used by figures)

| effect | kind | what the renderer draws | params |
|---|---|---|---|
| `drip` | visual | a dark drop slides down from the anchor, repeats | `color` |
| `smear` | visual | a dark blotch | `color`, `size` |
| `pixels` | visual | flickering square blocks around the anchor | `colors[]`, `size` |
| `extraEye` | visual | an extra eye that opens/blinks | `size` |
| `eyeGlow` | visual | glowing ring around both eyes (shape + colour) | `color` |
| `crack` | visual | a glowing jagged crack | `color` |
| `spikes` | visual | small spikes/thorns sticking out | `color`, `count` |
| `bubbles` | visual | small bubbles rising | `color` |
| `frost` | visual | frost crystals creep over the peephole rim | — |
| `teeth` | visual | a row of zigzag teeth glints at the anchor | — |
| `spores` | visual | floating spore dots | `color` |
| `smoke` | visual | dark wisps | — |
| `static` | visual | TV static noise patch | — |
| `stars` | visual | tiny stars circling in a spiral | `color` |
| `wetPrints` | visual | wet footprints at the feet | — |
| `rust` | visual | rust-coloured stain with darker rim | — |
| `vine` | visual | a thin tendril curling from the anchor | `color` |
| `mirrored` | visual (whole figure) | figure is flipped horizontally | — |
| `tilt` | visual (whole figure) | figure stands crooked | `deg` |
| `tooClose` | behavior | figure drawn ~12 % larger (too close to the peephole) | — |
| `noBlink` | behavior | never blinks (real figures blink every 2–6 s) | — |
| `jitter` | behavior | twitches every few seconds | — |
| `translucent` | visual | slightly see-through | — |
| `shadowOnly` | visual (level 3) | nothing on the body; only the shadow/mirror shows it | — |
| `knockExtra` | audio | monster knock pattern (handled by night + audio) | — |
| `ticking` | audio | ticking loop while visible | — |
| `distort` | audio | distorted voice/music | — |
| `textDrip` / `typo` / `shout` | text | speech bubble effects (night screen) | — |
| `impatient` | behavior | patience drains twice as fast (night screen) | — |

## Rules engine (owner: rules)

Pure logic, no DOM. Unit tests in `tests/` run with `node tests/run.mjs`.

```js
// js/data/nights.js
export const STORY_NIGHTS          // 7 entries following GDD "Nights"
export function nightConfig(run) → NightConfig   // story night or generated endless night
NightConfig = { night, visits, monsters, tellLevels: [min, max], tools: ToolId[],
                types: MonsterType[], events: ('powerOutage'|'twoOfThem'|'finale')[],
                patience, pusherPatience, candle: bool, flashlightUses: number|null, mirrorUses: 3 }
ToolId = 'album'|'questions'|'residents'|'flashlight'|'mirror'|'candle'|'callToDoor'

// js/systems/visits.js
export function generateNight(run, cfg, rng) → Visit[]
export function prepareVisit(run, visit, rng) → Visit   // call right before a visit starts;
                                                         // adapts it to what happened earlier tonight
Visit = {
  id, index, figureId,                 // figureId = the creature it looks like ('faceless' for the finale)
  isMonster: bool,
  type: 'real'|'imitator'|'returner'|'doppelganger'|'pusher'|'whisperer'|'faceless',
  tells: Tell[],                       // active tells ([] for real visitors)
  knock: 'real'|'monster',
  patience: seconds,
  answers: 'truth'|'lie'|'mixed', wrongChance: 0..1,
  textTell: null|'textDrip'|'typo'|'shout',
  dark: bool,                          // whisperer: invisible unless lit
  shadowFlicker: bool,                 // level-3 disguise: shadow flickers between shapes
  candleFlicker: bool,
  insideConflict: null | { insideIsMonster: bool },  // "two of them" situation (set by prepareVisit)
}

// js/systems/rules.js
export function startNight(run, cfg)                  // resets nightLog, guests, monstersInside, tool counters (run.tools = {flashlightLeft, mirrorLeft})
export function useTool(run, tool) → { ok, reason? }  // spends battery / mirror looks; reason e.g. 'battery'|'none-left'
export function answerQuestion(run, visit, factIndex | 'name', rng) → { text, correct, textTell }
export function resolveDecision(run, visit, decision: 'admit'|'reject'|'timeout') → DecisionResult
DecisionResult = { outcome: 'saved'|'realTurnedAway'|'monsterAdmitted'|'monsterCaught'|'noBed',
                   reveal: bool, line: string }
export function hammer(run, visit) → { door, brokeIn: bool }
export function resolveTwoOfThem(run, visit, throwOut: 'door'|'inside') → { correct, outcome, line }
export function decideFaceless(run, open: bool)       // stores run.openedFaceless
export function finishNight(run, rng) → MorningReport // applies losses, album updates, ending checks; sets run.phase
MorningReport = { night, saved: [figureId], lost: [{ id, by }], caught: [{ figureId, type }],
                  admitted: [{ figureId, type, tells }], turnedAway: [figureId],
                  missedTells: [{ figureId, tells: Tell[] }], flames, maxFlames,
                  jumpscare: null | { figureId }, gameOver: bool, endingId: null|string }
export function startDay(run)                         // actionsLeft = 3
export function dayAction(run, action, arg, rng) → { ok, message, factUnlocked?: { figureId, index } }
  // action: 'talk' (arg guestId) | 'askFriend' (arg guestId) | 'charge' | 'wick' | 'bed' | 'door'
export function endDay(run)                           // guests go home, night++, phase = 'note'
export function computeEnding(run) → 'lanternOut'|'dawn'|'twoSouls'|'newFog'
```

The rules engine owns all album updates during a run (`store.album.met / monsters / facts /
endings / endlessBest`) and emits `bus.emit('album', store.album)` after changes. Screens
call `ctx.save()` after each phase change.

## Rendering (owner: render)

```js
// js/render/figure.js
export function createFigureView(figure, opts) → { el, setDark(bool), setLight(0..1), destroy() }
  opts = { form: 'standard'|'monster', tells: Tell[], height: 420, blink: true,
           honestOddity: true, dark: false }
export function createShadowView(figure, { form, height, flicker: bool }) → { el, destroy() }
export function createMirrorView(figure, { form, size }) → { el, destroy() }
export function createPortrait(figure, { form: 'standard', height: 160, stamp: null|'MET'|'LOST', grayscale: false }) → HTMLElement
export const TELL_EFFECTS              // names it supports (must cover the table above)

// js/render/effects.js
export async function jumpscare(stageEl, figure, { reduced })   // full-screen monster burst, ~1.2 s
export async function reveal(container, figure, { reduced })    // monster form flashes in a container, ~0.8 s
export function shake(el, { intensity, duration })
export function flash(stageEl, { color, duration })
export function lightFlicker(el, { duration })
export function createFogEdge(size) → { el, set(progress 0..1), destroy() }  // patience fog for a round peephole

// js/render/icons.js — hand-drawn inline SVG icons as strings or nodes:
export const ICONS = { album, question, flashlight, mirror, candle, residents, flame, bed, battery, door, wick, talk, friend, bolt, ... }
export function icon(name, { size }) → SVGElement
```

Missing images (not yet extracted) must not crash: draw a grey placeholder blob.

## Audio (owner: audio)

```js
export const audio = {
  ready,                                  // true after init()
  init(),                                 // create AudioContext on first gesture (idempotent)
  setVolumes({ master, music, sfx }),
  music(mode: 'menu'|'day'|'night'|'finale'|'off'),
  ambient(mode: 'night'|'day'|'off'),
  knock(figure, variant: 'real'|'monster') → Promise,   // emits a caption like "*two soft knocks*"
  voice(figure, text, { monster, distort }) → Promise,  // gibberish syllables, length ~ text length
  sfx(name),                              // names below; emits captions for meaningful sounds
  heartbeat(level 0..1),                  // 0 = off
  loop(name: 'ticking'|'static'|'whisper', on: bool),
  stopAll(),
}
```

SFX names: `peepholeOpen, peepholeClose, bolt, doorOpen, doorSlam, footstepsIn,
footstepsAway, flashlightOn, flashlightOff, mirror, candle, pageTurn, penScratch, hammer,
flameOut, reveal, jumpscare1, jumpscare2, jumpscare3, powerOut, uiClick, uiHover, chime,
bell, creak, gulp`.

Everything must work without audio files (procedural WebAudio). CC0 / CC-BY files may be
added under `assets/audio/` and must be credited in `CREDITS.md` (source URL, author, licence).

## Story text (owner: day)

```js
// js/data/story.js
export const NOTES = { 1: { title, paragraphs: [...], rule: 'one-line rule' }, …, 7: {…} }
export const ENDINGS = { lanternOut, dawn, twoSouls, newFog }   // each { title, paragraphs: [...] }
export const GROUP_PHOTO = { title, paragraphs }
export const DAY_TEXT = { ... }   // labels and lines used by the day/morning screens
```

## Visual style

- Paper `#efe6d3`, ink `#2b2622`, night `#0d1019`, fog `#9aa3b5`, lantern `#f2b84b`, blood `#a3231b`
  (CSS variables in `css/base.css`).
- Font: `var(--font-hand)` (Patrick Hand), titles `var(--font-title)` (Patrick Hand SC).
- Hand-drawn look: `border-radius: var(--wobble)`, SVG filters `#sketch`, `#rough`, class `.boil`
  for line boil, `#silhouette` filter for shadows. Inline SVG drawings with round line caps.
- No emoji. All in-game text in English.
- Use stage pixel coordinates (1280×720). Pointer events (mouse + touch). Keyboard shortcuts per GDD.
- Respect `store.settings.reduceScares` (no shake, softer flashes, quieter stingers) and
  `store.settings.captions`.

## Testing

- Serve the repo on your own port: `npx http-server /home/user/horror-2d- -p <port> -c-1 -s &`
  (ports: figures 8101, audio 8102, rules 8103, render 8104, day 8105, meta 8106, night 8107).
  Stop it with `lsof -ti:<port> -sTCP:LISTEN | xargs -r kill` when done.
- Drive with Playwright (installed globally):
  ```js
  import { createRequire } from 'module';
  const require = createRequire(import.meta.url);
  const { chromium } = require('/opt/node22/lib/node_modules/playwright');
  const browser = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE ERROR', m.text()));
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  ```
  Keep test scripts and screenshots outside the repo (e.g. `/tmp/ss-<agent>/`), except unit
  tests under `tests/` (rules). **Look at your screenshots** (Read the PNG). Zero console errors.
- Other modules are being written at the same time. If one is missing, test against the
  contract with a local fallback, then re-test with the real module before you finish.
