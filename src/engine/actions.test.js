import { describe, it, expect } from 'vitest'
import { createGame } from './setup.js'
import { makeCard } from './state.js'
import { refillAllHands } from './draw.js'
import {
  startActionRounds,
  selectAction,
  clearSelection,
  allSelected,
  revealSelections,
  setResolutionOrder,
  resolveNextAction,
  roundComplete,
  advanceRound,
  legalSelections,
} from './actions.js'

/** A game with hands drawn and round 1 open. */
function opened(seed = 'actions') {
  const state = createGame({ seed })
  refillAllHands(state)
  startActionRounds(state)
  return state
}

/** First hand card of the given type, or undefined. */
function cardOf(player, cardId) {
  return player.hand.find((c) => c.cardId === cardId)
}

/** Forces a known card into hand so tests do not depend on the shuffle. */
function plant(state, player, cardId) {
  const card = makeCard(state, cardId, 'starter')
  player.hand.push(card)
  return card
}

/** Runs a full round with both players taking the given selections. */
function playRound(state, selections, order) {
  for (const [playerId, selection] of Object.entries(selections)) {
    const result = selectAction(state, playerId, selection)
    if (!result.ok) throw new Error(`select failed: ${result.reason}`)
  }
  revealSelections(state)
  setResolutionOrder(state, order ?? state.players.map((p) => p.id))
  while (!roundComplete(state)) {
    const result = resolveNextAction(state)
    if (!result.ok) throw new Error(`resolve failed: ${result.reason}`)
  }
}

describe('round lifecycle', () => {
  it('opens in the selecting phase on round 1', () => {
    const state = opened()
    expect(state.round.number).toBe(1)
    expect(state.round.phase).toBe('selecting')
    expect(allSelected(state)).toBe(false)
  })

  it('refuses to reveal until everyone has locked in', () => {
    const state = opened()
    const card = plant(state, state.players[0], 'recover')

    selectAction(state, 'p0', { kind: 'card', uid: card.uid, mode: 'effect' })

    const result = revealSelections(state)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/locked in/i)
  })

  it('lets a survivor change their mind before the reveal', () => {
    const state = opened()
    const card = plant(state, state.players[0], 'recover')

    selectAction(state, 'p0', { kind: 'card', uid: card.uid, mode: 'effect' })
    expect(clearSelection(state, 'p0').ok).toBe(true)
    expect(allSelected(state)).toBe(false)
  })

  it('closes selection once revealed', () => {
    const state = opened()
    const a = plant(state, state.players[0], 'recover')
    const b = plant(state, state.players[1], 'recover')

    selectAction(state, 'p0', { kind: 'card', uid: a.uid, mode: 'effect' })
    selectAction(state, 'p1', { kind: 'card', uid: b.uid, mode: 'effect' })
    expect(revealSelections(state).ok).toBe(true)

    const late = selectAction(state, 'p0', { kind: 'card', uid: a.uid, mode: 'effect' })
    expect(late.ok).toBe(false)
    expect(late.reason).toMatch(/closed/i)
  })

  it('keeps the chosen action out of the log until reveal', () => {
    const state = opened()
    const card = plant(state, state.players[0], 'recover')
    selectAction(state, 'p0', { kind: 'card', uid: card.uid, mode: 'effect' })

    // Hotseat secrecy: the log is visible to both players, so a lock-in must
    // not leak which card was chosen.
    const selectEvent = state.log.find((e) => e.type === 'select')
    expect(selectEvent).toBeDefined()
    expect(JSON.stringify(selectEvent)).not.toContain(card.uid)
    expect(JSON.stringify(selectEvent)).not.toContain('recover')
  })
})

describe('resolution order', () => {
  it('requires every survivor exactly once', () => {
    const state = opened()
    const a = plant(state, state.players[0], 'recover')
    const b = plant(state, state.players[1], 'recover')
    selectAction(state, 'p0', { kind: 'card', uid: a.uid, mode: 'effect' })
    selectAction(state, 'p1', { kind: 'card', uid: b.uid, mode: 'effect' })
    revealSelections(state)

    expect(setResolutionOrder(state, ['p0']).ok).toBe(false)
    expect(setResolutionOrder(state, ['p0', 'p0']).ok).toBe(false)
    expect(setResolutionOrder(state, ['p1', 'p0']).ok).toBe(true)
  })

  it('resolves in the order the team chose', () => {
    const state = opened()
    state.players[0].health = 3
    state.players[1].health = 3

    const a = plant(state, state.players[0], 'recover')
    const b = plant(state, state.players[1], 'recover')
    selectAction(state, 'p0', { kind: 'card', uid: a.uid, mode: 'effect' })
    selectAction(state, 'p1', { kind: 'card', uid: b.uid, mode: 'effect' })
    revealSelections(state)
    setResolutionOrder(state, ['p1', 'p0'])

    expect(resolveNextAction(state).playerId).toBe('p1')
    expect(resolveNextAction(state).playerId).toBe('p0')
    expect(roundComplete(state)).toBe(true)
  })

  it('refuses to resolve before an order is set', () => {
    const state = opened()
    expect(resolveNextAction(state).ok).toBe(false)
  })
})

