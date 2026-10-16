/**
 * Drawing, deck cycling, and end-of-Day cleanup.
 *
 * The rule that shapes all of this: Gear never occupies a hand slot. When Gear
 * is drawn it goes straight to Ready Gear and a replacement card is drawn, so a
 * survivor always ends the draw with a full hand of action cards *plus*
 * whatever Gear surfaced. Fear, by contrast, does occupy a slot -- that is the
 * entire cost of Fear.
 */

import { shuffle } from './rng.js'
import { makeCard } from './state.js'
import { logEvent } from './setup.js'
import { GEAR_BY_ID } from '../data/gear.js'
import { removeFear } from './gear.js'
import { FEAR_CARD } from '../data/starterCards.js'

/** Safety valve: a malformed deck must fail loudly, not hang the browser. */
const MAX_DRAW_ITERATIONS = 500

/**
 * Shuffles the discard pile into the draw pile.
 *
 * @returns {boolean} false if there was nothing to reshuffle
 */
export function reshuffleDiscard(state, player) {
  if (player.discard.length === 0) return false

  const count = player.discard.length
  player.draw = shuffle(state.rng, player.discard)
  player.discard = []

  logEvent(state, 'reshuffle', `${player.name} reshuffled ${count} cards into a new draw pile.`, {
    playerId: player.id,
    count,
  })
  return true
}

/**
 * Draws one card off the top, reshuffling first if needed.
 *
 * @returns {object|null} null only when draw AND discard are both empty, which
 *   cannot happen in a legal game -- nothing ever removes starter cards, so
 *   every survivor keeps a floor of 8.
 */
export function drawOne(state, player) {
  if (player.draw.length === 0 && !reshuffleDiscard(state, player)) return null
  return player.draw.shift()
}

/**
 * Fills a survivor's hand to the target size, applying Gear replacement.
 *
 * Gear drawn along the way is readied and does not count toward the hand, so
 * the loop keeps drawing. A Backpack readied mid-draw raises the target, and
 * the Gear replacement rule still applies to that extra card.
 *
 * @returns {object[]} the Gear readied during this draw, in the order it appeared
 */
export function refillHand(state, player) {
  const { handSize } = state.constants.meta
  const { extraCardPerBackpack, extraCardStacks } = state.constants.draw

  let target = handSize
  let backpacksCounted = 0
  const readied = []
  const drawnToHand = []
  let iterations = 0

  while (player.hand.length < target) {
    if (++iterations > MAX_DRAW_ITERATIONS) {
      throw new Error(`Draw loop failed to terminate for ${player.id}`)
    }

    const card = drawOne(state, player)
    if (!card) {
      // Unreachable in a legal game: nothing ever removes starter cards, so
      // every survivor keeps a floor of 8. If this fires, something upstream
      // deleted cards it should not have.
      logEvent(
        state,
        'draw-exhausted',
        `${player.name} could not fill their hand - no cards left anywhere.`,
        { playerId: player.id, handSize: player.hand.length, target },
      )
      break
    }

    if (card.kind !== 'gear') {
      player.hand.push(card)
      drawnToHand.push(card)
      continue
    }

    // Gear bypasses the hand entirely.
    player.readyGear.push(card)
    readied.push(card)
    logEvent(state, 'gear-readied', `${player.name} readied ${label(card)}.`, {
      playerId: player.id,
      cardId: card.cardId,
      uid: card.uid,
    })

    const gear = GEAR_BY_ID[card.cardId]
    if (gear?.onDraw === 'extraHandCard') {
      backpacksCounted += 1
      if (extraCardStacks || backpacksCounted === 1) {
        target += extraCardPerBackpack
        logEvent(state, 'draw-bonus', `${label(card)} grants ${player.name} an extra hand card.`, {
          playerId: player.id,
          newTarget: target,
        })
      }
    }

    if (gear?.onDraw === 'removeFear') {
      // Top Hat: removes from hand, played area or discard -- never the draw
      // pile, which no effect may search. It stays Ready rather than moving to
      // the used area: the trigger is automatic, not an action, and it has no
      // other use to spend. Both zones discard at cleanup, so nothing differs
      // mechanically.
      removeFear(state, player, 1, { source: 'Top Hat' })
    }
  }

  logEvent(state, 'draw', `${player.name} drew ${drawnToHand.length} cards.`, {
    playerId: player.id,
    cards: drawnToHand.map((c) => c.cardId),
    gearReadied: readied.map((c) => c.cardId),
    handTarget: target,
  })

  return readied
}

/** Draws for every survivor, in seat order. */
export function refillAllHands(state) {
  for (const player of state.players) refillHand(state, player)
}

/**
 * End-of-Day cleanup, after the Night resolves.
 *
 * Hand, played cards, and both Gear areas all go to discard. Only `removed` --
 * broken 2-use Gear and permanently removed Fear -- stays out.
 */
export function endOfDayCleanup(state, player) {
  let moved = 0
  for (const zone of ['hand', 'played', 'readyGear', 'usedGear']) {
    while (player[zone].length > 0) {
      player.discard.push(player[zone].shift())
      moved++
    }
  }

  logEvent(state, 'cleanup', `${player.name} discarded ${moved} cards.`, {
    playerId: player.id,
    moved,
  })
}

export function cleanupAllPlayers(state) {
  for (const player of state.players) endOfDayCleanup(state, player)
}

/**
 * Adds Fear cards to a survivor's discard pile, which is where gained Fear goes
 * unless an effect says otherwise.
 */
export function gainFear(state, player, amount = 1, { night = false } = {}) {
  let gained = 0
  let shielded = 0

  for (let i = 0; i < amount; i++) {
    // A Small Campfire shield only absorbs Fear gained during the Night, and
    // only one point per shield.
    if (night) {
      const shield = state.tonight?.fearShields?.find((s) => s.playerId === player.id && !s.used)
      if (shield) {
        shield.used = true
        shielded++
        continue
      }
    }
    player.discard.push(makeCard(state, FEAR_CARD.id, 'fear'))
    gained++
  }

  if (shielded > 0) {
    logEvent(state, 'fear-shielded', `${player.name} shrugged off ${shielded} Fear by the fire.`, {
      playerId: player.id,
      shielded,
    })
  }
  if (gained > 0) {
    logEvent(state, 'fear-gained', `${player.name} gained ${gained} Fear.`, {
      playerId: player.id,
      amount: gained,
    })
  }

  return { gained, shielded }
}

/** Hand cards that can actually be played or used as Work -- i.e. not Fear. */
export function usableHand(player) {
  return player.hand.filter((card) => card.kind !== 'fear')
}

/** Total Fear cards a survivor owns, across every zone except `removed`. */
export function fearCount(player) {
  const zones = ['draw', 'hand', 'played', 'discard']
  return zones.reduce(
    (sum, zone) => sum + player[zone].filter((card) => card.kind === 'fear').length,
    0,
  )
}

function label(card) {
  return GEAR_BY_ID[card.cardId]?.name ?? card.cardId
}
