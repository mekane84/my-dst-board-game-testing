/**
 * The effect interpreter.
 *
 * Location Discoveries, Dangers and Gathers are authored as data -- small
 * effect descriptors -- rather than code, so a card's text and its behaviour
 * stay in one place in src/data/locations.js.
 *
 * Most Dangers force a decision ("Spend 1 Food or gain 1 Fear"), so resolution
 * has to be interruptible. Running effects either finishes, or parks a pending
 * decision on the state and returns. The caller shows it, the player answers,
 * and `resolveChoice` picks the queue back up where it stopped.
 *
 * Everything stored on `state.pending` is plain data, so a game paused on a
 * decision still exports and reloads cleanly.
 */

import { logEvent } from './setup.js'
import { loseHealth, loseHunger } from './survivor.js'
import { gainFear } from './draw.js'
import { removeFear, eligibleModifier, useGear } from './gear.js'

const ok = (extra = {}) => ({ ok: true, ...extra })
const fail = (reason) => ({ ok: false, reason })

/* ------------------------------------------------------------------ */
/* Running effects                                                     */
/* ------------------------------------------------------------------ */

/**
 * Runs a list of effects for one survivor.
 *
 * @returns {{ok: boolean, pending?: boolean, reason?: string}} `pending: true`
 *   means a decision is waiting on `state.pending`.
 */
export function runEffects(state, player, effects, context = {}) {
  return drain(state, player, [...(effects ?? [])], { gained: {}, ...context })
}

function drain(state, player, queue, context) {
  while (queue.length > 0) {
    const effect = queue.shift()

    if (effect.type === 'choice' || effect.type === 'take') {
      state.pending = buildPending(state, player, effect, queue, context)
      return ok({ pending: true })
    }

    const result = applyEffect(state, player, effect, context)
    if (!result.ok) return result

    // An effect may expand into more effects -- notably one that turns out to
    // need a decision. Those run before whatever was already queued.
    if (result.expand) queue.unshift(...result.expand)
  }

  state.pending = null
  return ok({ pending: false })
}

function buildPending(state, player, effect, queue, context) {
  const base = {
    kind: effect.type,
    playerId: player.id,
    prompt: effect.prompt ?? (effect.type === 'take' ? 'Take resources' : 'Choose one'),
    queue,
    context,
  }

  if (effect.type === 'take') {
    return {
      ...base,
      from: effect.from,
      total: effect.total,
      maxSame: effect.maxSame ?? effect.total,
    }
  }

  return {
    ...base,
    options: effect.options.map((option, index) => ({
      index,
      label: option.label,
      ...optionAvailability(state, player, option, context),
    })),
    // Kept so the chosen branch's effects survive the pause.
    branches: effect.options.map((option) => option.effects ?? []),
  }
}

/** An option can be blocked -- you cannot spend Food the team does not have. */
function optionAvailability(state, player, option, context) {
  const need = option.requires
  if (!need) return { available: true, reason: null }

  if (need.resource) {
    const pool = need.fromGained ? context.gained[need.resource] ?? 0 : state.resources[need.resource] ?? 0
    if (pool < need.amount) {
      return { available: false, reason: `Not enough ${need.resource}.` }
    }
  }

  if (need.gear && !eligibleModifier(player, need.gear)) {
    return { available: false, reason: `Needs a Ready ${need.gear.replace(/_/g, ' ')}.` }
  }

  return { available: true, reason: null }
}

/* ------------------------------------------------------------------ */
/* Answering a pending decision                                        */
/* ------------------------------------------------------------------ */

/** Picks one option of a pending `choice` and resumes resolution. */
export function resolveChoice(state, index) {
  const pending = state.pending
  if (!pending) return fail('There is no decision waiting.')
  if (pending.kind !== 'choice') return fail('The waiting decision is not a choice.')

  const option = pending.options[index]
  if (!option) return fail('No such option.')
  if (!option.available) return fail(option.reason ?? 'That option is not available.')

  const player = state.players.find((p) => p.id === pending.playerId)
  const queue = [...pending.branches[index], ...pending.queue]
  const context = pending.context

  logEvent(state, 'choice', `${player.name} chose: ${option.label}`, {
    playerId: player.id,
    label: option.label,
  })

  state.pending = null
  return drain(state, player, queue, context)
}

/**
 * Answers a pending `take` with a resource tally, e.g. Abandoned Camp's
 * "3 total, maximum 2 of the same".
 */
export function resolveTake(state, tally) {
  const pending = state.pending
  if (!pending) return fail('There is no decision waiting.')
  if (pending.kind !== 'take') return fail('The waiting decision is not a take.')

  const entries = Object.entries(tally).filter(([, n]) => n > 0)
  const total = entries.reduce((sum, [, n]) => sum + n, 0)

  if (total !== pending.total) return fail(`Take exactly ${pending.total} resources.`)
  for (const [resource, n] of entries) {
    if (!pending.from.includes(resource)) return fail(`${resource} is not on offer here.`)
    if (n > pending.maxSame) return fail(`At most ${pending.maxSame} of the same resource.`)
  }

  const player = state.players.find((p) => p.id === pending.playerId)
  const context = pending.context
  const queue = pending.queue

  for (const [resource, n] of entries) {
    state.resources[resource] += n
    context.gained[resource] = (context.gained[resource] ?? 0) + n
  }

  logEvent(
    state,
    'take',
    `${player.name} took ${entries.map(([r, n]) => `${n} ${r}`).join(', ')}.`,
    { playerId: player.id, tally },
  )

  state.pending = null
  return drain(state, player, queue, context)
}

