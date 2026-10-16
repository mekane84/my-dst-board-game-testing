import { describe, it, expect } from 'vitest'
import { createGame } from './setup.js'
import { makeCard } from './state.js'
import { refillAllHands } from './draw.js'
import { createGearCard } from './gear.js'
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
  reselectCurrentAction,
  finishPendingAction,
} from './actions.js'
import { resolveChoice } from './effects.js'

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
    expect(state.log.some((e) => e.type === 'health-healed' && e.healed === 0)).toBe(true)
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

  it('rejects Work with no target, and unknown targets', () => {
    const state = opened()
    const gather = plant(state, state.players[0], 'gather')

    const bare = selectAction(state, 'p0', { kind: 'card', uid: gather.uid, mode: 'work' })
    expect(bare.ok).toBe(false)
    expect(bare.reason).toMatch(/work on/i)

    const bogus = selectAction(state, 'p0', {
      kind: 'card', uid: gather.uid, mode: 'work', work: { type: 'craft', id: 'jetpack' },
    })
    expect(bogus.ok).toBe(false)
    expect(bogus.reason).toMatch(/no such gear/i)
  })

  it('accepts a well-formed Work selection even when the team cannot afford it', () => {
    const state = opened()
    const gather = plant(state, state.players[0], 'gather')

    // Affordability is deliberately checked at RESOLUTION, not selection,
    // because the other survivor may spend the same resources first.
    expect(state.resources.wood).toBe(0)
    const result = selectAction(state, 'p0', {
      kind: 'card', uid: gather.uid, mode: 'work', work: { type: 'craft', id: 'axe' },
    })
    expect(result.ok).toBe(true)
  })

  it('reports action-cost abilities as coming later', () => {
    const state = opened()
    const result = selectAction(state, 'p0', { kind: 'ability', source: 'gear', id: 'small_campfire' })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/phase 7/i)
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
    expect(legal.find((s) => s.cardId === 'explore').available).toBe(true)
    expect(legal.find((s) => s.cardId === 'fear').available).toBe(false)
    expect(legal.find((s) => s.cardId === 'fear').reason).toMatch(/fear/i)
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

describe('Axe and Pickaxe modify a Gather', () => {
  it('adds its bonus to a Camp Gather of the matching resource', () => {
    const state = opened()
    const axe = createGearCard(state, 'axe')
    state.players[0].readyGear.push(axe)

    const a = plant(state, state.players[0], 'gather')
    const b = plant(state, state.players[1], 'recover')
    playRound(state, {
      p0: { kind: 'card', uid: a.uid, mode: 'effect', options: { resource: 'wood', gearUid: axe.uid } },
      p1: { kind: 'card', uid: b.uid, mode: 'effect' },
    })

    expect(state.resources.wood).toBe(2)
  })

  it('refuses to help with a resource it has nothing to do with', () => {
    const state = opened()
    const axe = createGearCard(state, 'axe')
    state.players[0].readyGear.push(axe)

    const a = plant(state, state.players[0], 'gather')
    const b = plant(state, state.players[1], 'recover')
    selectAction(state, 'p0', {
      kind: 'card', uid: a.uid, mode: 'effect', options: { resource: 'grass', gearUid: axe.uid },
    })
    selectAction(state, 'p1', { kind: 'card', uid: b.uid, mode: 'effect' })
    revealSelections(state)
    setResolutionOrder(state, ['p0', 'p1'])

    const result = resolveNextAction(state)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/only helps when gathering wood/i)
    expect(state.resources.grass).toBe(0)
  })

  it('is exhausted for the Day once used', () => {
    const state = opened()
    const axe = createGearCard(state, 'axe')
    state.players[0].readyGear.push(axe)

    const a = plant(state, state.players[0], 'gather')
    const b = plant(state, state.players[1], 'recover')
    playRound(state, {
      p0: { kind: 'card', uid: a.uid, mode: 'effect', options: { resource: 'wood', gearUid: axe.uid } },
      p1: { kind: 'card', uid: b.uid, mode: 'effect' },
    })

    expect(state.players[0].readyGear).toEqual([])
    expect(state.players[0].usedGear.map((c) => c.uid)).toEqual([axe.uid])
  })

  it('lets two Axes pay off across two Gathers, never on one', () => {
    // RESOLVED 2026-10-14: the once-per-Day limit is per card, but only one
    // Axe may modify a single Gather.
    const state = opened()
    const p0 = state.players[0]
    const axeOne = createGearCard(state, 'axe')
    const axeTwo = createGearCard(state, 'axe')
    p0.readyGear.push(axeOne, axeTwo)

    const g1 = plant(state, p0, 'gather')
    const r1 = plant(state, state.players[1], 'recover')
    playRound(state, {
      p0: { kind: 'card', uid: g1.uid, mode: 'effect', options: { resource: 'wood', gearUid: axeOne.uid } },
      p1: { kind: 'card', uid: r1.uid, mode: 'effect' },
    })
    expect(state.resources.wood).toBe(2)

    advanceRound(state)

    const g2 = plant(state, p0, 'gather')
    const r2 = plant(state, state.players[1], 'recover')
    playRound(state, {
      p0: { kind: 'card', uid: g2.uid, mode: 'effect', options: { resource: 'wood', gearUid: axeTwo.uid } },
      p1: { kind: 'card', uid: r2.uid, mode: 'effect' },
    })

    expect(state.resources.wood).toBe(4)
  })
})

