/**
 * Headless balance testing.
 *
 * A heuristic bot plays the game thousands of times so you can see the shape
 * of the difficulty curve — where players die, how often they win, whether
 * day 7 is a wall — without recruiting humans for every tweak.
 *
 * The bot is not clever. That is the point: it plays like a reasonable
 * first-time player, so its results are a floor, not a ceiling. If the bot
 * never survives past day 6, humans will struggle too.
 *
 *   npm run sim            # 500 games on the default rules
 *   npm run sim -- 2000    # more games, tighter numbers
 */

import { createGame, applyAction, endPhase, currentPhase, currentTile, canCraft, isLit, hasTool } from './engine.js'
import { RULES } from './rules.js'
import { tileAt, neighbours } from './map.js'

/** What the bot tries to keep stocked. Tuning these changes bot skill, not game balance. */
const TARGETS = { berries: 4, twigs: 4, grass: 4, wood: 3, flint: 2 }

/** Priority order when several things are short. */
const PRIORITY = ['berries', 'twigs', 'grass', 'wood', 'flint']

function resourceOf(state, tile) {
  return state.rules.biomes[tile.biome].resource
}

function shortfall(state) {
  return PRIORITY.filter((res) => (state.resources[res] ?? 0) < TARGETS[res])
}

function isTarget(state, tile, wanted) {
  const resource = resourceOf(state, tile)
  if (!resource || tile.remaining <= 0) return false
  if (resource === 'gold' && !hasTool(state, 'pickaxe')) return false
  return wanted ? wanted.includes(resource) : true
}

/** Breadth-first search for the nearest useful tile; returns the first step. */
function stepToward(state, wanted) {
  const start = { x: state.player.x, y: state.player.y }
  const key = (t) => `${t.x},${t.y}`

  const queue = [{ pos: start, first: null }]
  const seen = new Set([key(start)])

  while (queue.length) {
    const { pos, first } = queue.shift()
    const tile = tileAt(state.map, pos.x, pos.y)
    if (first && isTarget(state, tile, wanted)) return first

    for (const next of neighbours(state.map, pos.x, pos.y)) {
      if (seen.has(key(next))) continue
      seen.add(key(next))
      queue.push({ pos: { x: next.x, y: next.y }, first: first ?? { x: next.x, y: next.y } })
    }
  }
  return null
}

/** The bot's whole brain, in priority order. */
export function chooseAction(state) {
  const phase = currentPhase(state)
  const tile = currentTile(state)
  const { resources, player } = state

  // Eat before starving, best food first.
  if (player.hunger <= 30) {
    if (resources.cookedBerries > 0) return { type: 'eat', food: 'cookedBerries' }
    if (resources.berries > 0) return { type: 'eat', food: 'berries' }
  }

  // Get a light source up before the dark arrives.
  if (!isLit(state) && phase.id !== 'night') {
    if (canCraft(state, 'torch')) return { type: 'craft', recipe: 'torch' }
    if (canCraft(state, 'campfire')) return { type: 'craft', recipe: 'campfire' }
  }

  // Tools that pay for themselves.
  if (!hasTool(state, 'axe') && canCraft(state, 'axe')) return { type: 'craft', recipe: 'axe' }
  if (!hasTool(state, 'spear') && canCraft(state, 'spear')) return { type: 'craft', recipe: 'spear' }

  // Patch up when badly hurt, but only somewhere safe.
  if (player.health < 40 && isLit(state)) return { type: 'rest' }

  // Otherwise work toward whatever is short.
  const wanted = shortfall(state)
  if (isTarget(state, tile, wanted)) return { type: 'gather' }

  const step = stepToward(state, wanted.length ? wanted : null)
  if (step) return { type: 'move', to: step }

  if (isTarget(state, tile, null)) return { type: 'gather' }
  return { type: 'rest' }
}

/* ------------------------------------------------------------------ */
/* Batch running                                                       */
/* ------------------------------------------------------------------ */

/** Plays one game to completion and returns the finished state. */
export function playOut(seed, rules = RULES) {
  const state = createGame({ seed, rules })

  // A stuck bot must not hang the batch, so cap the steps and burn a phase
  // whenever it proposes something illegal.
  const maxSteps = rules.meta.daysToSurvive * 60
  let steps = 0

  while (state.status === 'playing' && steps++ < maxSteps) {
    const result = applyAction(state, chooseAction(state))
    if (!result.ok) endPhase(state)
  }

  return state
}

function percentile(sorted, p) {
  if (!sorted.length) return null
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[index]
}

/**
 * Plays `games` games and summarises the outcome.
 *
 * Seeds are derived from `seedPrefix`, so a batch is itself reproducible —
 * re-running after a rules tweak compares like with like.
 */
export function runBatch({ games = 500, rules = RULES, seedPrefix = 'sim' } = {}) {
  const deaths = []
  let wins = 0

  for (let i = 0; i < games; i++) {
    const state = playOut(`${seedPrefix}-${i}`, rules)
    if (state.status === 'won') wins++
    else deaths.push(state.day)
  }

  const sorted = [...deaths].sort((a, b) => a - b)
  const histogram = new Map()
  for (const day of deaths) histogram.set(day, (histogram.get(day) ?? 0) + 1)

  return {
    games,
    wins,
    losses: deaths.length,
    winRate: wins / games,
    daysToSurvive: rules.meta.daysToSurvive,
    earliestDeath: sorted[0] ?? null,
    medianDeath: percentile(sorted, 50),
    p10Death: percentile(sorted, 10),
    p90Death: percentile(sorted, 90),
    histogram: [...histogram.entries()].sort((a, b) => a[0] - b[0]),
  }
}

/** Renders a batch result as plain text, for the terminal or the UI. */
export function formatReport(stats) {
  const pct = (n) => `${(n * 100).toFixed(1)}%`
  const lines = [
    `Games:        ${stats.games}`,
    `Win rate:     ${pct(stats.winRate)}  (survived ${stats.daysToSurvive} days)`,
    `Deaths:       ${stats.losses}`,
  ]

  if (stats.losses > 0) {
    lines.push(
      `Death day:    median ${stats.medianDeath}, p10 ${stats.p10Death}, p90 ${stats.p90Death}`,
      '',
      'Deaths by day',
    )

    const peak = Math.max(...stats.histogram.map(([, count]) => count))
    for (const [day, count] of stats.histogram) {
      const bar = '#'.repeat(Math.max(1, Math.round((count / peak) * 40)))
      lines.push(`  day ${String(day).padStart(2)} ${bar} ${count}`)
    }
  }

  return lines.join('\n')
}
