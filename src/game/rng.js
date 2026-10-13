/**
 * Seeded random number generation.
 *
 * Every roll in the game goes through here so that a seed plus a list of
 * actions fully reproduces a playtest. "Seed 4471 went badly on turn 12" is
 * then something you can replay instead of something you have to remember.
 */

/** mulberry32 — small, fast, and good enough for a board game. */
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Turns an arbitrary string into a 32-bit seed, so seeds can be memorable. */
export function hashSeed(input) {
  const str = String(input)
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function makeRng(seed) {
  const numericSeed = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed)
  let calls = 0
  const next = mulberry32(numericSeed)

  return {
    seed,
    numericSeed,
    /** How many rolls have been consumed — useful when debugging desyncs. */
    get calls() {
      return calls
    },
    /** Float in [0, 1). */
    float() {
      calls++
      return next()
    },
    /** Integer in [min, max] inclusive. */
    int(min, max) {
      calls++
      return min + Math.floor(next() * (max - min + 1))
    },
    /** Uniform choice from an array. */
    pick(arr) {
      calls++
      return arr[Math.floor(next() * arr.length)]
    },
    /**
     * Choice from `[{ item, weight }]`. Falls back to the last entry if
     * floating point leaves a sliver at the end.
     */
    weighted(entries) {
      calls++
      const total = entries.reduce((sum, e) => sum + e.weight, 0)
      let roll = next() * total
      for (const entry of entries) {
        roll -= entry.weight
        if (roll <= 0) return entry.item
      }
      return entries[entries.length - 1].item
    },
    /** Fisher-Yates, returns a new array. */
    shuffle(arr) {
      const out = [...arr]
      for (let i = out.length - 1; i > 0; i--) {
        calls++
        const j = Math.floor(next() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    },
  }
}

/** A short, typeable seed — what you'd jot on a playtest sheet. */
export function randomSeed() {
  return Math.floor(Math.random() * 9000 + 1000).toString()
}
