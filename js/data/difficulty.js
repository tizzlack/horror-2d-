// Difficulty presets. Read by state.newRun() and the rules engine.
export const DIFFICULTY = {
  cozy: {
    id: 'cozy',
    label: 'Cozy',
    blurb: 'More patience, clearer tells. Missed tells are marked every morning.',
    patience: 90,          // seconds per visitor
    pusherPatience: 45,
    maxTellLevel: 2,       // monsters never use level-3 tells
    flames: 3,
    candle: true,
    morningHints: 'all',   // 'all' | 'missed' | 'none'
    monsterRatioBonus: -0.05,
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    blurb: 'The night as Chalk knew it.',
    patience: 60,
    pusherPatience: 30,
    maxTellLevel: 3,
    flames: 3,
    candle: true,
    morningHints: 'missed',
    monsterRatioBonus: 0,
  },
  nightmare: {
    id: 'nightmare',
    label: 'Nightmare',
    blurb: 'Little patience, hidden tells, two flames, no candle, no hints.',
    patience: 40,
    pusherPatience: 20,
    maxTellLevel: 3,
    flames: 2,
    candle: false,
    morningHints: 'none',
    monsterRatioBonus: 0.05,
  },
};

export const DIFFICULTY_ORDER = ['cozy', 'normal', 'nightmare'];
