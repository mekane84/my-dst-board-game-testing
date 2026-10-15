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

  round.resolvedCount += 1
  if (round.resolvedCount >= round.order.length) round.phase = 'complete'

  return ok({ playerId })
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
  if (state.round.phase !== 'selecting') return fail('Selections are closed for this round.')

  const player = state.players.find((p) => p.id === playerId)
  if (!player) return fail(`No such survivor: ${playerId}`)

  const check = validateSelection(state, player, selection)
  if (!check.ok) return check

  state.round.selections[playerId] = selection
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
    return fail('Action-cost Gear and Camp abilities arrive in Phase 4.')
  }

  if (selection.kind !== 'card') return fail(`Unknown selection kind: ${selection.kind}`)

  const card = player.hand.find((c) => c.uid === selection.uid)
  if (!card) return fail('That card is not in your hand.')
  if (card.kind === 'fear') return fail('Fear has no effect and cannot be used as Work.')

  if (selection.mode === 'work') {
    return fail('Crafting and building arrive in Phase 4.')
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
  if (selection.kind === 'ability') return `ability ${selection.id}`

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
  if (selection.kind === 'pass') {
    logEvent(state, 'pass', `${player.name} had no legal action and passed.`, { playerId: player.id })
    return ok()
  }

  const card = player.hand.find((c) => c.uid === selection.uid)
  if (!card) return fail('That card is no longer in hand.')

  const handler = HANDLERS[card.cardId]
  const result = handler.resolve(state, player, selection.options ?? {})
  if (!result.ok) return result

  // Played cards sit in `played` until end-of-Day cleanup sweeps them away.
  moveCard(player, card.uid, 'hand', 'played')
  return ok()
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
        return fail('Location Gather arrives in Phase 5.')
      }
      return ok()
    },
    options(state) {
      return { campResources: [...state.constants.gather.campResources] }
    },
    resolve(state, player, options) {
      const { campResources, campYield } = state.constants.gather

      if (options.target === 'location') return fail('Location Gather arrives in Phase 5.')
      if (!options.resource) return fail('Choose a resource to gather at Camp.')
      if (!campResources.includes(options.resource)) {
        // Food is excluded from this list on purpose: it can never be gathered
        // at Camp, which is the whole reason Food is scarce.
        return fail(`${options.resource} cannot be gathered at Camp.`)
      }

      state.resources[options.resource] += campYield
      logEvent(state, 'gather', `${player.name} gathered ${campYield} ${options.resource} at Camp.`, {
        playerId: player.id,
        resource: options.resource,
        amount: campYield,
      })
      return ok()
    },
  },

  explore: {
    available() {
      return fail('Explore needs Location effects, which arrive in Phase 5.')
    },
    resolve() {
      return fail('Explore needs Location effects, which arrive in Phase 5.')
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

      // Spear and Torch modify this in Phase 4.
      state.tonight[choice] += 1
      logEvent(state, 'prepare', `${player.name} prepared +1 ${choice} for tonight.`, {
        playerId: player.id,
        choice,
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
      const { maxHealth } = state.constants.survivor
      const before = player.health
      player.health = Math.min(maxHealth, player.health + 1)
      const healed = player.health - before

      // Lean-To's "first healing Recover each Day" bonus hooks in at Phase 7.
      logEvent(
        state,
        'recover',
        healed > 0
          ? `${player.name} recovered ${healed} Health (now ${player.health}).`
          : `${player.name} used Recover at full Health and healed nothing.`,
        { playerId: player.id, healed, health: player.health },
      )
      return ok()
    },
  },
}

export { HANDLERS }