describe('Spear and Torch modify a Prepare', () => {
  it('replaces the Prepare total rather than adding to it', () => {
    const state = opened()
    const spear = createGearCard(state, 'spear')
    state.players[0].readyGear.push(spear)

    const a = plant(state, state.players[0], 'prepare')
    const b = plant(state, state.players[1], 'recover')
    playRound(state, {
      p0: { kind: 'card', uid: a.uid, mode: 'effect', options: { choice: 'combat', gearUid: spear.uid } },
      p1: { kind: 'card', uid: b.uid, mode: 'effect' },
    })

    // "that Prepare provides 3 Combat total instead of 1" -- not 1 + 3.
    expect(state.tonight.combat).toBe(3)
    expect(spear.uses).toBe(1)
  })

  it('refuses the wrong kind of Prepare', () => {
    const state = opened()
    const spear = createGearCard(state, 'spear')
    state.players[0].readyGear.push(spear)

    const a = plant(state, state.players[0], 'prepare')
    const b = plant(state, state.players[1], 'recover')
    selectAction(state, 'p0', {
      kind: 'card', uid: a.uid, mode: 'effect', options: { choice: 'protection', gearUid: spear.uid },
    })
    selectAction(state, 'p1', { kind: 'card', uid: b.uid, mode: 'effect' })
    revealSelections(state)
    setResolutionOrder(state, ['p0', 'p1'])

    const result = resolveNextAction(state)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/only modifies a combat prepare/i)
    expect(state.tonight.protection).toBe(0)
  })

  it('upgrades a Protection Prepare with a Torch', () => {
    const state = opened()
    const torch = createGearCard(state, 'torch')
    state.players[0].readyGear.push(torch)

    const a = plant(state, state.players[0], 'prepare')
    const b = plant(state, state.players[1], 'recover')
    playRound(state, {
      p0: { kind: 'card', uid: a.uid, mode: 'effect', options: { choice: 'protection', gearUid: torch.uid } },
      p1: { kind: 'card', uid: b.uid, mode: 'effect' },
    })

    expect(state.tonight.protection).toBe(3)
  })
})

describe('Work resolves crafting and building', () => {
  it('crafts Gear, which is Ready the same Day', () => {
    const state = opened()
    state.resources.wood = 1
    state.resources.flint = 1

    const a = plant(state, state.players[0], 'gather')
    const b = plant(state, state.players[1], 'recover')
    playRound(state, {
      p0: { kind: 'card', uid: a.uid, mode: 'work', work: { type: 'craft', id: 'axe' } },
      p1: { kind: 'card', uid: b.uid, mode: 'effect' },
    })

    expect(state.players[0].readyGear.map((c) => c.cardId)).toEqual(['axe'])
    expect(state.resources.wood).toBe(0)
  })

  it('builds a Camp Improvement', () => {
    const state = opened()
    state.resources.wood = 3
    state.resources.flint = 2

    const a = plant(state, state.players[0], 'explore')
    const b = plant(state, state.players[1], 'recover')
    playRound(state, {
      p0: { kind: 'card', uid: a.uid, mode: 'work', work: { type: 'build', id: 'fire_pit' } },
      p1: { kind: 'card', uid: b.uid, mode: 'effect' },
    })

    // An Explore card spent as Work: any starter card can be Work.
    expect(state.camp.improvements.fire_pit).toBeDefined()
  })

  it('lets resolution order decide who gets the last of a resource', () => {
    const state = opened()
    state.resources.wood = 1
    state.resources.flint = 1

    const a = plant(state, state.players[0], 'gather')
    const b = plant(state, state.players[1], 'gather')

    selectAction(state, 'p0', { kind: 'card', uid: a.uid, mode: 'work', work: { type: 'craft', id: 'axe' } })
    selectAction(state, 'p1', { kind: 'card', uid: b.uid, mode: 'work', work: { type: 'craft', id: 'pickaxe' } })
    revealSelections(state)
    setResolutionOrder(state, ['p1', 'p0'])

    // Both selections were legal; only the first to resolve can afford it.
    expect(resolveNextAction(state).ok).toBe(true)
    const second = resolveNextAction(state)

    expect(second.ok).toBe(false)
    expect(second.reason).toMatch(/missing/i)
    expect(state.players[1].readyGear.map((c) => c.cardId)).toEqual(['pickaxe'])
    expect(state.players[0].readyGear).toEqual([])
  })
})

