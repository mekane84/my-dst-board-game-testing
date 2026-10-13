/**
 * The bridge between the pure engine and Vue.
 *
 * All the game logic lives in src/game. This store does nothing but hold a
 * reactive copy of the state, forward actions, and expose a few derived
 * values the components want. Keep it thin — rules belong in rules.js.
 */

import { defineStore } from 'pinia'
import { computed, markRaw, ref } from 'vue'
import {
  createGame,
  applyAction,
  endPhase,
  currentPhase,
  currentTile,
  isLit,
  missingFor,
  canCraft,
} from '../game/engine.js'
import { randomSeed } from '../game/rng.js'
import { tileAt, isAdjacent } from '../game/map.js'

function start(seed) {
  const state = createGame({ seed })
  // The RNG holds closures and a getter; Vue has no business proxying it.
  state.rng = markRaw(state.rng)
  return state
}

export const useGameStore = defineStore('game', () => {
  const game = ref(start(randomSeed()))
  const lastError = ref('')

  const player = computed(() => game.value.player)
  const resources = computed(() => game.value.resources)
  const rules = computed(() => game.value.rules)
  const phase = computed(() => currentPhase(game.value))
  const tile = computed(() => currentTile(game.value))
  const lit = computed(() => isLit(game.value))
  const log = computed(() => [...game.value.log].reverse())

  /** Recipes decorated with whether they're affordable right now. */
  const recipes = computed(() =>
    Object.entries(rules.value.recipes).map(([name, recipe]) => ({
      name,
      label: recipe.label,
      type: recipe.type,
      cost: recipe.cost,
      owned: Boolean(game.value.items[name]),
      durability: game.value.items[name]?.durability ?? null,
      affordable: canCraft(game.value, name),
      missing: missingFor(game.value, name),
    })),
  )

  /** Food the player is actually carrying. */
  const edibles = computed(() =>
    Object.keys(rules.value.food)
      .filter((food) => (resources.value[food] ?? 0) > 0)
      .map((food) => ({
        name: food,
        count: resources.value[food],
        ...rules.value.food[food],
      })),
  )

  function canMoveTo(x, y) {
    const target = tileAt(game.value.map, x, y)
    return Boolean(target) && isAdjacent(player.value, target)
  }

  function act(action) {
    const result = applyAction(game.value, action)
    lastError.value = result.ok ? '' : result.reason
    return result.ok
  }

  /** Deliberately give up the rest of the phase — sometimes the right play. */
  function skipPhase() {
    lastError.value = ''
    endPhase(game.value)
  }

  function newGame(seed = randomSeed()) {
    game.value = start(seed)
    lastError.value = ''
  }

  /** Restart the current board from scratch, same layout. */
  function restart() {
    newGame(game.value.seed)
  }

  return {
    game,
    lastError,
    player,
    resources,
    rules,
    phase,
    tile,
    lit,
    log,
    recipes,
    edibles,
    canMoveTo,
    act,
    skipPhase,
    newGame,
    restart,
  }
})
