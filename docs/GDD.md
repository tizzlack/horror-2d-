# Same Shape — Game Design (implementation reference)

This is the condensed English rule set every module must follow. The full German design
document lives with the owner; this file is the source of truth for code.

**Pitch.** Single-player 2D horror "door check" game. Every night small creatures knock on
the door of the Lantern House. They all share the same silhouette. Some are monsters
wearing a creature's skin. The player looks through the peephole, checks with tools, and
decides: let in or turn away. Cute-creepy, hand-drawn pencil-on-paper look.
All in-game text is **English**. Target age ~16 (blood and jumpscares like the art sheets).

## World & story

- **Fog Hollow**: a small valley drawn on old paper. Every evening the fog rolls in.
  Whoever stays outside until dawn turns into their monster self.
- **Lantern House**: the only safe place. The lantern on the roof keeps the fog out while
  the door is shut. Limited beds.
- **The player** is the new night keeper. Never shown; first-person view.
- **Chalk**, the old keeper, vanished. He left an album (photos + notes on every creature)
  and notebook pages. One page per night (shown before each night) teaches a rule and
  tells the story.
- **Rules of the world** (they are also game rules):
  1. A monster can wear a creature's skin, but never perfectly: a trace of its true form shows (a "tell").
  2. The shadow on the wall never lies: light shows the true shape.
  3. A monster can only copy someone it has seen — doppelgangers copy creatures who already came.
  4. Whoever stays in the fog is transformed, not dead. A transformed creature remembers everything.
- **Twist (night 7)**: a faceless bare silhouette knocks last. Chalk's final note reveals
  that his shadow replaced him in the fog — and that shadow is *you*. You chose to protect
  instead of devour. The faceless one is Chalk himself, formless after days in the fog.

## Core loop

`Note (Chalk's page) → Night (4–8 visits) → Morning report → Day (3 actions) → next Note …`
After night 7, or immediately when the last lantern flame goes out → Ending.

## A visit

1. **Knock** — every creature has its own knock pattern (audio + caption).
2. **Open the peephole** — the creature appears in the round peephole and says its greeting.
3. **Check** — use tools while the visitor's patience runs out (fog creeps in from the
   peephole edge; ~60 s on Normal).
4. **Decide** — drag the bolt to let in, or slam the flap to turn away.
5. **Reaction** — let in: silhouette walks in, added to the resident list.
   Turned away: walks back into the fog (monsters briefly show their true form).

| | Let in | Turn away |
|---|---|---|
| **Real** | Saved: +1 saved, guest for the day, album "MET" stamp | Transforms; comes back on a later night as a *returner*; album monster page unlocked with a sad note |
| **Monster** | At night's end: jumpscare, one resident is gone, one lantern flame goes out | Correct! The monster shows its true form for a moment (small scare); album monster page unlocked |

- **Patience runs out**: a real creature gives up and leaves (counts as turned away);
  a monster hammers the door (door −1, falls out of role: brief reveal) and leaves.
  Door at 0 → the monster breaks in (counts as let in).
- **Beds full** (4 at start, max 6): you cannot let anyone else in tonight.
- Max **one big jumpscare per night** (if several monsters got in, one jumpscare,
  but each takes a resident and a flame).

## Resources

| Resource | Start | Effect | Refill (day action) |
|---|---|---|---|
| Lantern flames (lives) | 3 (Nightmare 2) | Each admitted monster puts one out. 0 → ending "The Lantern Goes Out" | Mend the wick (+1, max = start) |
| Beds | 4 per night | Full → must turn everyone away | Build a bed (+1, max 6) |
| Flashlight battery | 100 % | Each use costs 20 % | Charge battery (back to 100 %) |
| Door | 3 | Hammering costs 1; 0 → monster breaks in | Reinforce the door (back to 3) |
| Patience | per visit | Time to check | resets each visit |

## Tools

