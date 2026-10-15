import { describe, it, expect } from 'vitest'
import { createRng, cloneRng, nextFloat, nextInt, pick, shuffle, hashSeed } from './rng.js'

/** Pulls `n` floats, advancing the rng. */
function take(rng, n) {
  return Array.from({ length: n }, () => nextFloat(rng))
}

describe('determinism', () => {
  it('produces an identical sequence for the same seed', () => {
    expect(take(createRng('alpha'), 20)).toEqual(take(createRng('alpha'), 20))
  })

  it('produces a different sequence for a different seed', () => {
    expect(take(createRng('alpha'), 20)).not.toEqual(take(createRng('beta'), 20))
  })

  it('treats numeric and string seeds consistently', () => {
    expect(take(createRng('4471'), 5)).toEqual(take(createRng('4471'), 5))
  })

  it('hashes seeds to a stable uint32', () => {
    expect(hashSeed('alpha')).toBe(hashSeed('alpha'))
    expect(hashSeed('alpha')).toBeGreaterThanOrEqual(0)
    expect(hashSeed('alpha')).toBeLessThan(2 ** 32)
  })
})

describe('serializability', () => {
  it('survives a JSON round-trip and resumes the same sequence', () => {
    const live = createRng('export-me')
    take(live, 7)

    const restored = JSON.parse(JSON.stringify(live))

    expect(take(restored, 10)).toEqual(take(live, 10))
  })

  it('holds no closures -- every field is plain data', () => {
    const rng = createRng('plain')
    for (const value of Object.values(rng)) {
      expect(typeof value).not.toBe('function')
    }
  })

  it('clones without aliasing the original', () => {
    const original = createRng('clone-me')
    const copy = cloneRng(original)

    take(copy, 5)

    expect(original.calls).toBe(0)
    expect(copy.calls).toBe(5)
  })

  it('counts every roll consumed', () => {
    const rng = createRng('counted')
    take(rng, 3)
    nextInt(rng, 1, 6)
    pick(rng, ['a', 'b'])
    expect(rng.calls).toBe(5)
  })
})

describe('nextInt', () => {
  it('stays within the inclusive range', () => {
    const rng = createRng('range')
    for (let i = 0; i < 500; i++) {
      const n = nextInt(rng, 3, 7)
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(7)
    }
  })

  it('reaches both endpoints', () => {
    const rng = createRng('endpoints')
    const seen = new Set()
    for (let i = 0; i < 500; i++) seen.add(nextInt(rng, 1, 3))
    expect([...seen].sort()).toEqual([1, 2, 3])
  })
})

describe('shuffle', () => {
  const deck = Array.from({ length: 23 }, (_, i) => `card-${i}`)

  it('never mutates the input', () => {
    const rng = createRng('pristine')
    const before = [...deck]
    shuffle(rng, deck)
    expect(deck).toEqual(before)
  })

  it('returns a permutation, losing and inventing nothing', () => {
    const result = shuffle(createRng('perm'), deck)
    expect(result).toHaveLength(deck.length)
    expect([...result].sort()).toEqual([...deck].sort())
  })

  it('orders identically for the same seed', () => {
    expect(shuffle(createRng('same'), deck)).toEqual(shuffle(createRng('same'), deck))
  })

  it('orders differently for different seeds', () => {
    expect(shuffle(createRng('one'), deck)).not.toEqual(shuffle(createRng('two'), deck))
  })

  it('handles empty and single-element arrays', () => {
    expect(shuffle(createRng('edge'), [])).toEqual([])
    expect(shuffle(createRng('edge'), ['only'])).toEqual(['only'])
  })
})

describe('pick', () => {
  it('always returns a member of the array', () => {
    const rng = createRng('pick')
    const items = ['a', 'b', 'c']
    for (let i = 0; i < 100; i++) expect(items).toContain(pick(rng, items))
  })

  it('returns undefined for an empty array', () => {
    expect(pick(createRng('empty'), [])).toBeUndefined()
  })
})
