import { describe, it, expect } from 'vitest'
import { createGame } from './setup.js'
import { makeCard, totalCards } from './state.js'
import {
  refillHand,
  endOfDayCleanup,
  reshuffleDiscard,
  gainFear,
  usableHand,
  fearCount,
} from './draw.js'
import { GEAR_BY_ID } from '../data/gear.js'
import { CONSTANTS } from '../data/constants.js'

function kindOf(cardId) {
  if (cardId === 'fear') return 'fear'
  return GEAR_BY_ID[cardId] ? 'gear' : 'starter'
}

/** Replaces a survivor's draw pile with an exact, ordered stack. */
function stackDeck(state, player, cardIds) {
  player.draw = cardIds.map((id) => makeCard(state, id, kindOf(id)))
}

function game(seed = 'draw-test') {
  const state = createGame({ seed })
  return { state, p: state.players[0] }
}

describe('basic draw', () => {
  it('fills the hand to 5', () => {
    const { state, p } = game()
    refillHand(state, p)
    expect(p.hand).toHaveLength(5)
    expect(p.draw).toHaveLength(3)
  })

  it('is deterministic for a seed', () => {
    const a = game('same-seed')
    const b = game('same-seed')
    refillHand(a.state, a.p)
    refillHand(b.state, b.p)
    expect(a.p.hand.map((c) => c.cardId)).toEqual(b.p.hand.map((c) => c.cardId))
  })
})

describe('Gear replacement draw', () => {
  it('never lets Gear consume a hand slot', () => {
    const { state, p } = game()
    stackDeck(state, p, ['axe', 'gather', 'gather', 'explore', 'prepare', 'recover'])

    const readied = refillHand(state, p)

    expect(p.hand).toHaveLength(5)
    expect(p.hand.every((c) => c.kind !== 'gear')).toBe(true)
    expect(p.readyGear.map((c) => c.cardId)).toEqual(['axe'])
    expect(readied.map((c) => c.cardId)).toEqual(['axe'])
  })

  it('refills correctly when several Gear arrive in a row', () => {
    const { state, p } = game()
    stackDeck(state, p, [
      'axe', 'pickaxe', 'map',
      'gather', 'gather', 'explore', 'prepare', 'recover',
    ])

    refillHand(state, p)

    expect(p.hand).toHaveLength(5)
    expect(p.readyGear).toHaveLength(3)
    expect(p.readyGear.map((c) => c.cardId)).toEqual(['axe', 'pickaxe', 'map'])
  })

  it('handles Gear interleaved with action cards', () => {
    const { state, p } = game()
    stackDeck(state, p, [
      'gather', 'spear', 'explore', 'torch', 'prepare', 'recover', 'gather',
    ])

    refillHand(state, p)

    expect(p.hand).toHaveLength(5)
    expect(p.readyGear.map((c) => c.cardId)).toEqual(['spear', 'torch'])
  })
})

describe('Fear in hand', () => {
  it('occupies a hand slot like any other card', () => {
    const { state, p } = game()
    stackDeck(state, p, ['fear', 'fear', 'gather', 'explore', 'prepare', 'recover'])

    refillHand(state, p)

    expect(p.hand).toHaveLength(5)
    expect(p.hand.filter((c) => c.kind === 'fear')).toHaveLength(2)
  })

  it('reduces the number of cards that can actually be played', () => {
    const { state, p } = game()
    stackDeck(state, p, ['fear', 'fear', 'gather', 'explore', 'prepare', 'recover'])

    refillHand(state, p)

    expect(usableHand(p)).toHaveLength(3)
  })

  it('gained Fear goes to the discard pile, not the hand', () => {
    const { state, p } = game()
    const before = p.hand.length

    gainFear(state, p, 2)

    expect(p.hand).toHaveLength(before)
    expect(p.discard.filter((c) => c.kind === 'fear')).toHaveLength(2)
    expect(fearCount(p)).toBe(2)
  })
})

describe('Backpack', () => {
  it('raises the hand target to 6', () => {
    const { state, p } = game()
    stackDeck(state, p, [
      'backpack', 'gather', 'gather', 'explore', 'prepare', 'recover', 'gather',
    ])

    refillHand(state, p)

    expect(p.hand).toHaveLength(6)
    expect(p.readyGear.map((c) => c.cardId)).toEqual(['backpack'])
  })

  it('still applies Gear replacement to the extra card', () => {
    const { state, p } = game()
    stackDeck(state, p, [
      'backpack', 'gather', 'gather', 'explore', 'prepare', 'axe', 'recover', 'gather',
    ])

    refillHand(state, p)

    expect(p.hand).toHaveLength(6)
    expect(p.readyGear.map((c) => c.cardId)).toEqual(['backpack', 'axe'])
  })

  it('caps the bonus at one extra card, however many Backpacks are Ready', () => {
    const { state, p } = game()
    stackDeck(state, p, [
      'backpack', 'backpack',
      'gather', 'gather', 'explore', 'prepare', 'recover', 'gather', 'explore',
    ])

    refillHand(state, p)

    // Both Backpacks ready, but the hand stops at 6.
    expect(p.readyGear).toHaveLength(2)
    expect(p.hand).toHaveLength(6)
  })

  it('logs the bonus only once when a second Backpack adds nothing', () => {
    const { state, p } = game()
    stackDeck(state, p, [
      'backpack', 'backpack',
      'gather', 'gather', 'explore', 'prepare', 'recover', 'gather', 'explore',
    ])

    refillHand(state, p)

    expect(state.log.filter((e) => e.type === 'draw-bonus')).toHaveLength(1)
  })

  it('can be made to stack again by flipping the constant', () => {
    const constants = structuredClone(CONSTANTS)
    constants.draw.extraCardStacks = true

    const state = createGame({ seed: 'stacking', constants })
    const p = state.players[0]
    stackDeck(state, p, [
      'backpack', 'backpack',
      'gather', 'gather', 'explore', 'prepare', 'recover', 'gather', 'explore',
    ])

    refillHand(state, p)

    expect(p.hand).toHaveLength(7)
  })
})

