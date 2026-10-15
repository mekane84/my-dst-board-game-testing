/**
 * Every balance-tunable number for Alpha 1.0.
 *
 * Values transcribed from docs/ALPHA_1_RULES.md and docs/CARDS.md. Those
 * documents are authoritative — if a number here disagrees with them, the
 * document wins and this file is the bug.
 *
 * Nothing in this file imports anything.
 */

/** Shared resource keys, in display order. */
export const RESOURCES = ['food', 'wood', 'grass', 'flint', 'silk']

/** Personal deck zones. Cards live in exactly one at a time. */
export const ZONES = ['draw', 'hand', 'played', 'discard', 'readyGear', 'usedGear', 'removed']

export const CONSTANTS = {
  meta: {
    /** Alpha 1.0 is 2 players. Night formulas use P so this stays configurable. */
    playerCount: 2,
    days: 10,
    handSize: 5,
    actionsPerDay: 3,
  },

  survivor: {
    startHealth: 5,
    maxHealth: 5,
    startHunger: 2,
    maxHunger: 2,
  },

  /** 8-card starter deck per survivor. */
  starterDeck: {
    gather: 3,
    explore: 2,
    prepare: 2,
    recover: 1,
  },

  startingResources: {
    food: 0,
    wood: 0,
    grass: 0,
    flint: 0,
    silk: 0,
  },

  gather: {
    /** Camp Gather yields exactly 1 of one chosen resource. */
    campYield: 1,
    /** Food can never come from Camp Gather. */
    campResources: ['wood', 'grass', 'flint'],
    /** Camp Gather has NO once-per-Day limit (ALPHA_1_RULES.md s4). */
    campOncePerDay: false,
    /** Each explored Location may be Gathered at most once per Day. */
    locationOncePerDay: true,
  },

  /**
   * Gear that modifies an action (Axe, Pickaxe on Gather; Spear, Torch on
   * Prepare). RESOLVED 2026-10-14.
   */
  gearModifiers: {
    /** At most this many Gear of a given type may modify a single action. */
    maxPerAction: 1,
    /**
     * Whose 'once per Day' it is: 'card' means each copy gets its own use, so
     * two Axes can each fire once in a Day -- but on different Gathers.
     * 'survivor' would make duplicate tools entirely dead.
     */
    limitScope: 'card',
  },

  /**
   * Renewable food cooldown, the authoritative digital reading:
   * harvested on Day D -> unavailable D+1 -> available again at start of D+2.
   */
  cooldown: {
    renewableFoodDays: 1,
  },

  hunger: {
    /**
     * RESOLVED 2026-10-14: any Hunger loss while Hunger is already 0 becomes
     * this much Health loss instead. Applies to every source, not just meals.
     */
    healthLossWhenHungerAtZero: 1,
  },

  /** Which Night band each Day draws from. Day 10 is always Red Moon. */
  nightBands: {
    early: [1, 2, 3],
    mid: [4, 5, 6, 7],
    late: [8, 9],
    redMoon: [10],
  },
}
