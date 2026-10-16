/**
 * Action-cost abilities.
 *
 * Small Campfire, the Tent, and Garland's second use are taken INSTEAD of
 * playing a starter action card. They consume one of the survivor's three
 * daily actions but cost no card from hand.
 *
 * This is centralised deliberately: docs/TODO.md flags the physical-game
 * representation as provisional, so if it changes it changes in one place.
 */

import { logEvent } from './setup.js'
import { GEAR_BY_ID } from '../data/gear.js'
import { CAMP_IMPROVEMENTS } from '../data/campImprovements.js'
import { useGear, removeFear, removableFearCount } from './gear.js'

const ok = (extra = {}) => ({ ok: true, ...extra })
const fail = (reason) => ({ ok: false, reason })

/* ------------------------------------------------------------------ */
/* What is available                                                   */
/* ------------------------------------------------------------------ */

/** Ready Gear this survivor could activate as their action. */
function gearAbilities(state, player) {
  return player.readyGear
    .filter((card) => GEAR_BY_ID[card.cardId]?.ability && GEAR_BY_ID[card.cardId]?.costsAction)
    .map((card) => {
      const gear = GEAR_BY_ID[card.cardId]
      let available = true
      let reason = null

      if (card.uses !== undefined && card.uses <= 0) {
        available = false
        reason = `${gear.name} has no uses left.`
      } else if (gear.ability.requiresEligibleFear && removableFearCount(player) === 0) {
        // Unlike the craft-use, this one is declined rather than wasted.
        available = false
        reason = 'No Fear you could remove.'
      }

      return {
        source: 'gear',
        id: card.cardId,
        uid: card.uid,
        name: gear.name,
        text: gear.text,
        available,
        reason,
      }
    })
}

/** Built Camp Improvements with an action ability. */
function campAbilities(state, player) {
  return CAMP_IMPROVEMENTS.filter((c) => c.ability?.costsAction)
    .filter((c) => state.camp.improvements[c.id])
    .map((c) => {
      const built = state.camp.improvements[c.id]
      let available = true
      let reason = null

      if (c.ability.oncePerDay && built.usedOnDay === state.day) {
        available = false
        reason = `${c.name} has already been used today.`
      } else {
        for (const [resource, amount] of Object.entries(c.ability.cost ?? {})) {
          if ((state.resources[resource] ?? 0) < amount) {
            available = false
            reason = `Needs ${amount} ${resource}.`
          }
        }
        if (available && c.ability.removeFear && removableFearCount(player) === 0) {
          available = false
          reason = 'No Fear you could remove.'
        }
      }

      return { source: 'camp', id: c.id, name: c.name, text: c.text, available, reason }
    })
}

export function abilityOptions(state, player) {
  return [...gearAbilities(state, player), ...campAbilities(state, player)]
}

/* ------------------------------------------------------------------ */
/* Using one                                                           */
/* ------------------------------------------------------------------ */

/**
 * Activates an ability as this survivor's action for the round.
 *
 * @param {object} selection - { source, id, uid?, options? }
 */
export function useAbility(state, player, selection) {
  const offered = abilityOptions(state, player).find((a) =>
    selection.source === 'gear'
      ? a.source === 'gear' && a.uid === selection.uid
      : a.source === 'camp' && a.id === selection.id,
  )

  if (!offered) return fail('That ability is not available to you right now.')
  if (!offered.available) return fail(offered.reason)

  return selection.source === 'gear'
    ? useGearAbility(state, player, selection, offered)
    : useCampAbility(state, player, selection, offered)
}

function useGearAbility(state, player, selection, offered) {
  const gear = GEAR_BY_ID[offered.id]
  const spec = gear.ability

  if (spec.protection) {
    state.tonight.protection += spec.protection
    logEvent(state, 'ability', `${player.name} lit the ${gear.name}: +${spec.protection} Protection tonight.`, {
      playerId: player.id,
      abilityId: offered.id,
      protection: spec.protection,
    })
  }

  if (spec.fearShields) {
    const targetId = selection.options?.shieldPlayerId ?? player.id
    const target = state.players.find((p) => p.id === targetId)
    if (!target) return fail('No such survivor to shield.')

    for (let i = 0; i < spec.fearShields; i++) {
      state.tonight.fearShields.push({ playerId: target.id, used: false })
    }
    logEvent(state, 'fear-shield', `${target.name} will ignore the next Fear gained tonight.`, {
      playerId: target.id,
      sourceId: offered.id,
    })
  }

  if (spec.removeFear) {
    removeFear(state, player, spec.removeFear, { source: gear.name })
  }

  if (spec.spendsUse) {
    const used = useGear(state, player, offered.uid, { reason: `${gear.name} ability` })
    if (!used.ok) return used
  }

  // Garland leaves the game on its second use, whether or not it broke on
  // durability -- "then remove Garland from your deck/game".
  if (spec.removesSelf) {
    for (const zone of ['readyGear', 'usedGear']) {
      const index = player[zone].findIndex((c) => c.uid === offered.uid)
      if (index !== -1) {
        const [card] = player[zone].splice(index, 1)
        player.removed.push(card)
        break
      }
    }
    logEvent(state, 'gear-removed', `${gear.name} is spent and leaves the game.`, {
      playerId: player.id,
      cardId: offered.id,
      uid: offered.uid,
    })
  }

  return ok()
}

function useCampAbility(state, player, selection, offered) {
  const def = CAMP_IMPROVEMENTS.find((c) => c.id === offered.id)
  const spec = def.ability

  for (const [resource, amount] of Object.entries(spec.cost ?? {})) {
    state.resources[resource] -= amount
  }

  if (spec.removeFear) {
    // "up to 3" -- removing fewer is never better, so take as many as exist.
    const removed = removeFear(state, player, spec.removeFear, { source: def.name })
    logEvent(state, 'ability', `${player.name} used the ${def.name} and shed ${removed} Fear.`, {
      playerId: player.id,
      abilityId: offered.id,
      removed,
    })
  }

  if (spec.oncePerDay) {
    state.camp.improvements[offered.id].usedOnDay = state.day
  }

  return ok()
}
