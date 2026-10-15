/**
 * Game setup: builds the starting state for a seed.
 *
 * Everything random here flows through the seeded RNG in a fixed order --
 * player decks first (in player order), then the Location deck, then the three
 * Night bands. Changing that order changes every existing seed, so don't.
 */

import { CONSTANTS } from '../data/constants.js'
import { STARTER_CARDS } from '../data/starterCards.js'
import { LOCATIONS } from '../data/locations.js'
import { NIGHTS_BY_BAND, RED_MOON } from '../data/nights.js'
import { createRng, shuffle, randomSeed } from './rng.js'
import { createGameState, createPlayerState, makeCard } from './state.js'

/** Default survivor names. Characters have no powers in Alpha 1.0. */
const DEFAULT_NAMES = ['Survivor 1', 'Survivor 2', 'Survivor 3', 'Survivor 4']

/**
 * Builds one survivor's 8-card starter deck, unshuffled.
 * Composition comes from constants, so it stays tunable.
 */
export function buildStarterDeck(state, constants = CONSTANTS) {
  const cards = []
  for (const [cardId, count] of Object.entries(constants.starterDeck)) {
    const def = STARTER_CARDS[cardId]
    if (!def) throw new Error(`Unknown starter card id in constants: ${cardId}`)
    for (let i = 0; i < count; i++) cards.push(makeCard(state, cardId, 'starter'))
  }
  return cards
}

/**
 * Assigns a Night card to each of the 10 Days.
 *
 * Bands are consumed whole: 3 Early cards across Days 1-3, 4 Mid across 4-7,
 * 2 Late across 8-9, and Red Moon fixed on Day 10. Each band has exactly as
 * many cards as it has Days, so every card appears exactly once.
 */
export function buildNightSchedule(rng, constants = CONSTANTS) {
  const { early, mid, late, redMoon } = constants.nightBands
  const schedule = []

  const bands = [
    [early, NIGHTS_BY_BAND.early],
    [mid, NIGHTS_BY_BAND.mid],
    [late, NIGHTS_BY_BAND.late],
  ]

  for (const [days, cards] of bands) {
    if (days.length !== cards.length) {
      throw new Error(`Night band mismatch: ${days.length} Days but ${cards.length} cards`)
    }
    for (const card of shuffle(rng, cards)) schedule.push(card.id)
  }

  for (let i = 0; i < redMoon.length; i++) schedule.push(RED_MOON.id)
  return schedule
}

/**
 * Creates a complete, ready-to-play game.
 *
 * @param {object} [options]
 * @param {string} [options.seed]        omit for a random one
 * @param {number} [options.playerCount] defaults to the Alpha 1.0 value of 2
 */
export function createGame({ seed = randomSeed(), playerCount, constants = CONSTANTS } = {}) {
  const count = playerCount ?? constants.meta.playerCount
  const rng = createRng(seed)

  // The state object has to exist before decks, because makeCard needs the
  // uid counter that lives on it.
  const state = createGameState({
    seed: String(seed),
    rng,
    players: [],
    locationDeck: [],
    nightSchedule: [],
    constants,
  })

  for (let i = 0; i < count; i++) {
    const player = createPlayerState(`p${i}`, DEFAULT_NAMES[i] ?? `Survivor ${i + 1}`, constants)
    player.draw = shuffle(rng, buildStarterDeck(state, constants))
    state.players.push(player)
  }

  state.locations.deck = shuffle(rng, LOCATIONS.map((l) => l.id))
  state.nightSchedule = buildNightSchedule(rng, constants)

  logEvent(state, 'setup', `Game created with seed ${state.seed}.`, {
    playerCount: count,
    locationDeckSize: state.locations.deck.length,
  })

  return state
}

/** Appends a structured event. Every rule-relevant change should call this. */
export function logEvent(state, type, message, data = {}) {
  state.log.push({
    index: state.log.length,
    day: state.day,
    phase: state.phase,
    type,
    message,
    ...data,
  })
}
