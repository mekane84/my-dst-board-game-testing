/**
 * The three Day action rounds.
 *
 * Each round runs: every survivor secretly selects one action, both reveal
 * simultaneously, the team picks the order to resolve them in, then they
 * resolve. Three rounds make a Day, which is why there is no action-point pool
 * -- each survivor simply acts once per round.
 *
 * PHASE 3 SCOPE: the round machinery plus the starter actions that can fully
 * resolve with what exists today. Camp Gather, Prepare and Recover work.
 * Location Gather and Explore need Phase 5; Work needs Phase 4. Those report
 * why they are unavailable rather than silently doing nothing.
 */

import { logEvent } from './setup.js'
import { moveCard, createRound } from './state.js'
import { STARTER_CARDS } from '../data/starterCards.js'
import { GEAR_BY_ID } from '../data/gear.js'
import { BUILDABLE_BY_ID, CAMP_IMPROVEMENTS } from '../data/campImprovements.js'
import { readyGearById, useGear } from './gear.js'
import { craftGear, buildStructure } from './crafting.js'
import { abilityOptions, useAbility } from './abilities.js'
import { healHealth } from './survivor.js'
import { exploreLocation, gatherAtLocation, locationOptions } from './locations.js'
import { harvestFoodSource, foodSourceOptions } from './food.js'

const ok = (extra = {}) => ({ ok: true, ...extra })
const fail = (reason) => ({ ok: false, reason })

/* ------------------------------------------------------------------ */
/* Round lifecycle                                                     */
/* ------------------------------------------------------------------ */

/** Begins Day `state.day`: resets the round counter. Hands are drawn by draw.js. */
export function startActionRounds(state) {
  state.actionRound = 1
  state.round = createRound(1)
  logEvent(state, 'round-start', `Day ${state.day}, action round 1.`)
}

export function allSelected(state) {
  return state.players.every((p) => state.round.selections[p.id] != null)
}

/**
 * Reveals both selections at once.
 *
 * Deliberately a separate step from selecting: the hotseat flow depends on
 * nothing being visible until everyone has locked in.
 */
export function revealSelections(state) {
  if (state.round.phase !== 'selecting') return fail('Selections are already revealed.')
  if (!allSelected(state)) return fail('Not every survivor has locked in an action.')

  state.round.phase = 'revealed'
  logEvent(state, 'reveal', `Round ${state.round.number} selections revealed.`, {
    selections: Object.fromEntries(
      Object.entries(state.round.selections).map(([id, s]) => [id, describeSelection(state, s)]),
    ),
  })
  return ok()
}

/** The team chooses who resolves first. Must list every survivor exactly once. */
export function setResolutionOrder(state, order) {
  if (state.round.phase !== 'revealed') return fail('Reveal the selections first.')

  const ids = state.players.map((p) => p.id)
  const unique = new Set(order)
  if (order.length !== ids.length || unique.size !== ids.length || !order.every((id) => ids.includes(id))) {
    return fail('Resolution order must list every survivor exactly once.')
  }

  state.round.order = [...order]
  state.round.phase = 'resolving'
  logEvent(state, 'order-chosen', `Resolution order: ${order.join(', ')}.`, { order })
  return ok()
}

/** Resolves the next survivor's action in the chosen order. */
export function resolveNextAction(state) {
  const round = state.round
  if (round.phase !== 'resolving') return fail('Set a resolution order first.')
  if (round.resolvedCount >= round.order.length) return fail('Every action has resolved.')

  const playerId = round.order[round.resolvedCount]
  const player = state.players.find((p) => p.id === playerId)
  const selection = round.selections[playerId]

  const result = applySelection(state, player, selection)
  if (!result.ok) return result

  // Location Dangers ask questions. The action is not finished until the
  // player has answered, so hold the round here.
  if (state.pending) return ok({ playerId, pending: true })

  round.resolvedCount += 1
  if (round.resolvedCount >= round.order.length) round.phase = 'complete'

  return ok({ playerId })
}

/**
 * Hands the current action back to its survivor to choose again.
 *
 * An action can be legal when selected and impossible by the time it resolves,
 * because the survivor ahead of them in the order spent the same resources.
 *
 * RESOLVED 2026-10-15: that survivor simply picks again rather than losing the
 * action. Their card was never spent -- resolution failed before it left hand --
 * so nothing is wasted, and the round waits on them.
 */
export function reselectCurrentAction(state, reason) {
  const round = state.round
  if (round.phase !== 'resolving') return fail('Nothing is being resolved.')

  const playerId = round.order[round.resolvedCount]
  const player = state.players.find((p) => p.id === playerId)

  delete round.selections[playerId]
  round.phase = 'reselecting'
  round.reselectFor = playerId

  logEvent(state, 'reselect', `${player.name} must choose again: ${reason}`, {
    playerId,
    reason,
    round: round.number,
  })

  return ok({ playerId })
}

