<script setup>
import { computed } from 'vue'
import { useGameStore } from '../stores/game.js'

const store = useGameStore()

/**
 * Purely presentational — the engine knows nothing about glyphs, so new
 * biomes only need a line here to show up on the board.
 */
const GLYPHS = {
  camp: '\u{1F3D5}',
  forest: '\u{1F332}',
  thicket: '\u{1F342}',
  grassland: '\u{1F33E}',
  berryPatch: '\u{1FAD0}',
  rocky: '\u{1FAA8}',
  goldVein: '\u{1F48E}',
}

const map = computed(() => store.game.map)

const rows = computed(() => {
  const { width, height, tiles } = map.value
  return Array.from({ length: height }, (_, y) => tiles.slice(y * width, y * width + width))
})

function isPlayer(tile) {
  return tile.x === store.player.x && tile.y === store.player.y
}

function reachable(tile) {
  return store.canMoveTo(tile.x, tile.y)
}

function biomeLabel(tile) {
  return store.rules.biomes[tile.biome].label
}

function onTile(tile) {
  if (!reachable(tile)) return
  store.act({ type: 'move', to: { x: tile.x, y: tile.y } })
}

function tileTitle(tile) {
  if (!tile.explored) return 'Unexplored'
  const biome = store.rules.biomes[tile.biome]
  const parts = [biomeLabel(tile)]
  if (biome.resource) parts.push(`${tile.remaining} ${biome.resource} left`)
  if (tile.structure) parts.push(`campfire (${tile.structure.durability} nights)`)
  return parts.join(' - ')
}
</script>

<template>
  <div class="board" :class="{ dark: !store.lit }">
    <div v-for="(row, y) in rows" :key="y" class="row">
      <button
        v-for="tile in row"
        :key="`${tile.x},${tile.y}`"
        class="tile"
        :class="{
          unexplored: !tile.explored,
          player: isPlayer(tile),
          reachable: reachable(tile),
          spent: tile.explored && tile.remaining === 0 && store.rules.biomes[tile.biome].resource,
        }"
        :disabled="!reachable(tile)"
        :title="tileTitle(tile)"
        @click="onTile(tile)"
      >
        <template v-if="tile.explored">
          <span class="glyph">{{ GLYPHS[tile.biome] }}</span>

          <span v-if="tile.structure && tile.structure.durability > 0" class="fire">
            {{ '\u{1F525}' }}
          </span>

          <span v-if="store.rules.biomes[tile.biome].resource" class="pips">
            <i v-for="n in tile.remaining" :key="n" />
          </span>

          <span v-if="isPlayer(tile)" class="marker" />
        </template>
        <span v-else class="fog">?</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.board {
  display: inline-flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: filter 0.4s ease;
}

/* Night visibly closes in, which is most of the tension in the real game. */
.board.dark {
  filter: brightness(0.55) saturate(0.7);
}

.row {
  display: flex;
  gap: 3px;
}

.tile {
  position: relative;
  width: 62px;
  height: 62px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--panel-raised);
  border: 1px solid var(--border);
  border-radius: 3px;
}

.tile:disabled {
  opacity: 1;
  cursor: default;
}

.tile.unexplored {
  background: #14120d;
  border-color: #241f16;
}

.tile.spent {
  opacity: 0.45;
}

.tile.reachable {
  border-color: var(--border-bright);
  cursor: pointer;
}

.tile.reachable:hover {
  border-color: var(--fire);
  background: #3a3426;
}

.tile.player {
  border-color: var(--fire);
  box-shadow: inset 0 0 0 1px rgba(232, 130, 30, 0.35);
}

.glyph {
  font-size: 1.6rem;
  line-height: 1;
}

.fog {
  color: var(--dim);
  font-size: 1.1rem;
}

.fire {
  position: absolute;
  top: 2px;
  right: 3px;
  font-size: 0.8rem;
}

.pips {
  position: absolute;
  bottom: 4px;
  display: flex;
  gap: 2px;
}

.pips i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--muted);
}

.marker {
  position: absolute;
  inset: auto 4px 4px auto;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--fire);
  box-shadow: 0 0 6px var(--fire);
}
</style>
