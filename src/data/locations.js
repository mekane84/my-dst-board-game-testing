/**
 * The 23-card Location deck, transcribed from docs/CARDS.md.
 *
 * Each card carries its verbatim text AND the effect descriptors the engine
 * runs, so the rules text and the behaviour live side by side. If the two ever
 * disagree, the text is right and the effects are the bug.
 *
 * Structural flags:
 *   oneShot            - Discovery only; no repeatable Gather
 *   transplantSlots    - Berry Groves each support exactly 1 transplant
 *   gatherRequiresGear - Gather is illegal without this Ready Gear
 *   clearable          - Spider Den: once cleared it is spent
 *   cooldownDays       - rests this many full Days after being Gathered
 */

const gain = (resource, amount = 1) => ({ type: 'gain', resource, amount })
const spend = (resource, amount = 1) => ({ type: 'spend', resource, amount })
/** Hands back what this card just gave, so the gained tally stays honest. */
const giveBack = (resource, amount = 1) => ({ type: 'spend', resource, amount, fromGained: true })
const fear = (amount = 1) => ({ type: 'fear', amount })
const health = (amount = 1) => ({ type: 'health', amount })
const hunger = (amount = 1) => ({ type: 'hunger', amount })
const spendGear = (gear) => ({ type: 'spendGearUse', gear })
const mark = (flag) => ({ type: 'markLocation', flag })
const returnGained = () => ({ type: 'returnOneGained' })
const choose = (prompt, options) => ({ type: 'choice', prompt, options })
const opt = (label, effects, requires) => ({ label, effects, ...(requires ? { requires } : {}) })

/** Shorthand for the very common "pay something, or take the Fear" Danger. */
const payOrFear = (payEffect, payLabel, fearAmount, requires) =>
  choose('Danger', [
    opt(payLabel, [payEffect], requires),
    opt(`Gain ${fearAmount} Fear`, [fear(fearAmount)]),
  ])

