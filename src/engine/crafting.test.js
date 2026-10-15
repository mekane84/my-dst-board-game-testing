import { describe, it, expect } from 'vitest'
import { createGame } from './setup.js'
import {
  craftGear,
  buildStructure,
  canAfford,
  missingFor,
  majorImprovementCount,
  workOptions,
} from './crafting.js'
import { createGearCard, removableFearCount } from './gear.js'
import { gainFear } from './draw.js'

function game(seed = 'crafting') {
  const state = createGame({ seed })
  return { state, p: state.players[0] }
}

function give(state, resources) {
  Object.assign(state.resources, resources)
}

describe('paying costs', () => {
  it('reports exactly what is short', () => {
    const { state } = game()
    give(state, { wood: 1 })
    expect(canAfford(state, { wood: 1, flint: 1 })).toBe(false)
    expect(missingFor(state, { wood: 1, flint: 1 })).toEqual({ flint: 1 })
  })

  it('treats an affordable cost as affordable', () => {
    const { state } = game()
    give(state, { wood: 3, flint: 2 })
    expect(canAfford(state, { wood: 3, flint: 2 })).toBe(true)
    expect(missingFor(state, { wood: 3, flint: 2 })).toEqual({})
  })
})

describe('crafting Gear', () => {
  it('spends the cost and readies the Gear the same Day', () => {
    const { state, p } = game()
    give(state, { wood: 1, flint: 1 })

    expect(craftGear(state, p, 'axe').ok).toBe(true)
    expect(state.resources.wood).toBe(0)
    expect(state.resources.flint).toBe(0)
    expect(p.readyGear.map((c) => c.cardId)).toEqual(['axe'])
  })

  it('refuses when the team cannot pay, and spends nothing', () => {
    const { state, p } = game()
    give(state, { wood: 1 })

    const result = craftGear(state, p, 'axe')
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/missing 1 flint/i)
    expect(state.resources.wood).toBe(1)
    expect(p.readyGear).toEqual([])
  })

  it('gives two-use Gear its durability', () => {
    const { state, p } = game()
    give(state, { wood: 2, flint: 1 })

    craftGear(state, p, 'spear')
    expect(p.readyGear[0].uses).toBe(2)
  })

  it('gives reusable Gear no durability counter at all', () => {
    const { state, p } = game()
    give(state, { wood: 1, flint: 1 })

    craftGear(state, p, 'axe')
    expect(p.readyGear[0].uses).toBeUndefined()
  })

  it('rejects an unknown Gear id', () => {
    const { state, p } = game()
    expect(craftGear(state, p, 'jetpack').ok).toBe(false)
  })

  it('allows a second copy of the same Gear', () => {
    const { state, p } = game()
    give(state, { wood: 2, flint: 2 })

    expect(craftGear(state, p, 'axe').ok).toBe(true)
    expect(craftGear(state, p, 'axe').ok).toBe(true)
    expect(p.readyGear).toHaveLength(2)
  })
})

describe('Garland', () => {
  it('removes 1 Fear on craft and spends that use immediately', () => {
    const { state, p } = game()
    give(state, { grass: 3 })
    gainFear(state, p, 2)

    craftGear(state, p, 'garland')

    expect(removableFearCount(p)).toBe(1)
    // Craft-use spent: durability down to 1, and exhausted for the Day.
    const garland = p.usedGear.find((c) => c.cardId === 'garland')
    expect(garland).toBeDefined()
    expect(garland.uses).toBe(1)
    expect(p.readyGear).toEqual([])
  })

  it('wastes the craft-use when there is no Fear to remove', () => {
    const { state, p } = game()
    give(state, { grass: 3 })

    craftGear(state, p, 'garland')

    // RESOLVED 2026-10-14: the use is spent either way.
    const garland = p.usedGear.find((c) => c.cardId === 'garland')
    expect(garland.uses).toBe(1)
    expect(state.log.some((e) => e.type === 'garland-wasted')).toBe(true)
  })
})

describe('building Camp Improvements', () => {
  it('records the build and the Day it happened', () => {
    const { state, p } = game()
    give(state, { wood: 3, flint: 2 })
    state.day = 4

    expect(buildStructure(state, p, 'fire_pit').ok).toBe(true)
    expect(state.camp.improvements.fire_pit).toEqual({ id: 'fire_pit', builtOnDay: 4 })
    expect(state.resources.wood).toBe(0)
  })

  it('allows only one of each major improvement', () => {
    const { state, p } = game()
    give(state, { wood: 6, flint: 4 })

    expect(buildStructure(state, p, 'fire_pit').ok).toBe(true)
    const second = buildStructure(state, p, 'fire_pit')
    expect(second.ok).toBe(false)
    expect(second.reason).toMatch(/already built/i)
  })

  it('counts majors for the 2-3 balance target', () => {
    const { state, p } = game()
    give(state, { wood: 10, flint: 5, grass: 10 })

    buildStructure(state, p, 'fire_pit')
    buildStructure(state, p, 'lean_to')

    expect(majorImprovementCount(state)).toBe(2)
  })
})

describe('food infrastructure', () => {
  it('builds a Farm into the shared food sources, not the improvements map', () => {
    const { state, p } = game()
    give(state, { wood: 2, grass: 3, flint: 1 })

    expect(buildStructure(state, p, 'simple_farm').ok).toBe(true)
    expect(state.camp.foodSources).toHaveLength(1)
    expect(state.camp.foodSources[0].availableOnDay).toBeNull()
    expect(majorImprovementCount(state)).toBe(0)
  })

  it('allows more than one Farm', () => {
    const { state, p } = game()
    give(state, { wood: 4, grass: 6, flint: 2 })

    buildStructure(state, p, 'simple_farm')
    buildStructure(state, p, 'simple_farm')
    expect(state.camp.foodSources).toHaveLength(2)
  })

  it('refuses a Berry Bush transplant without a Ready Shovel', () => {
    const { state, p } = game()
    give(state, { grass: 1 })

    const result = buildStructure(state, p, 'transplanted_berry_bush')
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/shovel/i)
  })

  it('refuses a transplant with a Shovel but no explored Berry Grove', () => {
    const { state, p } = game()
    give(state, { grass: 1 })
    p.readyGear.push(createGearCard(state, 'shovel'))

    const result = buildStructure(state, p, 'transplanted_berry_bush')
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/phase 5/i)
  })
})

describe('work options', () => {
  it('annotates every craft and build with whether it is affordable', () => {
    const { state, p } = game()
    give(state, { wood: 1, flint: 1 })

    const options = workOptions(state, p)
    const axe = options.find((o) => o.id === 'axe')
    const palisade = options.find((o) => o.id === 'palisade')

    expect(axe.available).toBe(true)
    expect(palisade.available).toBe(false)
    expect(palisade.reason).toMatch(/missing/i)
  })

  it('marks an already-built improvement as unavailable', () => {
    const { state, p } = game()
    give(state, { wood: 6, flint: 4 })
    buildStructure(state, p, 'fire_pit')

    const firePit = workOptions(state, p).find((o) => o.id === 'fire_pit')
    expect(firePit.available).toBe(false)
    expect(firePit.reason).toMatch(/already built/i)
  })
})
