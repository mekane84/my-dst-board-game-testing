/**
 * Terminal entry point for balance simulation.
 *
 * Kept separate from src/game/simulate.js so that file stays free of Node
 * imports and can run in the browser too.
 *
 *   npm run sim
 *   npm run sim -- 2000
 */

import { runBatch, formatReport } from '../src/game/simulate.js'
import { RULES } from '../src/game/rules.js'

const games = Number(process.argv[2]) || 500

if (!Number.isFinite(games) || games < 1) {
  console.error(`Not a usable game count: ${process.argv[2]}`)
  process.exit(1)
}

console.log(`Simulating ${games} games...\n`)

const started = Date.now()
const stats = runBatch({ games, rules: RULES })
const elapsed = ((Date.now() - started) / 1000).toFixed(1)

console.log(formatReport(stats))
console.log(`\nDone in ${elapsed}s`)
