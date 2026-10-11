# day agent notes

Files: `js/screens/note.js`, `js/screens/morning.js`, `js/screens/day.js`, `js/data/story.js`, `css/day.css`.

## What was built
- `story.js`: NOTES 1-7 (twist on 7), ENDINGS (lanternOut, dawn, twoSouls, newFog), GROUP_PHOTO, DAY_TEXT (note/morning/day labels, refusals, action texts).
- `note` screen: notebook page on a dark desk, line-by-line handwriting reveal (click / Space skips, Space again = "Night falls..."), per-night margin doodles, night 6 torn + shaky, night 7 smudged. Endless mode skips straight to `night`. Sets `run.phase='night'`, `ctx.save()`, `ctx.go('night')`.
- `morning` screen: album-page layout (Saved / Missing / Caught / Turned away / Missed tells with hand-drawn red circles at tell anchors / lantern flames). Sections reveal one by one (click skips). Continue -> `ending` when `report.endingId` (or `report.gameOver`), else `rules.startDay(run)` + `day`. Endless shows the "saved so far" score.
- `day` screen: SVG Lantern House (beds = `run.beds`, door planks = `run.door`), guests via `createFigureView`, click a guest -> bubble with talkLine + Talk / Ask about a friend (`dayAction`), fact card + chime/penScratch, action board with status and disabled reasons, 3 candle tokens, notebook modal (pages 1..run.night), "Evening falls" (confirm if jobs left) -> `rules.endDay`, then `note` (story) or `night` (endless). Lost guests (`run.lastReport.lost`) leave a faint outline plus an object (click for a line).

## Integration notes
- `day.js` also exports shared helpers used by `morning.js` (`getRender`, `getRules`, `snd`, `portrait`, `figureImg`, `flameEl`, `objectEl`, `objectKeyFor`, `hash01`). Do not remove them.
- All render/rules/audio imports are dynamic or guarded; fallbacks (plain `<img>`, local rules) are used if a module is missing.
- IMPORTANT router detail: `ctx.go` awaits `mount()`. My note/morning reveals therefore run in the background so a `go()` during the reveal is not blocked. Other screens should do the same with long intros.
- Uses SVG filters `#rough`, `#sketch`, `#silhouette` from index.html and `.fig-stamp` from css/figure.css (overridden smaller inside `.morning-photo`).
- Audio calls used: music('day'|'night'|'off'), ambient('day'), sfx pageTurn, penScratch, chime, bell, hammer, uiClick.
- Morning prints the tell `desc` plus a hint for how it is revealed (REVEALED_BY in morning.js). Tells with `revealedBy` flashlight/mirror, or audio/text kinds, get a dashed number (no circle).
- Object names left behind per figure: `OBJECT_BY_FIGURE` in day.js (sno scarf, lume halo, roku goggles, zipp cap, pix headphones, miso strawberry, dot sprout, tobi plaster, nyx moon, others button/mitten).
