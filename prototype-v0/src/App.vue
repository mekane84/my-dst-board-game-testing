<script setup>
import { computed, ref } from 'vue'
import { useGameStore } from './stores/game.js'
import BoardGrid from './components/BoardGrid.vue'
import MeterBar from './components/MeterBar.vue'
import ResourceTray from './components/ResourceTray.vue'
import ActionPanel from './components/ActionPanel.vue'
import EventLog from './components/EventLog.vue'

const store = useGameStore()
const seedInput = ref('')

const meters = computed(() => [
  { label: 'Health', value: store.player.health, max: store.rules.meters.maxHealth, color: 'var(--health)' },
  { label: 'Hunger', value: store.player.hunger, max: store.rules.meters.maxHunger, color: 'var(--hunger)' },
  { label: 'Sanity', value: store.player.sanity, max: store.rules.meters.maxSanity, color: 'var(--sanity)' },
])

const outcome = computed(() => {
  if (store.game.status === 'won') {
    return { title: 'You survived', detail: `${store.rules.meta.daysToSurvive} days in The Constant.` }
  }
  if (store.game.status === 'lost') {
    return { title: 'You died', detail: `Day ${store.game.day}. The dark got what it wanted.` }
  }
  return null
})

function startSeeded() {
  const seed = seedInput.value.trim()
  store.newGame(seed || undefined)
  seedInput.value = ''
}
</script>

<template>
  <div class="app">
    <header>
      <div class="title">
        <h1>The Constant</h1>
        <p class="sub">Board game prototype &mdash; playtest build</p>
      </div>

      <div class="clock">
        <span class="day">Day {{ store.game.day }}</span>
        <span class="phase" :class="store.phase.id">{{ store.phase.label }}</span>
        <span class="ap">{{ store.game.actionPoints }} AP</span>
        <span class="lit" :class="{ on: store.lit }">{{ store.lit ? 'lit' : 'dark' }}</span>
      </div>

      <div class="seed">
        <label>
          <span>Seed</span>
          <code>{{ store.game.seed }}</code>
        </label>
        <input v-model="seedInput" placeholder="new seed" @keyup.enter="startSeeded" />
        <button @click="startSeeded">New</button>
        <button @click="store.restart()" title="Same board, fresh start">Restart</button>
      </div>
    </header>

    <main>
      <section class="board-area">
        <BoardGrid />
        <p class="hint">
          Click an adjacent tile to move. Pips show what a tile has left.
          Actions end the phase when you run out of AP.
        </p>
      </section>

      <aside>
        <div class="panel">
          <div class="panel-title">Condition</div>
          <MeterBar v-for="m in meters" :key="m.label" v-bind="m" />
        </div>
        <ResourceTray />
        <ActionPanel />
        <EventLog />
      </aside>
    </main>

    <div v-if="outcome" class="overlay">
      <div class="outcome panel">
        <h2>{{ outcome.title }}</h2>
        <p>{{ outcome.detail }}</p>
        <div class="buttons">
          <button @click="store.restart()">Replay this board</button>
          <button @click="store.newGame()">New board</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app {
  max-width: 1180px;
  margin: 0 auto;
  padding: 1.4rem 1.2rem 2.5rem;
}

header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border);
}

h1 {
  font-size: 1.35rem;
  color: var(--fire);
}

.sub {
  margin: 0.15rem 0 0;
  font-size: 0.75rem;
  color: var(--dim);
}

.clock {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.85rem;
}

.day {
  font-weight: 600;
}

.phase {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.7rem;
  padding: 0.2rem 0.45rem;
  border-radius: 2px;
  border: 1px solid var(--border-bright);
}

.phase.day { color: #e8c97e; }
.phase.dusk { color: #c98a5e; }
.phase.night { color: #8e9ec9; }

.ap,
.lit {
  font-size: 0.75rem;
  color: var(--muted);
}

.lit.on {
  color: var(--fire);
}

.seed {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
}

.seed label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--muted);
}

.seed code {
  color: var(--text);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 2px;
  padding: 0.15rem 0.35rem;
}

.seed input {
  width: 7rem;
  font: inherit;
  color: var(--text);
  background: var(--panel);
  border: 1px solid var(--border-bright);
  border-radius: var(--radius);
  padding: 0.35rem 0.45rem;
}

main {
  display: grid;
  grid-template-columns: auto minmax(300px, 1fr);
  gap: 1.1rem;
  margin-top: 1.1rem;
  align-items: start;
}

aside {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.hint {
  max-width: 34rem;
  margin: 0.7rem 0 0;
  font-size: 0.76rem;
  line-height: 1.5;
  color: var(--dim);
}

.overlay {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(10, 9, 6, 0.82);
}

.outcome {
  text-align: center;
  padding: 1.8rem 2.4rem;
  border-color: var(--border-bright);
}

.outcome h2 {
  font-size: 1.5rem;
  color: var(--fire);
}

.outcome p {
  margin: 0.5rem 0 1.2rem;
  color: var(--muted);
  font-size: 0.88rem;
}

.buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

@media (max-width: 900px) {
  main {
    grid-template-columns: 1fr;
  }
}
</style>
