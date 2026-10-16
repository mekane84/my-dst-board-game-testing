/**
 * Work: crafting Personal Gear and building Camp structures.
 *
 * Any starter action card may be spent as Work instead of its printed effect.
 * Fear cannot, and Personal Gear cannot. Costs come out of the shared pool
 * immediately, and newly crafted Gear is Ready the same Day.
 */

import { logEvent } from './setup.js'
import { GEAR_BY_ID } from '../data/gear.js'
import { BUILDABLE_BY_ID, MAJOR_IDS } from '../data/campImprovements.js'
import { createGearCard, findReadyGear, useGear, removeFear } from './gear.js'
import { transplantableGroves } from './locations.js'

const ok = (extra = {}) => ({ ok: true, ...extra })
const fail = (reason) => ({ ok: false, reason })

/* ------------------------------------------------------------------ */
/* Resource costs                                                      */
/* ------------------------------------------------------------------ */

/** Resources the team is short of for a cost, as `{ resource: missing }`. */
export function missingFor(state, cost) {
  const missing = {}
  for (const [resource, needed] of Object.entries(cost)) {
    const short = needed - (state.resources[resource] ?? 0)
    if (short > 0) missing[resource] = short
  }
  return missing
}

export function canAfford(state, cost) {
  return Object.keys(missingFor(state, cost)).length === 0
}

function describeMissing(missing) {
  return Object.entries(missing)
    .map(([resource, n]) => `${n} ${resource}`)
    .join(', ')
}

function payCost(state, cost) {
  for (const [resource, needed] of Object.entries(cost)) {
    state.resources[resource] -= needed
  }
}

/* ------------------------------------------------------------------ */
/* Crafting Personal Gear                                              */
/* ------------------------------------------------------------------ */

/**
 * Crafts Gear for the acting survivor. It is Ready immediately and can be used
 * the same Day if legal.
 *
 * Garland is the exception: its first use fires here, on craft, and is spent
 * whether or not there is any Fear to remove (RESOLVED 2026-10-14).
 */
export function craftGear(state, player, gearId) {
  const gear = GEAR_BY_ID[gearId]
  if (!gear) return fail(`No such Gear: ${gearId}`)

  const missing = missingFor(state, gear.cost)
  if (Object.keys(missing).length > 0) return fail(`Missing ${describeMissing(missing)}.`)

  payCost(state, gear.cost)

  const card = createGearCard(state, gearId)
  player.readyGear.push(card)

  logEvent(state, 'craft', `${player.name} crafted ${gear.name}.`, {
    playerId: player.id,
    cardId: gearId,
    uid: card.uid,
    cost: { ...gear.cost },
  })

  if (gearId === 'garland') {
    const removed = removeFear(state, player, 1, { source: 'Garland craft' })
    if (removed === 0) {
      logEvent(state, 'garland-wasted', `${player.name} had no Fear to remove - half the Garland was wasted.`, {
        playerId: player.id,
        uid: card.uid,
      })
    }
    // The craft-use is spent either way, which also exhausts it for the Day.
    useGear(state, player, card.uid, { reason: 'Garland craft' })
  }

  return ok({ uid: card.uid })
}

/* ------------------------------------------------------------------ */
/* Building Camp structures                                            */
/* ------------------------------------------------------------------ */

export function isBuilt(state, buildId) {
  if (state.camp.improvements[buildId]) return true
  return state.camp.foodSources.some((f) => f.id === buildId)
}

/**
 * Builds a Camp Improvement or a piece of food infrastructure.
 *
 * Major improvements are unique; food infrastructure is not, subject to cost
 * and to the Berry Grove transplant gating.
 */