describe('reshuffling', () => {
  it('reshuffles the discard pile when the draw pile runs dry', () => {
    const { state, p } = game()

    p.discard = p.draw
    p.draw = []

    refillHand(state, p)

    expect(p.hand).toHaveLength(5)
    expect(state.log.some((e) => e.type === 'reshuffle')).toBe(true)
  })

  it('reports failure rather than reshuffling nothing', () => {
    const { state, p } = game()
    p.discard = []
    expect(reshuffleDiscard(state, p)).toBe(false)
  })

  it('mid-draw reshuffle still produces a full hand', () => {
    const { state, p } = game()

    // Two cards available, three more waiting in the discard.
    p.discard = p.draw.splice(0, 6)
    expect(p.draw).toHaveLength(2)

    refillHand(state, p)

    expect(p.hand).toHaveLength(5)
  })
})

describe('end-of-Day cleanup', () => {
  it('sends hand, played and both Gear areas to the discard pile', () => {
    const { state, p } = game()
    stackDeck(state, p, ['axe', 'gather', 'gather', 'explore', 'prepare', 'recover'])
    refillHand(state, p)

    // Pretend one card was played and the Axe was used.
    p.played.push(p.hand.pop())
    p.usedGear.push(p.readyGear.pop())

    endOfDayCleanup(state, p)

    expect(p.hand).toEqual([])
    expect(p.played).toEqual([])
    expect(p.readyGear).toEqual([])
    expect(p.usedGear).toEqual([])
    expect(p.discard.length).toBeGreaterThan(0)
  })

  it('leaves permanently removed cards out of the cycle', () => {
    const { state, p } = game()
    refillHand(state, p)

    p.removed.push(p.hand.pop())
    const removedUid = p.removed[0].uid

    endOfDayCleanup(state, p)

    expect(p.removed).toHaveLength(1)
    expect(p.discard.some((c) => c.uid === removedUid)).toBe(false)
  })
})

describe('deck cycling over several Days', () => {
  it('conserves every card across repeated draw/cleanup cycles', () => {
    const { state, p } = game()
    const startingTotal = totalCards(p)

    for (let day = 0; day < 6; day++) {
      refillHand(state, p)
      endOfDayCleanup(state, p)
    }

    expect(totalCards(p)).toBe(startingTotal)
  })

  it('keeps dealing a full hand every Day', () => {
    const { state, p } = game()

    for (let day = 0; day < 6; day++) {
      refillHand(state, p)
      expect(p.hand).toHaveLength(5)
      endOfDayCleanup(state, p)
    }
  })

  it('never exhausts the deck, because starter cards are never removed', () => {
    const { state, p } = game()

    // Fear only ever makes the deck bigger, so the 8-card floor holds.
    for (let day = 0; day < 10; day++) {
      refillHand(state, p)
      gainFear(state, p, 1)
      endOfDayCleanup(state, p)
      expect(totalCards(p)).toBeGreaterThanOrEqual(8)
    }

    expect(fearCount(p)).toBe(10)
  })

  it('grows the deck as Fear accumulates, clogging more hand slots over time', () => {
    const { state, p } = game()

    for (let day = 0; day < 8; day++) {
      refillHand(state, p)
      gainFear(state, p, 2)
      endOfDayCleanup(state, p)
    }

    refillHand(state, p)

    // 8 starters + 16 Fear: a hand of 5 is now mostly dead cards.
    expect(totalCards(p)).toBe(24)
    expect(usableHand(p).length).toBeLessThan(5)
  })
})

describe('event log', () => {
  // CLAUDE.md requires every draw, shuffle, Fear change and cleanup to be
  // logged. These assert that, so the requirement cannot quietly rot.
  it('records each draw with the cards that landed in hand', () => {
    const { state, p } = game()
    refillHand(state, p)

    const event = state.log.find((e) => e.type === 'draw')
    expect(event).toBeDefined()
    expect(event.playerId).toBe(p.id)
    expect(event.cards).toHaveLength(5)
    expect(event.cards).toEqual(p.hand.map((c) => c.cardId))
  })

  it('records Gear readied during the draw', () => {
    const { state, p } = game()
    stackDeck(state, p, ['axe', 'gather', 'gather', 'explore', 'prepare', 'recover'])
    refillHand(state, p)

    expect(state.log.some((e) => e.type === 'gear-readied' && e.cardId === 'axe')).toBe(true)
    expect(state.log.find((e) => e.type === 'draw').gearReadied).toEqual(['axe'])
  })

  it('records the Backpack bonus separately from the draw', () => {
    const { state, p } = game()
    stackDeck(state, p, [
      'backpack', 'gather', 'gather', 'explore', 'prepare', 'recover', 'gather',
    ])
    refillHand(state, p)

    const bonus = state.log.find((e) => e.type === 'draw-bonus')
    expect(bonus).toBeDefined()
    expect(bonus.newTarget).toBe(6)
  })

  it('records Fear gains and cleanups', () => {
    const { state, p } = game()
    refillHand(state, p)
    gainFear(state, p, 2)
    endOfDayCleanup(state, p)

    expect(state.log.find((e) => e.type === 'fear-gained').amount).toBe(2)
    expect(state.log.some((e) => e.type === 'cleanup')).toBe(true)
  })

  it('stamps every event with the Day it happened on', () => {
    const { state, p } = game()
    refillHand(state, p)
    expect(state.log.every((e) => e.day === 1)).toBe(true)
  })
})
