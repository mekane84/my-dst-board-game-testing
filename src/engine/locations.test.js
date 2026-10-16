import { describe, it, expect } from 'vitest'
import { createGame } from './setup.js'
import { exploreLocation, gatherAtLocation, exploredById, locationOptions } from './locations.js'
import { resolveChoice, resolveTake } from './effects.js'
import { createGearCard } from './gear.js'
import { buildStructure } from './crafting.js'
import { fearCount, gainFear as gainFearFor } from './draw.js'

function game(seed = 'locations') {
  const state = createGame({ seed })
  return { state, p: state.players[0] }
}

/** Puts a known Location on top, so tests do not depend on the shuffle. */
function stack(state, ...ids) {
  state.locations.deck = [...ids, ...state.locations.deck.filter((d) => !ids.includes(d))]
}

function ready(state, player, gearId) {
  const card = createGearCard(state, gearId)
  player.readyGear.push(card)
  return card
}

describe('exploring', () => {
  it('takes the top card and records it as explored', () => {
    const { state, p } = game()
    stack(state, 'savanna_open_plains')

    const result = exploreLocation(state, p)

    expect(result.ok).toBe(true)
    expect(state.locations.explored.map((l) => l.id)).toEqual(['savanna_open_plains'])
    expect(state.locations.deck).toHaveLength(22)
  })

  it('runs the Discovery effect', () => {
    const { state, p } = game()
    stack(state, 'savanna_open_plains')

    exploreLocation(state, p)

    expect(state.resources.grass).toBe(1)
  })

  it('leaves no decision waiting for a Calm Location', () => {
    const { state, p } = game()
    stack(state, 'savanna_open_plains')

    const result = exploreLocation(state, p)

    expect(result.pending).toBeFalsy()
    expect(state.pending).toBeNull()
  })

  it('finds nothing once the deck is empty, without erroring', () => {
    const { state, p } = game()
    state.locations.deck = []

    const result = exploreLocation(state, p)

    expect(result.ok).toBe(true)
    expect(result.found).toBe(false)
    expect(state.log.some((e) => e.type === 'explore-empty')).toBe(true)
  })
})

describe('Dangers that ask a question', () => {
  it('pauses with both options offered', () => {
    const { state, p } = game()
    stack(state, 'dense_forest_strange_noises')
    state.resources.food = 1

    const result = exploreLocation(state, p)

    expect(result.pending).toBe(true)
    expect(state.pending.kind).toBe('choice')
    expect(state.pending.options.map((o) => o.label)).toEqual(['Spend 1 Food', 'Gain 1 Fear'])
    // Discovery already ran; only the Danger is waiting.
    expect(state.resources.wood).toBe(1)
  })

  it('applies the branch that was chosen', () => {
    const { state, p } = game()
    stack(state, 'dense_forest_strange_noises')
    state.resources.food = 1

    exploreLocation(state, p)
    const result = resolveChoice(state, 0)

    expect(result.ok).toBe(true)
    expect(state.resources.food).toBe(0)
    expect(fearCount(p)).toBe(0)
    expect(state.pending).toBeNull()
  })

  it('applies the other branch just as happily', () => {
    const { state, p } = game()
    stack(state, 'dense_forest_strange_noises')
    state.resources.food = 1

    exploreLocation(state, p)
    resolveChoice(state, 1)

    expect(state.resources.food).toBe(1)
    expect(fearCount(p)).toBe(1)
  })

  it('blocks an option the team cannot pay for, and says why', () => {
    const { state, p } = game()
    stack(state, 'dense_forest_strange_noises')
    expect(state.resources.food).toBe(0)

    exploreLocation(state, p)

    const [pay, takeFear] = state.pending.options
    expect(pay.available).toBe(false)
    expect(pay.reason).toMatch(/not enough food/i)
    expect(takeFear.available).toBe(true)

    const refused = resolveChoice(state, 0)
    expect(refused.ok).toBe(false)
    expect(state.pending).not.toBeNull()
  })

  it('offers a Spear as a way out of Spider Woods', () => {
    const { state, p } = game()
    stack(state, 'dense_forest_spider_woods')
    const spear = ready(state, p, 'spear')

    exploreLocation(state, p)
    expect(state.pending.options[0].available).toBe(true)

    resolveChoice(state, 0)

    expect(spear.uses).toBe(1)
    expect(p.health).toBe(5)
    expect(fearCount(p)).toBe(0)
  })

  it('hides the Spear option when none is Ready', () => {
    const { state, p } = game()
    stack(state, 'dense_forest_spider_woods')

    exploreLocation(state, p)

    expect(state.pending.options[0].available).toBe(false)
    expect(state.pending.options[0].reason).toMatch(/spear/i)
  })
})

