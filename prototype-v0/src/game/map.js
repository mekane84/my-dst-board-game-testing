/**
 * Map generation.
 *
 * A plain square grid — easy to reason about on a physical board, and easy to
 * draw. Camp sits in the middle; biomes are scattered by weight around it.
 */

import { RULES } from './rules.js'

/**
 * Builds the board for a given seed.
 *
 * @param {ReturnType<import('./rng.js').makeRng>} rng
 * @param {typeof RULES} rules
 */
export function generateMap(rng, rules = RULES) {
  const { mapWidth, mapHeight } = rules.meta

  const weighted = Object.entries(rules.biomes)
    .filter(([, biome]) => biome.density > 0)
    .map(([id, biome]) => ({ item: id, weight: biome.density }))

  const campX = Math.floor(mapWidth / 2)
  const campY = Math.floor(mapHeight / 2)

  const tiles = []
  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
      const isCamp = x === campX && y === campY
      const biomeId = isCamp ? 'camp' : rng.weighted(weighted)
      const biome = rules.biomes[biomeId]

      tiles.push({
        x,
        y,
        biome: biomeId,
        /** Gathers remaining before the tile is spent. */
        remaining: biome.resource ? biome.amount : 0,
        /** A campfire built here, if any. */
        structure: null,
        /** Fog of war — camp and its neighbours start revealed. */
        explored: isCamp || isAdjacent({ x, y }, { x: campX, y: campY }),
      })
    }
  }

  return {
    width: mapWidth,
    height: mapHeight,
    camp: { x: campX, y: campY },
    tiles,
  }
}

export function tileAt(map, x, y) {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null
  return map.tiles[y * map.width + x]
}

/** Orthogonal adjacency — no diagonals, matching how the physical board plays. */
export function isAdjacent(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1
}

/** Tiles a player at (x, y) could legally move to. */
export function neighbours(map, x, y) {
  return [
    tileAt(map, x, y - 1),
    tileAt(map, x + 1, y),
    tileAt(map, x, y + 1),
    tileAt(map, x - 1, y),
  ].filter(Boolean)
}

/** Reveals a tile and everything orthogonally touching it. */
export function reveal(map, x, y) {
  const here = tileAt(map, x, y)
  if (here) here.explored = true
  for (const tile of neighbours(map, x, y)) tile.explored = true
}
