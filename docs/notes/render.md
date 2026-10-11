# Render agent notes

Files: `js/render/figure.js`, `js/render/effects.js`, `js/render/icons.js`, `css/figure.css`, `tools/figure_test.html`.
Everything follows "Rendering" in ARCHITECTURE.md. Tested with real `figures.js` data (all 20 figures + faceless).

## Using it

```js
import { createFigureView, createShadowView, createMirrorView, createPortrait, TELL_EFFECTS } from '../render/figure.js';
import { jumpscare, reveal, shake, flash, lightFlicker, createFogEdge } from '../render/effects.js';
import { icon, ICONS } from '../render/icons.js';
```

`css/figure.css` is already linked in `index.html`. Image paths are resolved against the document (`assets/figures/...`), i.e. index.html at the repo root.

### createFigureView(figure, opts) -> { el, setDark, setLight, destroy }
- `opts`: `form` ('standard'|'monster'), `tells` (Tell[]), `height` (default 420; width = height*5/7), `blink` (default true), `honestOddity` (default true), `dark` (bool), `animate` (default true; false = no boil/breathing).
- `el` is a `div.fig-view` (`position:relative; display:inline-block; pointer-events:none`) of exactly W x H px. The feet are at 96 % of the height. Place it yourself (e.g. absolutely centred in the peephole). It has no background and does not clip, so the peephole container must clip (round `overflow:hidden`).
- Always call `destroy()` in `unmount` (stops the rAF loop, removes the element). After destroy, zero rAF callbacks remain (verified).
- Tells: pass the visit's `tells` array. Audio/text tells (`knockExtra`, `ticking`, `distort`, `textDrip`, `typo`, `shout`, `impatient`) and `shadowOnly` are ignored (draw nothing). Tells are only drawn for `form:'standard'`.
- Anchors named in `tell.at` (head, face, top, accessory, body, handL/R, feet, mouth, eyeL/R) are used. `at:null` is fine for whole-figure effects and `frost`.
- `size` params: values <= 4 are treated as multipliers of the effect's default size (figures.js uses 0.8..1.4), larger values as design pixels (`pixels.size: 9`).
- Honest oddities come from `figure.honestOddity.effect` ('flicker' | 'dark' | 'wind'); pass `honestOddity:false` to turn them off (e.g. in the album).
- `setDark(true)` (whisperer): body almost invisible, faint pale outline + two eye glints; tells and blinking are hidden. `setDark(false)` fades back. `setLight(0..1)` dims the image (brightness + desaturation) and fades the tell overlay; 1 = normal. Both transition smoothly (0.5 s CSS), so flashlight flicker can call setLight repeatedly.
- Blink: eyelid colour is sampled from the image around `anchors.eyeL/eyeR` (needs same-origin images; falls back to a skin tone otherwise). Wrong eye anchors = visibly misplaced lids, so keep anchors accurate (current ones are).
- Reduced motion: `prefers-reduced-motion` disables breathing and line boil (tells stay animated, they are gameplay information). `opts.animate=false` does the same per view.
- Performance: line boil uses 3 pre-baked frames of the image (through #sketch/#sketch2/#sketch3, shared per image across views), so it costs a `drawImage` every 0.34 s, staggered per view. Overlay redraws at ~30 fps on a 1.5-2x canvas. 8 views at 420 px with tells: ~60 fps in software-rendered headless Chromium.
- Missing/broken image: a grey sketchy placeholder in the shared silhouette is drawn (`.fig-placeholder` class on `el`); never throws. (The browser still logs a 404 for the missing file.)

### createShadowView(figure, { form, height, flicker }) -> { el, setForm(f), destroy() }
Black silhouette, skewed (-9 deg) and stretched 1.12 x 1.32 from the bottom centre, ~75 % opacity, soft edge, slow wobble. The element box is W x H like a figure view but the shadow **overflows** upward and to the right, so put it in a wall container with `overflow:hidden` (or accept the overflow). `flicker:true` flips between standard and monster silhouette at 70-420 ms intervals (monster glimpses are short). `setForm()` stops flicker and shows one form. For the real "flashlight shows the TRUE shape" case use `form:'monster'`.

### createMirrorView(figure, { form, size }) -> { el, destroy() }
Round mirror (rim drawn with box-shadow, so allow ~9 px around it), crop around `monsterAnchors.face` (form 'monster') or `anchors.face`, 2.2x zoom, flipped horizontally, slight blur, sheen streak that drifts slowly. Static canvas, no loop (destroy only removes the element).

### createPortrait(figure, { form, height, stamp, grayscale }) -> HTMLElement
Plain `<img>`, no loops. `stamp`: 'MET' (green ink) or 'LOST' (red ink), rotated, `mix-blend-mode:multiply`, uses the `#rough` filter. Stamp font-size is `1.15em` of the parent, so it scales with the screen font. Falls back to the placeholder if the image is missing.

### effects.js
- `jumpscare(stageEl, figure, { reduced })`: appends `.fx-jump` (z-index 88, above screens, below the paper grain) to `stageEl`, resolves after ~1.2 s (reduced: ~1.9 s, no shake/strobe/slices, slow grow + fade) and removes itself. Needs `stageEl` to be the `#stage` element (uses its clientWidth/Height, falls back to 1280x720). It blocks pointer events while running. The caller is responsible for the stinger sound (`audio.sfx('jumpscare1')`).
  Timeline (normal): 0.1 s black, burst 70 % -> 140 % with growing shake, RGB split (red/cyan ghosts via `#fx-red`/`#fx-cyan` filters that effects.js injects as `#fx-defs`), random glitch slices, three red/black flashes (each ~50 ms, spaced > 200 ms, so < 3 Hz), final red frame, cut to black.
- `reveal(container, figure, { reduced })`: overlay inside `container` (it gets `position:relative` if static; the overlay uses `border-radius:inherit`, so give the round peephole `overflow:hidden`). If the container holds a `.fig-view` the monster image lines up exactly with it, otherwise it is centred and as tall as the container. Strips of the monster glitch in, RGB split, then it fades back (~0.8 s; reduced: simple cross-fade 1.2 s). Resolves when the overlay is removed. The underlying standard figure is left untouched (hide it yourself if you want the monster to stay).
- `shake(el, {intensity=8, duration=400})`: uses the independent CSS `translate` property (composes with `transform`), returns a Promise. `intensity<=0` is a no-op (use that for reduceScares).
- `flash(stageEl, {color, duration})`: full-stage colour flash, Promise.
- `lightFlicker(el, {duration})`: irregular `brightness()` flicker via Web Animations, Promise. Overrides `filter` only while running.
- `createFogEdge(size) -> { el, set(p), destroy() }`: `el` is a round `div.fx-fog` (size x size). Place it over the peephole (`position:absolute` over the figure; pointer-events none). `set(0)` hides it entirely (visibility hidden, loop idles); 0.3 fog creeping from the rim, 0.7 mostly fogged, 1.0 almost opaque fog with the figure only dimly visible. Smoothly eases towards the target. 96x96 canvas, 18 fps, per-pixel noise, CSS-scaled. Remove with `destroy()`.

### icons.js
`ICONS[name]` = complete `<svg>` strings (32 px, usable with `innerHTML`); `icon(name, {size, className})` = SVGElement (unknown name -> question mark). Names: album, question, flashlight, mirror, candle, residents, flame, flameOut, bed, battery, door, wick, talk, friend, bolt, flap, gear, back, play, sound, lock, star, moon, sun, house, eye. 48x48 viewBox, stroke `currentColor` width 2.7, round caps; light fill (`.f`, 14 % of currentColor) via `css/figure.css` (`.ico .f`).

## Tell effects as drawn
Level 1 effects are scaled 1.45x around their anchor, level 2 1.25x (and have fewer/fainter elements), so they are >= ~20 px at stage scale at height 420.
drip: ink drops with trails running from the anchor; smear: hatched blotch + runny drip; pixels: flickering blocks; extraEye: almond eye that opens/blinks/looks around; eyeGlow: wobbly glowing rings (+ rays at level 1) around both eyes (ignores `at`); crack: glowing jagged crack with branch, flickers; spikes: fan of spikes (pointing away from the body centre; `at:'body'` draws ribs instead; count 1 = a thin bent antenna); bubbles; frost: ferns + glaze creeping in from the view's edges/corners over ~4.5 s (designed to be clipped by the round peephole); teeth: gaping mouth with zigzag teeth + glint; spores; smoke (pale halo so it shows on dark figures); static: noisy TV patch with roll bar; stars: spiral of stars; wetPrints: puddle + footprints + drip; rust: stain with dark rim + flecks; vine: grows, sways, curls, retracts (8 s cycle).
Whole-figure: mirrored (scaleX -1 incl. overlay), tilt (`params.deg`), tooClose (1.12x), translucent (55 % opacity shimmer), jitter (a quick twitch every 2-4.5 s).

## Known limitations
- `frost` is drawn at the view-box edges, so how it looks depends on how the night screen clips/places the figure view (works as intended when the peephole circle is about as tall as the view).
- Level-3 `shadowOnly` is not drawn on the body by design; the night screen uses `createShadowView` / `createMirrorView`.
- Blink sampling needs same-origin images (works on any static server; `file://` would taint the canvas and fall back to a generic skin colour and radius).
- The mirror is a 2.2x zoom of a 400x560 bitmap, so it is soft by nature (a slight blur is applied on purpose).
- Test page: `tools/figure_test.html` (serve the repo root, open `/tools/figure_test.html`; `?s=figures,tells,real,odd,peep,shadows,mirrors,portraits,icons`, `?f=<figureId>` and `?h=<height>` for the tells section). The deliberate "missing image" cases log two 404s (`nope.png`, `nope2.png`). It substitutes measured anchors for a few figures only if it detects the old stub data.
