// Same Shape — story text. Owner: day agent. All in-game prose lives here.
// Chalk's voice: kind, tired, gruff, practical. Short sentences. A little eerie, never purple.

/** Chalk's notebook, one page per night. */
export const NOTES = {
  1: {
    title: 'The First Night',
    paragraphs: [
      'If you are reading this, the door is yours now. Good. Somebody has to mind it.',
      'The fog comes down every evening. Whoever stays outside until dawn does not die. They change. Remember that. It matters later.',
      'Small ones will knock. They all have the same shape, the same round head and short arms. That is no accident. Some of them are wearing somebody else\'s skin.',
      'My album is on the shelf. A photograph of every creature in the valley, with notes. Compare them. Ask questions. Nobody wears a skin perfectly. Something always slips.',
    ],
    rule: 'Let no one in you don\'t recognise.',
  },
  2: {
    title: 'The Shadow',
    paragraphs: [
      'Found the old flashlight in the shed. It still works. Mostly.',
      'Shine it past the visitor, onto the wall behind. A skin can fool the eye. It cannot fool the shadow. Whatever stands out there, the wall draws what it truly is.',
      'The battery is thin, so do not waste it. I charge it in the daytime by the fire. It costs a little of the morning.',
      'And if you turned someone away last night, they may knock again. Not the same as before. Look at the wall.',
    ],
    rule: 'The shadow never lies.',
  },
  3: {
    title: 'Twice',
    paragraphs: [
      'Strange night. Someone knocked at nine. A small one I knew. I let them in, gave them tea and a blanket.',
      'At midnight someone knocked again. Same round head. Same face. The very same small one, who was asleep by the fire.',
      'A monster can only copy what it has already seen. So now I keep a list of everyone who is inside. Read it before you open the door. If the name is already on it, somebody out there is lying.',
      'I did not sleep after that.',
    ],
    rule: 'Check who is already inside before you open.',
  },
  4: {
    title: 'A Voice in the Fog',
    paragraphs: [
      'Found a mirror in the cellar. The silver has gone patchy, but it still works. Hold it up to the visitor. A skin can copy a face. The eyes in the glass are the true ones.',
      'Some of them do not knock any more. They hammer. Real creatures are frightened of the fog, but they are polite about it. Patience is a tell. So is the lack of it.',
      'Last night I heard a voice out in the fog. It was calling the way I call. It used my words. "Let me in, it\'s cold." It sounded exactly like me.',
      'I did not answer. I am not sure why that frightens me so much.',
    ],
    rule: 'Whoever hammers is not afraid of the fog.',
  },
  5: {
    title: 'No Light',
    paragraphs: [
      'The power failed at dusk. The flashlight has two good shines left tonight, maybe fewer. I will have to think more and shine less.',
      'Worse: two of them. Someone knocked and said they were Maru. But Maru was already inside, warming by the fire. One of them is wearing a skin. Maybe the one at the door. Maybe the one I let in this afternoon.',
      'So call the one inside to the door. Put them side by side. One of them will flinch.',
      'I keep thinking about my shadow. It stopped following me some days ago. Tonight, I am going to go out and find it. Only for a minute. I will be back before the knocking starts.',
    ],
    rule: 'If there are two of them, call one to the door.',
  },
  6: {
    title: 'The Dark Outside',
    paragraphs: [
      'It is very dark. I am writing by the candle and the candle will not keep still. Forgive the hand.',
      'It shivers when something is near. Not always. Do not trust it all the way.',
      'Something speaks out beyond the light. It does not show itself. It says, "It\'s me, Lume… let me in…" Soft. Close. Very good at it. But there is no one standing there. Only the flashlight will show you what is.',
      'I went out to look for it. I have not found it. I think it found me. It is wearing my—',
    ],
    rule: 'What speaks in the dark, light it first.',
  },
  7: {
    title: 'The Last Page',
    paragraphs: [
      'I am not coming back to the door. I should have told you sooner. I did not know how.',
      'After the fifth page I went out to find my shadow. I found it. It was standing at the door in my place, with the lantern in its hand. It had my coat. It had my gruff way of knocking. It did not know it was a shadow.',
      'You are my shadow. You are the one reading this. You have kept this house while I stood out in the fog and slowly forgot my own face.',
      'A shadow can be hungry. You could have opened every door and eaten every guest. You asked questions instead. You kept them safe. I watched through the window, every night. Thank you.',
      'Tonight someone without a face will knock. That is me. I do not know if the light is strong enough. Whether you open is for you to decide.',
    ],
    rule: 'Tonight someone without a face will knock. It is me.',
  },
};

export const ENDINGS = {
  lanternOut: {
    title: 'The Lantern Goes Out',
    paragraphs: [
      'The last flame shivers, and goes out.',
      'The fog does not knock. It simply comes in, soft and grey, through the keyhole and the cracks around the door.',
      'The ones you let in turn to look at you. They all have the same shape. They never had the same soul.',
      'Somewhere a music box plays one more note, and stops.',
    ],
  },
  dawn: {
    title: 'Dawn',
    paragraphs: [
      'You do not open the door. The knocking goes on, slow and patient, until the light climbs over the hills. Then it stops.',
      'The fog lifts. For the first time the valley is green. Small faces appear at small windows, and nobody is afraid.',
      'On the path outside lies a long coat, folded on a stone. No footprints lead to it. No footprints lead away.',
      'Some evenings, at the edge of the field, a shape stands and looks at the house. It never comes closer. You never close the curtains.',
    ],
  },
  twoSouls: {
    title: 'Two Souls',
    paragraphs: [
      'You open the door.',
      'The lantern light falls across the faceless one, and the grey comes away like frost. A face. A round head. Short arms. A tired, crooked smile. Chalk.',
      'Two silhouettes stand side by side in the doorway. The same shape. Two different souls. Neither of them is a shadow now.',
      'The fog never comes back. In the morning someone puts the kettle on, and someone else says, "I will take the first watch."',
    ],
  },
  newFog: {
    title: 'The New Fog',
    paragraphs: [
      'You open the door.',
      'The lantern is too weak. The light flickers over the faceless one and cannot hold. It steps in. You step out. It is not cruel about it.',
      'The door closes. The fog comes in around your ankles. Through the peephole someone looks at you with a keeper\'s tired, patient eyes.',
      'You knock. Three times, softly. Nobody answers. Same shape. Different souls.',
    ],
  },
};

