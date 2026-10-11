// Figure data for the 20 launch figures (Sheet A, owner: figures).
// Schema: docs/ARCHITECTURE.md#figures. All text is English.
//
// Image canvas: 400x560 px, feet on y=540, body centre x=200. Anchors are normalised 0..1
// on that canvas (measured on the extracted PNGs from tools/extract_figures.py).
// facts[0] of every figure is something Chalk wrote down (known from the start).
// Tell effects are the ones listed in ARCHITECTURE.md "Tell effects".

const IMG = (id) => ({ standard: `assets/figures/${id}_standard.png`, monster: `assets/figures/${id}_monster.png` });

/* ANCHORS (generated from the extracted images, see tools/extract_figures.py) */
const ANCHORS = {
  nimi: {
    anchors: { head: [0.469, 0.384], face: [0.454, 0.535], eyeL: [0.335, 0.537], eyeR: [0.573, 0.504], mouth: [0.454, 0.581], body: [0.5, 0.768], handL: [0.275, 0.839], handR: [0.728, 0.839], feet: [0.5, 0.955], top: [0.469, 0.264] },
    monsterAnchors: { face: [0.475, 0.545], eyeL: [0.338, 0.562], eyeR: [0.613, 0.536], mouth: [0.475, 0.652] },
  },
  blip: {
    anchors: { head: [0.479, 0.384], face: [0.479, 0.541], eyeL: [0.357, 0.541], eyeR: [0.6, 0.512], mouth: [0.479, 0.588], body: [0.5, 0.768], handL: [0.265, 0.839], handR: [0.732, 0.839], feet: [0.5, 0.955], top: [0.479, 0.246] },
    monsterAnchors: { face: [0.5, 0.473], eyeL: [0.412, 0.468], eyeR: [0.58, 0.468], mouth: [0.5, 0.571] },
  },
  roku: {
    anchors: { head: [0.476, 0.384], face: [0.434, 0.471], eyeL: [0.287, 0.47], eyeR: [0.58, 0.443], mouth: [0.47, 0.568], body: [0.5, 0.768], handL: [0.268, 0.839], handR: [0.728, 0.839], feet: [0.5, 0.955], accessory: [0.438, 0.455], top: [0.476, 0.246] },
    monsterAnchors: { face: [0.525, 0.482], eyeL: [0.412, 0.473], eyeR: [0.625, 0.461], mouth: [0.5, 0.58] },
  },
  zen: {
    anchors: { head: [0.479, 0.384], face: [0.461, 0.554], eyeL: [0.343, 0.552], eyeR: [0.58, 0.527], mouth: [0.461, 0.6], body: [0.5, 0.768], handL: [0.258, 0.839], handR: [0.738, 0.839], feet: [0.5, 0.955], top: [0.479, 0.243] },
    monsterAnchors: { face: [0.475, 0.446], eyeL: [0.312, 0.429], eyeR: [0.55, 0.461], mouth: [0.487, 0.589] },
  },
  kai: {
    anchors: { head: [0.476, 0.384], face: [0.465, 0.513], eyeL: [0.345, 0.512], eyeR: [0.585, 0.486], mouth: [0.47, 0.561], body: [0.5, 0.768], handL: [0.252, 0.839], handR: [0.742, 0.839], feet: [0.5, 0.955], top: [0.476, 0.232] },
    monsterAnchors: { face: [0.475, 0.571], eyeL: [0.35, 0.562], eyeR: [0.58, 0.536], mouth: [0.475, 0.625] },
  },
  miso: {
    anchors: { head: [0.47, 0.384], face: [0.453, 0.534], eyeL: [0.34, 0.536], eyeR: [0.565, 0.504], mouth: [0.453, 0.58], body: [0.5, 0.768], handL: [0.268, 0.839], handR: [0.718, 0.839], feet: [0.5, 0.955], accessory: [0.375, 0.25], top: [0.47, 0.161] },
    monsterAnchors: { face: [0.475, 0.509], eyeL: [0.35, 0.486], eyeR: [0.588, 0.479], mouth: [0.475, 0.616] },
  },
  shady: {
    anchors: { head: [0.471, 0.384], face: [0.458, 0.512], eyeL: [0.338, 0.514], eyeR: [0.578, 0.48], mouth: [0.458, 0.558], body: [0.5, 0.768], handL: [0.248, 0.839], handR: [0.735, 0.839], feet: [0.5, 0.955], top: [0.471, 0.171] },
    monsterAnchors: { face: [0.475, 0.5], eyeL: [0.35, 0.468], eyeR: [0.58, 0.45], mouth: [0.475, 0.536] },
  },
  bub: {
    anchors: { head: [0.47, 0.384], face: [0.454, 0.516], eyeL: [0.333, 0.518], eyeR: [0.575, 0.486], mouth: [0.454, 0.562], body: [0.5, 0.768], handL: [0.258, 0.839], handR: [0.735, 0.839], feet: [0.5, 0.955], accessory: [0.463, 0.175], top: [0.47, 0.164] },
    monsterAnchors: { face: [0.475, 0.509], eyeL: [0.32, 0.486], eyeR: [0.613, 0.446], mouth: [0.463, 0.634] },
  },
  tobi: {
    anchors: { head: [0.479, 0.384], face: [0.454, 0.497], eyeL: [0.333, 0.498], eyeR: [0.575, 0.468], mouth: [0.454, 0.544], body: [0.5, 0.768], handL: [0.265, 0.839], handR: [0.732, 0.839], feet: [0.5, 0.955], accessory: [0.62, 0.312], top: [0.479, 0.182] },
    monsterAnchors: { face: [0.475, 0.42], eyeL: [0.325, 0.396], eyeR: [0.662, 0.42], mouth: [0.475, 0.571] },
  },
  lume: {
    anchors: { head: [0.464, 0.384], face: [0.448, 0.55], eyeL: [0.335, 0.552], eyeR: [0.56, 0.52], mouth: [0.448, 0.596], body: [0.5, 0.768], handL: [0.282, 0.839], handR: [0.72, 0.839], feet: [0.5, 0.955], accessory: [0.4, 0.246], top: [0.464, 0.159] },
    monsterAnchors: { face: [0.475, 0.509], eyeL: [0.375, 0.536], eyeR: [0.588, 0.514], mouth: [0.487, 0.625] },
  },
  pix: {
    anchors: { head: [0.488, 0.384], face: [0.448, 0.55], eyeL: [0.335, 0.55], eyeR: [0.56, 0.521], mouth: [0.448, 0.596], body: [0.5, 0.768], handL: [0.272, 0.839], handR: [0.722, 0.839], feet: [0.5, 0.955], accessory: [0.762, 0.479], top: [0.488, 0.186] },
    monsterAnchors: { face: [0.487, 0.491], eyeL: [0.35, 0.486], eyeR: [0.637, 0.429], mouth: [0.5, 0.536] },
  },
  crag: {
    anchors: { head: [0.502, 0.384], face: [0.463, 0.536], eyeL: [0.345, 0.534], eyeR: [0.58, 0.509], mouth: [0.463, 0.582], body: [0.5, 0.768], handL: [0.24, 0.839], handR: [0.758, 0.839], feet: [0.5, 0.955], top: [0.502, 0.207] },
    monsterAnchors: { face: [0.463, 0.509], eyeL: [0.338, 0.518], eyeR: [0.588, 0.482], mouth: [0.475, 0.575] },
  },
  sno: {
    anchors: { head: [0.49, 0.384], face: [0.472, 0.518], eyeL: [0.355, 0.518], eyeR: [0.59, 0.489], mouth: [0.472, 0.564], body: [0.5, 0.768], handL: [0.248, 0.839], handR: [0.762, 0.839], feet: [0.5, 0.955], accessory: [0.475, 0.693], top: [0.49, 0.191] },
    monsterAnchors: { face: [0.475, 0.429], eyeL: [0.338, 0.384], eyeR: [0.613, 0.384], mouth: [0.475, 0.455] },
  },
  vee: {
    anchors: { head: [0.458, 0.384], face: [0.449, 0.542], eyeL: [0.338, 0.536], eyeR: [0.56, 0.52], mouth: [0.449, 0.588], body: [0.5, 0.768], handL: [0.26, 0.839], handR: [0.738, 0.839], feet: [0.5, 0.955], accessory: [0.425, 0.189], top: [0.458, 0.161] },
    monsterAnchors: { face: [0.5, 0.411], eyeL: [0.35, 0.396], eyeR: [0.65, 0.396], mouth: [0.5, 0.429] },
  },
  kuro: {
    anchors: { head: [0.465, 0.384], face: [0.446, 0.528], eyeL: [0.312, 0.521], eyeR: [0.58, 0.505], mouth: [0.446, 0.574], body: [0.5, 0.768], handL: [0.272, 0.839], handR: [0.73, 0.839], feet: [0.5, 0.955], top: [0.465, 0.198] },
    monsterAnchors: { face: [0.5, 0.455], eyeL: [0.4, 0.45], eyeR: [0.625, 0.446], mouth: [0.5, 0.575] },
  },
  dot: {
    anchors: { head: [0.476, 0.384], face: [0.456, 0.58], eyeL: [0.345, 0.575], eyeR: [0.568, 0.557], mouth: [0.456, 0.627], body: [0.5, 0.768], handL: [0.285, 0.839], handR: [0.72, 0.839], feet: [0.5, 0.955], accessory: [0.5, 0.179], top: [0.476, 0.125] },
    monsterAnchors: { face: [0.5, 0.598], eyeL: [0.388, 0.58], eyeR: [0.613, 0.58], mouth: [0.5, 0.629] },
  },
  glitch: {
    anchors: { head: [0.478, 0.384], face: [0.438, 0.454], eyeL: [0.287, 0.45], eyeR: [0.588, 0.429], mouth: [0.45, 0.536], body: [0.5, 0.768], handL: [0.265, 0.839], handR: [0.738, 0.839], feet: [0.5, 0.955], accessory: [0.45, 0.429], top: [0.478, 0.182] },
    monsterAnchors: { face: [0.45, 0.411], eyeL: [0.275, 0.312], eyeR: [0.625, 0.312], mouth: [0.463, 0.42] },
  },
  maru: {
    anchors: { head: [0.469, 0.384], face: [0.443, 0.455], eyeL: [0.32, 0.457], eyeR: [0.565, 0.425], mouth: [0.445, 0.507], body: [0.5, 0.768], handL: [0.268, 0.839], handR: [0.722, 0.839], feet: [0.5, 0.955], top: [0.469, 0.146] },
    monsterAnchors: { face: [0.475, 0.455], eyeL: [0.362, 0.441], eyeR: [0.58, 0.429], mouth: [0.445, 0.518] },
  },
  nyx: {
    anchors: { head: [0.484, 0.384], face: [0.463, 0.487], eyeL: [0.325, 0.486], eyeR: [0.6, 0.461], mouth: [0.463, 0.534], body: [0.5, 0.768], handL: [0.265, 0.839], handR: [0.742, 0.839], feet: [0.5, 0.955], accessory: [0.53, 0.414], top: [0.484, 0.168] },
    monsterAnchors: { face: [0.5, 0.438], eyeL: [0.445, 0.438], eyeR: [0.555, 0.438], mouth: [0.5, 0.536] },
  },
  zipp: {
    anchors: { head: [0.476, 0.384], face: [0.455, 0.53], eyeL: [0.34, 0.53], eyeR: [0.57, 0.502], mouth: [0.455, 0.577], body: [0.5, 0.768], handL: [0.268, 0.839], handR: [0.732, 0.839], feet: [0.5, 0.955], accessory: [0.425, 0.268], top: [0.476, 0.177] },
    monsterAnchors: { face: [0.588, 0.509], eyeL: [0.425, 0.486], eyeR: [0.58, 0.504], mouth: [0.512, 0.625] },
  },
};