/**
 * Completes the action that was waiting on a decision.
 *
 * Called once `state.pending` has been answered, to advance the round that
 * resolveNextAction deliberately left hanging.
 */
export function finishPendingAction(state) {
  if (state.pending) return fail('A decision is still waiting.')

  const round = state.round
  if (round.phase !== 'resolving') return fail('Nothing is being resolved.')

  round.resolvedCount += 1
  if (round.resolvedCount >= round.order.length) round.phase = 'complete'
  return ok()
}

export function roundComplete(state) {
  return state.round.phase === 'complete'
}

/**
 * Moves to the next action round.
 *
 * @returns {{ok: boolean, dayComplete?: boolean, reason?: string}} dayComplete
 *   is true after the third round, when the Night should resolve.
 */
export function advanceRound(state) {
  if (!roundComplete(state)) return fail('Finish resolving this round first.')

  const { actionsPerDay } = state.constants.meta
  if (state.round.number >= actionsPerDay) {
    logEvent(state, 'rounds-complete', `All ${actionsPerDay} action rounds are done for Day ${state.day}.`)
    return ok({ dayComplete: true })
  }

  state.actionRound = state.round.number + 1
  state.round = createRound(state.actionRound)
  logEvent(state, 'round-start', `Day ${state.day}, action round ${state.actionRound}.`)
  return ok({ dayComplete: false })
}

/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */

/**
 * Locks in one survivor's action for this round.
 *
 * Selections can be changed freely until everyone has locked and the round is
 * revealed -- the secrecy that matters is between players, not against undo.
 *
 * Selection shapes:
 *   { kind: 'card', uid, mode: 'effect', options }
 *   { kind: 'card', uid, mode: 'work', work }        (Phase 4)
 *   { kind: 'ability', source, id }                  (Phase 4/7)
 *   { kind: 'pass' }
 */
export function selectAction(state, playerId, selection) {
  const { phase, reselectFor } = state.round

  if (phase === 'reselecting') {
    if (playerId !== reselectFor) {
      return fail('Only the survivor who must choose again may select right now.')
    }
  } else if (phase !== 'selecting') {
    return fail('Selections are closed for this round.')
  }

  const player = state.players.find((p) => p.id === playerId)
  if (!player) return fail(`No such survivor: ${playerId}`)

  const check = validateSelection(state, player, selection)
  if (!check.ok) return check

  state.round.selections[playerId] = selection

  if (state.round.phase === 'reselecting') {
    state.round.phase = 'resolving'
    delete state.round.reselectFor
  }

  logEvent(state, 'select', `${player.name} locked in an action.`, {
    playerId,
    // The choice itself is deliberately NOT logged here -- the log is visible
    // to both players, and this is the hotseat secrecy boundary.
    round: state.round.number,
  })
  return ok()
}

export function clearSelection(state, playerId) {
  if (state.round.phase !== 'selecting') return fail('Selections are closed for this round.')
  delete state.round.selections[playerId]
  return ok()
}

function validateSelection(state, player, selection) {
  if (!selection || typeof selection !== 'object') return fail('No selection given.')

  if (selection.kind === 'pass') {
    if (legalCardSelections(state, player).length > 0) {
      return fail('You can only pass when no legal action is available.')
    }
    return ok()
  }

  if (selection.kind === 'ability') {
    // Taken INSTEAD of playing a starter card: costs one of the three daily
    // actions but no card from hand.
    const offered = abilityOptions(state, player).find((a) =>
      selection.source === 'gear'
        ? a.source === 'gear' && a.uid === selection.uid
        : a.source === 'camp' && a.id === selection.id,
    )
    if (!offered) return fail('That ability is not available to you right now.')
    return offered.available ? ok() : fail(offered.reason)
  }

  if (selection.kind !== 'card') return fail(`Unknown selection kind: ${selection.kind}`)

  const card = player.hand.find((c) => c.uid === selection.uid)
  if (!card) return fail('That card is not in your hand.')
  if (card.kind === 'fear') return fail('Fear has no effect and cannot be used as Work.')

  if (selection.mode === 'work') {
    // Deliberately lenient: this only checks the Work target exists. Whether
    // the team can AFFORD it is checked at resolution, because the other
    // survivor's action may resolve first and spend the same resources. That
    // is exactly why the team gets to choose the resolution order.
    const work = selection.work
    if (!work || typeof work !== 'object') return fail('Choose something to Work on.')
    if (work.type === 'craft') {
      return GEAR_BY_ID[work.id] ? ok() : fail(`No such Gear: ${work.id}`)
    }
    if (work.type === 'build') {
      return BUILDABLE_BY_ID[work.id] ? ok() : fail(`No such structure: ${work.id}`)
    }
    return fail(`Unknown Work type: ${work.type}`)
  }
  if (selection.mode !== 'effect') return fail(`Unknown mode: ${selection.mode}`)

  const handler = HANDLERS[card.cardId]
  if (!handler) return fail(`No handler for ${card.cardId}.`)

  return handler.available(state, player, selection.options ?? {})
}

