# Rules agent notes

Files: `js/data/nights.js`, `js/systems/visits.js`, `js/systems/rules.js`, `tests/**`
(`node tests/run.mjs`; also runnable per file, e.g. `node tests/sim.test.mjs`). Pure logic, no DOM.
The API is exactly the contract in ARCHITECTURE.md; additions are listed below.

## How the screens should call it

```
cfg    = nightConfig(run)            // pure, deterministic from (seed, night, mode, difficulty); call it any time
visits = generateNight(run, cfg)     // consumes run.rngState, also stored in run.nightPlan (resume a night from there!)
startNight(run, cfg)                 // run.phase='night'
per visit: v = prepareVisit(run, visits[i])   // returns a COPY; use v from now on
           useTool / answerQuestion / hammer / resolveDecision | resolveTwoOfThem | decideFaceless
report = finishNight(run)            // run.phase='morning', run.lastReport = report
startDay(run); dayAction(...)*; endDay(run)   // story -> phase 'note', endless -> phase 'night'
```
Call `nightConfig(run)` BEFORE `endDay` bumps `run.night` if you need the config of the finished night.
Do not regenerate a night on resume: re-use `run.nightPlan` (regenerating would advance rngState and
give a different night).

## Additions / decisions beyond the contract

- `NightConfig` also has `endless: bool`. Story night 7 has `visits: 8` plus the faceless as an EXTRA 9th entry
  of `generateNight` (so the list has `cfg.visits + 1` items).
- Events: night 5 `['powerOutage','twoOfThem']`; nights 6 and 7 also include `'twoOfThem'` (GDD says "night 5+");
  night 7 adds `'finale'`. Endless nights roll `powerOutage` / `twoOfThem` occasionally (never `finale`).
- `run.tools` = `{ flashlightLeft, mirrorLeft, available: ToolId[] }`; `useTool` returns `reason: 'locked'`
  for tools not in `cfg.tools`, `'battery'` (< 20 %), `'none-left'` (outage flashlight / mirror), `'unknown'`.
  Success returns `{ ok:true, battery?, left? }`. Battery and door persist across nights (day actions refill).
- Faceless visit: `isMonster:false`, `type:'faceless'`, `patience:120` (screen may ignore it), `tells:[]`.
  `resolveDecision` on it just calls `decideFaceless(run, decision==='admit')` and never costs flames/guests/saved
  (returns `saved` / `realTurnedAway`, `reveal:false`). The screen may also call `decideFaceless` directly.
- **Beds**: occupied beds = `run.guests.length + run.monstersInside.length` (the player cannot tell them apart, a
  disguised monster takes a bed too). `admit` with no bed -> `{outcome:'noBed'}`, nothing changes, no log entry,
  the visit can still be rejected afterwards. Forced entry (`hammer` at door 0) ignores beds.
- **Timeout of a monster**: screen calls `hammer(run, v)` first, then `resolveDecision(run, v, 'timeout')`
  -> `monsterCaught`, `reveal:true`, album page `how:'caught'` WITH credit (its true form was seen; the cost is the
  door point). The `report.caught` entry has `timeout:true`. If `hammer` broke in, `resolveDecision` returns the
  earlier `monsterAdmitted` and does nothing again. `resolveDecision` is idempotent per `visit.id`.
  Timeout of a real visitor = reject (added to `run.rejectedReal`, comes back as a returner).
- **Returners**: turning a real away only appends to `run.rejectedReal` (no album change). `generateNight` schedules
  pending ones (count in `rejectedReal` minus count in `returned`, oldest first; max 1 on nights 2-4, 2 from 5; they
  count towards `cfg.monsters`). When the returner visit is resolved (admit/reject/timeout/break-in) it is pushed to
  `run.returned` and `album.monsters[id] = {night, how:'returner', tell}` is created (first page wins, never overwritten).
  A figure turned away twice can return twice.
- **Two of them**: `resolveTwoOfThem` resolves the WHOLE visit (do not also call `resolveDecision`).
  insideIsMonster=false (doppelganger at the door): `'door'` correct -> `monsterCaught`; `'inside'` wrong -> real guest
  is thrown out (removed from guests, saved-1, goes to `rejectedReal`) and the monster is admitted -> `monsterAdmitted`.
  insideIsMonster=true (imitator inside, real at the door): `'inside'` correct -> the imitator is caught (album `caught`,
  removed from `monstersInside`) and the real is admitted -> `saved`; `'door'` wrong -> `realTurnedAway`.
  Returns `{correct, outcome, line}` (`outcome:null` if the visit has no `insideConflict`).
  The generator creates the situation in two ways: doppelganger (real X first, doppelganger X later) and, on
  `twoOfThem` nights, an imitator X followed later by the real X.