| Tool | From night | Shows | Limit | Fooled by |
|---|---|---|---|---|
| Album | 1 | Chalk's photo of the claimed creature (standard form), notes, known facts, honest-oddity warning | — | Level-3 imitators look exactly like the photo |
| Questions | 1 | Ask a question from known facts (plus always "What's your name?"). Real: correct. Imitator: often wrong/evasive/garbled text. | 2 per visit, each costs 10 s patience | Returners know everything |
| Resident list | 3 | Who is inside tonight | — | Players who forget to check |
| Flashlight | 2 | Shadow on the wall behind the visitor shows the TRUE silhouette (monster shape) | 20 % battery per use; shadow visible ~1.5 s; level-3 shadows flicker between shapes | Power outage (night 5); empty battery |
| Mirror | 4 | Reflection shows the TRUE eyes/face (monster face crop) | 3 looks per night | Creatures with hidden eyes |
| Candle | 6 (not on Nightmare) | Flickers when a monster is near | Passive, unreliable (random flicker, always flickers for Zipp) | Zipp |
| Call to the door | 5 | When a visitor claims to be someone already inside, call the resident to the door and compare both side by side | — | — |

## Tells

A tell is a small trace of the monster form. Each disguised monster shows 1–3 tells; at
least one must be detectable with the tools available that night.

| Level | Visibility | From night |
|---|---|---|
| 1 obvious | Visible when you look | 1 |
| 2 subtle | Only when comparing with the album | 2 |
| 3 hidden | Only with flashlight/mirror (no visual tell on the body) | 4 |

Kinds: **visual** (static or animated overlay on the figure), **audio** (wrong knock,
distorted music, ticking), **text** (dripping letters, typo in own name, SHOUTING),
**behavior** (never blinks, stands too close, wrong patience).

**Honest oddities** (real creatures that look suspicious; Chalk warns about them):
Shady (always dark, only two eyes in the hood when real), Glitch (screen always flickers;
real: colour bars in the right order), Zipp (always brings wind; candle always flickers).

**Fairness**: no tell relies on colour alone; tells ≥ ~20 px at 1280×720; each creature
has a fixed tell pool; the morning report shows missed tells.

## Monster types

| Type | From night | Behaviour | Detect via |
|---|---|---|---|
| Imitator | 1 | Wears the skin of a creature not inside | tells, album, shadow |
| Returner | 2 (only after a mistake) | A real creature you turned away, now transformed; says "Why didn't you let me in?" Worn-out disguise. Knows all answers | shadow & mirror show it clearly; extra tells |
| Doppelganger | 3 | Claims to be someone already inside tonight | resident list; "call to the door" (from 5) |
| Pusher | 4 | Impatient: half patience, hammers early | behaviour (too impatient) |
| Whisperer | 6 | Stands outside the light; only its voice: "It's me, Lume…" | flashlight is the only way to see it at all |
| The Faceless | 7 (last visit) | Bare silhouette without a face; no tool works; a story choice | — |

**"Two of them" event (night 5+)**: if a visitor claims to be X while X is inside, either
the door one is the monster (classic doppelganger) or the one inside is (because you let in
an imitator of X earlier). "Call to the door" shows both; the player throws out one.

## Nights (story mode)

| Night | Visits | Monsters | Tell levels | New | Chalk's note theme |
|---|---|---|---|---|---|
| 1 | 4 | 1 | 1 | Album, Questions, Imitator (tutorial) | "Let no one in you don't recognise." |
| 2 | 5 | 1–2 | 1–2 | Flashlight; Returner (if you turned away a real one) | "The shadow never lies." |
| 3 | 6 | 2 | 1–2 | Resident list, Doppelganger | He saw someone at the door twice |
| 4 | 6 | 2 | 2–3 | Mirror, Pusher | He hears a voice in the fog that sounds like his own |
| 5 | 7 | 2–3 | 2–3 | Power outage (flashlight only 2 uses), "Two of them" + Call to the door | He wants to go out at night and find the shadow |
| 6 | 7 | 3 | 2–3 | Candle, Whisperer | Shaky handwriting, page half torn |
| 7 | 8 | 3–4 | all | The Faceless (finale, always the last visit) | The last note: the twist |

