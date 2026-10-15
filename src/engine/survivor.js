/**
 * Health, Hunger, and defeat.
 *
 * Every effect that damages or heals a survivor must go through here. That is
 * the point: the Hunger-at-0 conversion is a single rule applied in one place,
 * so a Night card, a Location Danger and a skipped meal cannot drift apart.
 */

import { logEvent } from './setup.js'
import { readyGearById, useGear } from './gear.js'

const ok = (extra = {}) => ({ ok: true, ...extra })
const fail = (reason) => ({ ok: false, reason })

/**
 * Applies Health loss, optionally spending Log Suit uses to prevent it.
 *
 * @param {string[]} [options.preventWith] uids of Ready Log Suits; each
 *   prevents exactly 1 Health loss to its owner.
 */
export function loseHealth(state, player, amount, { source = 'effect', preventWith = [] } = {}) {
  if (amount <= 0) return ok({ lost: 0, prevented: 0 })

  // Validate every prevention up front so a bad uid cannot half-apply.
  for (const uid of preventWith) {
    const card = readyGearById(player, uid)
    if (!card) return fail('That Log Suit is not Ready.')
    if (card.cardId !== 'log_suit') return fail('Only a Log Suit can prevent Health loss.')
    if (!(card.uses > 0)) return fail('That Log Suit has no uses left.')
  }
  if (preventWith.length > amount) {
    return fail('More prevention than there is damage to prevent.')
  }

  let prevented = 0
  for (const uid of preventWith) {
    const result = useGear(state, player, uid, { reason: 'prevent Health loss' })
    if (!result.ok) return result
    prevented++
  }

  const lost = amount - prevented
  player.health = Math.max(0, player.health - lost)

  logEvent(
    state,
    'health-lost',
    prevented > 0
      ? `${player.name} lost ${lost} Health (${prevented} prevented by Log Suit), now ${player.health}.`
      : `${player.name} lost ${lost} Health, now ${player.health}.`,
    { playerId: player.id, amount, lost, prevented, source, health: player.health },
  )

  checkDefeat(state)
  return ok({ lost, prevented })
}

export function healHealth(state, player, amount, { source = 'effect' } = {}) {
  const { maxHealth } = state.constants.survivor
  const before = player.health
  player.health = Math.min(maxHealth, player.health + amount)
  const healed = player.health - before

  logEvent(
    state,
    'health-healed',
    healed > 0
      ? `${player.name} healed ${healed} Health, now ${player.health}.`
      : `${player.name} was already at full Health.`,
    { playerId: player.id, requested: amount, healed, source, health: player.health },
  )
  return ok({ healed })
}

/**
 * Applies Hunger loss from ANY source.
 *
 * RESOLVED 2026-10-14: a survivor whose Hunger is already 0 loses 1 Health
 * instead. Applied point by point, so losing 2 Hunger at Hunger 1 costs the
 * last Hunger and then 1 Health.
 */
export function loseHunger(state, player, amount, { source = 'effect' } = {}) {
  const { healthLossWhenHungerAtZero } = state.constants.hunger
  let hungerLost = 0
  let healthLost = 0

  for (let i = 0; i < amount; i++) {
    if (player.hunger > 0) {
      player.hunger -= 1
      hungerLost++
    } else {
      const result = loseHealth(state, player, healthLossWhenHungerAtZero, { source: 'starvation' })
      healthLost += result.lost ?? 0
    }
  }

  if (hungerLost > 0) {
    logEvent(state, 'hunger-lost', `${player.name} lost ${hungerLost} Hunger, now ${player.hunger}.`, {
      playerId: player.id,
      hungerLost,
      source,
      hunger: player.hunger,
    })
  }

  return ok({ hungerLost, healthLost })
}

/**
 * Resolves one survivor's meal at the start of Night.
 *
 * Eating prevents the loss outright -- it does not refill Hunger, which never
 * goes back up once spent.
 */
export function resolveMeal(state, player, { eat }) {
  if (eat) {
    if (state.resources.food <= 0) return fail('No shared Food to eat.')
    state.resources.food -= 1
    logEvent(state, 'eat', `${player.name} ate 1 Food.`, { playerId: player.id })
    return ok({ ate: true })
  }

  const result = loseHunger(state, player, 1, { source: 'skipped meal' })
  return ok({ ate: false, ...result })
}

/** Any survivor at 0 Health loses the game for the whole team, immediately. */
export function checkDefeat(state) {
  if (state.status !== 'playing') return state.status

  const fallen = state.players.find((p) => p.health <= 0)
  if (fallen) {
    state.status = 'lost'
    logEvent(state, 'defeat', `${fallen.name} reached 0 Health on Day ${state.day}. The team is lost.`, {
      playerId: fallen.id,
      day: state.day,
    })
  }
  return state.status
}