export function buildStructure(state, player, buildId, options = {}) {
  const build = BUILDABLE_BY_ID[buildId]
  if (!build) return fail(`No such structure: ${buildId}`)

  if (build.unique && state.camp.improvements[buildId]) {
    return fail(`${build.name} is already built.`)
  }

  if (build.requiresGear && !findReadyGear(player, build.requiresGear)) {
    const needed = GEAR_BY_ID[build.requiresGear]?.name ?? build.requiresGear
    return fail(`You need a Ready ${needed}.`)
  }

  let grove = null
  if (build.requiresTransplantSlot) {
    const slot = findTransplantSlot(state, options.locationId)
    if (!slot.ok) return slot
    grove = slot.grove
  }

  const missing = missingFor(state, build.cost)
  if (Object.keys(missing).length > 0) return fail(`Missing ${describeMissing(missing)}.`)

  payCost(state, build.cost)

  if (build.family === 'major') {
    state.camp.improvements[buildId] = { id: buildId, builtOnDay: state.day }
  } else {
    state.camp.foodSources.push({
      id: buildId,
      builtOnDay: state.day,
      /** null means harvestable now; a Day number means resting until then. */
      availableOnDay: null,
      sourceLocationId: grove?.id ?? options.locationId ?? null,
    })
  }

  // One transplant per Grove, ever.
  if (grove) {
    grove.transplantUsed = true
    logEvent(state, 'transplant', `${grove.name} has given up its transplant.`, {
      locationId: grove.id,
    })
  }

  // The Shovel is exhausted for the Day but loses no durability -- it is
  // reusable Gear, so this just moves it to the used area.
  if (build.requiresGear) {
    const tool = findReadyGear(player, build.requiresGear)
    useGear(state, player, tool.uid, { reason: `${build.name} build` })
  }

  logEvent(state, 'build', `${player.name} built ${build.name}.`, {
    playerId: player.id,
    buildId,
    family: build.family,
    cost: { ...build.cost },
    day: state.day,
  })

  return ok()
}

/**
 * Finds a Berry Grove that can still be transplanted from.
 *
 * Each Grove supports exactly one transplant, ever, so the slot is consumed
 * by the build rather than being a per-Day allowance.
 */
function findTransplantSlot(state, locationId) {
  const groves = transplantableGroves(state)
  if (groves.length === 0) {
    return fail('No explored Berry Grove has an unused transplant opportunity.')
  }

  const grove = locationId ? groves.find((l) => l.id === locationId) : groves[0]
  if (!grove) return fail('That Berry Grove cannot be transplanted from.')
  return ok({ grove })
}

/** How many major Camp Improvements are built -- the 2-3 balance target. */
export function majorImprovementCount(state) {
  return MAJOR_IDS.filter((id) => state.camp.improvements[id]).length
}

/* ------------------------------------------------------------------ */
/* UI support                                                          */
/* ------------------------------------------------------------------ */

/** Everything the acting survivor could Work on, annotated with why not. */
export function workOptions(state, player) {
  const gear = Object.values(GEAR_BY_ID).map((g) => {
    const missing = missingFor(state, g.cost)
    const short = Object.keys(missing).length > 0
    return {
      kind: 'craft',
      id: g.id,
      name: g.name,
      cost: g.cost,
      available: !short,
      reason: short ? `Missing ${describeMissing(missing)}.` : null,
    }
  })

  const structures = Object.values(BUILDABLE_BY_ID).map((b) => {
    const missing = missingFor(state, b.cost)
    let available = Object.keys(missing).length === 0
    let reason = available ? null : `Missing ${describeMissing(missing)}.`

    if (b.unique && state.camp.improvements[b.id]) {
      available = false
      reason = 'Already built.'
    } else if (b.requiresGear && !findReadyGear(player, b.requiresGear)) {
      available = false
      reason = `Needs a Ready ${GEAR_BY_ID[b.requiresGear]?.name ?? b.requiresGear}.`
    } else if (b.requiresTransplantSlot) {
      const slot = findTransplantSlot(state)
      if (!slot.ok) {
        available = false
        reason = slot.reason
      }
    }

    return {
      kind: 'build',
      id: b.id,
      name: b.name,
      cost: b.cost,
      family: b.family,
      available,
      reason,
    }
  })

  return [...gear, ...structures]
}
