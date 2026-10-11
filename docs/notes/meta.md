# meta agent notes

Files: `js/screens/{menu,settings,album,ending,credits}.js`, `css/meta.css`. Tested on port 8106 against the real render/story/rules/audio modules, no console errors (the only error ever seen is the 404 for `CREDITS.md` until the audio agent adds that file; credits then renders it, otherwise a static fallback line).

## Exports other screens can use
- `album.js`: `openAlbumOverlay(ctx, { figureId, compare: true, onClose }) -> { close() }` (left ~55 % panel in #overlay, Esc closes via a capture-phase listener with stopImmediatePropagation, Left/Right switch creature, chip strip to jump). `compare:false` additionally shows the monster title and tell, still no monster page.
- `settings.js`: `openSettingsOverlay(ctx, { onClose }) -> { close() }` (same panel in #overlay, z-index 65, Esc closes, no "reset progress" in the overlay on purpose because resetProgress would wipe the running night).
- Helpers inside album.js also used by menu/ending: `portrait`, `figureImg`, `loadRender`, `loadStory`, `buildGroupPhoto`, `updateRewards`; `menu.js` exports `houseSvg()`.

## Behaviour decisions
- Continue: `ctx.go(phase === 'night' ? 'note' : phase, note ? {night} : {})`; hidden when no run or phase 'ending'. Endless button only when `Object.keys(album.endings).length > 0`.
- Album marks `album.rewards['25'|'50'|'75'|'100']` whenever the index is opened, and on the ending screen (`updateRewards`).
- Ending: reads `params.endingId` then `store.run.endingId`; snapshots stats from `store.run` (`history.length` = nights survived, `saved`, `stats.*`), sets `album.endings[id]=true`, then `clearRun()` + `ctx.save()` right at mount (not on leaving) so a closed tab never leaves an ending run behind. It does NOT touch `runsFinished` (rules does). Lantern-out monsters shown come from `run.history[].admitted[].figureId` + `run.lastReport.admitted`; guests in twoSouls from `run.met`. Group photo is offered from the stats card when `albumCompletion >= 100`, and also from the album index (button appears at 100 %).
- Music: menu/album/settings/credits `menu`; ending `off` (lanternOut), `finale` during the text, `menu` on the stats card.
- Chalk note/facts show whatever figures.js has; the figures stub still said "TODO" for personality when I tested.

## Things I rely on
- `createPortrait(figure, {form:'monster'})` works for the monster form (it does).
- Tell text on `album.monsters[id].tell` may be a tell id (looked up in figure.tells -> desc) or free text.
