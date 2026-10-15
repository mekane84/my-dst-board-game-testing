import { describe, it, expect } from 'vitest'
import { createGame } from './setup.js'
import { makeCard } from './state.js'
import {
  createGearCard,
  useGear,
  findReadyGear,
  hasReadyGear,
  eligibleModifier,
  removeFear,
  removableFearCount,
} from './gear.js'
import { refillHand, gainFear } from './draw.js'

function game(seed = 'gear') {
  const state = createGame({ seed })
  return { state, p: state.players[0] }
}

function ready(state, player, gearId) {
  const card = createGearCard(state, gearId)
  player.readyGear.push(card)
  return card
}

describe('reusable Gear', () => {
  it('moves to the used area once its effect fires', () => {
    const { state, p } = game()
    const axe = ready(state, p, 'axe')

    expect(useGear(state, p, axe.uid).ok).toBe(true)
    expect(p.readyGear).toEqual([])
    expect(p.usedGear.map((c) => c.uid)).toEqual([axe.uid])
  })

  it('cannot be used twice in one Day', () => {
    const { state, p } = game()
    const axe = ready(state, p, 'axe')
    useGear(state, p, axe.uid)

    const second = useGear(state, p, axe.uid)
    expect(second.ok).toBe(false)
    expect(second.reason).toMatch(/not ready/i)
  })

  it('is never destroyed by normal use', () => {
    const { state, p } = game()
    const axe = ready(state, p, 'axe')
    useGear(state, p, axe.uid)
    expect(p.removed).toEqual([])
  })
})

describe('two-use Gear', () => {
  it('spends one charge per use', () => {
    const { state, p } = game()
    const spear = ready(state, p, 'spear')
    expect(spear.uses).toBe(2)

    useGear(state, p, spear.uid)

    expect(spear.uses).toBe(1)
    expect(p.usedGear.map((c) => c.uid)).toEqual([spear.uid])
  })

  it('leaves the game entirely after the second use', () => {
    const { state, p } = game()
    const spear = ready(state, p, 'spear')

    useGear(state, p, spear.uid)
    p.readyGear.push(p.usedGear.pop()) // a new Day re-readies it

    const result = useGear(state, p, spear.uid)

    expect(result.broke).toBe(true)
    expect(p.removed.map((c) => c.uid)).toEqual([spear.uid])
    expect(p.usedGear).toEqual([])
    expect(state.log.some((e) => e.type === 'gear-broke')).toBe(true)
  })

  it('costs nothing to draw without using', () => {
    const { state, p } = game()
    const spear = ready(state, p, 'spear')
    expect(spear.uses).toBe(2)
    // No use call: durability untouched.
    expect(p.removed).toEqual([])
  })

  it('is not an eligible modifier once spent', () => {
    const { state, p } = game()
    const spear = ready(state, p, 'spear')

    expect(eligibleModifier(p, 'spear')).toBeDefined()
    useGear(state, p, spear.uid)
    expect(eligibleModifier(p, 'spear')).toBeUndefined()
  })
})

describe('lookups', () => {
  it('finds Ready Gear by id', () => {
    const { state, p } = game()
    ready(state, p, 'map')
    expect(hasReadyGear(p, 'map')).toBe(true)
    expect(hasReadyGear(p, 'axe')).toBe(false)
    expect(findReadyGear(p, 'map').cardId).toBe('map')
  })
})

describe('Fear removal', () => {
  it('removes from hand, played and discard', () => {
    const { state, p } = game()
    p.hand.push(makeCard(state, 'fear', 'fear'))
    p.played.push(makeCard(state, 'fear', 'fear'))
    p.discard.push(makeCard(state, 'fear', 'fear'))

    expect(removeFear(state, p, 3)).toBe(3)
    expect(removableFearCount(p)).toBe(0)
    expect(p.removed).toHaveLength(3)
  })

  it('never touches the draw pile', () => {
    const { state, p } = game()
    p.draw.push(makeCard(state, 'fear', 'fear'))

    expect(removeFear(state, p, 1)).toBe(0)
    expect(p.draw.filter((c) => c.kind === 'fear')).toHaveLength(1)
  })

  it('removes no more than asked', () => {
    const { state, p } = game()
    gainFear(state, p, 5)
    expect(removeFear(state, p, 2)).toBe(2)
    expect(removableFearCount(p)).toBe(3)
  })

  it('removes what it can when asked for more than exists', () => {
    const { state, p } = game()
    gainFear(state, p, 1)
    expect(removeFear(state, p, 3)).toBe(1)
  })

  it('stays silent when there is nothing to remove', () => {
    const { state, p } = game()
    expect(removeFear(state, p, 1)).toBe(0)
    expect(state.log.some((e) => e.type === 'fear-removed')).toBe(false)
  })
})

describe('Top Hat on-draw trigger', () => {
  it('removes 1 Fear from the discard pile the moment it is drawn', () => {
    const { state, p } = game()
    gainFear(state, p, 2)

    p.draw = [createGearCard(state, 'top_hat'), ...p.draw]
    refillHand(state, p)

    expect(removableFearCount(p)).toBe(1)
    expect(state.log.some((e) => e.type === 'fear-removed' && e.source === 'Top Hat')).toBe(true)
  })

  it('does nothing when no eligible Fear exists', () => {
    const { state, p } = game()
    p.draw = [createGearCard(state, 'top_hat'), ...p.draw]

    refillHand(state, p)

    expect(state.log.some((e) => e.type === 'fear-removed')).toBe(false)
    expect(hasReadyGear(p, 'top_hat')).toBe(true)
  })

  it('stays Ready rather than being spent, since the trigger is not an action', () => {
    const { state, p } = game()
    gainFear(state, p, 1)
    p.draw = [createGearCard(state, 'top_hat'), ...p.draw]

    refillHand(state, p)

    expect(hasReadyGear(p, 'top_hat')).toBe(true)
    expect(p.usedGear).toEqual([])
  })
})
