import { describe, it, expect } from 'vitest'
import { createGame } from './setup.js'
import { loseHealth, healHealth, loseHunger, resolveMeal, checkDefeat } from './survivor.js'
import { createGearCard } from './gear.js'

function game(seed = 'survivor') {
  const state = createGame({ seed })
  return { state, p: state.players[0] }
}

describe('Health', () => {
  it('subtracts damage and reports it', () => {
    const { state, p } = game()
    const result = loseHealth(state, p, 2, { source: 'test' })
    expect(p.health).toBe(3)
    expect(result.lost).toBe(2)
  })

  it('never drops below zero', () => {
    const { state, p } = game()
    loseHealth(state, p, 99)
    expect(p.health).toBe(0)
  })

  it('heals up to the cap and no further', () => {
    const { state, p } = game()
    p.health = 4
    expect(healHealth(state, p, 5).healed).toBe(1)
    expect(p.health).toBe(5)
  })

  it('reports healing nothing when already full', () => {
    const { state, p } = game()
    expect(healHealth(state, p, 1).healed).toBe(0)
  })
})

describe('Hunger at zero converts to Health', () => {
  // RESOLVED 2026-10-14: this applies to EVERY source of Hunger loss, not just
  // a skipped meal, so one helper enforces it for Night cards and Locations too.
  it('spends Hunger while there is any', () => {
    const { state, p } = game()
    const result = loseHunger(state, p, 1, { source: 'test' })

    expect(p.hunger).toBe(1)
    expect(p.health).toBe(5)
    expect(result.hungerLost).toBe(1)
  })

  it('costs Health once Hunger is exhausted', () => {
    const { state, p } = game()
    p.hunger = 0

    const result = loseHunger(state, p, 1, { source: 'test' })

    expect(p.hunger).toBe(0)
    expect(p.health).toBe(4)
    expect(result.healthLost).toBe(1)
  })

  it('splits a multi-point loss across the boundary', () => {
    const { state, p } = game()
    p.hunger = 1

    const result = loseHunger(state, p, 3, { source: 'test' })

    expect(p.hunger).toBe(0)
    expect(p.health).toBe(3)
    expect(result.hungerLost).toBe(1)
    expect(result.healthLost).toBe(2)
  })

  it('logs starvation distinctly from other damage', () => {
    const { state, p } = game()
    p.hunger = 0
    loseHunger(state, p, 1)
    expect(state.log.some((e) => e.type === 'health-lost' && e.source === 'starvation')).toBe(true)
  })
})

describe('meals', () => {
  it('eating spends 1 shared Food and prevents the loss entirely', () => {
    const { state, p } = game()
    state.resources.food = 1

    const result = resolveMeal(state, p, { eat: true })

    expect(result.ok).toBe(true)
    expect(state.resources.food).toBe(0)
    expect(p.hunger).toBe(2)
  })

  it('refuses to eat with no Food in the pool', () => {
    const { state, p } = game()
    expect(resolveMeal(state, p, { eat: true }).ok).toBe(false)
  })

  it('skipping a meal costs Hunger', () => {
    const { state, p } = game()
    resolveMeal(state, p, { eat: false })
    expect(p.hunger).toBe(1)
  })

  it('eating does not refill Hunger already spent', () => {
    const { state, p } = game()
    p.hunger = 0
    state.resources.food = 1

    resolveMeal(state, p, { eat: true })

    // Hunger is a one-way buffer: eating prevents loss, it does not restore.
    expect(p.hunger).toBe(0)
  })
})

describe('Log Suit prevention', () => {
  function withLogSuit(state, player) {
    const card = createGearCard(state, 'log_suit')
    player.readyGear.push(card)
    return card
  }

  it('prevents 1 Health loss per use spent', () => {
    const { state, p } = game()
    const suit = withLogSuit(state, p)

    const result = loseHealth(state, p, 2, { preventWith: [suit.uid] })

    expect(result.prevented).toBe(1)
    expect(result.lost).toBe(1)
    expect(p.health).toBe(4)
  })

  it('spends durability and breaks after the second use', () => {
    const { state, p } = game()
    const suit = withLogSuit(state, p)

    loseHealth(state, p, 1, { preventWith: [suit.uid] })
    expect(suit.uses).toBe(1)

    // Re-ready it, as a fresh Day would.
    p.readyGear.push(p.usedGear.pop())
    loseHealth(state, p, 1, { preventWith: [suit.uid] })

    expect(p.removed.some((c) => c.uid === suit.uid)).toBe(true)
    expect(p.health).toBe(5)
  })

  it('refuses more prevention than there is damage', () => {
    const { state, p } = game()
    const suit = withLogSuit(state, p)

    const result = loseHealth(state, p, 0, { preventWith: [suit.uid] })
    expect(result.lost).toBe(0)

    const tooMuch = loseHealth(state, p, 1, { preventWith: [suit.uid, suit.uid] })
    expect(tooMuch.ok).toBe(false)
  })

  it('rejects Gear that is not a Log Suit', () => {
    const { state, p } = game()
    const axe = createGearCard(state, 'axe')
    p.readyGear.push(axe)

    const result = loseHealth(state, p, 1, { preventWith: [axe.uid] })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/only a log suit/i)
    expect(p.health).toBe(5)
  })
})

describe('defeat', () => {
  it('loses the game for the team the moment any survivor hits 0', () => {
    const { state, p } = game()
    loseHealth(state, p, 5)
    expect(state.status).toBe('lost')
  })

  it('is unaffected while everyone is above 0', () => {
    const { state, p } = game()
    loseHealth(state, p, 4)
    expect(checkDefeat(state)).toBe('playing')
  })
})