describe('taking a tally of resources', () => {
  it('offers the pick with its limits', () => {
    const { state, p } = game()
    stack(state, 'abandoned_camp')

    exploreLocation(state, p)

    expect(state.pending.kind).toBe('take')
    expect(state.pending.total).toBe(3)
    expect(state.pending.maxSame).toBe(2)
    expect(state.pending.from).toEqual(['food', 'wood', 'grass', 'flint'])
  })

  it('grants exactly what was taken', () => {
    const { state, p } = game()
    stack(state, 'abandoned_camp')
    exploreLocation(state, p)

    const result = resolveTake(state, { wood: 2, food: 1 })

    expect(result.ok).toBe(true)
    expect(state.resources.wood).toBe(2)
    expect(state.resources.food).toBe(1)
  })

  it('refuses the wrong total', () => {
    const { state, p } = game()
    stack(state, 'abandoned_camp')
    exploreLocation(state, p)

    expect(resolveTake(state, { wood: 2 }).ok).toBe(false)
    expect(resolveTake(state, { wood: 2, food: 2 }).ok).toBe(false)
    expect(state.resources.wood).toBe(0)
  })

  it('enforces the maximum of the same resource', () => {
    const { state, p } = game()
    stack(state, 'abandoned_camp')
    exploreLocation(state, p)

    const result = resolveTake(state, { wood: 3 })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/at most 2/i)
  })

  it('treats "2 different resources" as a max of 1 each', () => {
    const { state, p } = game()
    stack(state, 'quiet_clearing')
    exploreLocation(state, p)

    expect(state.pending.maxSame).toBe(1)
    expect(resolveTake(state, { food: 2 }).ok).toBe(false)
    expect(resolveTake(state, { food: 1, flint: 1 }).ok).toBe(true)
    expect(state.resources.food).toBe(1)
    expect(state.resources.flint).toBe(1)
  })

  it('runs the Danger after the take, not before', () => {
    const { state, p } = game()
    stack(state, 'abandoned_camp')

    exploreLocation(state, p)
    expect(state.pending.kind).toBe('take')

    resolveTake(state, { wood: 2, food: 1 })

    // Now the Danger: 1 Fear, or give one of the three back.
    expect(state.pending.kind).toBe('choice')
    resolveChoice(state, 1)
    expect(state.pending.kind).toBe('choice')

    // Which one to give back is also a decision, since three kinds were taken.
    resolveChoice(state, 0)
    expect(state.resources.wood + state.resources.food).toBe(2)
    expect(state.pending).toBeNull()
  })
})

