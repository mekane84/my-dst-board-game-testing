/**
 * The rules engine.
 *
 * Pure JavaScript — no Vue, no DOM, no imports from anywhere outside this
 * folder. That constraint is deliberate: it means the whole game can run
 * headlessly in a test or a batch simulation, which is how you find out
 * whether day 7 is a cliff before you print any cards.
 *
 * State is mutated in place and the caller owns reactivity. Every action is
 * appended to `state.history`, so `seed + history` replays a session exactly.
 */

import { RULES, RESOURCES } from './rules.js'
import { makeRng, randomSeed } from './rng.js'
import { generateMap, tileAt, isAdjacent, reveal } from './map.js'

/** Creates a fresh game. Pass a seed to reproduce a previous session. */
export function createGame({ seed = randomSeed(), rules = RULES } = {}) {
  const rng = makeRng(seed)
  const map = generateMap(rng, rules)

  const state = {
    seed,
    rules,
    rng,
    map,
    player: {
      x: map.camp.x,
      y: map.camp.y,
      health: rules.meters.startHealth,
      hunger: rules.meters.startHunger,
      sanity: rules.meters.startSanity,
    },
    resources: { ...rules.startingResources },
    /** Crafted items. Light sources carry a `durability`; tools are permanent. */
    items: {},
    day: 1,
    phaseIndex: 0,
    actionPoints: rules.phases[0].actionPoints,
    status: 'playing',
    log: [],
    history: [],
  }

  logEvent(state, `Day 1 begins. You wake at camp with nothing but your wits.`)
  return state
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export function currentPhase(state) {
  return state.rules.phases[state.phaseIndex]
}

export function currentTile(state) {
  return tileAt(state.map, state.player.x, state.player.y)
}

export function hasTool(state, name) {
  return Boolean(state.items[name])
}

/** Is the player standing somewhere lit right now? */
export function isLit(state) {
  if (currentPhase(state).lit) return true

  const tile = currentTile(state)
  if (tile?.structure?.type === 'campfire' && tile.structure.durability > 0) return true

  const torch = state.items.torch
  return Boolean(torch && torch.durability > 0)
}

/** Resources the player is short of for a recipe, as `{ resource: missing }`. */
export function missingFor(state, recipeName) {
  const recipe = state.rules.recipes[recipeName]
  if (!recipe) return null

  const missing = {}
  for (const [resource, needed] of Object.entries(recipe.cost)) {
    const short = needed - (state.resources[resource] ?? 0)
    if (short > 0) missing[resource] = short
  }
  return missing
}

export function canCraft(state, recipeName) {
  const missing = missingFor(state, recipeName)
  return Boolean(missing) && Object.keys(missing).length === 0
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

const HANDLERS = {
  move: doMove,
  gather: doGather,
  craft: doCraft,
  eat: doEat,
  cook: doCook,
  rest: doRest,
}

/**
 * Applies one action.
 *
 * @returns {{ ok: boolean, reason?: string }} — a rejection is never an
 *   exception, because the UI needs to explain *why* a move is illegal.
 */
export function applyAction(state, action) {
  if (state.status !== 'playing') {
    return fail('The game is over.')
  }

  const handler = HANDLERS[action.type]
  if (!handler) return fail(`Unknown action "${action.type}".`)

  const cost = state.rules.actions[action.type]?.ap ?? 1
  if (state.actionPoints < cost) {
    return fail(`Not enough action points — ${action.type} costs ${cost}.`)
  }

  const result = handler(state, action)
  if (!result.ok) return result

  state.actionPoints -= cost
  state.history.push(action)

  // Running out of points is the common case for ending a phase, so do it for
  // the player rather than making them click an extra button.
  if (state.actionPoints <= 0) endPhase(state)

  return { ok: true }
}

function doMove(state, { to }) {
  if (!to) return fail('No destination given.')

  const target = tileAt(state.map, to.x, to.y)
  if (!target) return fail('That tile is off the map.')
  if (!isAdjacent(state.player, target)) return fail('You can only move to an adjacent tile.')

  state.player.x = target.x
  state.player.y = target.y
  reveal(state.map, target.x, target.y)

  logEvent(state, `Moved to ${state.rules.biomes[target.biome].label} (${target.x}, ${target.y}).`)
  return ok()
}

function doGather(state) {
  const tile = currentTile(state)
  const biome = state.rules.biomes[tile.biome]

  if (!biome.resource) return fail('Nothing to gather here.')
  if (tile.remaining <= 0) return fail('This tile is exhausted.')

  // Some resources are gated behind a tool.
  const gate = Object.entries(state.rules.recipes).find(([, r]) =>
    r.effect?.unlocks?.includes(biome.resource),
  )
  if (gate && !hasTool(state, gate[0])) {
    return fail(`You need ${state.rules.recipes[gate[0]].label.toLowerCase()} to gather ${biome.resource}.`)
  }

  let amount = biome.yield
  for (const [name, recipe] of Object.entries(state.rules.recipes)) {
    const bonus = recipe.effect?.bonusYield?.[biome.resource]
    if (bonus && hasTool(state, name)) amount += bonus
  }

  state.resources[biome.resource] += amount
  tile.remaining -= 1

  logEvent(state, `Gathered ${amount} ${biome.resource}.`)
  return ok()
}

function doCraft(state, { recipe: name }) {
  const recipe = state.rules.recipes[name]
  if (!recipe) return fail(`No such recipe "${name}".`)

  const missing = missingFor(state, name)
  if (Object.keys(missing).length > 0) {
    const text = Object.entries(missing)
      .map(([res, n]) => `${n} ${res}`)
      .join(', ')
    return fail(`Missing ${text}.`)
  }

  for (const [resource, needed] of Object.entries(recipe.cost)) {
    state.resources[resource] -= needed
  }

  if (recipe.type === 'structure') {
    currentTile(state).structure = { type: name, durability: recipe.durability }
    logEvent(state, `Built a ${recipe.label.toLowerCase()} here.`)
  } else if (recipe.type === 'light') {
    // Crafting a second torch tops the first one up rather than replacing it.
    const existing = state.items[name]
    state.items[name] = {
      durability: (existing?.durability ?? 0) + recipe.durability,
    }
    logEvent(state, `Crafted a ${recipe.label.toLowerCase()}.`)
  } else {
    state.items[name] = {}
    logEvent(state, `Crafted a ${recipe.label.toLowerCase()}.`)
  }

  return ok()
}

function doEat(state, { food = 'berries' } = {}) {
  const effect = state.rules.food[food]
  if (!effect) return fail(`"${food}" isn't food.`)
  if ((state.resources[food] ?? 0) <= 0) return fail(`You have no ${food}.`)

  state.resources[food] -= 1
  adjust(state, 'hunger', effect.hunger)
  adjust(state, 'sanity', effect.sanity)
  adjust(state, 'health', effect.health)

  logEvent(state, `Ate ${food} (+${effect.hunger} hunger).`)
  return ok()
}

function doCook(state) {
  const tile = currentTile(state)
  if (!(tile.structure?.type === 'campfire' && tile.structure.durability > 0)) {
    return fail('You need a lit campfire to cook.')
  }
  if (state.resources.berries <= 0) return fail('Nothing to cook.')

  state.resources.berries -= 1
  state.resources.cookedBerries += 1

  logEvent(state, 'Cooked berries over the fire.')
  return ok()
}

function doRest(state) {
  const { healthRestore } = state.rules.actions.rest

  adjust(state, 'health', healthRestore)
  adjust(state, 'sanity', state.rules.sanity.restRecovery)
  adjust(state, 'hunger', -state.rules.hunger.restSurcharge)

  logEvent(state, `Rested (+${healthRestore} health, but hungrier for it).`)
  return ok()
}

/* ------------------------------------------------------------------ */
/* Phase and day progression                                           */
/* ------------------------------------------------------------------ */

/**
 * Ends the current phase: upkeep fires, then the clock moves on.
 *
 * Called automatically when action points run out, and exposed so a player can
 * choose to skip a phase — sometimes hiding by the fire is the right play.
 */
export function endPhase(state) {
  if (state.status !== 'playing') return

  const phase = currentPhase(state)
  const lit = isLit(state)
  const { hunger, sanity, darkness } = state.rules

  adjust(state, 'hunger', -(hunger.drainPerPhase[phase.id] ?? 0))

  if (state.player.hunger <= 0) {
    adjust(state, 'health', -hunger.starvingHealthDrain)
    logEvent(state, `Starving — lost ${hunger.starvingHealthDrain} health.`, 'bad')
  }

  const sanityTable = lit ? sanity.changePerPhaseLit : sanity.changePerPhaseUnlit
  const sanityChange = sanityTable[phase.id] ?? 0
  if (sanityChange !== 0) {
    adjust(state, 'sanity', sanityChange)
    if (sanityChange < 0) {
      logEvent(state, `The dark presses in — lost ${-sanityChange} sanity.`, 'bad')
    }
  }

  if (phase.id === 'night' && !lit) {
    const mitigated = hasTool(state, 'spear')
    const damage = Math.round(
      darkness.charlieDamage * (mitigated ? 1 - darkness.spearMitigation : 1),
    )
    adjust(state, 'health', -damage)
    logEvent(
      state,
      mitigated
        ? `Something struck from the dark. You fought it off — ${damage} health.`
        : `Something struck from the dark — ${damage} health.`,
      'bad',
    )
  }

  if (phase.id === 'night' && state.player.sanity <= sanity.shadowThreshold) {
    adjust(state, 'health', -sanity.shadowHealthDamage)
    logEvent(state, `Shadows took shape — ${sanity.shadowHealthDamage} health.`, 'bad')
  }

  if (!phase.lit) burnLightSources(state)

  if (checkGameOver(state)) return

  advanceClock(state)
}

function burnLightSources(state) {
  const torch = state.items.torch
  if (torch && torch.durability > 0) {
    torch.durability -= 1
    if (torch.durability === 0) {
      delete state.items.torch
      logEvent(state, 'Your torch burned out.', 'bad')
    }
  }

  const tile = currentTile(state)
  if (tile.structure?.durability > 0) {
    tile.structure.durability -= 1
    if (tile.structure.durability === 0) {
      logEvent(state, 'The campfire burned down to ash.', 'bad')
    }
  }
}

function advanceClock(state) {
  state.phaseIndex += 1

  if (state.phaseIndex >= state.rules.phases.length) {
    state.phaseIndex = 0
    state.day += 1

    if (state.day > state.rules.meta.daysToSurvive) {
      state.status = 'won'
      logEvent(state, `You survived ${state.rules.meta.daysToSurvive} days.`, 'good')
      return
    }
    logEvent(state, `Day ${state.day} begins.`)
  }

  state.actionPoints = currentPhase(state).actionPoints
}

function checkGameOver(state) {
  if (state.player.health <= 0) {
    state.status = 'lost'
    logEvent(state, `You died on day ${state.day}.`, 'bad')
    return true
  }
  return false
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const METER_CAPS = {
  health: 'maxHealth',
  hunger: 'maxHunger',
  sanity: 'maxSanity',
}

/** Changes a meter and clamps it to [0, max]. */
function adjust(state, meter, delta) {
  if (!delta) return
  const max = state.rules.meters[METER_CAPS[meter]]
  state.player[meter] = Math.max(0, Math.min(max, state.player[meter] + delta))
}

function logEvent(state, message, tone = 'neutral') {
  state.log.push({
    day: state.day ?? 1,
    phase: state.rules?.phases[state.phaseIndex]?.id ?? 'day',
    message,
    tone,
  })
}

function ok() {
  return { ok: true }
}

function fail(reason) {
  return { ok: false, reason }
}

/**
 * Rebuilds a game from a seed and a recorded action list.
 *
 * This is what makes a bug report actionable: hand over the seed and the
 * history, and the exact same board plays out the exact same way.
 */
export function replay(seed, history, rules = RULES) {
  const state = createGame({ seed, rules })
  for (const action of history) {
    if (state.status !== 'playing') break
    applyAction(state, action)
  }
  return state
}

export { RESOURCES }
