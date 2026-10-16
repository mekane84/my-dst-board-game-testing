/**
 * GameState shape and zone helpers.
 *
 * Pure data and pure functions -- no Vue, no DOM. Everything here must survive
 * `JSON.parse(JSON.stringify(state))` unchanged, which is what makes state
 * export/import and simulation replay work.
 */

import { CONSTANTS, RESOURCES, ZONES } from '../data/constants.js'

/**
 * One physical card in a personal deck.
 *
 * `uid` is unique for the life of the game, so two copies of Gather (or two
 * crafted Axes) are distinguishable -- which matters for per-card limits like
 * the Axe's once-per-Day bonus.
 *
 * @typedef {{ uid: string, cardId: string, kind: 'starter'|'fear'|'gear', uses?: number }} Card
 */

/**
 * @typedef {Object} PlayerState
 * @property {string} id
 * @property {string} name
 * @property {number} health
 * @property {number} hunger
 * @property {Card[]} draw      face-down draw pile
 * @property {Card[]} hand
 * @property {Card[]} played    resolved this Day, cleaned up at Night's end
 * @property {Card[]} discard
 * @property {Card[]} readyGear Gear drawn or crafted and available this Day
 * @property {Card[]} usedGear  Gear whose effect was spent this Day
 * @property {Card[]} removed   permanently out of the game (broken / Fear removal)
 */

export function createPlayerState(id, name, constants = CONSTANTS) {
  return {
    id,
    name,
    health: constants.survivor.startHealth,
    hunger: constants.survivor.startHunger,
    draw: [],
    hand: [],
    played: [],
    discard: [],
    readyGear: [],
    usedGear: [],
    removed: [],
  }
}

export function createEmptyResources() {
  const pool = {}
  for (const key of RESOURCES) pool[key] = 0
  return pool
}

/**
 * @typedef {Object} GameState
 * @property {string} seed
 * @property {object} rng            serializable RNG state
 * @property {number} day            1..10
 * @property {'day'|'night'} phase
 * @property {number} actionRound    1..3 during the Day
 * @property {PlayerState[]} players
 * @property {Record<string, number>} resources shared pool
 * @property {string[]} nightSchedule night card id per Day, index 0 = Day 1
 * @property {{combat: number, protection: number}} tonight accumulated totals
 * @property {'playing'|'won'|'lost'} status
 */

/**
 * Fresh state for one action round.
 *
 * `phase` drives what the UI may offer:
 *   selecting -> revealed -> resolving -> complete
 */
export function createRound(number) {
  return {
    number,
    phase: 'selecting',
    /** playerId -> selection. Hidden from the other player while selecting. */
    selections: {},
    /** Player ids in the team's chosen resolution order. */
    order: [],
    resolvedCount: 0,
  }
}

/** Builds the full initial state. Decks are filled by setup.js. */
export function createGameState({ seed, rng, players, locationDeck, nightSchedule, constants = CONSTANTS }) {
  return {
    seed,
    rng,
    constants,
    day: 1,
    phase: 'day',
    actionRound: 1,
    round: createRound(1),
    players,
    resources: { ...constants.startingResources },
    camp: {
      /** Built major improvements, keyed by id -> { builtOnDay, ... }. */
      improvements: {},
      /** Transplanted bushes and farms: [{ id, type, availableOnDay }]. */
      foodSources: [],
    },
    locations: {
      /** Face-down deck of Location ids. */
      deck: locationDeck,
      /** Face-up explored Locations with their per-card state. */
      explored: [],
    },
    nightSchedule,
    tonight: {
      combat: 0,
      protection: 0,
      /**
       * Small Campfire shields: each lets one survivor ignore the next 1 Fear
       * they would gain THIS Night. Unused shields expire with the Night.
       */
      fearShields: [],
    },
    /** Monotonic counter backing every Card.uid. */
    cardCounter: 0,
    status: 'playing',
    log: [],
    /** Recorded actions, so seed + history replays a session exactly. */
    history: [],
  }
}

/** Mints a new card instance with a unique uid. Mutates `state.cardCounter`. */
export function makeCard(state, cardId, kind, extra = {}) {
  state.cardCounter += 1
  return { uid: `c${state.cardCounter}`, cardId, kind, ...extra }
}

/** The Night card id for a given Day (1-indexed). */
export function nightForDay(state, day = state.day) {
  return state.nightSchedule[day - 1]
}

/** Total cards a player owns across every zone -- useful as a test invariant. */
export function totalCards(player) {
  return ZONES.reduce((sum, zone) => sum + player[zone].length, 0)
}

/**
 * Moves a card between zones by uid.
 *
 * @returns {boolean} false if the card was not in `from` (callers should treat
 *   that as a bug rather than ignoring it).
 */
export function moveCard(player, uid, from, to) {
  const index = player[from].findIndex((card) => card.uid === uid)
  if (index === -1) return false
  const [card] = player[from].splice(index, 1)
  player[to].push(card)
  return true
}

/** Deep structural clone. Used by the simulator to branch without aliasing. */
export function cloneState(state) {
  return structuredClone(state)
}