describe('Map', () => {
  it('draws two and offers the choice', () => {
    const { state, p } = game()
    stack(state, 'savanna_open_plains', 'merm_spider_aftermath')
    const map = ready(state, p, 'map')

    const result = exploreLocation(state, p, { gearUid: map.uid })

    expect(result.pending).toBe(true)
    expect(state.pending.options.map((o) => o.label)).toEqual([
      'Savanna - Open Plains',
      'Merm-Spider Aftermath',
    ])
  })

  it('discovers the chosen one and bottoms the other', () => {
    const { state, p } = game()
    stack(state, 'savanna_open_plains', 'merm_spider_aftermath')
    const map = ready(state, p, 'map')

    exploreLocation(state, p, { gearUid: map.uid })
    resolveChoice(state, 1)

    expect(state.locations.explored.map((l) => l.id)).toEqual(['merm_spider_aftermath'])
    expect(state.resources.silk).toBe(1)
    expect(state.locations.deck.at(-1)).toBe('savanna_open_plains')
    // One card was discovered and one went back to the bottom, so 23 - 1 = 22.
    expect(state.locations.deck).toHaveLength(22)
  })

  it('spends the Map for the Day', () => {
    const { state, p } = game()
    const map = ready(state, p, 'map')

    exploreLocation(state, p, { gearUid: map.uid })

    expect(p.readyGear).toEqual([])
    expect(p.usedGear.map((c) => c.cardId)).toEqual(['map'])
  })

  it('refuses Gear that does not modify an Explore', () => {
    const { state, p } = game()
    const axe = ready(state, p, 'axe')

    const result = exploreLocation(state, p, { gearUid: axe.uid })

    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/does not modify an explore/i)
  })
})

/** Explores a known Location and answers any decisions it raises. */
function settle(state, player, id, ...answers) {
  stack(state, id)
  exploreLocation(state, player)
  for (const answer of answers) {
    if (state.pending?.kind === 'take') resolveTake(state, answer)
    else if (state.pending?.kind === 'choice') resolveChoice(state, answer)
  }
  return exploredById(state, id)
}

describe('gathering at a Location', () => {
  it('yields the Location Gather amount', () => {
    const { state, p } = game()
    settle(state, p, 'savanna_open_plains')

    const result = gatherAtLocation(state, p, 'savanna_open_plains')

    expect(result.ok).toBe(true)
    // 1 Grass from Discovery, 3 more from the Gather.
    expect(state.resources.grass).toBe(4)
  })

  it('allows only one Gather per Day, unlike Camp', () => {
    const { state, p } = game()
    settle(state, p, 'savanna_open_plains')

    gatherAtLocation(state, p, 'savanna_open_plains')
    const second = gatherAtLocation(state, p, 'savanna_open_plains')

    expect(second.ok).toBe(false)
    expect(second.reason).toMatch(/already gathered here today/i)
  })

  it('opens up again the next Day', () => {
    const { state, p } = game()
    settle(state, p, 'savanna_open_plains')
    gatherAtLocation(state, p, 'savanna_open_plains')

    state.day += 1

    expect(gatherAtLocation(state, p, 'savanna_open_plains').ok).toBe(true)
    expect(state.resources.grass).toBe(7)
  })

  it('refuses a Location that was never explored', () => {
    const { state, p } = game()
    const result = gatherAtLocation(state, p, 'savanna_open_plains')
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/not been explored/i)
  })

  it('refuses a Location with no repeatable Gather', () => {
    const { state, p } = game()
    settle(state, p, 'carrot_patch_rustling_grass', 1)

    const result = gatherAtLocation(state, p, 'carrot_patch_rustling_grass')
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/no repeatable gather/i)
  })
})

describe('Gather modifiers at a Location', () => {
  it('turns Boulder Field into 3 Flint with a Pickaxe', () => {
    const { state, p } = game()
    settle(state, p, 'boulder_field_loose_rocks', 1)
    const pickaxe = ready(state, p, 'pickaxe')

    gatherAtLocation(state, p, 'boulder_field_loose_rocks', { gearUid: pickaxe.uid })

    // 1 Flint from Discovery, then 2 + 1 from the Gather.
    expect(state.resources.flint).toBe(4)
  })

  it('refuses a modifier the Location cannot use', () => {
    const { state, p } = game()
    settle(state, p, 'savanna_open_plains')
    const pickaxe = ready(state, p, 'pickaxe')

    const result = gatherAtLocation(state, p, 'savanna_open_plains', { gearUid: pickaxe.uid })

    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/only helps when gathering flint/i)
  })
})

