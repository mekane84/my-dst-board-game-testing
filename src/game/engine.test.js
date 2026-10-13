import { describe, it, expect } from 'vitest'
import {
  createGame,
  applyAction,
  endPhase,
  currentPhase,
  currentTile,
  canCraft,
  missingFor,
  isLit,
  replay,
} from './engine.js'
import { cloneRules } from './rules.js'

/** Runs upkeep until the given phase is current. */
function advanceTo(state, phaseId) {
  let guard = 0
  while (currentPhase(state).id !== phaseId && state.status === 'playing') {
    endPhase(state)
    if (++guard > 20) throw new Error(`never reached phase "${phaseId}"`)
  }
  return state
}

function give(state, resources) {
  Object.assign(state.resources, resources)
}

describe('setup', () => {
  it('puts the player at camp with the configured meters', () => {
    const state = createGame({ seed: 'test' })
    expect(state.player.x).toBe(state.map.camp.x)
    expect(state.player.y).toBe(state.map.camp.y)
    expect(state.player.health).toBe(state.rules.meters.startHealth)
    expect(state.day).toBe(1)
    expect(currentPhase(state).id).toBe('day')
  })

  it('reveals camp and its neighbours, but not the far corners', () => {
    const state = createGame({ seed: 'test' })
    expect(currentTile(state).explored).toBe(true)
    expect(state.map.tiles[0].explored).toBe(false)
  })
})

describe('determinism', () => {
  it('generates an identical board for the same seed', () => {
    const a = createGame({ seed: 'seed-one' })
    const b = createGame({ seed: 'seed-one' })
    expect(a.map.tiles).toEqual(b.map.tiles)
  })

  it('generates a different board for a different seed', () => {
    const a = createGame({ seed: 'seed-one' })
    const b = createGame({ seed: 'seed-two' })
    expect(a.map.tiles).not.toEqual(b.map.tiles)
  })
})

describe('action points', () => {
  it('refuses an action the player cannot afford', () => {
    const state = createGame({ seed: 'ap' })
    state.actionPoints = 0
    const result = applyAction(state, { type: 'rest' })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/action points/i)
  })

  it('ends the phase automatically once points run out', () => {
    const state = createGame({ seed: 'ap' })
    const points = currentPhase(state).actionPoints
    for (let i = 0; i < points; i++) applyAction(state, { type: 'rest' })
    expect(currentPhase(state).id).toBe('dusk')
  })

  it('does not charge for an illegal action', () => {
    const state = createGame({ seed: 'ap' })
    const before = state.actionPoints
    applyAction(state, { type: 'move', to: { x: 99, y: 99 } })
    expect(state.actionPoints).toBe(before)
  })
})

describe('gathering', () => {
  it('yields the biome amount and depletes the tile', () => {
    const state = createGame({ seed: 'gather' })
    const tile = currentTile(state)
    tile.biome = 'forest'
    tile.remaining = 4

    applyAction(state, { type: 'gather' })
    expect(state.resources.wood).toBe(2)
    expect(tile.remaining).toBe(3)
  })

  it('refuses an exhausted tile', () => {
    const state = createGame({ seed: 'gather' })
    const tile = currentTile(state)
    tile.biome = 'forest'
    tile.remaining = 0

    const result = applyAction(state, { type: 'gather' })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/exhausted/i)
  })

  it('gates gold behind the pickaxe', () => {
    const state = createGame({ seed: 'gather' })
    const tile = currentTile(state)
    tile.biome = 'goldVein'
    tile.remaining = 2

    const blocked = applyAction(state, { type: 'gather' })
    expect(blocked.ok).toBe(false)
    expect(blocked.reason).toMatch(/pickaxe/i)

    state.items.pickaxe = {}
    expect(applyAction(state, { type: 'gather' }).ok).toBe(true)
    expect(state.resources.gold).toBe(1)
  })

  it('applies the axe bonus to wood', () => {
    const state = createGame({ seed: 'gather' })
    const tile = currentTile(state)
    tile.biome = 'forest'
    tile.remaining = 4
    state.items.axe = {}

    applyAction(state, { type: 'gather' })
    expect(state.resources.wood).toBe(4)
  })
})

describe('crafting', () => {
  it('reports exactly what is missing', () => {
    const state = createGame({ seed: 'craft' })
    give(state, { twigs: 1, grass: 0 })
    expect(canCraft(state, 'torch')).toBe(false)
    expect(missingFor(state, 'torch')).toEqual({ twigs: 1, grass: 2 })
  })

  it('spends the resources and grants the item', () => {
    const state = createGame({ seed: 'craft' })
    give(state, { twigs: 2, grass: 2 })

    expect(applyAction(state, { type: 'craft', recipe: 'torch' }).ok).toBe(true)
    expect(state.items.torch.durability).toBe(2)
    expect(state.resources.twigs).toBe(0)
    expect(state.resources.grass).toBe(0)
  })

  it('builds a campfire onto the current tile, not the inventory', () => {
    const state = createGame({ seed: 'craft' })
    give(state, { wood: 3, grass: 2 })

    applyAction(state, { type: 'craft', recipe: 'campfire' })
    expect(currentTile(state).structure).toEqual({ type: 'campfire', durability: 5 })
    expect(state.items.campfire).toBeUndefined()
  })

  it('tops up an existing torch rather than replacing it', () => {
    const state = createGame({ seed: 'craft' })
    give(state, { twigs: 4, grass: 4 })

    applyAction(state, { type: 'craft', recipe: 'torch' })
    applyAction(state, { type: 'craft', recipe: 'torch' })
    expect(state.items.torch.durability).toBe(4)
  })
})

