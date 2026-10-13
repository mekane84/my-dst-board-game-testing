<script setup>
import { useGameStore } from '../stores/game.js'

const store = useGameStore()
</script>

<template>
  <div class="panel log-panel">
    <div class="panel-title">Journal</div>
    <ol class="log">
      <li v-for="(entry, i) in store.log" :key="store.log.length - i" :class="entry.tone">
        <span class="when">D{{ entry.day }} {{ entry.phase.slice(0, 3) }}</span>
        <span class="what">{{ entry.message }}</span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.log-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.log {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
  max-height: 320px;
}

li {
  display: flex;
  gap: 0.5rem;
  padding: 0.25rem 0;
  font-size: 0.78rem;
  line-height: 1.35;
  border-bottom: 1px solid rgba(61, 55, 41, 0.45);
}

li:last-child {
  border-bottom: none;
}

.when {
  flex: 0 0 3.4rem;
  color: var(--dim);
  font-variant-numeric: tabular-nums;
  text-transform: uppercase;
  font-size: 0.68rem;
  padding-top: 0.1rem;
}

.what {
  color: var(--muted);
}

li.bad .what {
  color: #d9776b;
}

li.good .what {
  color: var(--good);
}
</style>
