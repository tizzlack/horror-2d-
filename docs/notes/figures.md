# Figures agent notes

## Assets (`assets/figures/`)
- `<id>_standard.png` / `<id>_monster.png` for the 20 Sheet A figures, `faceless.png`, and (unused at launch)
  `sheet_b/<id>_standard|monster.png` for the 20 Sheet B figures.
- All files: 400x560 RGBA, transparent, ONE uniform scale (x2.4587 from the sheet), feet at y=540 (+/-2 px
  because the drawn outline is not a straight line), body centre (legs/torso band, ignoring accessories) at x=200.
  Standard and monster of a figure use the same centre/baseline logic, so they line up when swapped.
- Scale note: the spec wanted standard bodies of ~470-500 px, but the monsters with tall parts (Crag's crystals,
  Lume's halo, Shady's hood, Kai's flower) are ~220 sheet-px tall vs ~165-195 for standards, so the uniform scale
  had to be chosen so the TALLEST monster still fits in 540 px. Standards are therefore 400-475 px tall
  (median ~435). Sheet B is scaled x2.4253 (its tallest monster is taller); not used at launch.
- The soft ground shadow drawn under the feet on the sheets was removed. Add your own contact shadow if wanted.
- The images keep the paper-sketch look (pencil edge, light fringe on black figures is part of the drawing).
- Regenerate with `python3 tools/extract_figures.py` (needs numpy, scipy, PIL), preview with
  `python3 tools/contact_sheet.py [sheet_b]` -> `/tmp/ss-figures/contact_{grey,dark}.png`.
- `faceless.png`: Nimi's silhouette, pale (#ece6da) fill, wobbly dark pencil outline, faint arm/leg strokes,
  a few soft smudges, no face. Anchors for it are approximate (`FACELESS.anchors`).

## `js/data/figures.js`
- Exports: `FIGURES, FIGURE_BY_ID, FIGURE_IDS, FACELESS, getFigure` (as in ARCHITECTURE.md) plus a new
  `TELL_EFFECT_NAMES` (the allowed tell effects, same list as the table; handy for tests).
- Anchors are normalised on the 400x560 canvas. Standard anchors: head, face, eyeL, eyeR, mouth, body, handL, handR,
  feet, top and (where the figure has one) `accessory`:
  roku goggles, miso strawberry, bub top bubble tuft, tobi band-aid, lume halo, pix headphone cup, sno scarf,
  vee leaf, dot sprout, glitch TV screen, nyx moon, zipp cap. Kai, nimi, blip, zen, shady, crag, kuro, maru
  have no accessory anchor (tells never use `at: 'accessory'` for them; validated).
  Note the faces are slightly left of x=0.5 and the right eye sits ~15 px higher than the left on most figures
  (the drawings are like that), so use the eye anchors rather than a symmetric guess.
  Glitch (standard) has no real eyes: eyeL/eyeR/face are placed on the TV screen. Nyx's eyes are guesses (dark sky).
- `monsterAnchors` (face/eyeL/eyeR/mouth) were measured on the monster images for the mirror view: Bub/Roku/Zen/Tobi/...
  have eyes at different places than the standard. For Sno, Vee, Glitch the "eyes" are not real (maw), so the mirror
  should crop around `face`.
- Tells: 4-6 per figure (104 total); each has exactly one level-3 `shadowOnly` (revealedBy `flashlight` for the
  shadow-wall ones, `mirror` where the owner's design says "mirror shows ..." : roku, zen, shady, lume, pix, kuro, nyx).
  Level 1 = obvious visual (drip/smear/pixels/rust/spikes/teeth/...) so night-1 figures (nimi, bub, lume, zen,
  miso) are easy; level 2 includes `mirrored`/`tilt`/`noBlink`/accessory overlays (`at: 'accessory'`) that are
  found by comparing with the album.
- Special uses of effects to know about (render):
  * `mirrored` is also used for **Glitch** (colour bars in the wrong order) and **Nyx** (moon in the wrong phase)
    and **Zipp** (cap brim the wrong way); it simply flips the whole figure.
  * `jitter` with `at: 'accessory'` on **Zipp** ("cap spins by itself") and **Vee** (leaf twitches, `at: null`):
    renderer may rotate/twitch just the accessory when `at` is given. Zipp's one is `kind: 'behavior'`
    though it is a level-1 tell the player can see.
  * `smear` with `at: 'accessory'` (Miso: strawberry leaves hidden; Dot: sprout turned into a mushroom cap, brown blob)
    and `crack` at `accessory` (Lume's halo), `spikes` at `top` (Nimi's bent antenna, count 1).
  * `extraEye` at `accessory` (Tobi, eye under the band-aid), `teeth` at `accessory` (Vee's leaf), `eyeGlow` at `eyeR` (Kuro).
- Honest oddities: shady `dark`, glitch `flicker`, zipp `wind`, each with Chalk's warning text in `note`.
- facts[0] (food) is the one Chalk wrote down; facts[1] is always a friend fact that names another Sheet A
  figure (pairs: nimi-bub, blip-pix, roku-crag, zen-maru, kai-dot, miso-sno, shady-kuro, tobi-lume, vee-glitch,
  nyx-zipp); facts[2] is a habit that helps recognise the figure.
- Knock patterns are unique per figure; the monster variant adds a beat, changes rhythm or is much slower.
  Voices are unique (pitch/speed/wave).
- FACELESS: `facts: []`, `tells: []`, same shape as other figures, images both point to `faceless.png`.

## Needs from other modules
- render: please make `createFigureView` tolerate `at` anchors that a figure lacks (validated: none do).
- rules: tells with `kind: 'audio'|'text'|'behavior'` and the `impatient` effect (Vee) are meant for the night screen.