/**
 * Every card selection this survivor could legally make right now, annotated
 * with why the unavailable ones are blocked so the UI can explain itself.
 */
export function legalSelections(state, player) {
  const out = []

  for (const card of player.hand) {
    if (card.kind === 'fear') {
      out.push({ uid: card.uid, cardId: card.cardId, mode: 'effect', available: false, reason: 'Fear has no effect.' })
      continue
    }

    const handler = HANDLERS[card.cardId]
    const check = handler
      ? handler.available(state, player, {})
      : fail(`No handler for ${card.cardId}.`)

    out.push({
      uid: card.uid,
      cardId: card.cardId,
      name: STARTER_CARDS[card.cardId]?.name ?? card.cardId,
      mode: 'effect',
      available: check.ok,
      reason: check.reason,
      options: handler?.options?.(state, player) ?? null,
    })
  }

  return out
}

function legalCardSelections(state, player) {
  return legalSelections(state, player).filter((s) => s.available)
}

/** Human-readable summary, used in the log after reveal. */
export function describeSelection(state, selection) {
  if (!selection) return 'nothing'
  if (selection.kind === 'pass') return 'passed'
  if (selection.kind === 'ability') {
    const label = GEAR_BY_ID[selection.id]?.name
      ?? CAMP_IMPROVEMENTS.find((c) => c.id === selection.id)?.name
      ?? selection.id
    return `${label} (ability)`
  }

  const name = cardNameByUid(state, selection.uid)
  if (selection.mode === 'work') return `${name} as Work`

  const opts = selection.options ?? {}
  const detail = opts.resource ?? opts.choice ?? opts.locationId
  return detail ? `${name} (${detail})` : name
}

function cardNameByUid(state, uid) {
  for (const player of state.players) {
    for (const zone of ['hand', 'played', 'discard', 'draw']) {
      const card = player[zone].find((c) => c.uid === uid)
      if (card) return STARTER_CARDS[card.cardId]?.name ?? card.cardId
    }
  }
  return 'a card'
}

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

function applySelection(state, player, selection) {
  if (selection.kind === 'ability') {
    return useAbility(state, player, selection)
  }

  if (selection.kind === 'pass') {
    logEvent(state, 'pass', `${player.name} had no legal action and passed.`, { playerId: player.id })
    return ok()
  }

  const card = player.hand.find((c) => c.uid === selection.uid)
  if (!card) return fail('That card is no longer in hand.')

  const result =
    selection.mode === 'work'
      ? applyWork(state, player, selection.work)
      : HANDLERS[card.cardId].resolve(state, player, selection.options ?? {})

  if (!result.ok) return result

  // Played cards sit in `played` until end-of-Day cleanup sweeps them away.
  // This happens even when the action is mid-decision: handlers validate
  // before they mutate, so reaching here means the action legally began.
  moveCard(player, card.uid, 'hand', 'played')
  return ok()
}

/** Any starter card may be spent as Work instead of its printed effect. */
function applyWork(state, player, work) {
  if (work.type === 'craft') return craftGear(state, player, work.id)
  if (work.type === 'build') return buildStructure(state, player, work.id, work.options ?? {})
  return fail(`Unknown Work type: ${work.type}`)
}

/* ------------------------------------------------------------------ */
/* Starter action handlers                                             */
/* ------------------------------------------------------------------ */

