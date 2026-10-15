/**
 * Personal Gear, transcribed from docs/CARDS.md.
 *
 * PHASE 2 SCOPE: identity, cost, durability and the structural flags the draw
 * system needs. Effect handlers arrive in Phase 4 (engine/gear.js); until then
 * `text` is the source of truth.
 *
 * `type`:
 *   reusable        cycles through the deck indefinitely
 *   two-use         2 durability charges, then permanently removed
 *   special-two-use Garland only -- use 1 fires on craft, use 2 on a later draw
 *
 * `onDraw` marks Gear that does something the moment it is drawn and readied,
 * which the draw loop must handle rather than the action system.
 */

export const GEAR = [
  // ------------------------------------------------------- reusable
  {
    id: 'axe',
    name: 'Axe',
    type: 'reusable',
    cost: { wood: 1, flint: 1 },
    text: 'Once per Day when you Gather Wood, gain +1 Wood.',
    modifies: 'gather',
  },
  {
    id: 'pickaxe',
    name: 'Pickaxe',
    type: 'reusable',
    cost: { wood: 1, flint: 1 },
    text: 'Once per Day when you Gather Flint, gain +1 Flint.',
    modifies: 'gather',
  },
  {
    id: 'trap',
    name: 'Trap',
    type: 'reusable',
    cost: { wood: 1, grass: 1, flint: 1 },
    text: 'Use with Gather at Rabbit Field: gain 2 Food. Then Rabbit Field rests for one full Day.',
    provisional: true,
  },
  {
    id: 'backpack',
    name: 'Backpack',
    type: 'reusable',
    cost: { grass: 2 },
    text: 'When drawn and readied, draw 1 additional hand card that Day.',
    /** Fires during the draw loop; Gear replacement still applies to that draw. */
    onDraw: 'extraHandCard',
  },
  {
    id: 'map',
    name: 'Map',
    type: 'reusable',
    cost: { grass: 1, flint: 1 },
    text: 'Once per Day when you Explore, draw 2 Location cards instead of 1. Choose 1 to discover and resolve. Put the other on the bottom of the Location deck.',
    modifies: 'explore',
  },
  {
    id: 'shovel',
    name: 'Shovel',
    type: 'reusable',
    cost: { wood: 1, flint: 1 },
    text: 'Required to transplant a Berry Bush. Using the Shovel for a transplant uses it for the Day but does not destroy it.',
    provisional: true,
  },
  {
    id: 'fishing_rod',
    name: 'Fishing Rod',
    type: 'reusable',
    cost: { wood: 1, silk: 1 },
    text: 'Use with Gather at an available Pond: gain 3 Food. Then that Pond rests for one full Day.',
  },
  {
    id: 'top_hat',
    name: 'Top Hat',
    type: 'reusable',
    cost: { silk: 1 },
    text: 'When drawn: permanently remove 1 Fear from your hand, played area, or discard pile. Do not search your draw pile. If no eligible Fear exists, nothing happens.',
    onDraw: 'removeFear',
  },

  // -------------------------------------------------------- two-use
  {
    id: 'spear',
    name: 'Spear',
    type: 'two-use',
    uses: 2,
    cost: { wood: 2, flint: 1 },
    text: 'Use with one Combat Prepare: that Prepare provides 3 Combat total instead of 1. May also satisfy Location effects that explicitly require a Spear, spending 1 use.',
    modifies: 'prepare',
  },
  {
    id: 'torch',
    name: 'Torch',
    type: 'two-use',
    uses: 2,
    cost: { wood: 1, grass: 2 },
    text: 'Use with one Protection Prepare: that Prepare provides 3 Protection total instead of 1. May also satisfy Location effects that call for light, spending 1 use.',
    modifies: 'prepare',
  },
  {
    id: 'log_suit',
    name: 'Log Suit',
    type: 'two-use',
    uses: 2,
    cost: { wood: 2, grass: 2 },
    text: 'When you would lose Health, spend 1 use to prevent 1 Health loss to yourself. May prevent Red Moon Health loss.',
    /** Reactive: prompts during damage resolution rather than on an action. */
    reactive: true,
  },
  {
    id: 'small_campfire',
    name: 'Small Campfire',
    type: 'two-use',
    uses: 2,
    cost: { wood: 1, grass: 1 },
    text: 'Action: gain +2 Protection this Night. Also, one survivor may ignore 1 Fear gained this Night.',
    /** Costs one of the three daily actions, not a starter card. */
    costsAction: true,
  },
  {
    id: 'garland',
    name: 'Garland',
    type: 'special-two-use',
    uses: 2,
    cost: { grass: 3 },
    text: 'On craft: permanently remove 1 Fear from your hand, played area, or discard pile. Later, when drawn: spend an action to remove 1 more Fear, then remove Garland from your deck/game.',
    costsAction: true,
    provisional: true,
    /**
     * RESOLVED 2026-10-14: the craft-time use is always spent, even with no
     * eligible Fear anywhere. Crafting Garland into an empty board wastes half
     * the card.
     */
    craftUseAlwaysSpent: true,
  },
]

export const GEAR_BY_ID = Object.fromEntries(GEAR.map((g) => [g.id, g]))

/** Gear whose effect fires the moment it is drawn and readied. */
export const ON_DRAW_GEAR = GEAR.filter((g) => g.onDraw).map((g) => g.id)

export function isTwoUse(gearId) {
  const gear = GEAR_BY_ID[gearId]
  return gear?.type === 'two-use' || gear?.type === 'special-two-use'
}
