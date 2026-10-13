/**
 * Every tunable number in the game lives here.
 *
 * Nothing in this file imports anything. Change a value, save, and the running
 * game picks it up via HMR without losing board state — that's the whole point
 * of keeping balance separate from logic.
 *
 * When a playtest goes sideways, the fix is almost always in this file.
 */

export const RULES = {
  meta: {
    /** Survive this many full days to win. */
    daysToSurvive: 20,
    mapWidth: 7,
    mapHeight: 7,
  },

  meters: {
    maxHealth: 100,
    maxHunger: 100,
    maxSanity: 100,
    startHealth: 100,
    startHunger: 100,
    startSanity: 100,
  },

  /**
   * A day is three phases. Action points reset at the start of each phase, so
   * shortening the night is the lever for making the game gentler.
   */
  phases: [
    { id: 'day', label: 'Day', actionPoints: 4, lit: true },
    { id: 'dusk', label: 'Dusk', actionPoints: 2, lit: false },
    { id: 'night', label: 'Night', actionPoints: 1, lit: false },
  ],

  hunger: {
    /** Drained at the END of each phase, keyed by phase id. */
    drainPerPhase: { day: 4, dusk: 3, night: 3 },
    /** Extra drain for taking a Rest action. */
    restSurcharge: 3,
    /** Health lost per phase while hunger sits at zero. */
    starvingHealthDrain: 8,
  },

  sanity: {
    /** Applied at the end of each phase. Positive restores. */
    changePerPhaseLit: { day: 2, dusk: 0, night: -3 },
    changePerPhaseUnlit: { day: 2, dusk: -5, night: -15 },
    restRecovery: 5,
    /** At or below this, shadow creatures start showing up at night. */
    shadowThreshold: 30,
    shadowHealthDamage: 10,
  },

  darkness: {
    /** Health lost when a night phase ends with no light source. */
    charlieDamage: 20,
    /** A spear cuts Charlie's damage by this fraction. */
    spearMitigation: 0.5,
  },

  actions: {
    move: { ap: 1 },
    gather: { ap: 1 },
    craft: { ap: 1 },
    eat: { ap: 1 },
    rest: { ap: 1, healthRestore: 8 },
    cook: { ap: 1 },
  },

  /**
   * Biomes and what they yield. `density` is the relative weight used when
   * seeding the map; `amount` is how many times a tile can be gathered before
   * it's exhausted.
   */
  biomes: {
    camp: { label: 'Camp', resource: null, density: 0, safe: true },
    forest: { label: 'Forest', resource: 'wood', density: 3, amount: 4, yield: 2 },
    thicket: { label: 'Thicket', resource: 'twigs', density: 2, amount: 4, yield: 2 },
    grassland: { label: 'Grassland', resource: 'grass', density: 3, amount: 4, yield: 2 },
    berryPatch: { label: 'Berry Patch', resource: 'berries', density: 2, amount: 3, yield: 2 },
    rocky: { label: 'Rocky Ground', resource: 'flint', density: 2, amount: 3, yield: 1 },
    goldVein: { label: 'Gold Vein', resource: 'gold', density: 1, amount: 2, yield: 1 },
  },

  food: {
    berries: { hunger: 15, sanity: 0, health: 0 },
    cookedBerries: { hunger: 25, sanity: 5, health: 2 },
  },

  /**
   * Recipes. `tools` grant passive effects; `light` items are consumed by the
   * night. `requiresCampfire` means you must be standing on a lit camp.
   */
  recipes: {
    torch: {
      label: 'Torch',
      cost: { twigs: 2, grass: 2 },
      type: 'light',
      /** Nights of light before it burns out. */
      durability: 2,
    },
    campfire: {
      label: 'Campfire',
      cost: { wood: 3, grass: 2 },
      type: 'structure',
      /** Lights the tile it's built on, for this many nights. */
      durability: 5,
    },
    axe: {
      label: 'Axe',
      cost: { twigs: 1, flint: 1 },
      type: 'tool',
      /** Bonus wood per gather. */
      effect: { bonusYield: { wood: 2 } },
    },
    pickaxe: {
      label: 'Pickaxe',
      cost: { twigs: 1, flint: 2 },
      type: 'tool',
      /** Gold cannot be gathered without this. */
      effect: { unlocks: ['gold'] },
    },
    spear: {
      label: 'Spear',
      cost: { twigs: 2, flint: 1 },
      type: 'tool',
      effect: { mitigatesDarkness: true },
    },
  },

  /** Resources the player starts with. Handy for testing late-game states. */
  startingResources: {
    wood: 0,
    grass: 0,
    twigs: 0,
    flint: 0,
    berries: 2,
    cookedBerries: 0,
    gold: 0,
  },
}

/** Resource keys, derived so adding a biome doesn't mean editing two lists. */
export const RESOURCES = Object.keys(RULES.startingResources)

/** Deep clone, so a tweaked ruleset in one sim never leaks into the next. */
export function cloneRules(rules = RULES) {
  return structuredClone(rules)
}