// tell helper: T(id, level, kind, effect, at, params, revealedBy, desc)
const T = (id, level, kind, effect, at, params, revealedBy, desc) =>
  ({ id, level, kind, effect, at, params, revealedBy, desc });

// Every effect a tell may use (kept in sync with the table in ARCHITECTURE.md).
export const TELL_EFFECT_NAMES = [
  'drip', 'smear', 'pixels', 'extraEye', 'eyeGlow', 'crack', 'spikes', 'bubbles', 'frost', 'teeth',
  'spores', 'smoke', 'static', 'stars', 'wetPrints', 'rust', 'vine', 'mirrored', 'tilt', 'tooClose',
  'noBlink', 'jitter', 'translucent', 'shadowOnly', 'knockExtra', 'ticking', 'distort', 'textDrip',
  'typo', 'shout', 'impatient',
];

function make(def) {
  const a = ANCHORS[def.id];
  return {
    sheet: 'A',
    honestOddity: null,
    ...def,
    images: IMG(def.id),
    anchors: a.anchors,
    monsterAnchors: a.monsterAnchors,
  };
}

export const FIGURES = [
  // 1 ---------------------------------------------------------------------------------------
  make({
    id: 'nimi', name: 'Nimi', number: 1, monsterTitle: 'The Ink',
    personality: 'Cheerful, curious and a little naive',
    greeting: "Hi! Can I come in? Everything's so grey out there.",
    admitLine: "Oh, it's so bright in here! Thank you, thank you!",
    rejectLine: "Oh... okay. I'll just wait over there. Where it's grey.",
    returnerLine: "Why didn't you let me in? It was so grey, and now I can't stop dripping...",
    talkLines: [
      "Did you know the kettle sings when it is happy? I asked it.",
      "I counted all the stars last night. I lost count at seven.",
      "Everything here has a name, even the squeaky floorboard. Mine is called Gerald.",
      "Is it true that fog tastes like cold porridge? I will find out one day!",
    ],
    facts: [
      { cat: 'food', q: 'What is your favourite food?', a: 'Warm porridge with honey.', wrong: ['Cold fish soup.', 'Dry toast.', 'Pickled onions.'] },
      { cat: 'friend', q: 'Who do you play hide and seek with?', a: 'Bub. He leaves little puddles, so I always find him.', wrong: ['Crag. He never moves.', 'Shady. I never find him.', 'Vee. She cheats.'] },
      { cat: 'habit', q: 'What do you do when you meet someone new?', a: 'I wave with both hands and say hi twice.', wrong: ['I bow politely.', 'I hide behind my hands.', 'I salute.'] },
    ],
    knock: { style: 'soft', real: [0, 300], monster: [0, 300, 600] },
    voice: { pitch: 1.5, speed: 1.15, wave: 'triangle' },
    tells: [
      T('nimi_smear', 1, 'visual', 'smear', 'face', { color: '#111', size: 1.4 }, 'eye', 'A black smear covered half of its face.'),
      T('nimi_drip', 1, 'visual', 'drip', 'head', { color: '#111' }, 'eye', 'Black ink kept dripping from its head.'),
      T('nimi_antenna', 2, 'visual', 'spikes', 'top', { color: '#2b2622', count: 1 }, 'album', "A small bent antenna stuck out of its head. Chalk's photo has none."),
      T('nimi_noblink', 2, 'behavior', 'noBlink', null, {}, 'behavior', 'It never blinked.'),
      T('nimi_knock', 2, 'audio', 'knockExtra', null, {}, 'ear', 'Its knock had one tap too many.'),
      T('nimi_shadow', 3, 'visual', 'shadowOnly', null, {}, 'flashlight', 'Its shadow dripped like running ink.'),
    ],
  }),
  // 2 ---------------------------------------------------------------------------------------
  make({
    id: 'blip', name: 'Blip', number: 2, monsterTitle: 'The Pixel Rot',
    personality: 'Cool, bored, always has a quip',
    greeting: 'Yo. Open up.',
    admitLine: "Cool. Thanks. Don't make it weird.",
    rejectLine: 'Whatever. Figures.',
    returnerLine: "Yo. You left me out there. Not cool. Not cool at all.",
    talkLines: [
      "Everything's fine. Fine is my favourite word.",
      'I rated the fog. One star. Too damp.',
      "Don't tell the others, but I kind of like your lamp.",
      'Boring is just peaceful with a better haircut.',
    ],
    facts: [
      { cat: 'food', q: 'What do you snack on?', a: 'Salted crackers. Plain ones are for amateurs.', wrong: ['Sweet jam toast.', 'Fresh berries.', 'Hot soup.'] },
      { cat: 'friend', q: 'Who do you hang out with?', a: 'Pix. We share one pair of headphones and zero words.', wrong: ['Maru. He talks too much.', 'Zen. Too sleepy.', 'Nimi. Too cheerful.'] },
      { cat: 'habit', q: 'What do you do before you answer a question?', a: 'I roll my eyes first. Then I answer.', wrong: ['I whistle a tune.', 'I scratch my head.', 'I count to three.'] },
    ],
    knock: { style: 'beep', real: [0, 120, 240], monster: [0, 120, 240, 360, 480] },
    voice: { pitch: 1.0, speed: 1.35, wave: 'square' },
    tells: [
      T('blip_pixels', 1, 'visual', 'pixels', 'head', { colors: ['#37b4e8', '#e8334a', '#22cc77'], size: 9 }, 'eye', 'Little blocks of pixels flickered around its head.'),
      T('blip_eyepix', 2, 'visual', 'pixels', 'face', { colors: ['#37b4e8', '#111111'], size: 6 }, 'eye', 'Its eyes broke into pixels for a moment.'),
      T('blip_tilt', 2, 'visual', 'tilt', null, { deg: 6 }, 'album', "It stood slightly crooked, unlike Chalk's photo."),
      T('blip_static', 2, 'visual', 'static', 'body', {}, 'eye', 'A patch of static buzzed on its belly.'),
      T('blip_distort', 2, 'audio', 'distort', null, {}, 'ear', 'Its voice crackled like a broken speaker.'),
      T('blip_shadow', 3, 'visual', 'shadowOnly', null, {}, 'flashlight', 'Its shadow broke apart into little squares.'),
    ],
  }),
  // 3 ---------------------------------------------------------------------------------------
  make({
    id: 'roku', name: 'Roku', number: 3, monsterTitle: 'The Clockwork',
    personality: 'Tinkerer who talks about machines all day',
    greeting: 'My goggles detected fog! Quick!',
    admitLine: 'Excellent! Your door hinge is a four out of five, by the way.',
    rejectLine: 'Hm. Noted. Recalibrating... somewhere outside.',
    returnerLine: "Why didn't you let me in? My gears are all wrong now. Tick. Tick.",
    talkLines: [
      "Your lantern runs at about six lumens. I'd love to improve it.",
      'I built a spoon that stirs by itself. It stirs too much.',
      'Every machine hums a note. This house hums in B flat.',
      "Don't worry about the loose screw in my hand. It's decorative.",
    ],
    facts: [
      { cat: 'food', q: 'What do you like to eat?', a: 'Bolt-shaped pasta with butter.', wrong: ['Ginger biscuits.', 'Cold stew.', 'Apple pie.'] },
      { cat: 'friend', q: 'Who helps with your inventions?', a: 'Crag. He lifts all the heavy parts and never complains.', wrong: ['Pix. Pix turns every machine up to eleven.', 'Kai. He waters the gears.', 'Dot. Dot plants the bolts.'] },
      { cat: 'habit', q: 'What do you do before you speak?', a: 'I tap my goggles twice. Tap, tap.', wrong: ['I polish my goggles.', 'I pull them over my eyes.', 'I tap my foot.'] },
    ],
    knock: { style: 'hard', real: [0, 220, 440, 660], monster: [0, 220, 440, 700] },
    voice: { pitch: 1.25, speed: 1.3, wave: 'sawtooth' },
    tells: [
      T('roku_rust', 1, 'visual', 'rust', 'body', {}, 'eye', 'A rust stain spread across its fur.'),
      T('roku_smoke', 1, 'visual', 'smoke', 'head', {}, 'eye', 'Dark smoke curled out of the top of its head.'),
      T('roku_mirrored', 2, 'visual', 'mirrored', null, {}, 'album', 'Its goggle strap sat on the wrong side of its head.'),
      T('roku_ticking', 2, 'audio', 'ticking', null, {}, 'ear', 'Faint ticking came from inside it.'),
      T('roku_jitter', 2, 'behavior', 'jitter', null, {}, 'behavior', 'It twitched like a wound-up toy.'),
      T('roku_shadow', 3, 'visual', 'shadowOnly', null, {}, 'mirror', 'Its reflection showed a single clockwork eye.'),
    ],
  }),
  // 4 ---------------------------------------------------------------------------------------
  make({
    id: 'zen', name: 'Zen', number: 4, monsterTitle: 'The Thousand Eyes',
    personality: 'Calm, sleepy, meditative',
    greeting: 'Mmh... is there somewhere to sleep?',
    admitLine: 'Mmmh. Warm. This is the right place.',
    rejectLine: 'It is fine. The fog is also a kind of blanket.',
    returnerLine: "Why didn't you let me in? I am so awake now. I see everything.",
    talkLines: [
      'If you hold very still, the kettle forgets you are there.',
      'I once napped through an entire storm. It was lovely.',
      'Breathe in. Breathe out. Do you hear the lantern? It breathes too.',
      "Shhh. Don't wake the soup.",
    ],
    facts: [
      { cat: 'food', q: 'What do you like to eat?', a: 'Warm milk with a pinch of lavender.', wrong: ['Spicy noodles.', 'Burnt toast.', 'Sour apples.'] },
      { cat: 'friend', q: 'Who do you nap with?', a: 'Maru. Maru is a perfect pillow.', wrong: ['Zipp. Too loud.', 'Kuro. He scratches.', 'Pix. Pix never takes the headphones off.'] },
      { cat: 'habit', q: 'What do you do during a conversation?', a: 'I yawn at every second sentence.', wrong: ['I hum a lullaby.', 'I stare at the ceiling.', 'I stretch my arms.'] },
    ],
    knock: { style: 'slow', real: [0, 800], monster: [0, 800, 1900] },
    voice: { pitch: 0.8, speed: 0.7, wave: 'sine' },
    tells: [
      T('zen_drip', 1, 'visual', 'drip', 'face', { color: '#6a2bb0' }, 'eye', 'Purple goo dripped down its face.'),
      T('zen_extraeye', 1, 'visual', 'extraEye', 'head', { size: 1.2 }, 'eye', 'An extra eye opened on its forehead.'),
      T('zen_noblink', 2, 'behavior', 'noBlink', null, {}, 'behavior', 'It never closed its eyes, not even slowly.'),
      T('zen_knock', 2, 'audio', 'knockExtra', null, {}, 'ear', 'Its knock came far too slowly, with a tap too many.'),
      T('zen_shadow', 3, 'visual', 'shadowOnly', null, {}, 'mirror', 'Its reflection showed dozens of staring eyes.'),
    ],
  }),
  // 5 ---------------------------------------------------------------------------------------
  make({
    id: 'kai', name: 'Kai', number: 5, monsterTitle: 'The Thornbloom',
    personality: 'Nature lover, quiet and friendly',
    greeting: 'The flowers outside are asleep. Me too, soon.',
    admitLine: 'Thank you. I will be very quiet, like moss.',
    rejectLine: 'That is all right. I will sleep with the flowers.',
    returnerLine: "Why didn't you let me in? Things grow strange out there...",
    talkLines: [
      'Your windowsill is too empty. It wants a little green.',
      'Listen. The wood in this house is still a bit alive.',
      'I do not talk much. Plants never do, and they are wise.',
      'Rain smells different on every hill. This one smells like pennies.',
    ],
    facts: [
      { cat: 'food', q: 'What do you like to eat?', a: 'Clover sandwiches with dew.', wrong: ['Roast chicken.', 'Chocolate cake.', 'Fried fish.'] },
      { cat: 'friend', q: 'Who helps you in the garden?', a: 'Dot. Dot grows faster when we sing.', wrong: ['Roku. He builds the sprinklers.', 'Vee. She bites the weeds.', 'Sno. Sno keeps the frost off.'] },
      { cat: 'habit', q: 'What do you do before stepping inside?', a: 'I sniff the air for flowers. Then I smile.', wrong: ['I stomp my feet clean.', 'I knock on the wall.', 'I count the doorsteps.'] },
    ],
    knock: { style: 'soft', real: [0, 200, 800], monster: [0, 200, 800, 1000] },
    voice: { pitch: 0.9, speed: 0.85, wave: 'triangle' },
    tells: [
      T('kai_thorn', 1, 'visual', 'spikes', 'head', { color: '#2f5a2a', count: 3 }, 'eye', 'Small thorns poked out of its head.'),
      T('kai_vine', 1, 'visual', 'vine', 'feet', { color: '#2e6a2a' }, 'eye', 'A thin vine curled around its foot.'),
      T('kai_tilt', 2, 'visual', 'tilt', null, { deg: 5 }, 'album', "It leaned to one side, unlike Chalk's photo."),
      T('kai_handthorn', 2, 'visual', 'spikes', 'handR', { color: '#2f5a2a', count: 2 }, 'album', 'A thorn grew from its hand.'),
      T('kai_knock', 2, 'audio', 'knockExtra', null, {}, 'ear', 'Its knock had one rustle too many.'),
      T('kai_shadow', 3, 'visual', 'shadowOnly', null, {}, 'flashlight', 'Its shadow was covered in blossoms and thorns.'),
    ],
  }),
  // 6 ---------------------------------------------------------------------------------------
  make({
    id: 'miso', name: 'Miso', number: 6, monsterTitle: 'The Melt',
    personality: 'Sweet, spoiled, loves treats',
    greeting: "Do you have cookies? I'm sooo hungry!",
    admitLine: 'Yay! Is it dinner time? It is dinner time, right?',
    rejectLine: "No cookies? Hmph. I'll tell everyone.",
    returnerLine: "Why didn't you let me in?! I'm melting and it's all your fault!",
    talkLines: [
      'A cookie is a hug you can eat.',
      "I'm not spoiled. I'm just very, very easy to love.",
      'If the strawberry on my head gets squished, I will cry. Loudly.',
      'Do you have jam? Any jam. Even the sad kind.',
    ],
    facts: [
      { cat: 'food', q: 'What is your favourite treat?', a: 'Strawberry cookies with cream.', wrong: ['Liver pate.', 'Lemon drops.', 'Salty crackers.'] },
      { cat: 'friend', q: 'Who shares their snacks with you?', a: 'Sno. Sno makes me ice cream in winter.', wrong: ['Crag. He only eats pebbles.', 'Blip. He guards his crackers.', 'Kuro. He bites.'] },
      { cat: 'habit', q: 'What is the first thing you do at a door?', a: 'I ask for a cookie. Always.', wrong: ['I ask for a blanket.', 'I ask for a hug.', 'I ask what time it is.'] },
    ],
    knock: { style: 'roll', real: [0, 100, 200, 300], monster: [0, 100, 200, 300, 400, 500] },
    voice: { pitch: 1.8, speed: 1.1, wave: 'sine' },
    tells: [
      T('miso_drip', 1, 'visual', 'drip', 'face', { color: '#c8284a' }, 'eye', 'Strawberry-red goo dripped down its face.'),
      T('miso_leaves', 2, 'visual', 'smear', 'accessory', { color: '#d8445a', size: 1.1 }, 'album', 'Its strawberry had no leaves.'),
      T('miso_textdrip', 2, 'text', 'textDrip', null, {}, 'text', 'Its words dripped down like syrup.'),
      T('miso_knock', 2, 'audio', 'knockExtra', null, {}, 'ear', 'Its knock rolled on two beats too long.'),
      T('miso_shadow', 3, 'visual', 'shadowOnly', null, {}, 'flashlight', 'Its shadow melted into a puddle.'),
    ],
  }),
  // 7 ---------------------------------------------------------------------------------------
  make({
    id: 'shady', name: 'Shady', number: 7, monsterTitle: 'The Maw',
    personality: 'Shy, whispers, always in the dark',
    greeting: "...hi. I won't be a bother, promise.",
    admitLine: '...thank you. I will stay in the corner. Honest.',
    rejectLine: '...oh. That is fine. I am used to it.',
    returnerLine: "Why didn't you let me in? ...I was so hungry in the dark.",
    talkLines: [
      "...I like corners. They don't look back.",
      '...your lantern is very bright. Could you dim it? Just a little?',
      "...I'm not scary. I just have a lot of hood.",
      '...do you mind if I sit behind the curtain? Thank you.',
    ],
    facts: [
      { cat: 'food', q: 'What do you like to eat?', a: 'Blackberry jam on dark bread.', wrong: ['Sunny-side-up eggs.', 'Fresh salad.', 'Vanilla pudding.'] },
      { cat: 'friend', q: 'Who do you sit with in the dark?', a: 'Kuro. He is the only one who does not stare.', wrong: ['Zipp. Zipp never stops talking.', 'Lume. Too bright.', 'Sno. Sno is too chilly.'] },
      { cat: 'habit', q: 'How do you talk to people?', a: 'In a whisper, looking at my feet.', wrong: ['Loudly, with a grin.', 'Singing.', 'In rhymes.'] },
    ],
    knock: { style: 'soft', real: [0, 1000], monster: [0, 1000, 1250] },
    voice: { pitch: 0.7, speed: 0.8, wave: 'sine' },
    honestOddity: {
      effect: 'dark',
      note: "Shady is always dark; only two eyes shine in its hood. That is normal. A Shady with teeth or a third eye is not Shady.",
    },
    tells: [
      T('shady_teeth', 1, 'visual', 'teeth', 'mouth', {}, 'eye', 'A row of teeth glinted inside the hood.'),
      T('shady_extraeye', 2, 'visual', 'extraEye', 'face', { size: 1 }, 'album', 'A third eye blinked in the dark of the hood.'),
      T('shady_tooclose', 2, 'behavior', 'tooClose', null, {}, 'behavior', 'It stood far too close to the peephole, and Shady is shy.'),
      T('shady_smoke', 2, 'visual', 'smoke', 'body', {}, 'eye', 'Dark wisps drifted off its cloak.'),
      T('shady_shadow', 3, 'visual', 'shadowOnly', null, {}, 'mirror', 'Its reflection showed a huge, toothy maw.'),
    ],
  }),
  // 8 ---------------------------------------------------------------------------------------
  make({
    id: 'bub', name: 'Bub', number: 8, monsterTitle: 'The Flood',
    personality: 'Dreamy, loves water and soap bubbles',
    greeting: 'Blub! Is it dry inside?',
    admitLine: 'Blub blub! Thank you! I promise to only leak a little.',
    rejectLine: 'Blub... okay. I will go and be a puddle.',
    returnerLine: "Why didn't you let me in? Blub... everything is so wet now...",
    talkLines: [
      'Did you know every bubble has a tiny weather inside?',
      "I'm not damp. I'm just a very soft kind of water.",
      'Rain is just the sky giving hugs very quickly.',
      'Blub. Sorry about the puddle. It follows me.',
    ],
    facts: [
      { cat: 'food', q: 'What do you like to eat?', a: 'Seaweed soup with soap-bubble dumplings.', wrong: ['Dry crackers.', 'Roasted nuts.', 'Burnt toast.'] },
      { cat: 'friend', q: 'Who follows your puddle trail?', a: 'Nimi. Nimi plays hide and seek with me.', wrong: ['Roku. He measures the puddles.', 'Sno. She freezes them.', 'Dot. Dot waters itself.'] },
      { cat: 'habit', q: 'What do you do when you are nervous?', a: 'I blow one little bubble. Just one.', wrong: ['I tap-dance.', 'I hide my face.', 'I giggle and spin.'] },
    ],
    knock: { style: 'thud', real: [0, 350, 700], monster: [0, 350, 700, 1250] },
    voice: { pitch: 1.1, speed: 0.9, wave: 'sine' },
    tells: [
      T('bub_bubbles', 1, 'visual', 'bubbles', 'head', { color: '#9fd4f0' }, 'eye', 'Bubbles kept rising from its head.'),
      T('bub_prints', 1, 'visual', 'wetPrints', 'feet', {}, 'eye', 'It left wet footprints on the doorstep.'),
      T('bub_translucent', 2, 'visual', 'translucent', null, {}, 'album', 'Its body looked a little see-through.'),
      T('bub_knock', 2, 'audio', 'knockExtra', null, {}, 'ear', 'Its knock came with a wet splash and one thud too many.'),
      T('bub_shadow', 3, 'visual', 'shadowOnly', null, {}, 'flashlight', 'Its shadow wobbled like water.'),
    ],
  }),
  // 9 ---------------------------------------------------------------------------------------
  make({
    id: 'tobi', name: 'Tobi', number: 9, monsterTitle: 'The Spikemaw',
    personality: 'Clumsy, brave, always hurt',
    greeting: 'Fell over again. Can I come in?',
    admitLine: "Ow! No, that's the door. I'm fine! Thank you!",
    rejectLine: "That's okay! I'm used to falling down. I'll get up again.",
    returnerLine: "Why didn't you let me in? I fell... and something else got up.",
    talkLines: [
      'This band-aid is my lucky one. I have lots of them.',
      'I tripped over a sleeping hill today. It grumbled.',
      "I'm not scared of the fog. I'm scared of stairs.",
      'Bruises are just badges you collect by being brave.',
    ],
    facts: [
      { cat: 'food', q: 'What do you like to eat?', a: 'Honey pancakes. Even when they land on the floor.', wrong: ['Plain rice.', 'Spinach pie.', 'Boiled eggs.'] },
      { cat: 'friend', q: 'Who patches you up?', a: 'Lume. Her light makes the bruises sting less.', wrong: ['Zen. Zen just yawns.', 'Crag. Crag only grunts.', 'Miso. Miso eats the band-aids.'] },
      { cat: 'habit', q: 'What do you always do at the door?', a: 'I trip on the doorstep. Every single time.', wrong: ['I salute the door.', 'I jump over the step.', 'I tiptoe in.'] },
    ],
    knock: { style: 'stumble', real: [0, 180, 260, 700], monster: [0, 180, 260, 700, 880] },
    voice: { pitch: 1.3, speed: 1.25, wave: 'square' },
    tells: [
      T('tobi_spikes', 1, 'visual', 'spikes', 'top', { color: '#d99a1a', count: 5 }, 'eye', 'Orange spikes poked out all around its head.'),
      T('tobi_mirrored', 2, 'visual', 'mirrored', null, {}, 'album', 'Its band-aid was on the wrong side.'),
      T('tobi_eye', 2, 'visual', 'extraEye', 'accessory', { size: 0.8 }, 'eye', 'An eye blinked under its band-aid.'),
      T('tobi_knock', 2, 'audio', 'knockExtra', null, {}, 'ear', 'It stumbled over one knock too many.'),
      T('tobi_shadow', 3, 'visual', 'shadowOnly', null, {}, 'flashlight', 'Its shadow was covered in spikes.'),
    ],
  }),
  // 10 --------------------------------------------------------------------------------------
  make({
    id: 'lume', name: 'Lume', number: 10, monsterTitle: 'The Fallen',
    personality: 'Helpful, gentle, a little holy',
    greeting: 'I bring light. May I stay?',
    admitLine: 'Bless this little house. Thank you for the warmth.',
    rejectLine: 'I understand. I will keep my light on for you anyway.',
    returnerLine: "Why didn't you let me in? My light went out out there...",
    talkLines: [
      'A little light goes a long way. Even a crooked one.',
      'I polish my halo every evening. It does not help, but it is calming.',
      'Everyone glows a little. You just have to be patient.',
      'Shall I read to you? I know a story about a lamp that loved moths.',
    ],
    facts: [
      { cat: 'food', q: 'What do you like to eat?', a: 'Moonbeam pudding with a drop of honey.', wrong: ['Garlic bread.', 'Smoked sausage.', 'Pepper stew.'] },
      { cat: 'friend', q: 'Who do you look after?', a: 'Tobi. Someone has to.', wrong: ['Kuro. He refuses to be looked after.', 'Pix. Pix cannot hear anything.', 'Shady. Shady hides.'] },
      { cat: 'habit', q: 'What do you do before you speak?', a: 'I fold my hands, softly, like a candle.', wrong: ['I clap once.', 'I raise one finger.', 'I tap my halo.'] },
    ],
    knock: { style: 'soft', real: [0, 500, 1000], monster: [0, 500, 1000, 1500] },
    voice: { pitch: 1.4, speed: 0.85, wave: 'sine' },
    tells: [
      T('lume_smoke', 1, 'visual', 'smoke', 'accessory', {}, 'eye', 'Black smoke curled off its halo.'),
      T('lume_tilt', 1, 'visual', 'tilt', null, { deg: 9 }, 'eye', 'It stood crooked, halo and all.'),
      T('lume_crack', 2, 'visual', 'crack', 'accessory', { color: '#222222' }, 'album', 'Its halo was cracked.'),
      T('lume_knock', 2, 'audio', 'knockExtra', null, {}, 'ear', 'Its knock had one tap too many.'),
      T('lume_shadow', 3, 'visual', 'shadowOnly', null, {}, 'mirror', 'Its reflection showed an empty, black face.'),
    ],
  }),
  // 11 --------------------------------------------------------------------------------------
  make({
    id: 'pix', name: 'Pix', number: 11, monsterTitle: 'The Distortion',
    personality: 'Gamer, loud, always listening to music',
    greeting: 'WHAT? Oh - yes, in please!',
    admitLine: "AWESOME! Is there a plug socket? I'm at two percent!",
    rejectLine: 'WHAT? No? OK. I will just go and pause myself.',
    returnerLine: "WHY DIDN'T YOU LET ME IN? It got so loud out there...",
    talkLines: [
      "Sorry, I can't hear you! I can only hear the bass.",
      "I've got a high score in not-sleeping. Four nights!",
      'Every door is just a boss with a handle.',
      'Want to swap headphones? No? I will sing it to you then.',
    ],
    facts: [
      { cat: 'food', q: 'What do you eat while gaming?', a: 'Cheese puffs and fizzy grape juice.', wrong: ['Plain rice cakes.', 'Cold stew.', 'Carrot sticks.'] },
      { cat: 'friend', q: 'Who do you play with?', a: 'Blip. We share one pair of headphones.', wrong: ['Nyx. Nyx only plays at night.', 'Roku. He keeps taking the controller apart.', 'Maru. He always tackles.'] },
      { cat: 'habit', q: 'What does your head do when you listen?', a: 'It nods to the beat. All day long.', wrong: ['It spins in circles.', 'It stays perfectly still.', 'It shakes side to side.'] },
    ],
    knock: { style: 'beep', real: [0, 150, 300, 600, 750], monster: [0, 150, 450, 600, 900] },
    voice: { pitch: 1.15, speed: 1.4, wave: 'sawtooth' },
    tells: [
      T('pix_drip', 1, 'visual', 'drip', 'accessory', { color: '#b040d0' }, 'eye', 'Goo dripped from its headphones.'),
      T('pix_static', 2, 'visual', 'static', 'accessory', {}, 'album', 'Static crackled around the headphones.'),
      T('pix_distort', 2, 'audio', 'distort', null, {}, 'ear', 'Its music sounded warped and drowned.'),
      T('pix_typo', 2, 'text', 'typo', null, {}, 'text', 'It misspelled its own name.'),
      T('pix_shadow', 3, 'visual', 'shadowOnly', null, {}, 'mirror', 'Its reflection showed glowing pink eyes.'),
    ],
  }),
  // 12 --------------------------------------------------------------------------------------
  make({
    id: 'crag', name: 'Crag', number: 12, monsterTitle: 'The Crystal Break',
    personality: 'Few words, strong, protective',
    greeting: 'Hm. In.',
    admitLine: 'Hm. Good. I will guard the door.',
    rejectLine: 'Hm. Understood. Stay safe.',
    returnerLine: "Why didn't you let me in? ...I broke.",
    talkLines: [
      'Hm.',
      'Rocks do not talk. They think. Slowly.',
      'I can carry two beds. Do not ask me to carry three.',
      'Sit. I will stand. I am used to it.',
    ],
    facts: [
      { cat: 'food', q: 'What do you like to eat?', a: 'Gravel soup. Extra gravel.', wrong: ['Whipped cream.', 'Soft cheese.', 'Fruit salad.'] },
      { cat: 'friend', q: 'Whose side do you always take?', a: "Roku's. He is loud, so someone has to be quiet.", wrong: ['Zipp. He is too fast for me.', 'Vee. She bites.', 'Glitch. I cannot hear him.'] },
      { cat: 'habit', q: 'How do you knock?', a: 'Once. Hard. Then I wait.', wrong: ['Three light taps.', 'I scratch the door.', 'I never knock; I wait for the door.'] },
    ],
    knock: { style: 'hard', real: [0, 1000], monster: [0, 350, 1000] },
    voice: { pitch: 0.6, speed: 0.7, wave: 'square' },
    tells: [
      T('crag_shards', 1, 'visual', 'spikes', 'top', { color: '#7ab8d8', count: 3 }, 'eye', 'Crystal shards jutted out of its head.'),
      T('crag_crack', 2, 'visual', 'crack', 'body', { color: '#9fe0ff' }, 'album', 'A glowing crack ran across its chest.'),
      T('crag_tooclose', 2, 'behavior', 'tooClose', null, {}, 'behavior', 'It loomed far too close to the peephole.'),
      T('crag_knock', 2, 'audio', 'knockExtra', null, {}, 'ear', 'It knocked three times. Crag only knocks once.'),
      T('crag_shadow', 3, 'visual', 'shadowOnly', null, {}, 'flashlight', 'Its shadow had crystal spikes.'),
    ],
  }),
  // 13 --------------------------------------------------------------------------------------
  make({
    id: 'sno', name: 'Sno', number: 13, monsterTitle: 'The Frostmaw',
    personality: 'Cheerful, cuddly, loves the cold',
    greeting: "Brr, even I'm cold! Open up!",
    admitLine: "Yay, cosy! But please don't put me near the fireplace!",
    rejectLine: "Okay! I will build a little snow castle out here.",
    returnerLine: "Why didn't you let me in? I am so, so cold now...",
    talkLines: [
      'My scarf was knitted by a snowstorm. It is very proud.',
      'Cold is just a hug that forgot to be warm.',
      'Snowflakes are all different. Just like all of you. Almost.',
      'Do you have a window? I would like to look at the frost.',
    ],
    facts: [
      { cat: 'food', q: 'What do you like to eat?', a: 'Vanilla ice with a pinch of salt.', wrong: ['Hot chilli stew.', 'Fried dumplings.', 'Toasted marshmallows.'] },
      { cat: 'friend', q: 'Who do you share your ice cream with?', a: 'Miso. Miso always wants a second scoop.', wrong: ['Kai. Kai is allergic to frost.', 'Crag. Crag does not eat.', 'Zipp. Zipp melts it with his chatter.'] },
      { cat: 'habit', q: 'What do you do with your scarf?', a: 'I rub it against my cheek when I am happy.', wrong: ['I wrap it around my head.', 'I swing it like a lasso.', 'I never take it off. Never touch it.'] },
    ],
    knock: { style: 'soft', real: [0, 250, 500], monster: [0, 250, 500, 1100] },
    voice: { pitch: 1.55, speed: 0.95, wave: 'triangle' },
    tells: [
      T('sno_icicles', 1, 'visual', 'spikes', 'handR', { color: '#cfeaff', count: 4 }, 'eye', 'Icicles hung from its arm.'),
      T('sno_frost', 1, 'visual', 'frost', null, {}, 'eye', 'Frost crept over the edge of the peephole.'),
      T('sno_noblink', 2, 'behavior', 'noBlink', null, {}, 'behavior', 'It never blinked.'),
      T('sno_knock', 2, 'audio', 'knockExtra', null, {}, 'ear', 'Its knock came late, with a cracking sound.'),
      T('sno_shadow', 3, 'visual', 'shadowOnly', null, {}, 'flashlight', 'Its shadow had a jagged maw.'),
    ],
  }),
  // 14 --------------------------------------------------------------------------------------
  make({
    id: 'vee', name: 'Vee', number: 14, monsterTitle: 'The Trap',
    personality: 'Grumpy, cheeky, but a good heart',
    greeting: 'What are you staring at? Open up.',
    admitLine: "Finally. Don't get used to me being nice.",
    rejectLine: "Fine. I didn't want to come in anyway. Really.",
    returnerLine: "Why didn't you let me in?! I told you not to stare!",
    talkLines: [
      "I'm not grumpy. I'm just right more often than other people.",
      'That leaf on my head is not a hat. Stop asking.',
      'Fine, your soup is not bad. Do not tell anyone I said that.',
      "If someone's cold, I give them my blanket. But I complain the whole time.",
    ],
    facts: [
      { cat: 'food', q: 'What do you like to eat?', a: 'Spicy pepper soup. The spicier the better.', wrong: ['Sweet porridge.', 'Plain bread.', 'Steamed carrots.'] },
      { cat: 'friend', q: 'Who do you argue with the most?', a: 'Glitch. We never agree on what is on TV.', wrong: ['Dot. Dot never talks back.', 'Shady. Shady never talks.', 'Nimi. Nimi agrees with everything.'] },
      { cat: 'habit', q: 'What do you do when you are annoyed?', a: 'I cross my arms and huff. Loudly.', wrong: ['I giggle nervously.', 'I stamp my foot and run.', 'I hum a tune.'] },
    ],
    knock: { style: 'hard', real: [0, 150, 300], monster: [0, 150, 300, 450, 600] },
    voice: { pitch: 0.95, speed: 1.2, wave: 'sawtooth' },
    tells: [
      T('vee_teeth', 1, 'visual', 'teeth', 'accessory', {}, 'eye', 'Its leaf had tiny teeth.'),
      T('vee_leafjitter', 2, 'behavior', 'jitter', null, {}, 'behavior', 'Its leaf twitched on its own.'),
      T('vee_vine', 2, 'visual', 'vine', 'handL', { color: '#2e6a2a' }, 'album', 'A thin vine curled from its hand.'),
      T('vee_impatient', 2, 'behavior', 'impatient', null, {}, 'behavior', 'It got impatient much too quickly.'),
      T('vee_shadow', 3, 'visual', 'shadowOnly', null, {}, 'flashlight', 'Its shadow had the huge head of a flytrap.'),
    ],
  }),
  // 15 --------------------------------------------------------------------------------------
  make({
    id: 'kuro', name: 'Kuro', number: 15, monsterTitle: 'The Red Eye',
    personality: 'Proud, suspicious, cat-like',
    greeting: "I'm only here because of the fog. Not because of you.",
    admitLine: 'Hmph. Acceptable. I will take the warmest spot.',
    rejectLine: 'Hmph. I did not want your house anyway. Obviously.',
    returnerLine: "Why didn't you let me in? ...You will regret that. Slowly.",
    talkLines: [
      'I do not purr. I vibrate. There is a difference.',
      'Do not touch the tail. I will allow it once. Maybe.',
      'That chair is mine now. I decided just now.',
      "I'm not friends with anyone. Except Shady. Shady doesn't count.",
    ],
    facts: [
      { cat: 'food', q: 'What do you like to eat?', a: 'Smoked fish. Only the tail end.', wrong: ['Sweet pancakes.', 'Cold rice.', 'Raw vegetables.'] },
      { cat: 'friend', q: 'Who do you tolerate?', a: 'Shady. Shady never asks questions.', wrong: ['Zipp. Zipp asks too many.', 'Lume. Lume smells of candles.', 'Maru. Maru hugs.'] },
      { cat: 'habit', q: 'How do you knock?', a: 'With my tail. A slow swish, swish, swish.', wrong: ['With my head.', 'With both fists.', 'I never knock. I wait to be noticed.'] },
    ],
    knock: { style: 'scratch', real: [0, 400, 800], monster: [0, 400, 800, 1000] },
    voice: { pitch: 0.75, speed: 1.0, wave: 'sawtooth' },
    tells: [
      T('kuro_cracks', 1, 'visual', 'crack', 'body', { color: '#d92222' }, 'eye', 'Red cracks ran across its body.'),
      T('kuro_glow', 1, 'visual', 'eyeGlow', 'eyeR', { color: '#ff2020' }, 'eye', 'One of its eyes glowed red.'),
      T('kuro_knock', 2, 'audio', 'knockExtra', null, {}, 'ear', 'Its tail knock came with a scratch and one swish too many.'),
      T('kuro_noblink', 2, 'behavior', 'noBlink', null, {}, 'behavior', 'It never blinked, not even slowly.'),
      T('kuro_shadow', 3, 'visual', 'shadowOnly', null, {}, 'mirror', 'Its reflection showed one huge red eye.'),
    ],
  }),
  // 16 --------------------------------------------------------------------------------------
  make({
    id: 'dot', name: 'Dot', number: 16, monsterTitle: 'The Spore',
    personality: 'Small, shy, likes to grow',
    greeting: 'I... I got lost.',
    admitLine: '...thank you. I will be small. I am very good at small.',
    rejectLine: '...oh. Okay. I will find somewhere quiet to grow.',
    returnerLine: "Why didn't you let me in? I grew in the wrong places...",
    talkLines: [
      'I am watering myself on Tuesdays. It is Tuesday, I think.',
      'The sprout on my head is shy too. It hides when it rains.',
      '...can I sit by the window? The sun is good for growing.',
      "I'm not very tall. But I am very, very patient.",
    ],
    facts: [
      { cat: 'food', q: 'What do you like to eat?', a: 'Sunshine and a tiny bit of rain water.', wrong: ['Roast beef.', 'Salty fries.', 'Cheese toast.'] },
      { cat: 'friend', q: 'Who helps you grow?', a: 'Kai. He sings to my sprout.', wrong: ['Bub. Bub waters me too much.', 'Roku. He measures me every day.', 'Crag. Crag sits on me.'] },
      { cat: 'habit', q: 'What do you do at a new door?', a: 'I peek around the frame first, only with one eye.', wrong: ['I wave and shout hello.', 'I knock loudly.', 'I run in without looking.'] },
    ],
    knock: { style: 'soft', real: [0, 700], monster: [0, 300, 700] },
    voice: { pitch: 1.65, speed: 0.8, wave: 'sine' },
    tells: [
      T('dot_spores', 1, 'visual', 'spores', 'head', { color: '#e8d9b0' }, 'eye', 'Spores floated around its head.'),
      T('dot_mushroom', 2, 'visual', 'smear', 'accessory', { color: '#a5502d', size: 1.3 }, 'album', 'Its sprout had turned into a mushroom cap.'),
      T('dot_tooclose', 2, 'behavior', 'tooClose', null, {}, 'behavior', 'It pressed close to the peephole, and Dot is shy.'),
      T('dot_knock', 2, 'audio', 'knockExtra', null, {}, 'ear', 'Its knock came with one tap too many.'),
      T('dot_shadow', 3, 'visual', 'shadowOnly', null, {}, 'flashlight', 'Its shadow wore a big mushroom cap.'),
    ],
  }),
  // 17 --------------------------------------------------------------------------------------
  make({
    id: 'glitch', name: 'Glitch', number: 17, monsterTitle: 'Off Air',
    personality: 'Talks like a TV announcer',
    greeting: 'We interrupt this program: please let me in!',
    admitLine: 'And now, back to our regular programme: a warm welcome!',
    rejectLine: 'This programme is over. Thank you for watching.',
    returnerLine: "Why didn't you let me in? The signal is lost. Shhhhhhh.",
    talkLines: [
      'Breaking news: the soup is warm. More at eleven.',
      'Please stand by. Please keep standing by.',
      'In weather: fog. Tomorrow: more fog. Thank you.',
      "And that's the end of today's transmission. Sleep well, viewers.",
    ],
    facts: [
      { cat: 'food', q: 'What do you like to eat?', a: 'Popcorn. Salted, never sweet.', wrong: ['Plain crackers.', 'Tomato soup.', 'Strawberry jam.'] },
      { cat: 'friend', q: 'Who do you watch TV with?', a: 'Vee. We argue about every show.', wrong: ['Nyx. Nyx only watches the stars.', 'Zen. Zen falls asleep immediately.', 'Dot. Dot is scared of the static.'] },
      { cat: 'habit', q: 'What do the colour bars on your screen do?', a: 'They flicker, but always stay in the same order.', wrong: ['They change order every night.', 'They fade to black.', 'They stay perfectly still.'] },
    ],
    knock: { style: 'beep', real: [0, 100, 200, 300], monster: [0, 100, 200, 300, 550] },
    voice: { pitch: 0.9, speed: 1.0, wave: 'square' },
    honestOddity: {
      effect: 'flicker',
      note: "Glitch's screen always flickers. That is normal. The real Glitch shows its colour bars in the same order every time. If the order is wrong, or there are teeth in the static, it is not Glitch.",
    },
    tells: [
      T('glitch_teeth', 1, 'visual', 'teeth', 'face', {}, 'eye', 'Teeth glinted inside the static.'),
      T('glitch_bars', 2, 'visual', 'mirrored', null, {}, 'album', 'The colour bars ran in the wrong order.'),
      T('glitch_distort', 2, 'audio', 'distort', null, {}, 'ear', 'Its announcement dropped to a low growl.'),
      T('glitch_typo', 2, 'text', 'typo', null, {}, 'text', 'It garbled its own name.'),
      T('glitch_shadow', 3, 'visual', 'shadowOnly', null, {}, 'flashlight', 'Its shadow had a row of teeth.'),
    ],
  }),
  // 18 --------------------------------------------------------------------------------------
  make({
    id: 'maru', name: 'Maru', number: 18, monsterTitle: 'The Bones',
    personality: 'Playful, cuddly, cheeky',
    greeting: 'Hehe, guess who!',
    admitLine: 'Hehe! Hug time! Everyone gets a hug, whether they want one or not!',
    rejectLine: "Hehe... that's not funny. Okay, it's a bit funny.",
    returnerLine: "Why didn't you let me in? Hehe... I'm not laughing anymore.",
    talkLines: [
      'Peekaboo! Did you see me? No? Again!',
      "I'm not clingy. I'm just very close to people. All the time.",
      'The best sleep is on top of someone. Nobody asked me to move yet.',
      'Tickle contest! No? Then I will tickle the cat.',
    ],
    facts: [
      { cat: 'food', q: 'What do you like to eat?', a: 'Bamboo cakes with maple syrup.', wrong: ['Salty crisps.', 'Raw fish.', 'Mushroom stew.'] },
      { cat: 'friend', q: 'Who do you sleep on?', a: 'Zen. Zen never complains. Zen never wakes up.', wrong: ['Kuro. Kuro hisses.', 'Crag. Crag is too hard.', 'Zipp. Zipp does not stay still.'] },
      { cat: 'habit', q: 'What do you do when you see a friend?', a: 'I jump on them. Big hug, no warning.', wrong: ['I tip my hat.', 'I bow.', 'I wave from far away.'] },
    ],
    knock: { style: 'roll', real: [0, 120, 240, 600], monster: [0, 120, 240, 600, 720] },
    voice: { pitch: 1.35, speed: 1.3, wave: 'triangle' },
    tells: [
      T('maru_ribs', 1, 'visual', 'spikes', 'body', { color: '#eeeeee', count: 6 }, 'eye', 'The stripes on its belly looked like ribs.'),
      T('maru_mask', 2, 'visual', 'smear', 'face', { color: '#2b1a14', size: 1.1 }, 'album', 'The mask on its face was much too dark.'),
      T('maru_jitter', 2, 'behavior', 'jitter', null, {}, 'behavior', 'It twitched stiffly, like a puppet on strings.'),
      T('maru_knock', 2, 'audio', 'knockExtra', null, {}, 'ear', 'Its knock rolled on one beat too long.'),
      T('maru_shadow', 3, 'visual', 'shadowOnly', null, {}, 'flashlight', 'Its shadow was a skeleton.'),
    ],
  }),
  // 19 --------------------------------------------------------------------------------------
  make({
    id: 'nyx', name: 'Nyx', number: 19, monsterTitle: 'The Black Hole',
    personality: 'Dreamy, speaks in riddles, nocturnal',
    greeting: 'The stars say I should sleep here tonight.',
    admitLine: 'The door opens inward, like a thought. Thank you.',
    rejectLine: 'The night keeps what the door gives away. Farewell.',
    returnerLine: "Why didn't you let me in? Now the sky is inside me.",
    talkLines: [
      'What has a moon but no night? A riddle. I am still thinking.',
      'I sleep by day, awake by dark. The world is upside down, you see.',
      'Every star is a question that never got an answer.',
      'Count the stars with me. If you reach the end, tell me.',
    ],
    facts: [
      { cat: 'food', q: 'What do you like to eat?', a: 'Blueberries and midnight tea.', wrong: ['Fried eggs at noon.', 'Orange marmalade.', 'Tomato soup.'] },
      { cat: 'friend', q: 'Who keeps you company at night?', a: 'Zipp. He talks, and I get to listen to the wind.', wrong: ['Kai. Kai sleeps at night.', 'Glitch. Glitch is off-air.', 'Blip. Blip says it is too late.'] },
      { cat: 'habit', q: 'What do you do before you answer?', a: 'I look at the sky first, even indoors.', wrong: ['I close my eyes.', 'I look at my shoes.', 'I turn around three times.'] },
    ],
    knock: { style: 'slow', real: [0, 900, 1800], monster: [0, 1400, 2800] },
    voice: { pitch: 0.85, speed: 0.78, wave: 'triangle' },
    tells: [
      T('nyx_stars', 1, 'visual', 'stars', 'head', { color: '#ffffff' }, 'eye', 'Tiny stars circled around it in a spiral.'),
      T('nyx_moon', 2, 'visual', 'mirrored', null, {}, 'album', 'The moon on its body was in the wrong phase.'),
      T('nyx_smoke', 2, 'visual', 'smoke', 'feet', {}, 'eye', 'Dark wisps pooled around its feet.'),
      T('nyx_knock', 2, 'audio', 'knockExtra', null, {}, 'ear', 'Its knocks came far too slowly.'),
      T('nyx_shadow', 3, 'visual', 'shadowOnly', null, {}, 'mirror', 'Its reflection showed a black hole.'),
    ],
  }),
  // 20 --------------------------------------------------------------------------------------
  make({
    id: 'zipp', name: 'Zipp', number: 20, monsterTitle: 'The Whirl',
    personality: 'Hyperactive, talks without taking a breath',
    greeting: 'Quickquickquick, in before the fog comes!',
    admitLine: 'Yes yes yes! Thank you! Where is the soup? Is there soup?',
    rejectLine: 'Okay okay okay bye! Maybe next time! Quick!',
    returnerLine: "Why didn't you let me in? Wooosh. Everything is spinning now.",
    talkLines: [
      "I can't sit still. Believe me, I tried. For two whole seconds.",
      'Do you feel the draught? That is me. Sorry. Not sorry.',
      'I once blew out a candle by walking past it. It was rude.',
      'Hello how are you good thanks wonderful what is for dinner?',
    ],
    facts: [
      { cat: 'food', q: 'What do you like to eat?', a: 'Anything that can be eaten while running.', wrong: ['Slow-cooked stew.', 'Soup with a spoon.', 'Multi-course dinners.'] },
      { cat: 'friend', q: 'Who listens to you for hours?', a: 'Nyx. Nyx loves the whooshing.', wrong: ['Zen. Zen falls asleep.', 'Crag. Crag does not listen.', 'Shady. Shady runs away.'] },
      { cat: 'habit', q: 'What happens when you enter a room?', a: 'The wind comes with me, and the candles flicker.', wrong: ['It gets very quiet.', 'The candles go out.', 'Nothing special.'] },
    ],
    knock: { style: 'roll', real: [0, 70, 140, 210, 280, 350], monster: [0, 70, 140, 210, 280, 350, 420, 490] },
    voice: { pitch: 1.6, speed: 1.4, wave: 'sawtooth' },
    honestOddity: {
      effect: 'wind',
      note: "Zipp always brings a gust of wind, and any candle near Zipp flickers. That is normal, so do not trust the candle around Zipp. Look for the other signs instead.",
    },
    tells: [
      T('zipp_translucent', 1, 'visual', 'translucent', null, {}, 'eye', 'Its body was slightly see-through.'),
      T('zipp_cap', 1, 'behavior', 'jitter', 'accessory', {}, 'eye', 'Its cap spun round and round by itself.'),
      T('zipp_mirrored', 2, 'visual', 'mirrored', null, {}, 'album', 'Its cap brim pointed the wrong way.'),
      T('zipp_shout', 2, 'text', 'shout', null, {}, 'text', 'It SHOUTED every word.'),
      T('zipp_shadow', 3, 'visual', 'shadowOnly', null, {}, 'flashlight', 'Its shadow had a spinning propeller.'),
    ],
  }),
];

