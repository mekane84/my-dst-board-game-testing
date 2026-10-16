/**
 * Exploring, and Gathering from explored Locations.
 *
 * An explored Location is a small state record in `state.locations.explored`.
 * The card definition in src/data/locations.js is immutable shared data;
 * everything that changes during a game -- cooldowns, whether a Spider Den is
 * cleared, whether a Berry Grove's transplant has been used -- lives on the
 * record instead.
 */

import { logEvent } from './setup.js'
import { LOCATIONS_BY_ID } from '../data/locations.js'
import { runEffects, registerEffect } from './effects.js'
import { readyGearById, useGear } from './gear.js'
import { GEAR_BY_ID } from '../data/gear.js'

const ok = (extra = {}) => ({ ok: true, ...extra })
const fail = (reason) => ({ ok: false, reason })

function createExploredRecord(state, locationId) {
  const def = LOCATIONS_BY_ID[locationId]
  return {
    id: def.id,
    name: def.name,
    exploredOnDay: state.day,
    /** Day this Location was last Gathered -- enforces once per Day. */
    gatheredOnDay: null,
    /** Day it becomes harvestable again after a cooldown. */
    availableOnDay: null,
    transplantSlots: def.transplantSlots ?? 0,
    transplantUsed: false,
    cleared: false,
  }
}

export function exploredById(state, locationId) {
  return state.locations.explored.find((l) => l.id === locationId)
}

/**
 * Why this Location cannot be Gathered right now, or null if it can.
 *
 * Checked in the order a player would ask: does it even have a Gather, is it
 * spent, is it resting, have we already been today, do we have the tool.
 */
export function gatherBlockedReason(state, player, record) {
  const def = LOCATIONS_BY_ID[record.id]

  if (!def.gatherEffects) return 'This Location has no repeatable Gather.'
  if (def.clearable && record.cleared) return `${def.name} is cleared out.`

  if (record.availableOnDay !== null && state.day < record.availableOnDay) {
    return `Resting until Day ${record.availableOnDay}.`
  }
  if (record.gatheredOnDay === state.day) {
    return 'Already gathered here today.'
  }

  if (def.gatherRequiresGear) {
    const ready = player.readyGear.find(
      (c) => c.cardId === def.gatherRequiresGear && (c.uses === undefined || c.uses > 0),
    )
    if (!ready) {
      const gear = GEAR_BY_ID[def.gatherRequiresGear]
      return `Needs a Ready ${gear?.name ?? def.gatherRequiresGear}.`
    }
  }

  return null
}

/** Explored Locations annotated with whether this survivor can Gather them. */
export function locationOptions(state, player) {
  return state.locations.explored.map((record) => {
    const reason = gatherBlockedReason(state, player, record)
    return {
      id: record.id,
      name: record.name,
      available: reason === null,
      reason,
      gatheredOnDay: record.gatheredOnDay,
      availableOnDay: record.availableOnDay,
      transplantSlots: record.transplantSlots,
      transplantUsed: record.transplantUsed,
      cleared: record.cleared,
    }
  })
}

/* ------------------------------------------------------------------ */
/* Exploring                                                           */
/* ------------------------------------------------------------------ */

/**
 * Discovers one Location: records it, then runs Discovery followed by Danger.
 *
 * Both run as a single queue, so a decision part-way through Discovery still
 * leaves the Danger queued behind it.
 */
function discover(state, player, locationId) {
  const def = LOCATIONS_BY_ID[locationId]
  const record = createExploredRecord(state, locationId)
  state.locations.explored.push(record)

  logEvent(state, 'explore', `${player.name} discovered ${def.name}.`, {
    playerId: player.id,
    locationId,
  })

  const effects = [...(def.discoveryEffects ?? []), ...(def.dangerEffects ?? [])]
  const result = runEffects(state, player, effects, { location: record })
  return result.ok ? ok({ locationId, pending: result.pending }) : result
}

// Registered rather than built into effects.js, so the effect interpreter
// never needs to know what a Location is.
registerEffect('discoverLocation', (state, player, effect) => {
  for (const id of effect.bottom ?? []) state.locations.deck.push(id)
  return discover(state, player, effect.locationId)
})