- Night 1 only uses figures with obvious tells (nimi, bub, lume, zen, miso).
- Honest oddities appear from night 2.
- Which creatures come, and their tells, are random per run (seeded).

## Morning

Shows: who was saved, who is missing (eaten), monsters caught, real ones turned away,
missed tells (per difficulty: Cozy all marked, Normal missed ones, Nightmare none),
lantern flames left. The jumpscare itself plays at the end of the night (before morning).

## Day (Lantern House)

Last night's saved guests sit in the warm room (idle animations). 3 action points:

| Action | Effect |
|---|---|
| Talk to a guest | Unlock one of their facts in the album |
| Ask a guest about a friend | Unlock a fact about a creature that is still outside (not met yet) |
| Charge battery | Flashlight 100 % |
| Mend the wick | +1 flame (max start value) |
| Build a bed | +1 bed (max 6) |
| Reinforce the door | Door back to 3 |

Guests go home in the evening; saved creatures may knock again on a later night.
A lost guest leaves an empty spot with a small object (cosmetic).

## Endings

| Ending | Condition |
|---|---|
| `lanternOut` — The Lantern Goes Out (bad) | All flames out, any night. Montage of the monsters you let in. Game over |
| `dawn` — Dawn (normal) | Survived night 7, did NOT open for the Faceless. Fog lifts, Chalk stays outside forever. Bittersweet |
| `twoSouls` — Two Souls (good) | Survived night 7, ≥ 20 saved, opened for the Faceless. The lantern light gives Chalk his shape back; two equal silhouettes, two different souls. The fog never returns |
| `newFog` — The New Fog (dark) | Survived night 7, < 20 saved, opened for the Faceless. Lantern too weak; Chalk takes your place. Last image: you outside in the fog, knocking |
| Bonus: Group Photo | Album 100 % complete, after any ending: all creatures in both forms in one picture |

After the first ending, **Endless mode** unlocks: night after night, harder, highscore = most saved.

## Album

Persistent across runs. Contains Chalk's photo of every creature from the start (needed
to compare). Collect: standard page "MET" stamp (met the real one), 3 facts each
(fact 1 known from Chalk; 2 more via day talks), monster page (seen the monster form:
caught, jumpscare or returner) with the monster title, the night, and the tell that gave it away.
Rewards at 25 / 50 / 75 / 100 % completion: cover stickers, house decorations, alternative
door + music box, bonus "Group Photo".

## Difficulty

See `js/data/difficulty.js` (Cozy / Normal / Nightmare: patience, max tell level, flames, candle, morning hints).

## Sound

- One main theme on a music box. Day: cheerful, normal tempo. Night: same melody slower,
  detuned, with noise ("Same melody, different soul"). Finale: the music box stops; only wind.
- Every creature has a fixed knock pattern; monsters knock slightly wrong (one too many,
  wrong rhythm, too slow, scratching).
- Voices: gibberish syllables (Animal Crossing style) per creature pitch; monsters use the
  same syllables lower, with reverb/echo.
- Ambience: night wind + fog hiss + creaking wood + heartbeat when patience is low; day:
  birds, fireplace crackle, murmuring.
- SFX: peephole open/close, bolt, door open, flashlight click, mirror clink, candle flicker,
  page turn, pen scratch, hammering, flame out, monster reveal, 3 jumpscare stingers.
- Settings: "Reduce jumpscares" (quieter, no screen shake), "Sound captions" (all sounds
  and knocks as text captions).

## Controls

Mouse/touch first; keyboard shortcuts: Space peephole, 1 album, 2 question, 3 flashlight
(hold), 4 mirror, Tab resident list, E (hold 0.5 s) let in, Q turn away, Esc pause/back.
Letting in requires a deliberate drag/hold so nobody admits a monster by accident.
No numbers on screen where avoidable: patience = fog creeping into the peephole,
battery = marks on the flashlight, lives = flames.