describe('an action that cannot resolve', () => {
  /** Sets up two crafts competing for the same single wood + flint. */
  function contested() {
    const state = opened()
    state.resources.wood = 1
    state.resources.flint = 1

    const a = plant(state, state.players[0], 'gather')
    const b = plant(state, state.players[1], 'gather')

    selectAction(state, 'p0', { kind: 'card', uid: a.uid, mode: 'work', work: { type: 'craft', id: 'axe' } })
    selectAction(state, 'p1', { kind: 'card', uid: b.uid, mode: 'work', work: { type: 'craft', id: 'pickaxe' } })
    revealSelections(state)
    setResolutionOrder(state, ['p0', 'p1'])

    resolveNextAction(state)
    const blocked = resolveNextAction(state)
    expect(blocked.ok).toBe(false)
    return { state, blocked, cardB: b }
  }

  it('hands the action back to its survivor to choose again', () => {
    const { state, blocked } = contested()

    expect(reselectCurrentAction(state, blocked.reason).ok).toBe(true)
    expect(state.round.phase).toBe('reselecting')
    expect(state.round.reselectFor).toBe('p1')
    expect(state.log.some((e) => e.type === 'reselect')).toBe(true)
  })

  it('leaves their card unspent, so nothing is wasted', () => {
    const { state, blocked, cardB } = contested()
    reselectCurrentAction(state, blocked.reason)

    expect(state.players[1].hand.map((c) => c.uid)).toContain(cardB.uid)
    expect(state.players[1].played).toEqual([])
  })

  it('only lets the affected survivor pick during a reselect', () => {
    const { state, blocked } = contested()
    reselectCurrentAction(state, blocked.reason)

    const wrongPlayer = selectAction(state, 'p0', { kind: 'pass' })
    expect(wrongPlayer.ok).toBe(false)
    expect(wrongPlayer.reason).toMatch(/must choose again/i)
  })

  it('resumes resolution once they have picked something else', () => {
    const { state, blocked, cardB } = contested()
    reselectCurrentAction(state, blocked.reason)

    const retry = selectAction(state, 'p1', {
      kind: 'card', uid: cardB.uid, mode: 'effect', options: { resource: 'grass' },
    })
    expect(retry.ok).toBe(true)
    expect(state.round.phase).toBe('resolving')

    expect(resolveNextAction(state).ok).toBe(true)
    expect(roundComplete(state)).toBe(true)
    expect(state.resources.grass).toBe(1)
    expect(state.players[0].readyGear.map((c) => c.cardId)).toEqual(['axe'])
  })

  it('refuses when nothing is being resolved', () => {
    const state = opened()
    expect(reselectCurrentAction(state, 'x').ok).toBe(false)
  })
})

describe('actions that open a decision', () => {
  /** Puts a Location with a Danger on top of the deck. */
  function stackDanger(state) {
    state.locations.deck = [
      'dense_forest_strange_noises',
      ...state.locations.deck.filter((d) => d !== 'dense_forest_strange_noises'),
    ]
  }

  function exploreVsRecover(state) {
    const a = plant(state, state.players[0], 'explore')
    const b = plant(state, state.players[1], 'recover')
    selectAction(state, 'p0', { kind: 'card', uid: a.uid, mode: 'effect' })
    selectAction(state, 'p1', { kind: 'card', uid: b.uid, mode: 'effect' })
    revealSelections(state)
    setResolutionOrder(state, ['p0', 'p1'])
  }

  it('suspends the round until the decision is answered', () => {
    const state = opened()
    stackDanger(state)
    exploreVsRecover(state)

    const result = resolveNextAction(state)

    expect(result.ok).toBe(true)
    expect(result.pending).toBe(true)
    expect(state.pending).not.toBeNull()
    // The action is not finished, so the round has not moved on.
    expect(state.round.resolvedCount).toBe(0)
  })

  it('refuses to finish while the decision is still open', () => {
    const state = opened()
    stackDanger(state)
    exploreVsRecover(state)
    resolveNextAction(state)

    const early = finishPendingAction(state)
    expect(early.ok).toBe(false)
    expect(early.reason).toMatch(/still waiting/i)
  })

  it('completes the action once answered, and the round carries on', () => {
    const state = opened()
    stackDanger(state)
    exploreVsRecover(state)
    resolveNextAction(state)

    resolveChoice(state, 1) // take the Fear
    expect(state.pending).toBeNull()

    expect(finishPendingAction(state).ok).toBe(true)
    expect(state.round.resolvedCount).toBe(1)

    expect(resolveNextAction(state).ok).toBe(true)
    expect(roundComplete(state)).toBe(true)
  })

  it('completes the round when the decision was on its last action', () => {
    // The case that stalled the harness: answering a decision finished the
    // final action, leaving the round complete rather than resolving.
    const state = opened()
    stackDanger(state)

    const a = plant(state, state.players[0], 'recover')
    const b = plant(state, state.players[1], 'explore')
    selectAction(state, 'p0', { kind: 'card', uid: a.uid, mode: 'effect' })
    selectAction(state, 'p1', { kind: 'card', uid: b.uid, mode: 'effect' })
    revealSelections(state)
    setResolutionOrder(state, ['p0', 'p1'])

    resolveNextAction(state)
    resolveNextAction(state)
    expect(state.pending).not.toBeNull()
    expect(roundComplete(state)).toBe(false)

    resolveChoice(state, 1)
    finishPendingAction(state)

    expect(roundComplete(state)).toBe(true)
    expect(advanceRound(state).ok).toBe(true)
  })
})
