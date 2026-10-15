import { describe, it, expect } from 'vitest'
import { createGame, buildNightSchedule, buildStarterDeck } from './setup.js'
import { createRng } from './rng.js'
import { moveCard, totalCards, nightForDay, createGameState } from './state.js'
import { CONSTANTS } from '../data/constants.js'
import { NIGHTS_BY_BAND, RED_MOON } from '../data/nights.js'
import { LOCATIONS } from '../data/locations.js'

describe('survivors', () => {
  it('creates the Alpha 1.0 default of 2', () => {
    expect(createGame({ seed: 's' }).players).toHaveLength(2)
  })

  it('honours an explicit playerCount, since Night formulas use P', () => {
    expect(createGame({ seed: 's', playerCount: 4 }).players).toHaveLength(4)
  })

  it('starts each survivor at 5 Health and 2 Hunger', () => {
    for (const player of createGame({ seed: 's' }).players) {
      expect(player.health).toBe(5)
      expect(player.hunger).toBe(2)
    }
  })

  it('starts shared resources empty', () => {
    expect(createGame({ seed: 's' }).resources).toEqual({
      food: 0, wood: 0, grass: 0, flint: 0, silk: 0,
    })
  })
})

describe('starter decks', () => {
  it('deals 8 cards composed 3 Gather / 2 Explore / 2 Prepare / 1 Recover', () => {
    for (const player of createGame({ seed: 's' }).players) {
      expect(player.draw).toHaveLength(8)

      const counts = {}
      for (const card of player.draw) counts[card.cardId] = (counts[card.cardId] ?? 0) + 1
      expect(counts).toEqual({ gather: 3, explore: 2, prepare: 2, recover: 1 })
    }
  })

  it('starts every other zone empty', () => {
    for (const player of createGame({ seed: 's' }).players) {
      expect(player.hand).toEqual([])
      expect(player.discard).toEqual([])
      expect(player.readyGear).toEqual([])
      expect(player.removed).toEqual([])
      expect(totalCards(player)).toBe(8)
    }
  })

  it('gives every card across both decks a unique uid', () => {
    const game = createGame({ seed: 's' })
    const uids = game.players.flatMap((p) => p.draw.map((c) => c.uid))
    expect(uids).toHaveLength(16)
    expect(new Set(uids).size).toBe(16)
  })

  it('rejects a constants file naming a card that does not exist', () => {
    const broken = structuredClone(CONSTANTS)
    broken.starterDeck.nonsense = 2
    const state = createGameState({ seed: 'x', rng: createRng('x'), players: [], locationDeck: [], nightSchedule: [] })
    expect(() => buildStarterDeck(state, broken)).toThrow(/unknown starter card/i)
  })
})

describe('location deck', () => {
  it('holds all 23 Locations exactly once', () => {
    const { deck } = createGame({ seed: 's' }).locations
    expect(deck).toHaveLength(23)
    expect(new Set(deck).size).toBe(23)
    expect([...deck].sort()).toEqual(LOCATIONS.map((l) => l.id).sort())
  })

  it('starts with nothing explored', () => {
    expect(createGame({ seed: 's' }).locations.explored).toEqual([])
  })
})

describe('night schedule', () => {
  it('covers all 10 Days', () => {
    expect(createGame({ seed: 's' }).nightSchedule).toHaveLength(10)
  })

  it('draws Days 1-3 from Early, 4-7 from Mid, 8-9 from Late', () => {
    const schedule = createGame({ seed: 's' }).nightSchedule
    const idsIn = (band) => NIGHTS_BY_BAND[band].map((n) => n.id)

    expect(schedule.slice(0, 3).sort()).toEqual(idsIn('early').sort())
    expect(schedule.slice(3, 7).sort()).toEqual(idsIn('mid').sort())
    expect(schedule.slice(7, 9).sort()).toEqual(idsIn('late').sort())
  })

  it('always ends on Red Moon', () => {
    const game = createGame({ seed: 's' })
    expect(game.nightSchedule[9]).toBe(RED_MOON.id)
    expect(nightForDay(game, 10)).toBe(RED_MOON.id)
  })

  it('uses every banded Night card exactly once', () => {
    const schedule = createGame({ seed: 's' }).nightSchedule.slice(0, 9)
    expect(new Set(schedule).size).toBe(9)
  })

  it('throws if a band has a different card count than its Day count', () => {
    const broken = structuredClone(CONSTANTS)
    broken.nightBands.early = [1, 2]
    expect(() => buildNightSchedule(createRng('x'), broken)).toThrow(/band mismatch/i)
  })
})

describe('reproducibility', () => {
  it('builds a byte-identical game from the same seed', () => {
    expect(createGame({ seed: 'repeat-me' })).toEqual(createGame({ seed: 'repeat-me' }))
  })

  it('builds a different game from a different seed', () => {
    const a = createGame({ seed: 'world-a' })
    const b = createGame({ seed: 'world-b' })
    expect(a.locations.deck).not.toEqual(b.locations.deck)
  })

  it('survives a JSON round-trip with nothing lost', () => {
    const game = createGame({ seed: 'exportable' })
    expect(JSON.parse(JSON.stringify(game))).toEqual(game)
  })
})

describe('zone movement', () => {
  it('moves a card and leaves the total unchanged', () => {
    const game = createGame({ seed: 's' })
    const player = game.players[0]
    const uid = player.draw[0].uid

    expect(moveCard(player, uid, 'draw', 'hand')).toBe(true)
    expect(player.draw).toHaveLength(7)
    expect(player.hand).toHaveLength(1)
    expect(totalCards(player)).toBe(8)
  })

  it('reports failure rather than silently dropping an absent card', () => {
    const player = createGame({ seed: 's' }).players[0]
    expect(moveCard(player, 'not-a-uid', 'draw', 'hand')).toBe(false)
    expect(totalCards(player)).toBe(8)
  })
})
