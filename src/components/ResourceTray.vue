<script setup>
import { computed } from 'vue'
import { useGameStore } from '../stores/game.js'

const store = useGameStore()

const ICONS = {
  wood: '\u{1FAB5}',
  grass: '\u{1F33F}',
  twigs: '\u{1F342}',
  flint: '\u{1FAA8}',
  berries: '\u{1FAD0}',
  cookedBerries: '\u{1F372}',
  gold: '\u{1F48E}',
}

/** Zeroes are shown dimmed rather than hidden, so the tray never reflows. */
const entries = computed(() =>
  Object.entries(store.resources).map(([name, count]) => ({
    name,
    count,
    icon: ICONS[name] ?? '\u{1F4E6}',
  })),
)
</script>

<template>
  <div class="panel">
    <div class="panel-title">Supplies</div>
    <ul class="tray">
      <li v-for="item in entries" :key="item.name" :class="{ empty: item.count === 0 }">
        <span class="icon">{{ item.icon }}</span>
        <span class="count">{{ item.count }}</span>
        <span class="name">{{ item.name }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.tray {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.3rem 0.6rem;
}

li {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  font-size: 0.82rem;
}

li.empty {
  opacity: 0.35;
}

.icon {
  font-size: 0.95rem;
}

.count {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  min-width: 1.2em;
}

.name {
  color: var(--muted);
  text-transform: lowercase;
}
</style>