export const FIGURE_BY_ID = Object.fromEntries(FIGURES.map((f) => [f.id, f]));
export const FIGURE_IDS = FIGURES.map((f) => f.id);

// The Faceless (night 7 finale). No face, no tells, no tool works on it.
export const FACELESS = {
  id: 'faceless', name: 'The Faceless', number: 0, sheet: 'A', monsterTitle: 'The Faceless',
  personality: 'Formless, silent. Chalk, after days in the fog.',
  greeting: '...',
  admitLine: '...',
  rejectLine: '...',
  returnerLine: '...',
  talkLines: ['...'],
  facts: [],
  knock: { style: 'slow', real: [0, 1600, 3200], monster: [0, 1600, 3200] },
  voice: { pitch: 0.7, speed: 0.7, wave: 'sine' },
  honestOddity: null,
  images: { standard: 'assets/figures/faceless.png', monster: 'assets/figures/faceless.png' },
  anchors: {
    head: [0.475, 0.39], face: [0.46, 0.53], eyeL: [0.35, 0.53], eyeR: [0.57, 0.5], mouth: [0.46, 0.6],
    body: [0.5, 0.77], handL: [0.28, 0.84], handR: [0.72, 0.84], feet: [0.5, 0.955], top: [0.475, 0.27],
  },
  monsterAnchors: { face: [0.46, 0.53], eyeL: [0.35, 0.53], eyeR: [0.57, 0.5], mouth: [0.46, 0.6] },
  tells: [],
};

export function getFigure(id) {
  return id === 'faceless' ? FACELESS : FIGURE_BY_ID[id];
}
