/**
 * Shared Camp structures, transcribed from docs/CARDS.md.
 *
 * Two families, deliberately kept apart because the balance targets differ:
 *
 * - MAJOR improvements (Fire Pit, Palisade, Lean-To, Tent) are expensive and
 *   permanent. A normal winning game builds 2-3; all four should take a
 *   deliberate Camp-heavy strategy. There is no hard cap -- cost and timing do
 *   the limiting.
 * - FOOD infrastructure (Berry Bush, Farm) is permanent too but does NOT count
 *   toward that 2-3 target.
 *
 * `unique: true` means one copy exists for the whole team.
 */

export const CAMP_IMPROVEMENTS = [
  {
    id: 'fire_pit',
    name: 'Fire Pit',
    family: 'major',
    cost: { wood: 3, flint: 2 },
    unique: true,
    text: 'At the start of Night, spend 1 Wood to fuel the Fire Pit. If fueled, gain +2 Protection this Night. If not fueled, it provides no Protection.',
    /** Resolved at Night in Phase 8. */
    night: { fuel: { wood: 1 }, protectionIfFueled: 2 },
  },
  {
    id: 'palisade',
    name: 'Palisade',
    family: 'major',
    cost: { wood: 4, flint: 3 },
    unique: true,
    text: 'Gain +2 Combat every Night.',
    night: { combat: 2 },
  },
  {
    id: 'lean_to',
    name: 'Lean-To',
    family: 'major',
    cost: { wood: 3, grass: 4 },
    unique: true,
    text: 'The first healing Recover used by the team each Day heals 3 Health instead of 1.',
    /**
     * RESOLVED 2026-10-14: "healing" is load-bearing. A Recover played at full
     * Health is not a healing Recover and does not consume the Day's bonus.
     */
    firstHealingRecoverHeals: 3,
  },
  {
    id: 'tent',
    name: 'Tent',
    family: 'major',
    cost: { wood: 3, grass: 5 },
    unique: true,
    text: 'Once per Day: one survivor may spend 1 action + 1 Food to permanently remove up to 3 Fear from their own hand, played area, and/or discard pile.',
    /** Costs one of the three daily actions rather than a starter card. */
    ability: { costsAction: true, cost: { food: 1 }, removeFear: 3, oncePerDay: true },
  },
]

export const FOOD_INFRASTRUCTURE = [
  {
    id: 'transplanted_berry_bush',
    name: 'Transplanted Berry Bush',
    family: 'food',
    cost: { grass: 1 },
    /** Needs a Ready Shovel and an unused transplant slot on a Berry Grove. */
    requiresGear: 'shovel',
    requiresTransplantSlot: true,
    unique: false,
    provisional: true,
    text: 'Gather: gain 2 Food. Then this Berry Bush regrows for one full Day.',
    yield: { food: 2 },
    cooldownDays: 1,
  },
  {
    id: 'simple_farm',
    name: 'Simple Farm Plot',
    family: 'food',
    cost: { wood: 2, grass: 3, flint: 1 },
    unique: false,
    provisional: true,
    text: 'Gather: gain 3 Food. Then this Farm regrows for one full Day.',
    yield: { food: 3 },
    cooldownDays: 1,
  },
]

export const BUILDABLE = [...CAMP_IMPROVEMENTS, ...FOOD_INFRASTRUCTURE]
export const BUILDABLE_BY_ID = Object.fromEntries(BUILDABLE.map((b) => [b.id, b]))

/** Major improvements only -- what the 2-3 balance target counts. */
export const MAJOR_IDS = CAMP_IMPROVEMENTS.map((c) => c.id)