describe('Camp Gather', () => {
  it('adds exactly 1 of the chosen resource', () => {
    const state = opened()
    const a = plant(state, state.players[0], 'gather')
    const b = plant(state, state.players[1], 'gather')

    playRound(state, {
      p0: { kind: 'card', uid: a.uid, mode: 'effect', options: { resource: 'wood' } },
      p1: { kind: 'card', uid: b.uid, mode: 'effect', options: { resource: 'flint' } },
    })

    expect(state.resources.wood).toBe(1)
    expect(state.resources.flint).toBe(1)
  })

  it('never yields Food, however it is asked', () => {
    const state = opened()
    const card = plant(state, state.players[0], 'gather')

    const result = selectAction(state, 'p0', {
      kind: 'card', uid: card.uid, mode: 'effect', options: { resource: 'food' },
    })
    // Selection passes the generic check; resolution is where Food is refused.
    revealOrResolveAndExpectFood(state, result, card)
  })

  it('has no once-per-Day limit, unlike Locations', () => {
    const state = opened()
    const p = state.players[0]
    const other = plant(state, state.players[1], 'recover')

    for (let round = 0; round < 3; round++) {
      const card = plant(state, p, 'gather')
      const partner = round === 0 ? other : plant(state, state.players[1], 'recover')
      playRound(state, {
        p0: { kind: 'card', uid: card.uid, mode: 'effect', options: { resource: 'grass' } },
        p1: { kind: 'card', uid: partner.uid, mode: 'effect' },
      })
      if (round < 2) advanceRound(state)
    }

    expect(state.resources.grass).toBe(3)
  })
})

/** Helper: Food must be refused somewhere in the chain, with a clear reason. */
function revealOrResolveAndExpectFood(state, selectResult, card) {
  if (!selectResult.ok) {
    expect(selectResult.reason).toMatch(/camp/i)
    return
  }
  const partner = plant(state, state.players[1], 'recover')
  selectAction(state, 'p1', { kind: 'card', uid: partner.uid, mode: 'effect' })
  revealSelections(state)
  setResolutionOrder(state, ['p0', 'p1'])
  const resolved = resolveNextAction(state)
  expect(resolved.ok).toBe(false)
  expect(resolved.reason).toMatch(/cannot be gathered at camp/i)
  expect(state.resources.food).toBe(0)
}

describe('Prepare', () => {
  it('adds Combat or Protection for tonight', () => {
    const state = opened()
    const a = plant(state, state.players[0], 'prepare')
    const b = plant(state, state.players[1], 'prepare')

    playRound(state, {
      p0: { kind: 'card', uid: a.uid, mode: 'effect', options: { choice: 'combat' } },
      p1: { kind: 'card', uid: b.uid, mode: 'effect', options: { choice: 'protection' } },
    })

    expect(state.tonight.combat).toBe(1)
    expect(state.tonight.protection).toBe(1)
  })

  it('rejects anything but combat or protection', () => {
    const state = opened()
    const a = plant(state, state.players[0], 'prepare')
    const b = plant(state, state.players[1], 'recover')

    selectAction(state, 'p0', { kind: 'card', uid: a.uid, mode: 'effect', options: { choice: 'sanity' } })
    selectAction(state, 'p1', { kind: 'card', uid: b.uid, mode: 'effect' })
    revealSelections(state)
    setResolutionOrder(state, ['p0', 'p1'])

    const result = resolveNextAction(state)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/combat or \+1 protection/i)
  })
})

describe('Recover', () => {
  it('heals 1 Health', () => {
    const state = opened()
    state.players[0].health = 2
    const a = plant(state, state.players[0], 'recover')
    const b = plant(state, state.players[1], 'recover')

    playRound(state, {
      p0: { kind: 'card', uid: a.uid, mode: 'effect' },
      p1: { kind: 'card', uid: b.uid, mode: 'effect' },
    })

    expect(state.players[0].health).toBe(3)
  })

  it('does not heal past max Health', () => {
    const state = opened()
    const a = plant(state, state.players[0], 'recover')
    const b = plant(state, state.players[1], 'recover')

    playRound(state, {
      p0: { kind: 'card', uid: a.uid, mode: 'effect' },
      p1: { kind: 'card', uid: b.uid, mode: 'effect' },
    })

    expect(state.players[0].health).toBe(5)
    expect(state.log.some((e) => e.type === 'recover' && e.healed === 0)).toBe(true)
  })
})