describe('Gear-gated Gathers', () => {
  it('refuses Rabbit Field without a Trap', () => {
    const { state, p } = game()
    settle(state, p, 'rabbit_field')

    const result = gatherAtLocation(state, p, 'rabbit_field')
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/needs a ready trap/i)
  })

  it('yields Food and spends the Trap when one is Ready', () => {
    const { state, p } = game()
    settle(state, p, 'rabbit_field')
    ready(state, p, 'trap')

    const result = gatherAtLocation(state, p, 'rabbit_field')

    expect(result.ok).toBe(true)
    expect(state.resources.food).toBe(3) // 1 Discovery + 2 Gather
    expect(p.usedGear.map((c) => c.cardId)).toEqual(['trap'])
  })

  it('needs a Fishing Rod for a Pond', () => {
    const { state, p } = game()
    settle(state, p, 'quiet_pond')

    expect(gatherAtLocation(state, p, 'quiet_pond').reason).toMatch(/fishing rod/i)

    ready(state, p, 'fishing_rod')
    expect(gatherAtLocation(state, p, 'quiet_pond').ok).toBe(true)
    expect(state.resources.food).toBe(4) // 1 Discovery + 3 Gather
  })
})

describe('renewable food cooldown', () => {
  // Harvested on Day D: unavailable D+1, available again at the start of D+2.
  it('rests for one full Day after harvest', () => {
    const { state, p } = game()
    settle(state, p, 'rabbit_field')
    ready(state, p, 'trap')

    expect(state.day).toBe(1)
    gatherAtLocation(state, p, 'rabbit_field')
    expect(exploredById(state, 'rabbit_field').availableOnDay).toBe(3)

    state.day = 2
    ready(state, p, 'trap')
    const dayTwo = gatherAtLocation(state, p, 'rabbit_field')
    expect(dayTwo.ok).toBe(false)
    expect(dayTwo.reason).toMatch(/resting until day 3/i)

    state.day = 3
    expect(gatherAtLocation(state, p, 'rabbit_field').ok).toBe(true)
  })
})

describe('Spider Den', () => {
  it('gives Silk and clears out when a Spear is spent', () => {
    const { state, p } = game()
    stack(state, 'spider_den')
    const spear = ready(state, p, 'spear')

    exploreLocation(state, p)
    resolveChoice(state, 0)

    expect(state.resources.silk).toBe(2)
    expect(exploredById(state, 'spider_den').cleared).toBe(true)
    expect(spear.uses).toBe(1)
  })

  it('costs Fear and stays uncleared when you back away', () => {
    const { state, p } = game()
    stack(state, 'spider_den')

    exploreLocation(state, p)
    resolveChoice(state, 1)

    expect(state.resources.silk).toBe(0)
    expect(fearCount(p)).toBe(1)
    expect(exploredById(state, 'spider_den').cleared).toBe(false)
  })

  it('can be cleared later by Gathering with a Spear', () => {
    const { state, p } = game()
    stack(state, 'spider_den')
    exploreLocation(state, p)
    resolveChoice(state, 1)

    state.day = 2
    ready(state, p, 'spear')
    const result = gatherAtLocation(state, p, 'spider_den')

    expect(result.ok).toBe(true)
    expect(state.resources.silk).toBe(2)
    expect(exploredById(state, 'spider_den').cleared).toBe(true)
  })

  it('has nothing left once cleared', () => {
    const { state, p } = game()
    stack(state, 'spider_den')
    ready(state, p, 'spear')
    exploreLocation(state, p)
    resolveChoice(state, 0)

    state.day = 2
    ready(state, p, 'spear')
    const result = gatherAtLocation(state, p, 'spider_den')

    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/cleared out/i)
  })
})

