import { describe, it, expect } from 'vitest'
import { createGame } from './setup.js'
import { buildStructure } from './crafting.js'
import { harvestFoodSource, foodSourceOptions, foodSourceByUid } from './food.js'
import { createGearCard } from './gear.js'
import { exploreLocation } from './locations.js'
import { CONSTANTS } from '../data/constants.js'

function game(seed = 'food') {
  const state = createGame({ seed })
  return { state, p: state.players[0] }
}

function give(state, resources) {
  Object.assign(state.resources, resources)
}

/** Builds a Farm and returns its record. */
function farm(state, player) {
  give(state, { wood: 2, grass: 3, flint: 1 })
  buildStructure(state, player, 'simple_farm')
  return state.camp.foodSources.at(-1)
}

/** Explores a Berry Grove and transplants a bush from it. */
function bush(state, player) {
  state.locations.deck = ['berry_grove_peaceful', ...state.locations.deck]
  exploreLocation(state, player)
  give(state, { grass: 1 })
  player.readyGear.push(createGearCard(state, 'shovel'))
  buildStructure(state, player, 'transplanted_berry_bush')
  return state.camp.foodSources.at(-1)
}

describe('Food is never gatherable at Camp', () => {
  it('leaves Food out of the Camp Gather list entirely', () => {
    expect(CONSTANTS.gather.campResources).not.toContain('food')
    expect(CONSTANTS.gather.campResources).toEqual(['wood', 'grass', 'flint'])
  })
})

describe('harvesting a Farm', () => {
  it('yields its Food', () => {
    const { state, p } = game()
    const plot = farm(state, p)
    state.resources.food = 0

    const result = harvestFoodSource(state, p, plot.uid)

    expect(result.ok).toBe(true)
    expect(result.amount).toBe(3)
    expect(state.resources.food).toBe(3)
  })

  it('records when it was harvested and when it returns', () => {
    const { state, p } = game()
    const plot = farm(state, p)
    state.day = 4

    harvestFoodSource(state, p, plot.uid)

    expect(plot.harvestedOnDay).toBe(4)
    expect(plot.availableOnDay).toBe(6)
  })

  it('refuses an unknown food source', () => {
    const { state, p } = game()
    const result = harvestFoodSource(state, p, 'nope')
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/no such food source/i)
  })
})

describe('harvesting a Transplanted Berry Bush', () => {
  it('yields less than a Farm, matching the food hierarchy', () => {
    const { state, p } = game()
    const planted = bush(state, p)
    state.resources.food = 0

    expect(harvestFoodSource(state, p, planted.uid).amount).toBe(2)
    expect(state.resources.food).toBe(2)
  })
})

describe('the renewable cooldown', () => {
  // harvested Day D -> unavailable D+1 -> available again at the start of D+2
  it('rests for exactly one full Day', () => {
    const { state, p } = game()
    const plot = farm(state, p)
    state.resources.food = 0

    expect(state.day).toBe(1)
    expect(harvestFoodSource(state, p, plot.uid).ok).toBe(true)

    const sameDay = harvestFoodSource(state, p, plot.uid)
    expect(sameDay.ok).toBe(false)
    expect(sameDay.reason).toMatch(/resting until day 3/i)

    state.day = 2
    const nextDay = harvestFoodSource(state, p, plot.uid)
    expect(nextDay.ok).toBe(false)
    expect(nextDay.reason).toMatch(/resting until day 3/i)

    state.day = 3
    expect(harvestFoodSource(state, p, plot.uid).ok).toBe(true)
    expect(state.resources.food).toBe(6)
  })

  it('lets two Farms rest independently', () => {
    const { state, p } = game()
    const first = farm(state, p)
    const second = farm(state, p)
    state.resources.food = 0

    expect(first.uid).not.toBe(second.uid)

    harvestFoodSource(state, p, first.uid)
    // The second is untouched and still ready the same Day.
    expect(harvestFoodSource(state, p, second.uid).ok).toBe(true)
    expect(state.resources.food).toBe(6)
  })
})

describe('food source options', () => {
  it('reports what is ready and what is resting', () => {
    const { state, p } = game()
    const plot = farm(state, p)

    let options = foodSourceOptions(state)
    expect(options).toHaveLength(1)
    expect(options[0]).toMatchObject({ name: 'Simple Farm Plot', yield: 3, available: true })

    harvestFoodSource(state, p, plot.uid)
    options = foodSourceOptions(state)

    expect(options[0].available).toBe(false)
    expect(options[0].reason).toMatch(/resting/i)
  })

  it('lists a Bush and a Farm side by side', () => {
    const { state, p } = game()
    bush(state, p)
    farm(state, p)

    const names = foodSourceOptions(state).map((o) => o.name)
    expect(names).toEqual(['Transplanted Berry Bush', 'Simple Farm Plot'])
  })
})

describe('the whole Berry route end to end', () => {
  it('explore a Grove, transplant it, then harvest on a cycle', () => {
    const { state, p } = game()
    state.resources.food = 0

    const planted = bush(state, p)
    // The Grove's Discovery gave 2 Food before any harvesting.
    expect(state.resources.food).toBe(2)
    expect(foodSourceByUid(state, planted.uid)).toBeDefined()

    harvestFoodSource(state, p, planted.uid)
    expect(state.resources.food).toBe(4)

    state.day = 3
    harvestFoodSource(state, p, planted.uid)
    expect(state.resources.food).toBe(6)

    // The Grove itself gave up its only transplant.
    expect(state.locations.explored[0].transplantUsed).toBe(true)
  })
})
