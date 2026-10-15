/**
 * Night cards, transcribed from docs/CARDS.md.
 *
 * Thresholds are stored as `mult * P + add` where P is the player count, so the
 * formulas stay generic even though Alpha 1.0 fixes P = 2.
 *
 * Outcomes are ordered BEST FIRST. Resolution walks the list and takes the first
 * whose threshold is met; the entry marked `fallback` always matches.
 *
 * Effect vocabulary (resolved later by engine/night.js):
 *   fearEach / healthEach / hungerEach   - applies to every survivor
 *   fearOne  / hungerOne                 - one survivor, team's choice
 *   fearAssign / healthAssign            - N total, team distributes
 *   gainResource / spendResource         - shared pool
 *   choice                               - team picks one of `options`
 */

/** Threshold helper: `combat >= 2P + 3` is `req('combat', 2, 3)`. */
const req = (stat, mult, add) => ({ stat, mult, add })

export const NIGHT_CARDS = [
  // ---------------------------------------------------------------- Early
  {
    id: 'distant_howls',
    name: 'Distant Howls',
    band: 'early',
    outcomes: [
      { id: 'quieted', label: 'Quieted', threshold: req('combat', 1, 0), effects: [] },
      { id: 'kept_awake', label: 'Kept Awake', fallback: true, effects: [{ type: 'fearEach', amount: 1 }] },
    ],
  },
  {
    id: 'hound_scouts',
    name: 'Hound Scouts',
    band: 'early',
    outcomes: [
      { id: 'driven_off', label: 'Driven Off', threshold: req('combat', 1, 2), effects: [] },
      {
        id: 'scratched_up',
        label: 'Scratched Up',
        threshold: req('combat', 1, 0),
        effects: [{ type: 'healthAssign', amount: 1 }],
      },
      {
        id: 'mauled',
        label: 'Mauled',
        fallback: true,
        effects: [
          { type: 'healthEach', amount: 1 },
          { type: 'fearOne', amount: 1 },
        ],
      },
    ],
  },
  {
    id: 'cold_rain',
    name: 'Cold Rain',
    band: 'early',
    outcomes: [
      { id: 'kept_dry', label: 'Kept Dry', threshold: req('protection', 1, 1), effects: [] },
      {
        id: 'soaked_through',
        label: 'Soaked Through',
        fallback: true,
        effects: [{ type: 'hungerEach', amount: 1 }],
      },
    ],
  },

  // ------------------------------------------------------------------ Mid
  {
    id: 'light_rain',
    name: 'Light Rain',
    band: 'mid',
    outcomes: [
      { id: 'sheltered', label: 'Sheltered', threshold: req('protection', 1, 0), effects: [] },
      {
        id: 'miserable_night',
        label: 'Miserable Night',
        fallback: true,
        effects: [
          {
            type: 'choice',
            options: [
              {
                label: 'Spend 1 shared Food',
                effects: [{ type: 'spendResource', resource: 'food', amount: 1 }],
              },
              {
                label: 'One survivor loses 1 Hunger',
                effects: [{ type: 'hungerOne', amount: 1 }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    /**
     * Payment-driven rather than threshold-driven: the team declares how much
     * Food to pay, so the UI must present the legal options instead of the
     * engine auto-spending (implementation note in docs/CARDS.md).
     */
    id: 'food_thieves',
    name: 'Food Thieves',
    band: 'mid',
    paymentResource: 'food',
    outcomes: [
      { id: 'chased_away', label: 'Chased Away', payment: { mult: 1, add: 0 }, effects: [] },
      {
        id: 'they_grab_a_few',
        label: 'They Grab a Few',
        payment: { mult: 0.5, add: 0, round: 'ceil' },
        effects: [{ type: 'hungerOne', amount: 1 }],
      },
      {
        id: 'pantry_raided',
        label: 'Pantry Raided',
        fallback: true,
        effects: [
          { type: 'hungerEach', amount: 1 },
          { type: 'fearOne', amount: 1 },
        ],
      },
    ],
  },
  {
    id: 'restless_shadows',
    name: 'Restless Shadows',
    band: 'mid',
    outcomes: [
      { id: 'shadows_recede', label: 'Shadows Recede', threshold: req('protection', 2, 1), effects: [] },
      {
        id: 'uneasy_night',
        label: 'Uneasy Night',
        threshold: req('protection', 1, 1),
        effects: [{ type: 'fearEach', amount: 1 }],
      },
      { id: 'surrounded', label: 'Surrounded', fallback: true, effects: [{ type: 'fearEach', amount: 2 }] },
    ],
  },
  {
    id: 'spider_swarm',
    name: 'Spider Swarm',
    band: 'mid',
    outcomes: [
      {
        id: 'nest_cleared',
        label: 'Nest Cleared',
        threshold: req('combat', 2, 2),
        effects: [{ type: 'gainResource', resource: 'food', amount: 1 }],
      },
      {
        id: 'bitten_back',
        label: 'Bitten Back',
        threshold: req('combat', 1, 2),
        effects: [
          { type: 'healthAssign', amount: 1 },
          { type: 'fearAssign', amount: 1 },
        ],
      },
      {
        id: 'overrun',
        label: 'Overrun',
        fallback: true,
        effects: [
          // "assign P total Health loss" -- scales with player count.
          { type: 'healthAssign', mult: 1, add: 0 },
          { type: 'fearEach', amount: 1 },
        ],
      },
    ],
  },

  // ----------------------------------------------------------------- Late
  {
    id: 'long_night',
    name: 'Long Night',
    band: 'late',
    outcomes: [
      { id: 'kept_at_bay', label: 'Kept at Bay', threshold: req('protection', 2, 3), effects: [] },
      {
        id: 'night_terrors',
        label: 'Night Terrors',
        fallback: true,
        effects: [
          { type: 'fearEach', amount: 1 },
          { type: 'hungerEach', amount: 1 },
        ],
      },
    ],
  },
  {
    id: 'alpha_hounds',
    name: 'Alpha Hounds',
    band: 'late',
    outcomes: [
      { id: 'pack_broken', label: 'Pack Broken', threshold: req('combat', 2, 3), effects: [] },
      {
        id: 'bloodied',
        label: 'Bloodied',
        threshold: req('combat', 2, 1),
        effects: [
          { type: 'healthAssign', amount: 2 },
          { type: 'fearOne', amount: 1 },
        ],
      },
      {
        id: 'torn_apart',
        label: 'Torn Apart',
        fallback: true,
        effects: [
          { type: 'healthEach', amount: 1 },
          { type: 'healthAssign', amount: 1 },
          { type: 'fearEach', amount: 1 },
        ],
      },
    ],
  },
]

/**
 * Night 10. Two independent checks; each deals 0 / 1 / 3 Health to EVERY
 * survivor depending on its own tier. There is no "must reach middle" rule --
 * survival is simply whatever Health remains after both, minus prevention
 * such as Log Suit.
 */
export const RED_MOON = {
  id: 'red_moon',
  name: 'Red Moon',
  band: 'redMoon',
  checks: [
    {
      id: 'hounds',
      label: 'Hounds',
      tiers: [
        { id: 'pack_broken', label: 'Pack Broken', threshold: req('combat', 2, 3), healthEach: 0 },
        { id: 'bloodied', label: 'Bloodied', threshold: req('combat', 2, 1), healthEach: 1 },
        { id: 'torn_apart', label: 'Torn Apart', fallback: true, healthEach: 3 },
      ],
    },
    {
      id: 'darkness',
      label: 'Darkness',
      tiers: [
        {
          id: 'darkness_held_back',
          label: 'Darkness Held Back',
          threshold: req('protection', 1, 3),
          healthEach: 0,
        },
        {
          id: 'shadows_break_through',
          label: 'Shadows Break Through',
          threshold: req('protection', 1, 2),
          healthEach: 1,
        },
        { id: 'consumed_by_darkness', label: 'Consumed by Darkness', fallback: true, healthEach: 3 },
      ],
    },
  ],
}

/** Resolves a `mult * P + add` threshold for a given player count. */
export function thresholdValue(threshold, playerCount) {
  return threshold.mult * playerCount + threshold.add
}

/** Resolves a Food Thieves payment tier for a given player count. */
export function paymentValue(payment, playerCount) {
  const raw = payment.mult * playerCount + payment.add
  return payment.round === 'ceil' ? Math.ceil(raw) : raw
}

export const NIGHTS_BY_BAND = {
  early: NIGHT_CARDS.filter((n) => n.band === 'early'),
  mid: NIGHT_CARDS.filter((n) => n.band === 'mid'),
  late: NIGHT_CARDS.filter((n) => n.band === 'late'),
}