/* ------------------------------------------------------------------ */
/* Individual effects                                                  */
/* ------------------------------------------------------------------ */

/**
 * Applies one effect.
 *
 * May return `expand`, a list of effects to splice in ahead of the rest of the
 * queue. That is how an effect that turns out to need a decision -- "remove
 * 1 Fear from any survivor" when both have some -- becomes a choice.
 */
function applyEffect(state, player, effect, context) {
  const handler = EFFECTS[effect.type]
  if (!handler) return fail(`Unknown effect type: ${effect.type}`)
  return handler(state, player, effect, context)
}

const EFFECTS = {
  gain(state, player, effect, context) {
    state.resources[effect.resource] += effect.amount
    context.gained[effect.resource] = (context.gained[effect.resource] ?? 0) + effect.amount

    logEvent(state, 'gain', `${player.name} gained ${effect.amount} ${effect.resource}.`, {
      playerId: player.id,
      resource: effect.resource,
      amount: effect.amount,
    })
    return ok()
  },

  /**
   * Spends from the shared pool. `fromGained` means "return what this card
   * just gave you", as on Carrot Patch and Fallen Timber.
   */
  spend(state, player, effect, context) {
    const available = effect.fromGained
      ? context.gained[effect.resource] ?? 0
      : state.resources[effect.resource] ?? 0

    if (available < effect.amount) return fail(`Not enough ${effect.resource}.`)

    state.resources[effect.resource] -= effect.amount
    if (effect.fromGained) {
      context.gained[effect.resource] -= effect.amount
    }

    logEvent(state, 'spend', `${player.name} spent ${effect.amount} ${effect.resource}.`, {
      playerId: player.id,
      resource: effect.resource,
      amount: effect.amount,
      returned: Boolean(effect.fromGained),
    })
    return ok()
  },

  fear(state, player, effect) {
    gainFear(state, player, effect.amount)
    return ok()
  },

  health(state, player, effect) {
    loseHealth(state, player, effect.amount, { source: effect.source ?? 'Location' })
    return ok()
  },

  hunger(state, player, effect) {
    loseHunger(state, player, effect.amount, { source: effect.source ?? 'Location' })
    return ok()
  },

  /**
   * Removes Fear. `target: 'any'` is a team decision, so when more than one
   * survivor is eligible this expands into a choice rather than guessing.
   */
  removeFear(state, player, effect) {
    const amount = effect.amount ?? 1

    if (effect.target !== 'any') {
      const removed = removeFear(state, player, amount, { source: 'Location' })
      return removed === 0 && effect.fallback ? ok({ expand: effect.fallback }) : ok()
    }

    const eligible = state.players.filter((p) => countRemovableFear(p) > 0)
    if (eligible.length === 0) {
      return effect.fallback ? ok({ expand: effect.fallback }) : ok()
    }
    if (eligible.length === 1) {
      removeFear(state, eligible[0], amount, { source: 'Location' })
      return ok()
    }

    return ok({
      expand: [
        {
          type: 'choice',
          prompt: `Remove ${amount} Fear from which survivor?`,
          options: eligible.map((p) => ({
            label: p.name,
            effects: [{ type: 'removeFearFrom', playerId: p.id, amount }],
          })),
        },
      ],
    })
  },

  removeFearFrom(state, player, effect) {
    const target = state.players.find((p) => p.id === effect.playerId)
    if (!target) return fail('No such survivor.')
    removeFear(state, target, effect.amount, { source: 'Location' })
    return ok()
  },

  /**
   * "Keep only 2 of the 3" / "Return 1 of that Food": gives back one unit of
   * whatever this card just handed over. Which one is the player's call when
   * the card gave more than one kind.
   */
  returnOneGained(state, player, effect, context) {
    const options = Object.entries(context.gained)
      .filter(([, n]) => n > 0)
      .map(([resource]) => ({
        label: `Return 1 ${resource}`,
        effects: [{ type: 'spend', resource, amount: 1, fromGained: true }],
      }))

    if (options.length === 0) return fail('Nothing gained here to give back.')
    if (options.length === 1) return ok({ expand: options[0].effects })
    return ok({ expand: [{ type: 'choice', prompt: 'Give back which resource?', options }] })
  },

  /** Spends a use of Ready Gear, e.g. a Spear clearing a Spider Den. */
  spendGearUse(state, player, effect) {
    const card = eligibleModifier(player, effect.gear)
    if (!card) return fail(`No Ready ${effect.gear.replace(/_/g, ' ')} to spend.`)
    return useGear(state, player, card.uid, { reason: effect.reason ?? 'Location' })
  },

  /** Sets a flag on the Location being resolved, such as a cleared Spider Den. */
  markLocation(state, player, effect, context) {
    const location = context.location
    if (!location) return fail('No Location in context to mark.')
    location[effect.flag] = true

    logEvent(state, 'location-marked', `${location.name} is now ${effect.flag}.`, {
      locationId: location.id,
      flag: effect.flag,
    })
    return ok()
  },
}

/**
 * Adds an effect handler from outside this module.
 *
 * Lets locations.js contribute a `discoverLocation` effect without the effect
 * interpreter importing it back, which would be a cycle.
 */
export function registerEffect(type, handler) {
  EFFECTS[type] = handler
}

function countRemovableFear(player) {
  return ['hand', 'played', 'discard'].reduce(
    (sum, zone) => sum + player[zone].filter((c) => c.kind === 'fear').length,
    0,
  )
}