const HANDLERS = {
  gather: {
    /**
     * Camp Gather works today. Location Gather needs Phase 5, so a selection
     * targeting a Location is rejected with a reason rather than ignored.
     */
    available(state, player, options) {
      if (options.target === 'location') {
        const choice = locationOptions(state, player).find((l) => l.id === options.locationId)
        if (!choice) return fail('That Location has not been explored.')
        return choice.available ? ok() : fail(choice.reason)
      }

      if (options.target === 'food') {
        const choice = foodSourceOptions(state).find((f) => f.uid === options.foodUid)
        if (!choice) return fail('No such food source at Camp.')
        return choice.available ? ok() : fail(choice.reason)
      }

      return ok()
    },
    options(state, player) {
      return {
        campResources: [...state.constants.gather.campResources],
        locations: locationOptions(state, player),
        foodSources: foodSourceOptions(state),
      }
    },
    resolve(state, player, options) {
      const { campResources, campYield } = state.constants.gather

      if (options.target === 'location') {
        if (!options.locationId) return fail('Choose a Location to gather from.')
        return gatherAtLocation(state, player, options.locationId, { gearUid: options.gearUid })
      }

      if (options.target === 'food') {
        if (!options.foodUid) return fail('Choose a food source to harvest.')
        return harvestFoodSource(state, player, options.foodUid)
      }

      if (!options.resource) return fail('Choose a resource to gather at Camp.')
      if (!campResources.includes(options.resource)) {
        // Food is excluded from this list on purpose: it can never be gathered
        // at Camp, which is the whole reason Food is scarce.
        return fail(`${options.resource} cannot be gathered at Camp.`)
      }

      let amount = campYield

      // At most ONE Gear of a given type may modify a single Gather
      // (RESOLVED 2026-10-14). Using it moves it out of Ready Gear, which is
      // what enforces once-per-Day per card.
      if (options.gearUid) {
        const card = readyGearById(player, options.gearUid)
        if (!card) return fail('That Gear is not Ready. It may already have been used this Day.')

        const gear = GEAR_BY_ID[card.cardId]
        if (!gear?.gatherBonus) return fail(`${gear?.name ?? 'That Gear'} does not modify a Gather.`)
        if (gear.gatherBonus.resource !== options.resource) {
          return fail(`${gear.name} only helps when gathering ${gear.gatherBonus.resource}.`)
        }

        const used = useGear(state, player, options.gearUid, { reason: 'Gather bonus' })
        if (!used.ok) return used
        amount += gear.gatherBonus.amount
      }

      state.resources[options.resource] += amount
      logEvent(state, 'gather', `${player.name} gathered ${amount} ${options.resource} at Camp.`, {
        playerId: player.id,
        resource: options.resource,
        amount,
        modified: Boolean(options.gearUid),
      })
      return ok()
    },
  },

  explore: {
    /**
     * Always legal. An empty Location deck still finds nothing rather than
     * being illegal -- the rules say the Explore card may be used as Work
     * instead, which is the player's call, not a block.
     */
    available() {
      return ok()
    },
    resolve(state, player, options) {
      return exploreLocation(state, player, { gearUid: options.gearUid })
    },
  },

  prepare: {
    available() {
      return ok()
    },
    options() {
      return { choices: ['combat', 'protection'] }
    },
    resolve(state, player, options) {
      const choice = options.choice
      if (choice !== 'combat' && choice !== 'protection') {
        return fail('Choose +1 Combat or +1 Protection.')
      }

      let amount = 1

      // Spear and Torch REPLACE the Prepare's output rather than adding to it:
      // "that Prepare provides 3 Combat total instead of 1."
      if (options.gearUid) {
        const card = readyGearById(player, options.gearUid)
        if (!card) return fail('That Gear is not Ready. It may already have been used this Day.')

        const gear = GEAR_BY_ID[card.cardId]
        if (!gear?.prepareBonus) return fail(`${gear?.name ?? 'That Gear'} does not modify a Prepare.`)
        if (gear.prepareBonus.choice !== choice) {
          return fail(`${gear.name} only modifies a ${gear.prepareBonus.choice} Prepare.`)
        }

        const used = useGear(state, player, options.gearUid, { reason: 'Prepare modifier' })
        if (!used.ok) return used
        amount = gear.prepareBonus.total
      }

      state.tonight[choice] += amount
      logEvent(state, 'prepare', `${player.name} prepared +${amount} ${choice} for tonight.`, {
        playerId: player.id,
        choice,
        amount,
        total: state.tonight[choice],
      })
      return ok()
    },
  },

  recover: {
    available() {
      return ok()
    },
    resolve(state, player) {
      let amount = 1

      /**
       * RESOLVED 2026-10-14: "healing" is load-bearing. A Recover played at
       * full Health is not a healing Recover, so it neither heals nor burns
       * the Day's Lean-To bonus.
       */
      const leanTo = state.camp.improvements.lean_to
      const wouldHeal = player.health < state.constants.survivor.maxHealth

      if (leanTo && wouldHeal && leanTo.usedOnDay !== state.day) {
        amount = CAMP_IMPROVEMENTS.find((c) => c.id === 'lean_to').firstHealingRecoverHeals
        leanTo.usedOnDay = state.day
        logEvent(state, 'lean-to', `The Lean-To makes ${player.name}'s rest count for more.`, {
          playerId: player.id,
          heals: amount,
        })
      }

      // healHealth already logs the outcome, including "already at full
      // Health", so a second "used Recover" line would just be noise.
      healHealth(state, player, amount, { source: 'Recover' })
      return ok()
    },
  },
}

export { HANDLERS }
