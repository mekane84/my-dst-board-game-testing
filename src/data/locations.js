/**
 * The 23-card Location deck, transcribed from docs/CARDS.md.
 *
 * PHASE 1 SCOPE: this file carries each Location's identity, verbatim card
 * text, and the structural flags the engine needs to track state. The actual
 * effect handlers land in Phase 5 (engine/locations.js); until then `effects`
 * is intentionally absent and the `text` fields are the source of truth.
 *
 * Structural flags:
 *   oneShot            - Discovery only; no repeatable Gather
 *   transplantSlots    - Berry Groves each support exactly 1 transplant
 *   gatherRequiresGear - Gather is illegal without this Ready Gear
 *   clearable          - Spider Den: once cleared it is spent
 */

export const LOCATIONS = [
  {
    id: 'dense_forest_strange_noises',
    name: 'Dense Forest - Strange Noises',
    discovery: 'Gain 1 Wood.',
    danger: 'Spend 1 Food or gain 1 Fear.',
    gather: 'Gain 3 Wood.',
  },
  {
    id: 'dense_forest_spider_woods',
    name: 'Dense Forest - Spider Woods',
    discovery: 'Gain 1 Wood.',
    danger: 'You may spend 1 Spear use to ignore this Danger. Otherwise lose 1 Health or gain 2 Fear.',
    gather: 'Gain 3 Wood.',
  },
  {
    id: 'savanna_open_plains',
    name: 'Savanna - Open Plains',
    discovery: 'Gain 1 Grass.',
    danger: null,
    gather: 'Gain 3 Grass.',
  },
  {
    id: 'savanna_scorching_sun',
    name: 'Savanna - Scorching Sun',
    discovery: 'Gain 1 Grass.',
    danger: 'Lose 1 Hunger or gain 1 Fear.',
    gather: 'Gain 3 Grass.',
  },
  {
    id: 'boulder_field_loose_rocks',
    name: 'Boulder Field - Loose Rocks',
    discovery: 'Gain 1 Flint.',
    danger: 'Lose 1 Health or gain 1 Fear.',
    gather: 'Gain 2 Flint. If using a Ready Pickaxe, gain 3 Flint instead.',
  },
  {
    id: 'boulder_field_cave_echoes',
    name: 'Boulder Field - Cave Echoes',
    discovery: 'Gain 1 Flint.',
    danger: 'Spend 1 Food or gain 2 Fear.',
    gather: 'Gain 2 Flint. If using a Ready Pickaxe, gain 3 Flint instead.',
  },
  {
    id: 'berry_grove_peaceful',
    name: 'Berry Grove - Peaceful Grove',
    discovery: 'Gain 2 Food.',
    danger: null,
    gather: null,
    transplantSlots: 1,
  },
  {
    id: 'berry_grove_something_feeding',
    name: 'Berry Grove - Something Feeding Here',
    discovery: 'Gain 2 Food.',
    danger: 'Spend 1 Food or gain 1 Fear.',
    gather: null,
    transplantSlots: 1,
  },
  {
    id: 'rabbit_field',
    name: 'Rabbit Field',
    discovery: 'Gain 1 Food.',
    danger: null,
    gather: 'Only if using a Ready Trap: gain 2 Food, then Rabbit Field rests for one full Day.',
    gatherRequiresGear: 'trap',
    cooldownDays: 1,
  },
  {
    id: 'mixed_woodland_tangled_thicket',
    name: 'Mixed Woodland - Tangled Thicket',
    discovery: 'Choose gain 1 Wood or 1 Grass.',
    danger: 'Lose 1 Health or gain 1 Fear.',
    gather: 'Choose gain 2 Wood or 2 Grass.',
  },
  {
    id: 'marsh_murky_ground',
    name: 'Marsh - Murky Ground',
    discovery: 'Choose gain 1 Food or 1 Grass.',
    danger: 'Lose 1 Hunger or gain 2 Fear.',
    gather: 'Gain 1 Food + 1 Grass.',
  },
  {
    id: 'pond_croaking_banks',
    name: 'Pond - Croaking Banks',
    discovery: 'Gain 1 Food.',
    danger: 'Lose 1 Hunger or gain 1 Fear.',
    gather: 'Only if using a Ready Fishing Rod: gain 3 Food, then this Pond rests for one full Day.',
    gatherRequiresGear: 'fishing_rod',
    cooldownDays: 1,
  },
  {
    id: 'flower_meadow',
    name: 'Flower Meadow',
    discovery: 'Permanently remove 1 Fear from any survivor. If no survivor has Fear, gain 1 Grass instead.',
    danger: null,
    gather: 'Gain 1 Grass.',
  },
  {
    id: 'rocky_clearing_sharp_stones',
    name: 'Rocky Clearing - Sharp Stones',
    discovery: 'Choose gain 1 Wood or 1 Flint.',
    danger: 'Lose 1 Health or gain 1 Fear.',
    gather: 'Gain 1 Wood + 1 Flint.',
  },
  {
    id: 'carrot_patch_rustling_grass',
    name: 'Carrot Patch - Rustling Grass',
    discovery: 'Gain 3 Food.',
    danger: 'Return/spend 1 of that Food or gain 1 Fear.',
    gather: null,
    oneShot: true,
  },
  {
    id: 'fallen_timber_unstable_pile',
    name: 'Fallen Timber - Unstable Pile',
    discovery: 'Gain 3 Wood.',
    danger: 'Return 1 Wood or lose 1 Health.',
    gather: null,
    oneShot: true,
  },
  {
    id: 'abandoned_camp',
    name: 'Abandoned Camp',
    discovery: 'Take 3 total resources chosen from Food, Wood, Grass, and Flint; maximum 2 of the same resource.',
    danger: 'Gain 1 Fear or keep only 2 of the 3 resources.',
    gather: null,
    oneShot: true,
  },
  {
    id: 'quiet_clearing',
    name: 'Quiet Clearing',
    discovery: 'Choose 2 different resources from Food, Wood, Grass, and Flint and gain 1 of each.',
    danger: null,
    gather: null,
    oneShot: true,
  },
  {
    id: 'quiet_pond',
    name: 'Quiet Pond',
    discovery: 'Gain 1 Food.',
    danger: null,
    gather: 'Only if using a Ready Fishing Rod: gain 3 Food, then this Pond rests for one full Day.',
    gatherRequiresGear: 'fishing_rod',
    cooldownDays: 1,
  },
  {
    id: 'spider_den',
    name: 'Spider Den',
    discovery: 'If you use a Ready Spear (spend 1 Spear use), gain 2 Silk and mark the Den cleared. Otherwise gain 1 Fear; the Silk remains unclaimed.',
    danger: null,
    gather: 'If using a Ready Spear, spend 1 Spear use, gain 2 Silk, and mark the Den cleared.',
    gatherRequiresGear: 'spear',
    clearable: true,
  },
  {
    id: 'spider_warrior',
    name: 'Spider Warrior',
    discovery: 'If you use a Ready Spear (spend 1 Spear use), gain 1 Silk + 1 Food. Otherwise lose 1 Health and gain 1 Fear.',
    danger: null,
    gather: null,
    oneShot: true,
  },
  {
    id: 'merm_spider_aftermath',
    name: 'Merm-Spider Aftermath',
    flavor: 'You find the remains of a spider nearby a Merm house.',
    discovery: 'Gain 1 Silk.',
    danger: null,
    gather: null,
    oneShot: true,
  },
  {
    id: 'berry_grove_thorny_brambles',
    name: 'Berry Grove - Thorny Brambles',
    discovery: 'Gain 2 Food.',
    danger: 'Gain 1 Fear or return 1 of the Food gained here.',
    gather: null,
    transplantSlots: 1,
  },
]

/** Sanity guard: the deck size is a design decision, not an accident. */
export const LOCATION_DECK_SIZE = LOCATIONS.length