describe('Flower Meadow', () => {
  it('gives Grass instead when nobody has any Fear', () => {
    const { state, p } = game()
    settle(state, p, 'flower_meadow')

    expect(state.resources.grass).toBe(1)
  })

  it('removes Fear without asking when only one survivor has any', () => {
    const { state, p } = game()
    gainFearFor(state, p, 2)

    settle(state, p, 'flower_meadow')

    expect(fearCount(p)).toBe(1)
    expect(state.resources.grass).toBe(0)
  })

  it('asks which survivor when both have Fear', () => {
    const { state, p } = game()
    const other = state.players[1]
    gainFearFor(state, p, 1)
    gainFearFor(state, other, 1)

    stack(state, 'flower_meadow')
    exploreLocation(state, p)

    expect(state.pending.kind).toBe('choice')
    expect(state.pending.options.map((o) => o.label)).toEqual([p.name, other.name])

    resolveChoice(state, 1)
    expect(fearCount(other)).toBe(0)
    expect(fearCount(p)).toBe(1)
  })
})

describe('Berry Grove transplants', () => {
  it('becomes possible once a Grove is explored', () => {
    const { state, p } = game()
    state.resources.grass = 1
    ready(state, p, 'shovel')

    const before = buildStructure(state, p, 'transplanted_berry_bush')
    expect(before.ok).toBe(false)
    expect(before.reason).toMatch(/berry grove/i)

    settle(state, p, 'berry_grove_peaceful')
    expect(buildStructure(state, p, 'transplanted_berry_bush').ok).toBe(true)
    expect(state.camp.foodSources.map((f) => f.id)).toEqual(['transplanted_berry_bush'])
  })

  it('spends that Grove’s one and only transplant', () => {
    const { state, p } = game()
    state.resources.grass = 2
    settle(state, p, 'berry_grove_peaceful')

    ready(state, p, 'shovel')
    buildStructure(state, p, 'transplanted_berry_bush')

    expect(exploredById(state, 'berry_grove_peaceful').transplantUsed).toBe(true)

    ready(state, p, 'shovel')
    const second = buildStructure(state, p, 'transplanted_berry_bush')
    expect(second.ok).toBe(false)
    expect(second.reason).toMatch(/berry grove/i)
  })

  it('lets a second Grove supply a second bush', () => {
    const { state, p } = game()
    state.resources.grass = 2
    settle(state, p, 'berry_grove_peaceful')
    settle(state, p, 'berry_grove_thorny_brambles', 0)

    ready(state, p, 'shovel')
    expect(buildStructure(state, p, 'transplanted_berry_bush').ok).toBe(true)
    ready(state, p, 'shovel')
    expect(buildStructure(state, p, 'transplanted_berry_bush').ok).toBe(true)

    expect(state.camp.foodSources).toHaveLength(2)
  })

  it('keeps the Shovel, exhausting it only for the Day', () => {
    const { state, p } = game()
    state.resources.grass = 1
    settle(state, p, 'berry_grove_peaceful')
    const shovel = ready(state, p, 'shovel')

    buildStructure(state, p, 'transplanted_berry_bush')

    // Reusable Gear: used for the Day, but no durability and never removed.
    expect(p.usedGear.map((c) => c.uid)).toEqual([shovel.uid])
    expect(p.removed).toEqual([])
    expect(shovel.uses).toBeUndefined()
  })
})

describe('location options for the UI', () => {
  it('reports why each explored Location is or is not gatherable', () => {
    const { state, p } = game()
    settle(state, p, 'savanna_open_plains')
    settle(state, p, 'rabbit_field')

    const options = locationOptions(state, p)
    const plains = options.find((o) => o.id === 'savanna_open_plains')
    const rabbits = options.find((o) => o.id === 'rabbit_field')

    expect(plains.available).toBe(true)
    expect(plains.reason).toBeNull()
    expect(rabbits.available).toBe(false)
    expect(rabbits.reason).toMatch(/trap/i)
  })
})
