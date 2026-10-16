import { describe, it, expect } from 'vitest'
import { createGame } from './setup.js'
import { HANDLERS } from './actions.js'
import { abilityOptions, useAbility } from './abilities.js'
import { createGearCard, removableFearCount } from './gear.js'
import { gainFear } from './draw.js'
import { buildStructure } from './crafting.js'

function game(seed = 'abilities') {
  const state = createGame({ seed })
  return { state, p: state.players[0], other: state.players[1] }
}

function ready(state, player, gearId) {
  const card = createGearCard(state, gearId)
  player.readyGear.push(card)
  return card
}

function build(state, player, id, resources) {
  Object.assign(state.resources, resources)
  const result = buildStructure(state, player, id)
  if (!result.ok) throw new Error(`build failed: ${result.reason}`)
}

/** Recover goes through its action handler, where the Lean-To bonus lives. */
function recover(state, player) {
  return HANDLERS.recover.resolve(state, player, {})
}

describe('Lean-To', () => {
  it('heals 1 without one built', () => {
    const { state, p } = game()
    p.health = 1
    recover(state, p)
    expect(p.health).toBe(2)
  })

  it('makes the Day’s first healing Recover heal 3', () => {
    const { state, p } = game()
    build(state, p, 'lean_to', { wood: 3, grass: 4 })
    p.health = 1

    recover(state, p)

    expect(p.health).toBe(4)
    expect(state.log.some((e) => e.type === 'lean-to')).toBe(true)
  })

  it('only improves the first one each Day', () => {
    const { state, p, other } = game()
    build(state, p, 'lean_to', { wood: 3, grass: 4 })
    p.health = 1
    other.health = 1

    recover(state, p)
    recover(state, other)

    expect(p.health).toBe(4)
    expect(other.health).toBe(2)
  })

  it('refreshes the next Day', () => {
    const { state, p } = game()
    build(state, p, 'lean_to', { wood: 3, grass: 4 })
    p.health = 1
    recover(state, p)

    state.day = 2
    p.health = 1
    recover(state, p)

    expect(p.health).toBe(4)
  })

  it('is not burned by a Recover that heals nothing', () => {
    // RESOLVED 2026-10-14: a Recover at full Health is not a healing Recover.
    const { state, p, other } = game()
    build(state, p, 'lean_to', { wood: 3, grass: 4 })

    expect(p.health).toBe(5)
    recover(state, p)
    expect(p.health).toBe(5)

    other.health = 1
    recover(state, other)
    expect(other.health).toBe(4)
  })
})

describe('Small Campfire', () => {
  function lit(state, player, options) {
    const card = ready(state, player, 'small_campfire')
    const result = useAbility(state, player, {
      source: 'gear', id: 'small_campfire', uid: card.uid, options,
    })
    return { card, result }
  }

  it('adds Protection for tonight', () => {
    const { state, p } = game()
    const { result } = lit(state, p)

    expect(result.ok).toBe(true)
    expect(state.tonight.protection).toBe(2)
  })

  it('spends one of its two uses', () => {
    const { state, p } = game()
    const { card } = lit(state, p)

    expect(card.uses).toBe(1)
    expect(p.usedGear.map((c) => c.uid)).toEqual([card.uid])
  })

  it('shields the acting survivor by default', () => {
    const { state, p } = game()
    lit(state, p)

    expect(state.tonight.fearShields).toEqual([{ playerId: p.id, used: false }])
  })

  it('can shield the other survivor instead', () => {
    const { state, p, other } = game()
    lit(state, p, { shieldPlayerId: other.id })

    expect(state.tonight.fearShields[0].playerId).toBe(other.id)
  })

  it('absorbs exactly one Fear gained at Night', () => {
    const { state, p } = game()
    lit(state, p)

    const result = gainFear(state, p, 2, { night: true })

    expect(result.shielded).toBe(1)
    expect(result.gained).toBe(1)
    expect(removableFearCount(p)).toBe(1)
    expect(state.log.some((e) => e.type === 'fear-shielded')).toBe(true)
  })

  it('does nothing for Fear gained during the Day', () => {
    const { state, p } = game()
    lit(state, p)

    const result = gainFear(state, p, 1)

    expect(result.shielded).toBe(0)
    expect(removableFearCount(p)).toBe(1)
    expect(state.tonight.fearShields[0].used).toBe(false)
  })

  it('does not shield the survivor it was not pointed at', () => {
    const { state, p, other } = game()
    lit(state, p, { shieldPlayerId: other.id })

    gainFear(state, p, 1, { night: true })

    expect(removableFearCount(p)).toBe(1)
    expect(state.tonight.fearShields[0].used).toBe(false)
  })

  it('breaks after its second use', () => {
    const { state, p } = game()
    const { card } = lit(state, p)

    p.readyGear.push(p.usedGear.pop())
    useAbility(state, p, { source: 'gear', id: 'small_campfire', uid: card.uid })

    expect(p.removed.map((c) => c.uid)).toEqual([card.uid])
    expect(state.tonight.protection).toBe(4)
  })
})