describe('played cards', () => {
  it('moves a resolved card from hand to the played area', () => {
    const state = opened()
    const a = plant(state, state.players[0], 'recover')
    const b = plant(state, state.players[1], 'recover')
    const handBefore = state.players[0].hand.length

    playRound(state, {
      p0: { kind: 'card', uid: a.uid, mode: 'effect' },
      p1: { kind: 'card', uid: b.uid, mode: 'effect' },
    })

    expect(state.players[0].hand).toHaveLength(handBefore - 1)
    expect(state.players[0].played.map((c) => c.uid)).toContain(a.uid)
  })
})

describe('three rounds make a Day', () => {
  it('advances 1 -> 2 -> 3 and then reports the Day is done', () => {
    const state = opened()

    for (let round = 1; round <= 3; round++) {
      expect(state.round.number).toBe(round)

      const a = plant(state, state.players[0], 'recover')
      const b = plant(state, state.players[1], 'recover')
      playRound(state, {
        p0: { kind: 'card', uid: a.uid, mode: 'effect' },
        p1: { kind: 'card', uid: b.uid, mode: 'effect' },
      })

      const advanced = advanceRound(state)
      expect(advanced.ok).toBe(true)
      expect(advanced.dayComplete).toBe(round === 3)
    }
  })

  it('refuses to advance mid-round', () => {
    const state = opened()
    const result = advanceRound(state)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/finish resolving/i)
  })
})

describe('what is not legal yet', () => {
  it('rejects Fear as an action', () => {
    const state = opened()
    const fear = makeCard(state, 'fear', 'fear')
    state.players[0].hand.push(fear)

    const result = selectAction(state, 'p0', { kind: 'card', uid: fear.uid, mode: 'effect' })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/fear/i)
  })

  it('rejects a card that is not in hand', () => {
    const state = opened()
    const result = selectAction(state, 'p0', { kind: 'card', uid: 'nope', mode: 'effect' })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/not in your hand/i)
  })

  it('reports Work and Explore as coming later, rather than failing silently', () => {
    const state = opened()
    const gather = plant(state, state.players[0], 'gather')
    const explore = plant(state, state.players[0], 'explore')

    const work = selectAction(state, 'p0', { kind: 'card', uid: gather.uid, mode: 'work' })
    expect(work.ok).toBe(false)
    expect(work.reason).toMatch(/phase 4/i)

    const exploring = selectAction(state, 'p0', { kind: 'card', uid: explore.uid, mode: 'effect' })
    expect(exploring.ok).toBe(false)
    expect(exploring.reason).toMatch(/phase 5/i)
  })

  it('reports action-cost abilities as coming later', () => {
    const state = opened()
    const result = selectAction(state, 'p0', { kind: 'ability', source: 'gear', id: 'small_campfire' })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/phase 4/i)
  })
})

describe('legal selections', () => {
  it('annotates each hand card with whether it can be used, and why not', () => {
    const state = opened()
    const player = state.players[0]
    player.hand = []
    plant(state, player, 'recover')
    plant(state, player, 'explore')
    player.hand.push(makeCard(state, 'fear', 'fear'))

    const legal = legalSelections(state, player)

    expect(legal).toHaveLength(3)
    expect(legal.find((s) => s.cardId === 'recover').available).toBe(true)
    expect(legal.find((s) => s.cardId === 'explore').available).toBe(false)
    expect(legal.find((s) => s.cardId === 'explore').reason).toMatch(/phase 5/i)
    expect(legal.find((s) => s.cardId === 'fear').available).toBe(false)
  })
})

describe('passing', () => {
  it('is illegal while any real action remains', () => {
    const state = opened()
    const result = selectAction(state, 'p0', { kind: 'pass' })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/only pass when no legal action/i)
  })

  it('is allowed when a hand holds nothing but Fear', () => {
    const state = opened()
    const player = state.players[0]
    player.hand = [1, 2, 3, 4, 5].map(() => makeCard(state, 'fear', 'fear'))

    expect(selectAction(state, 'p0', { kind: 'pass' }).ok).toBe(true)
  })

  it('resolves as a no-op and is recorded in the log', () => {
    const state = opened()
    state.players[0].hand = [1, 2, 3, 4, 5].map(() => makeCard(state, 'fear', 'fear'))
    const b = plant(state, state.players[1], 'recover')

    playRound(state, {
      p0: { kind: 'pass' },
      p1: { kind: 'card', uid: b.uid, mode: 'effect' },
    })

    expect(state.log.some((e) => e.type === 'pass' && e.playerId === 'p0')).toBe(true)
  })
})
