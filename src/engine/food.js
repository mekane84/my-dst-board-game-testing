/**
 * Harvesting the Camp's food infrastructure.
 *
 * Transplanted Berry Bushes and Farm Plots are permanent shared objects, but
 * unlike a Location they live at Camp rather than on the explored board. They
 * follow the same renewable-food cooldown as Rabbit Fields and Ponds:
 *
 *   harvested on Day D -> unavailable D+1 -> available again at the start of D+2
 *
 * Food deliberately cannot come from Camp Gather, so these structures plus the
 * gear-gated food Locations are the only renewable routes in the game.
 */

import { logEvent } from './setup.js'
import { BUILDABLE_BY_ID } from '../data/campImprovements.js'

const ok = (extra = {}) => ({ ok: true, ...extra })
const fail = (reason) => ({ ok: false, reason })

export function foodSourceByUid(state, uid) {
  return state.camp.foodSources.find((f) => f.uid === uid)
}

/** Why this food source cannot be harvested right now, or null if it can. */
export function harvestBlockedReason(state, source) {
  if (source.availableOnDay !== null && state.day < source.availableOnDay) {
    return `Resting until Day ${source.availableOnDay}.`
  }
  return null
}

/** Every built food source, annotated for the UI. */
export function foodSourceOptions(state) {
  return state.camp.foodSources.map((source) => {
    const def = BUILDABLE_BY_ID[source.id]
    const reason = harvestBlockedReason(state, source)
    return {
      uid: source.uid,
      id: source.id,
      name: def?.name ?? source.id,
      yield: def?.yield?.food ?? 0,
      available: reason === null,
      reason,
      harvestedOnDay: source.harvestedOnDay,
      availableOnDay: source.availableOnDay,
    }
  })
}

/**
 * Harvests one Camp food source.
 *
 * The cooldown is what stops a second harvest the same Day -- with a one-Day
 * rest the source is unavailable until D+2, so no separate once-per-Day check
 * is needed.
 */
export function harvestFoodSource(state, player, uid) {
  const source = foodSourceByUid(state, uid)
  if (!source) return fail('No such food source at Camp.')

  const blocked = harvestBlockedReason(state, source)
  if (blocked) return fail(blocked)

  const def = BUILDABLE_BY_ID[source.id]
  if (!def?.yield?.food) return fail(`${def?.name ?? source.id} yields no Food.`)

  const amount = def.yield.food
  state.resources.food += amount

  source.harvestedOnDay = state.day
  source.availableOnDay = state.day + (def.cooldownDays ?? 0) + 1

  logEvent(state, 'harvest', `${player.name} harvested ${amount} Food from the ${def.name}.`, {
    playerId: player.id,
    foodUid: uid,
    sourceId: source.id,
    amount,
    restingUntil: source.availableOnDay,
  })

  return ok({ amount })
}