/**
 * The Explore action.
 *
 * With a Ready Map, draws 2 and offers the choice, bottoming the one not taken.
 * An empty deck finds nothing -- the action is still spent.
 */
export function exploreLocation(state, player, { gearUid } = {}) {
  if (state.locations.deck.length === 0) {
    logEvent(state, 'explore-empty', `${player.name} explored, but there is nothing left to find.`, {
      playerId: player.id,
    })
    return ok({ found: false })
  }

  if (!gearUid) {
    return discover(state, player, state.locations.deck.shift())
  }

  const card = readyGearById(player, gearUid)
  if (!card) return fail('That Gear is not Ready. It may already have been used this Day.')
  if (GEAR_BY_ID[card.cardId]?.modifies !== 'explore') {
    return fail(`${GEAR_BY_ID[card.cardId]?.name ?? 'That Gear'} does not modify an Explore.`)
  }

  const used = useGear(state, player, gearUid, { reason: 'Explore' })
  if (!used.ok) return used

  const drawn = state.locations.deck.splice(0, 2)
  if (drawn.length === 1) return discover(state, player, drawn[0])

  const [first, second] = drawn
  return runEffects(state, player, [
    {
      type: 'choice',
      prompt: 'Map: which Location do you discover? The other goes to the bottom.',
      options: [
        {
          label: LOCATIONS_BY_ID[first].name,
          effects: [{ type: 'discoverLocation', locationId: first, bottom: [second] }],
        },
        {
          label: LOCATIONS_BY_ID[second].name,
          effects: [{ type: 'discoverLocation', locationId: second, bottom: [first] }],
        },
      ],
    },
  ])
}

/* ------------------------------------------------------------------ */
/* Gathering at a Location                                             */
/* ------------------------------------------------------------------ */

/**
 * Gathers from an explored Location.
 *
 * `gearUid` is an optional Gather modifier (Axe or Pickaxe). Gear the Location
 * REQUIRES -- a Trap, Fishing Rod or Spear -- is spent by the Location's own
 * effects instead, since the card says to use it rather than offering a bonus.
 */
export function gatherAtLocation(state, player, locationId, { gearUid } = {}) {
  const record = exploredById(state, locationId)
  if (!record) return fail('That Location has not been explored.')

  const blocked = gatherBlockedReason(state, player, record)
  if (blocked) return fail(blocked)

  const def = LOCATIONS_BY_ID[locationId]
  const effects = [...def.gatherEffects]

  if (gearUid) {
    const card = readyGearById(player, gearUid)
    if (!card) return fail('That Gear is not Ready. It may already have been used this Day.')

    const gear = GEAR_BY_ID[card.cardId]
    const bonus = gear?.gatherBonus
    if (!bonus) return fail(`${gear?.name ?? 'That Gear'} does not modify a Gather.`)

    const yieldsIt = def.gatherEffects.some(
      (e) => e.type === 'gain' && e.resource === bonus.resource,
    )
    if (!yieldsIt) return fail(`${gear.name} only helps when gathering ${bonus.resource}.`)

    const used = useGear(state, player, gearUid, { reason: 'Gather bonus' })
    if (!used.ok) return used
    effects.push({ type: 'gain', resource: bonus.resource, amount: bonus.amount })
  }

  record.gatheredOnDay = state.day
  if (def.cooldownDays) {
    // Harvested on Day D means unavailable D+1, back at the start of D+2.
    record.availableOnDay = state.day + def.cooldownDays + 1
  }

  logEvent(state, 'gather-location', `${player.name} gathered at ${def.name}.`, {
    playerId: player.id,
    locationId,
    restingUntil: record.availableOnDay,
  })

  return runEffects(state, player, effects, { location: record })
}

/** Explored Berry Groves with an unused transplant opportunity. */
export function transplantableGroves(state) {
  return state.locations.explored.filter((l) => l.transplantSlots > 0 && !l.transplantUsed)
}