describe('Tent', () => {
  function withTent(state, player) {
    build(state, player, 'tent', { wood: 3, grass: 5 })
    state.resources.food = 1
  }

  function useTent(state, player) {
    return useAbility(state, player, { source: 'camp', id: 'tent' })
  }

  it('sheds up to 3 Fear for 1 Food', () => {
    const { state, p } = game()
    withTent(state, p)
    gainFear(state, p, 5)

    const result = useTent(state, p)

    expect(result.ok).toBe(true)
    expect(removableFearCount(p)).toBe(2)
    expect(state.resources.food).toBe(0)
  })

  it('takes what it can when there is less than 3', () => {
    const { state, p } = game()
    withTent(state, p)
    gainFear(state, p, 1)

    useTent(state, p)

    expect(removableFearCount(p)).toBe(0)
    expect(state.resources.food).toBe(0)
  })

  it('only works once a Day', () => {
    const { state, p } = game()
    withTent(state, p)
    state.resources.food = 2
    gainFear(state, p, 6)

    expect(useTent(state, p).ok).toBe(true)
    const second = useTent(state, p)

    expect(second.ok).toBe(false)
    expect(second.reason).toMatch(/already been used today/i)
    expect(state.resources.food).toBe(1)
  })

  it('comes back the next Day', () => {
    const { state, p } = game()
    withTent(state, p)
    state.resources.food = 2
    gainFear(state, p, 6)

    useTent(state, p)
    state.day = 2

    expect(useTent(state, p).ok).toBe(true)
    expect(removableFearCount(p)).toBe(0)
  })

  it('is unavailable without the Food', () => {
    const { state, p } = game()
    withTent(state, p)
    state.resources.food = 0
    gainFear(state, p, 2)

    const tent = abilityOptions(state, p).find((a) => a.id === 'tent')
    expect(tent.available).toBe(false)
    expect(tent.reason).toMatch(/needs 1 food/i)
  })

  it('is unavailable with no Fear to shed', () => {
    const { state, p } = game()
    withTent(state, p)

    const tent = abilityOptions(state, p).find((a) => a.id === 'tent')
    expect(tent.available).toBe(false)
    expect(tent.reason).toMatch(/no fear/i)
  })

  it('only touches the acting survivor’s own deck', () => {
    const { state, p, other } = game()
    withTent(state, p)
    gainFear(state, p, 2)
    gainFear(state, other, 2)

    useTent(state, p)

    expect(removableFearCount(p)).toBe(0)
    expect(removableFearCount(other)).toBe(2)
  })
})

describe('Garland’s second use', () => {
  /** A Garland that has already spent its craft-use, now Ready again. */
  function drawnGarland(state, player) {
    const card = createGearCard(state, 'garland')
    card.uses = 1
    player.readyGear.push(card)
    return card
  }

  it('removes 1 Fear and then leaves the game', () => {
    const { state, p } = game()
    const card = drawnGarland(state, p)
    gainFear(state, p, 2)

    const result = useAbility(state, p, { source: 'gear', id: 'garland', uid: card.uid })

    expect(result.ok).toBe(true)
    expect(removableFearCount(p)).toBe(1)
    // `removed` holds both the Fear it shed and the Garland itself.
    expect(p.removed.map((c) => c.uid)).toContain(card.uid)
    expect(p.removed.filter((c) => c.kind === 'fear')).toHaveLength(1)
    expect(p.readyGear).toEqual([])
    expect(p.usedGear).toEqual([])
  })

  it('is declined rather than wasted when there is no Fear', () => {
    // Unlike the craft-use, this one is optional.
    const { state, p } = game()
    const card = drawnGarland(state, p)

    const offered = abilityOptions(state, p).find((a) => a.uid === card.uid)
    expect(offered.available).toBe(false)
    expect(offered.reason).toMatch(/no fear/i)

    const result = useAbility(state, p, { source: 'gear', id: 'garland', uid: card.uid })
    expect(result.ok).toBe(false)
    expect(p.removed).toEqual([])
  })
})

describe('what is on offer', () => {
  it('lists nothing when the survivor has no abilities', () => {
    const { state, p } = game()
    expect(abilityOptions(state, p)).toEqual([])
  })

  it('lists Ready action Gear and built Camp abilities together', () => {
    const { state, p } = game()
    ready(state, p, 'small_campfire')
    build(state, p, 'tent', { wood: 3, grass: 5 })
    state.resources.food = 1
    gainFear(state, p, 1)

    const names = abilityOptions(state, p).map((a) => a.name)
    expect(names).toEqual(['Small Campfire', 'Tent'])
    expect(abilityOptions(state, p).every((a) => a.available)).toBe(true)
  })

  it('ignores Gear that is not an action ability', () => {
    const { state, p } = game()
    ready(state, p, 'axe')
    ready(state, p, 'spear')

    expect(abilityOptions(state, p)).toEqual([])
  })
})