describe('upkeep', () => {
  it('drains hunger by the phase amount', () => {
    const state = createGame({ seed: 'upkeep' })
    endPhase(state)
    expect(state.player.hunger).toBe(state.rules.meters.startHunger - 4)
  })

  it('costs health while hunger sits at zero', () => {
    const state = createGame({ seed: 'upkeep' })
    state.player.hunger = 0
    endPhase(state)
    expect(state.player.health).toBe(
      state.rules.meters.startHealth - state.rules.hunger.starvingHealthDrain,
    )
  })

  it('clamps meters instead of overflowing them', () => {
    const state = createGame({ seed: 'upkeep' })
    applyAction(state, { type: 'eat', food: 'berries' })
    expect(state.player.hunger).toBe(state.rules.meters.maxHunger)
  })
})

describe('darkness', () => {
  it('punishes an unlit night', () => {
    const state = createGame({ seed: 'dark' })
    advanceTo(state, 'night')
    expect(isLit(state)).toBe(false)

    const before = state.player.health
    endPhase(state)
    expect(state.player.health).toBe(before - state.rules.darkness.charlieDamage)
  })

  it('spares a player holding a lit torch', () => {
    const state = createGame({ seed: 'dark' })
    give(state, { twigs: 2, grass: 2 })
    applyAction(state, { type: 'craft', recipe: 'torch' })

    advanceTo(state, 'night')
    expect(isLit(state)).toBe(true)

    const before = state.player.health
    endPhase(state)
    expect(state.player.health).toBe(before)
  })

  it('halves the damage for a player with a spear', () => {
    const state = createGame({ seed: 'dark' })
    state.items.spear = {}
    advanceTo(state, 'night')

    const before = state.player.health
    endPhase(state)
    expect(state.player.health).toBe(before - state.rules.darkness.charlieDamage / 2)
  })

  it('burns the torch down over successive nights', () => {
    const state = createGame({ seed: 'dark' })
    give(state, { twigs: 2, grass: 2 })
    applyAction(state, { type: 'craft', recipe: 'torch' })

    advanceTo(state, 'dusk')
    endPhase(state)
    expect(state.items.torch.durability).toBe(1)

    endPhase(state)
    expect(state.items.torch).toBeUndefined()
  })
})

describe('cooking', () => {
  it('needs a lit campfire', () => {
    const state = createGame({ seed: 'cook' })
    const result = applyAction(state, { type: 'cook' })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/campfire/i)
  })

  it('upgrades berries when one is available', () => {
    const state = createGame({ seed: 'cook' })
    give(state, { wood: 3, grass: 2, berries: 1 })
    applyAction(state, { type: 'craft', recipe: 'campfire' })

    expect(applyAction(state, { type: 'cook' }).ok).toBe(true)
    expect(state.resources.berries).toBe(0)
    expect(state.resources.cookedBerries).toBe(1)
  })
})

describe('win and loss', () => {
  it('ends in a win after surviving the configured days', () => {
    const rules = cloneRules()
    rules.meta.daysToSurvive = 1
    const state = createGame({ seed: 'win', rules })

    for (let i = 0; i < 3; i++) endPhase(state)
    expect(state.status).toBe('won')
  })

  it('ends in a loss when health reaches zero', () => {
    const rules = cloneRules()
    rules.meters.startHealth = 10
    const state = createGame({ seed: 'lose', rules })

    advanceTo(state, 'night')
    endPhase(state)
    expect(state.status).toBe('lost')
  })

  it('refuses actions once the game is over', () => {
    const state = createGame({ seed: 'over' })
    state.status = 'lost'
    expect(applyAction(state, { type: 'rest' }).ok).toBe(false)
  })
})

describe('replay', () => {
  // Deliberately avoids the `give` helper: injected resources are not recorded
  // in history, so a test using them would pass even if replay were broken.
  const script = (camp) => [
    { type: 'move', to: { x: camp.x + 1, y: camp.y } },
    { type: 'gather' },
    { type: 'gather' },
    { type: 'move', to: { x: camp.x + 1, y: camp.y + 1 } },
    { type: 'gather' },
    { type: 'rest' },
    { type: 'eat', food: 'berries' },
    { type: 'gather' },
    { type: 'move', to: { x: camp.x, y: camp.y + 1 } },
    { type: 'gather' },
  ]

  it('reproduces a session exactly from seed plus history', () => {
    const state = createGame({ seed: 'replay-me' })
    for (const action of script(state.map.camp)) applyAction(state, action)

    // The script has to actually do something, or this proves nothing.
    expect(state.history.length).toBeGreaterThan(5)

    const again = replay('replay-me', state.history)

    expect(again.player).toEqual(state.player)
    expect(again.resources).toEqual(state.resources)
    expect(again.items).toEqual(state.items)
    expect(again.actionPoints).toBe(state.actionPoints)
    expect(again.day).toBe(state.day)
    expect(again.phaseIndex).toBe(state.phaseIndex)
    expect(again.status).toBe(state.status)
    expect(again.map.tiles).toEqual(state.map.tiles)
  })

  it('lands somewhere else when the same history runs on a different seed', () => {
    const state = createGame({ seed: 'replay-me' })
    for (const action of script(state.map.camp)) applyAction(state, action)

    const elsewhere = replay('a-different-world', state.history)
    expect(elsewhere.resources).not.toEqual(state.resources)
  })
})
