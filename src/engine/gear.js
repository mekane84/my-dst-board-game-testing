/**
 * Gear instances, durability, and use.
 *
 * Two rules do most of the work here:
 *
 * 1. "Unless a card says otherwise, a single Ready copy may be used at most
 *    once that Day." Using Gear moves it out of Ready Gear, so the Ready zone
 *    IS the once-per-Day tracker -- no separate flag to keep in sync.
 * 2. Two-use Gear spends a charge only when its effect actually fires. Drawing
 *    it without using it costs nothing. At zero charges it leaves the game
 *    rather than returning to the discard pile.
 */

import { logEvent } from './setup.js'
import { makeCard, moveCard } from './state.js'
import { GEAR_BY_ID, isTwoUse } from '../data/gear.js'

const ok = (extra = {}) => ({ ok: true, ...extra })
const fail = (reason) => ({ ok: false, reason })

/** Zones Fear can be permanently removed from. Never the draw pile. */
export const FEAR_REMOVAL_ZONES = ['hand', 'played', 'discard']

/** Mints a Gear card, carrying durability for the two-use family. */
export function createGearCard(state, gearId) {
  const gear = GEAR_BY_ID[gearId]
  if (!gear) throw new Error(`Unknown gear id: ${gearId}`)

  const extra = isTwoUse(gearId) ? { uses: gear.uses } : {}
  return makeCard(state, gearId, 'gear', extra)
}

export function findReadyGear(player, gearId) {
  return player.readyGear.find((c) => c.cardId === gearId)
}

export function readyGearById(player, uid) {
  return player.readyGear.find((c) => c.uid === uid)
}

export function hasReadyGear(player, gearId) {
  return Boolean(findReadyGear(player, gearId))
}

/**
 * Spends one use of a Ready Gear card.
 *
 * Reusable Gear moves to the used area. Two-use Gear loses a charge and is
 * permanently removed once it hits zero -- `removed` is outside the deck
 * cycle, so a broken Spear never comes back.
 *
 * @returns {{ok: boolean, broke?: boolean, reason?: string}}
 */
export function useGear(state, player, uid, { reason = 'effect' } = {}) {
  const card = readyGearById(player, uid)
  if (!card) return fail('That Gear is not Ready. It may already have been used this Day.')

  const gear = GEAR_BY_ID[card.cardId]

  if (isTwoUse(card.cardId)) {
    if (!(card.uses > 0)) return fail(`${gear.name} has no uses left.`)
    card.uses -= 1

    if (card.uses <= 0) {
      moveCard(player, uid, 'readyGear', 'removed')
      logEvent(state, 'gear-broke', `${player.name}'s ${gear.name} broke and left the game.`, {
        playerId: player.id,
        cardId: card.cardId,
        uid,
        reason,
      })
      return ok({ broke: true })
    }

    moveCard(player, uid, 'readyGear', 'usedGear')
    logEvent(state, 'gear-used', `${player.name} used ${gear.name} (${card.uses} use left).`, {
      playerId: player.id,
      cardId: card.cardId,
      uid,
      usesLeft: card.uses,
      reason,
    })
    return ok({ broke: false })
  }

  moveCard(player, uid, 'readyGear', 'usedGear')
  logEvent(state, 'gear-used', `${player.name} used ${gear.name}.`, {
    playerId: player.id,
    cardId: card.cardId,
    uid,
    reason,
  })
  return ok({ broke: false })
}

/**
 * Finds a Ready Gear card of the given id that can still modify an action.
 *
 * Honours the resolved rule that at most one Gear of a type may modify a single
 * action: callers pass one uid, and the Ready zone stops a second use the same
 * Day. Two Axes still each fire once per Day, on different Gathers.
 */
export function eligibleModifier(player, gearId) {
  return player.readyGear.find(
    (c) => c.cardId === gearId && (!isTwoUse(c.cardId) || c.uses > 0),
  )
}

/**
 * Permanently removes up to `count` Fear cards from a survivor's hand, played
 * area and discard pile -- never the draw pile, which no effect may search.
 *
 * @returns {number} how many were actually removed
 */
export function removeFear(state, player, count = 1, { source = 'effect' } = {}) {
  let removed = 0

  for (const zone of FEAR_REMOVAL_ZONES) {
    while (removed < count) {
      const card = player[zone].find((c) => c.kind === 'fear')
      if (!card) break
      moveCard(player, card.uid, zone, 'removed')
      removed++
    }
    if (removed >= count) break
  }

  if (removed > 0) {
    logEvent(state, 'fear-removed', `${player.name} permanently removed ${removed} Fear.`, {
      playerId: player.id,
      removed,
      source,
    })
  }
  return removed
}

/** Fear cards eligible for removal right now (excludes the draw pile). */
export function removableFearCount(player) {
  return FEAR_REMOVAL_ZONES.reduce(
    (sum, zone) => sum + player[zone].filter((c) => c.kind === 'fear').length,
    0,
  )
}