export const LOCATIONS = [
  {
    id: 'dense_forest_strange_noises',
    name: 'Dense Forest - Strange Noises',
    discovery: 'Gain 1 Wood.',
    danger: 'Spend 1 Food or gain 1 Fear.',
    gather: 'Gain 3 Wood.',
    discoveryEffects: [gain('wood')],
    dangerEffects: [payOrFear(spend('food'), 'Spend 1 Food', 1, { resource: 'food', amount: 1 })],
    gatherEffects: [gain('wood', 3)],
  },
  {
    id: 'dense_forest_spider_woods',
    name: 'Dense Forest - Spider Woods',
    discovery: 'Gain 1 Wood.',
    danger: 'You may spend 1 Spear use to ignore this Danger. Otherwise lose 1 Health or gain 2 Fear.',
    gather: 'Gain 3 Wood.',
    discoveryEffects: [gain('wood')],
    dangerEffects: [
      choose('Spider Woods', [
        opt('Spend 1 Spear use to ignore', [spendGear('spear')], { gear: 'spear' }),
        opt('Lose 1 Health', [health(1)]),
        opt('Gain 2 Fear', [fear(2)]),
      ]),
    ],
    gatherEffects: [gain('wood', 3)],
  },
  {
    id: 'savanna_open_plains',
    name: 'Savanna - Open Plains',
    discovery: 'Gain 1 Grass.',
    danger: null,
    gather: 'Gain 3 Grass.',
    discoveryEffects: [gain('grass')],
    dangerEffects: [],
    gatherEffects: [gain('grass', 3)],
  },
  {
    id: 'savanna_scorching_sun',
    name: 'Savanna - Scorching Sun',
    discovery: 'Gain 1 Grass.',
    danger: 'Lose 1 Hunger or gain 1 Fear.',
    gather: 'Gain 3 Grass.',
    discoveryEffects: [gain('grass')],
    dangerEffects: [payOrFear(hunger(1), 'Lose 1 Hunger', 1)],
    gatherEffects: [gain('grass', 3)],
  },
  {
    id: 'boulder_field_loose_rocks',
    name: 'Boulder Field - Loose Rocks',
    discovery: 'Gain 1 Flint.',
    danger: 'Lose 1 Health or gain 1 Fear.',
    gather: 'Gain 2 Flint. If using a Ready Pickaxe, gain 3 Flint instead.',
    discoveryEffects: [gain('flint')],
    dangerEffects: [payOrFear(health(1), 'Lose 1 Health', 1)],
    // The Pickaxe's +1 comes from the normal Gather-modifier system, which is
    // what turns this into "3 Flint instead".
    gatherEffects: [gain('flint', 2)],
  },
  {
    id: 'boulder_field_cave_echoes',
    name: 'Boulder Field - Cave Echoes',
    discovery: 'Gain 1 Flint.',
    danger: 'Spend 1 Food or gain 2 Fear.',
    gather: 'Gain 2 Flint. If using a Ready Pickaxe, gain 3 Flint instead.',
    discoveryEffects: [gain('flint')],
    dangerEffects: [payOrFear(spend('food'), 'Spend 1 Food', 2, { resource: 'food', amount: 1 })],
    gatherEffects: [gain('flint', 2)],
  },
  {
    id: 'berry_grove_peaceful',
    name: 'Berry Grove - Peaceful Grove',
    discovery: 'Gain 2 Food.',
    danger: null,
    gather: null,
    transplantSlots: 1,
    discoveryEffects: [gain('food', 2)],
    dangerEffects: [],
    gatherEffects: null,
  },
  {
    id: 'berry_grove_something_feeding',
    name: 'Berry Grove - Something Feeding Here',
    discovery: 'Gain 2 Food.',
    danger: 'Spend 1 Food or gain 1 Fear.',
    gather: null,
    transplantSlots: 1,
    discoveryEffects: [gain('food', 2)],
    dangerEffects: [payOrFear(spend('food'), 'Spend 1 Food', 1, { resource: 'food', amount: 1 })],
    gatherEffects: null,
  },
  {
    id: 'rabbit_field',
    name: 'Rabbit Field',
    discovery: 'Gain 1 Food.',
    danger: null,
    gather: 'Only if using a Ready Trap: gain 2 Food, then Rabbit Field rests for one full Day.',
    gatherRequiresGear: 'trap',
    cooldownDays: 1,
    discoveryEffects: [gain('food')],
    dangerEffects: [],
    gatherEffects: [spendGear('trap'), gain('food', 2)],
  },
  {
    id: 'mixed_woodland_tangled_thicket',
    name: 'Mixed Woodland - Tangled Thicket',
    discovery: 'Choose gain 1 Wood or 1 Grass.',
    danger: 'Lose 1 Health or gain 1 Fear.',
    gather: 'Choose gain 2 Wood or 2 Grass.',
    discoveryEffects: [
      choose('Take which?', [
        opt('1 Wood', [gain('wood')]),
        opt('1 Grass', [gain('grass')]),
      ]),
    ],
    dangerEffects: [payOrFear(health(1), 'Lose 1 Health', 1)],
    gatherEffects: [
      choose('Gather which?', [
        opt('2 Wood', [gain('wood', 2)]),
        opt('2 Grass', [gain('grass', 2)]),
      ]),
    ],
  },
  {
    id: 'marsh_murky_ground',
    name: 'Marsh - Murky Ground',
    discovery: 'Choose gain 1 Food or 1 Grass.',
    danger: 'Lose 1 Hunger or gain 2 Fear.',
    gather: 'Gain 1 Food + 1 Grass.',
    discoveryEffects: [
      choose('Take which?', [
        opt('1 Food', [gain('food')]),
        opt('1 Grass', [gain('grass')]),
      ]),
    ],
    dangerEffects: [payOrFear(hunger(1), 'Lose 1 Hunger', 2)],
    gatherEffects: [gain('food'), gain('grass')],
  },
  {
    id: 'pond_croaking_banks',
    name: 'Pond - Croaking Banks',
    discovery: 'Gain 1 Food.',
    danger: 'Lose 1 Hunger or gain 1 Fear.',
    gather: 'Only if using a Ready Fishing Rod: gain 3 Food, then this Pond rests for one full Day.',
    gatherRequiresGear: 'fishing_rod',
    cooldownDays: 1,
    discoveryEffects: [gain('food')],
    dangerEffects: [payOrFear(hunger(1), 'Lose 1 Hunger', 1)],
    gatherEffects: [spendGear('fishing_rod'), gain('food', 3)],
  },
  {
    id: 'flower_meadow',
    name: 'Flower Meadow',
    discovery: 'Permanently remove 1 Fear from any survivor. If no survivor has Fear, gain 1 Grass instead.',
    danger: null,
    gather: 'Gain 1 Grass.',
    discoveryEffects: [
      { type: 'removeFear', target: 'any', amount: 1, fallback: [gain('grass')] },
    ],
    dangerEffects: [],
    gatherEffects: [gain('grass')],
  },
  {
    id: 'rocky_clearing_sharp_stones',
    name: 'Rocky Clearing - Sharp Stones',
    discovery: 'Choose gain 1 Wood or 1 Flint.',
    danger: 'Lose 1 Health or gain 1 Fear.',
    gather: 'Gain 1 Wood + 1 Flint.',
    discoveryEffects: [
      choose('Take which?', [
        opt('1 Wood', [gain('wood')]),
        opt('1 Flint', [gain('flint')]),
      ]),
    ],
    dangerEffects: [payOrFear(health(1), 'Lose 1 Health', 1)],
    gatherEffects: [gain('wood'), gain('flint')],
  },
  {
    id: 'carrot_patch_rustling_grass',
    name: 'Carrot Patch - Rustling Grass',
    discovery: 'Gain 3 Food.',
    danger: 'Return/spend 1 of that Food or gain 1 Fear.',
    gather: null,
    oneShot: true,
    discoveryEffects: [gain('food', 3)],
    dangerEffects: [
      payOrFear(giveBack('food'), 'Return 1 Food', 1, { resource: 'food', amount: 1, fromGained: true }),
    ],
    gatherEffects: null,
  },
  {
    id: 'fallen_timber_unstable_pile',
    name: 'Fallen Timber - Unstable Pile',
    discovery: 'Gain 3 Wood.',
    danger: 'Return 1 Wood or lose 1 Health.',
    gather: null,
    oneShot: true,
    discoveryEffects: [gain('wood', 3)],
    dangerEffects: [
      choose('Danger', [
        opt('Return 1 Wood', [giveBack('wood')], { resource: 'wood', amount: 1, fromGained: true }),
        opt('Lose 1 Health', [health(1)]),
      ]),
    ],
    gatherEffects: null,
  },
  {
    id: 'abandoned_camp',
    name: 'Abandoned Camp',
    discovery: 'Take 3 total resources chosen from Food, Wood, Grass, and Flint; maximum 2 of the same resource.',
    danger: 'Gain 1 Fear or keep only 2 of the 3 resources.',
    gather: null,
    oneShot: true,
    discoveryEffects: [
      { type: 'take', prompt: 'Take 3 resources (max 2 of a kind)', from: ['food', 'wood', 'grass', 'flint'], total: 3, maxSame: 2 },
    ],
    dangerEffects: [
      choose('Danger', [
        opt('Gain 1 Fear', [fear(1)]),
        opt('Keep only 2 of the 3', [returnGained()]),
      ]),
    ],
    gatherEffects: null,
  },
  {
    id: 'quiet_clearing',
    name: 'Quiet Clearing',
    discovery: 'Choose 2 different resources from Food, Wood, Grass, and Flint and gain 1 of each.',
    danger: null,
    gather: null,
    oneShot: true,
    // maxSame 1 is what makes them "2 different resources".
    discoveryEffects: [
      { type: 'take', prompt: 'Take 2 different resources', from: ['food', 'wood', 'grass', 'flint'], total: 2, maxSame: 1 },
    ],
    dangerEffects: [],
    gatherEffects: null,
  },
  {
    id: 'quiet_pond',
    name: 'Quiet Pond',
    discovery: 'Gain 1 Food.',
    danger: null,
    gather: 'Only if using a Ready Fishing Rod: gain 3 Food, then this Pond rests for one full Day.',
    gatherRequiresGear: 'fishing_rod',
    cooldownDays: 1,
    discoveryEffects: [gain('food')],
    dangerEffects: [],
    gatherEffects: [spendGear('fishing_rod'), gain('food', 3)],
  },
  {
    id: 'spider_den',
    name: 'Spider Den',
    discovery: 'If you use a Ready Spear (spend 1 Spear use), gain 2 Silk and mark the Den cleared. Otherwise gain 1 Fear; the Silk remains unclaimed.',
    danger: null,
    gather: 'If using a Ready Spear, spend 1 Spear use, gain 2 Silk, and mark the Den cleared.',
    gatherRequiresGear: 'spear',
    clearable: true,
    // Discovery and Danger are one decision on this card, so it all sits here.
    discoveryEffects: [
      choose('Spider Den', [
        opt('Spend 1 Spear use: take 2 Silk', [spendGear('spear'), gain('silk', 2), mark('cleared')], { gear: 'spear' }),
        opt('Back away (gain 1 Fear)', [fear(1)]),
      ]),
    ],
    dangerEffects: [],
    gatherEffects: [spendGear('spear'), gain('silk', 2), mark('cleared')],
  },
  {
    id: 'spider_warrior',
    name: 'Spider Warrior',
    discovery: 'If you use a Ready Spear (spend 1 Spear use), gain 1 Silk + 1 Food. Otherwise lose 1 Health and gain 1 Fear.',
    danger: null,
    gather: null,
    oneShot: true,
    discoveryEffects: [
      choose('Spider Warrior', [
        opt('Spend 1 Spear use: take 1 Silk + 1 Food', [spendGear('spear'), gain('silk'), gain('food')], { gear: 'spear' }),
        opt('Fight it unarmed', [health(1), fear(1)]),
      ]),
    ],
    dangerEffects: [],
    gatherEffects: null,
  },
  {
    id: 'merm_spider_aftermath',
    name: 'Merm-Spider Aftermath',
    flavor: 'You find the remains of a spider nearby a Merm house.',
    discovery: 'Gain 1 Silk.',
    danger: null,
    gather: null,
    oneShot: true,
    discoveryEffects: [gain('silk')],
    dangerEffects: [],
    gatherEffects: null,
  },
  {
    id: 'berry_grove_thorny_brambles',
    name: 'Berry Grove - Thorny Brambles',
    discovery: 'Gain 2 Food.',
    danger: 'Gain 1 Fear or return 1 of the Food gained here.',
    gather: null,
    transplantSlots: 1,
    discoveryEffects: [gain('food', 2)],
    dangerEffects: [
      choose('Danger', [
        opt('Gain 1 Fear', [fear(1)]),
        opt('Return 1 Food', [giveBack('food')], { resource: 'food', amount: 1, fromGained: true }),
      ]),
    ],
    gatherEffects: null,
  },
]

export const LOCATIONS_BY_ID = Object.fromEntries(LOCATIONS.map((l) => [l.id, l]))

/** Sanity guard: the deck size is a design decision, not an accident. */
export const LOCATION_DECK_SIZE = LOCATIONS.length