- `prepareVisit`: a doppelganger whose original is not inside becomes a plain `imitator`; any visit whose figure is
  inside as a guest gets `{insideIsMonster:false}`, inside as an admitted monster `{insideIsMonster:true}`;
  otherwise `insideConflict:null`. Only show the "call to the door" UI when `cfg.tools` has `callToDoor`.
- `finishNight`: for each admitted monster in order: flame-1 and, if any guest is left, one random guest is lost
  (`saved`-1, `lost:[{id, by: monsterFigureId}]`). `report.saved` = surviving guests. Album monster pages `how:'jumpscare'`
  for admitted monsters (only if the figure has no page yet). Always sets `run.phase='morning'` (also on game over / ending;
  the morning screen should go to `ending` when `report.endingId`). On an ending: `run.endingId`,
  `album.endings[id]=true`, `album.runsFinished++`. Endless: `album.endlessBest = max(endlessBest, run.saved)` every night;
  game over (`lanternOut`) is the only ending in endless. `report.caught[i]` may carry `timeout:true`.
  `missedTells`: Cozy ('all') -> tells of every monster seen tonight incl. caught ones, Normal ('missed') -> admitted
  only, Nightmare -> `[]`.
- `answerQuestion` returns `{text, correct, textTell}`; unknown fact index -> `{text:'...', correct:null, ok:false,
  reason:'unknown-fact'}`. `'name'` with a `typo` textTell is misspelled (`correct:false`). The 2-per-visit limit and the
  10 s patience cost are the screen's job.
- `dayAction` results: `{ok, message, actionsLeft, factUnlocked?, fact?, line?}`; refusals `{ok:false, reason, message}`
  with reasons `noActions | noGuest | nothingNew | full | unknown`; refusals other than `noActions` cost nothing.
  `askFriend` picks figures not in `run.met` (never the guest) with a still-locked fact 1 or 2, preferring figures
  whose name appears in the guest's `friend` fact text.
- `endDay` also clears `monstersInside` and sets `actionsLeft = 3`.
- `generateNight` stores `run.rngState` always (also when an rng is passed in); `finishNight`/`dayAction`/
  `answerQuestion` do too.

## twoSouls threshold

Kept at **>= 20 saved** (`TWO_SOULS_MIN_SAVED` in rules.js). A perfect player saves 26-29 (Cozy 27-32, Nightmare 23-28);
20 is ~70 % of that. A player who judges 90 % of visits correctly gets twoSouls ~94 % of the time, 80 % -> ~43 %,
70 % -> ~5 %.

## Fairness (generation)

Tell usability: `eye/ear/text/behavior` always, `album/flashlight/mirror` need the tool in `cfg.tools`, `candle` needs
`cfg.candle`; a `shadowOnly` effect additionally needs flashlight or mirror. Every monster gets >= 1 usable tell:
pool is tried within `cfg.tellLevels`, then widened to easier levels (never above the difficulty cap), and as last
resort a generic level-1 `drip` tell (`<id>_generic`) or `<id>_impatient` for pushers is synthesised (pool tells are
copied, never mutated). The figures agent need not provide an `impatient` tell, but it is used if present.
Monsters are preferably assigned figures that have such a tell in range. Verified over 500 seeds x 7 nights x 3
difficulties, endless, hostile pools and randomised pools.

## What other modules should know

- Render/night: pass `honestOddity: !visit.isMonster` (monsters wearing Shady/Glitch/Zipp's skin do not get the
  honest oddity effect); `visit.dark` = whisperer; `visit.shadowFlicker` / `candleFlicker` are rolled per visit.
- Night 1 (story) only uses nimi, bub, lume, zen, miso; endless night 1 uses every figure without an honest oddity.
- Tests currently run against whatever `js/data/figures.js` exports (stub or real); they only rely on the schema,
  `facts` (3 per figure with `wrong` arrays) and `tells`.

## Simulation numbers (`node tests/sim.test.mjs`, 2000+ runs)

Random player (50 % admit / 40 % reject / 10 % hammer-timeout, random tools): 83 % lanternOut, 9 % dawn, 8 % newFog;
saved mean 5.6 (p90 11, max 18); Nightmare 98 % lanternOut. Perfect player: always twoSouls when opening, never loses
a flame; saved mean 25.5 / 27.5 / 29.5 (Nightmare / Normal / Cozy). Endless perfect player survives 40 nights
(saved ~170), random player lasts ~4 nights (saved ~4).
