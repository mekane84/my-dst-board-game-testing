/**
 * Seeded deterministic randomness.
 *
 * Every random outcome in the game goes through here. The RNG is a plain
 * serializable object -- no closures -- so it can live inside GameState and
 * survive a JSON export/import round-trip exactly. That is what makes
 * "export the state, reload it, get the same game" actually true.
 *
 * Usage is functional, matching the engine's style:
 *
 *   const rng = createRng('4471')
 *   const n = nextInt(rng, 1, 6)   // mutates rng.state
 */

/** mulberry32: one uint32 of state, good enough for a board game. */
function step(rng) {
  rng.state = (rng.state + 0x6d2b79f5) | 0
  let t = rng.state
  t = Math.imul(t ^ (t >>> 15), 1 | t)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  rng.calls++
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** FNV-1a, so seeds can be memorable strings rather than raw integers. */
export function hashSeed(input) {
  const str = String(input)
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Creates RNG state from a seed.
 *
 * @param {string|number} seed - shown in the UI and re-enterable by the player
 */
export function createRng(seed) {
  return {
    seed: String(seed),
    state: typeof seed === 'number' ? seed >>> 0 : hashSeed(seed),
    /** Rolls consumed so far. Purely diagnostic, but handy for desync hunts. */
    calls: 0,
  }
}

/** Exact copy, so you can look ahead without disturbing the real sequence. */
export function cloneRng(rng) {
  return { seed: rng.seed, state: rng.state, calls: rng.calls }
}

/** Float in [0, 1). */
export function nextFloat(rng) {
  return step(rng)
}

/** Integer in [min, max], inclusive at both ends. */
export function nextInt(rng, min, max) {
  return min + Math.floor(step(rng) * (max - min + 1))
}

/** Uniform choice. Returns undefined for an empty array. */
export function pick(rng, items) {
  if (items.length === 0) return undefined
  return items[Math.floor(step(rng) * items.length)]
}

/**
 * Fisher-Yates. Returns a new array; the input is never mutated, because deck
 * data is shared across games and must stay pristine.
 */
export function shuffle(rng, items) {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(step(rng) * (i + 1))
    const swap = out[i]
    out[i] = out[j]
    out[j] = swap
  }
  return out
}

/** A short, typeable seed -- what a tester would write on a playtest sheet. */
export function randomSeed() {
  return String(Math.floor(Math.random() * 9000) + 1000)
}