export const GROUP_PHOTO = {
  title: 'Everyone, Both Ways',
  paragraphs: [
    'Every page of the album is full. Every creature, in both forms, standing side by side.',
    'Chalk would have liked this one. He would have pretended he did not.',
  ],
};

/** Labels and lines used by the note, morning and day screens. */
export const DAY_TEXT = {
  note: {
    button: 'Night falls…',
    skip: 'Click to turn the page faster',
    pageOf: (n) => `Page ${n} of 7`,
    signoff: '— C.',
  },

  morning: {
    heading: (n) => `Night ${n} — Morning`,
    subtitle: [
      'Pale light on the paper. The fog is thinning.',
      'The fog has pulled back from the windows.',
      'Dawn. Nobody is knocking now.',
    ],
    saved: { title: 'Saved', empty: 'Nobody came in last night.', stamp: 'MET' },
    missing: {
      title: 'Missing',
      empty: 'Everyone who came in is still here.',
      by: (name) => `Taken by something wearing ${name}`,
      byUnknown: 'Taken in the night',
      leftBehind: { scarf: 'a scarf', halo: 'a halo', goggles: 'goggles', cap: 'a cap', headphones: 'headphones', strawberry: 'a strawberry hat', sprout: 'a little sprout', bandage: 'a plaster', moon: 'a paper moon', button: 'a button', mitten: 'a mitten' },
    },
    caught: { title: 'Caught', empty: 'No monster knocked, or none was found out.', line: 'Found out at the door.' },
    turned: { title: 'Turned away', empty: 'You turned nobody away.', line: 'Turned away. They will come back… changed.' },
    missed: {
      title: 'Missed tells',
      lead: 'Chalk circled what you did not see:',
      none: 'Nothing slipped past you. Or the margins stay blank.',
      noHints: 'Chalk\'s margins stay blank on this difficulty.',
    },
    flames: { title: 'Lantern flames', left: (a, b) => `${a} of ${b} still burn.`, last: 'Only one flame is left.' },
    score: { title: 'Saved so far', best: (n) => `Best: ${n}`, newBest: 'A new best.' },
    continue: 'Continue',
    continueEnding: 'Continue…',
    continueEndless: 'Into the day',
  },

  day: {
    title: (n) => `Day ${n} — The Lantern House`,
    subtitle: 'Warm. Quiet. The fog is somewhere else.',
    emptyRoom: 'Nobody stayed. The beds are made. The house is very quiet.',
    notebook: 'Chalk\'s notebook',
    notebookTitle: 'Chalk\'s notebook',
    notebookEmpty: 'The pages are blank.',
    notebookPage: (a, b) => `Page ${a} of ${b}`,
    evening: 'Evening falls…',
    eveningConfirm: (n) => `You still have ${n} ${n === 1 ? 'job' : 'jobs'} left today. Let the evening fall anyway?`,
    eveningYes: 'Let it fall',
    eveningNo: 'Not yet',
    actionsLabel: 'Jobs left today',
    actionsNone: 'The daylight is spent.',
    board: 'Today\'s jobs',
    guestHint: 'Click a guest to talk.',
    guestsLabel: 'Guests',
    talk: 'Talk',
    askFriend: 'Ask about a friend',
    close: 'Close',
    album: 'New in the album',
    albumNothing: 'Nothing new. They have told you everything they can.',
    leftBehind: (who, what) => `${who}\'s ${what}. Nobody has picked it up.`,
    leftBehindShort: 'Left behind.',
    noGuest: 'No one is here.',
    bubbleFallback: ['Hello.', 'It is warm in here.', 'Thank you for the bed.'],
    status: {
      battery: (n, max) => `Battery ${n} of ${max}`,
      flames: (n, max) => `Flames ${n} of ${max}`,
      beds: (n, max) => `Beds ${n} of ${max}`,
      door: (n, max) => `Planks ${n} of ${max}`,
    },
    actions: {
      charge: { label: 'Charge battery', desc: 'The flashlight, full again.', done: 'The flashlight hums. Full.' },
      wick: { label: 'Mend the wick', desc: 'Light one flame again.', done: 'A flame comes back to the lantern.' },
      bed: { label: 'Build a bed', desc: 'One more place to sleep.', done: 'A new bed stands by the wall.' },
      door: { label: 'Reinforce the door', desc: 'Fresh planks for the next hammering.', done: 'The door is as strong as it will get.' },
    },
    refuse: {
      charge: 'The battery is already full.',
      wick: 'Every flame is already burning.',
      bed: 'There is no room for another bed.',
      door: 'The door is as strong as it gets.',
      noActions: 'No daylight left for work.',
      noGuests: 'There is no one to talk to.',
      generic: 'That does not work right now.',
    },
  },
};
