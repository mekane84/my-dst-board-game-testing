<script setup>
import { computed, ref, shallowRef } from 'vue'
import { createGame } from '../engine/setup.js'
import { randomSeed } from '../engine/rng.js'
import { NIGHT_CARDS, RED_MOON, thresholdValue } from '../data/nights.js'
import { LOCATIONS } from '../data/locations.js'
import { STARTER_CARDS } from '../data/starterCards.js'

/**
 * Phase 1 harness. Shows what setup produced for a seed so determinism can be
 * eyeballed, and nothing more -- no gameplay yet.
 */
const game = shallowRef(createGame({ seed: randomSeed() }))
const seedInput = ref('')

const nightsById = Object.fromEntries([...NIGHT_CARDS, RED_MOON].map((n) => [n.id, n]))
const locationsById = Object.fromEntries(LOCATIONS.map((l) => [l.id, l]))

const playerCount = computed(() => game.value.players.length)

const schedule = computed(() =>
  game.value.nightSchedule.map((id, i) => {
    const card = nightsById[id]
    return {
      day: i + 1,
      name: card.name,
      band: card.band,
      thresholds: summarise(card),
    }
  }),
)

/** Renders a Night card's tiers as readable "combat >= 7" strings. */
function summarise(card) {
  const P = playerCount.value
  if (card.checks) {
    return card.checks.flatMap((check) =>
      check.tiers
        .filter((t) => t.threshold)
        .map((t) => `${check.label}: ${t.threshold.stat} >= ${thresholdValue(t.threshold, P)} (${t.healthEach} dmg)`),
    )
  }
  return (card.outcomes ?? [])
    .filter((o) => o.threshold)
    .map((o) => `${o.label}: ${o.threshold.stat} >= ${thresholdValue(o.threshold, P)}`)
}

/** 'redMoon' -> 'RED MOON'; the raw key reads badly uppercased. */
function bandLabel(band) {
  return band === 'redMoon' ? 'Red Moon' : band
}

function deckSummary(player) {
  const counts = {}
  for (const card of player.draw) counts[card.cardId] = (counts[card.cardId] ?? 0) + 1
  return Object.entries(counts)
    .map(([id, n]) => `${n}x ${STARTER_CARDS[id]?.name ?? id}`)
    .join(', ')
}

function newGame(seed) {
  game.value = createGame({ seed: seed || randomSeed() })
}

function startSeeded() {
  newGame(seedInput.value.trim())
  seedInput.value = ''
}

function exportState() {
  const blob = JSON.stringify(game.value, null, 2)
  navigator.clipboard?.writeText(blob)
  console.log(blob)
}
</script>

<template>
  <div class="app">
    <header>
      <div>
        <h1>Alpha 1.0 &mdash; setup harness</h1>
        <p class="sub">Phase 1: seeded RNG, state model, deterministic shuffle. No gameplay yet.</p>
      </div>
      <div class="seed">
        <span class="muted">seed</span>
        <code>{{ game.seed }}</code>
        <input v-model="seedInput" placeholder="enter seed" @keyup.enter="startSeeded" />
        <button @click="startSeeded">New</button>
        <button @click="newGame(game.seed)">Rebuild same</button>
        <button @click="exportState">Copy state JSON</button>
      </div>
    </header>

    <main>
      <section class="panel">
        <h2>Night schedule</h2>
        <table>
          <tbody>
            <tr v-for="n in schedule" :key="n.day">
              <td class="day">Day {{ n.day }}</td>
              <td class="band" :class="n.band">{{ bandLabel(n.band) }}</td>
              <td class="name">{{ n.name }}</td>
              <td class="thr">
                <div v-for="t in n.thresholds" :key="t">{{ t }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="panel">
        <h2>Survivors</h2>
        <div v-for="p in game.players" :key="p.id" class="player">
          <div class="player-head">
            <strong>{{ p.name }}</strong>
            <span class="muted">
              {{ p.health }} HP &middot; {{ p.hunger }} Hunger &middot; {{ p.draw.length }} cards
            </span>
          </div>
          <div class="muted small">{{ deckSummary(p) }}</div>
          <div class="order">{{ p.draw.map((c) => c.cardId).join(' > ') }}</div>
        </div>

        <h2 class="spaced">Shared resources</h2>
        <div class="muted">
          <span v-for="(v, k) in game.resources" :key="k" class="res">{{ k }}: {{ v }}</span>
        </div>
      </section>

      <section class="panel wide">
        <h2>Location deck order ({{ game.locations.deck.length }})</h2>
        <ol class="locations">
          <li v-for="(id, i) in game.locations.deck" :key="id">
            <span class="muted">{{ String(i + 1).padStart(2, '0') }}</span>
            {{ locationsById[id].name }}
          </li>
        </ol>
      </section>
    </main>
  </div>
</template>

<style scoped>
.app { max-width: 1200px; margin: 0 auto; padding: 1.2rem; }

header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding-bottom: 0.9rem;
  border-bottom: 1px solid var(--border);
}

h1 { font-size: 1.1rem; color: var(--accent); }
h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); margin-bottom: 0.6rem; }
.spaced { margin-top: 1.2rem; }
.sub { margin: 0.2rem 0 0; color: var(--muted); font-size: 0.75rem; }

.seed { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
.seed code { color: var(--accent); }
.seed input { width: 8rem; }

main {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem;
  margin-top: 1rem;
  align-items: start;
}

.panel { background: var(--panel); border: 1px solid var(--border); border-radius: 4px; padding: 0.9rem; }
.wide { grid-column: 1 / -1; }

table { width: 100%; border-collapse: collapse; }
td { padding: 0.25rem 0.4rem; border-bottom: 1px solid #272a33; vertical-align: top; }
tr:last-child td { border-bottom: none; }

.day { color: var(--muted); white-space: nowrap; }
.band { text-transform: uppercase; font-size: 0.65rem; letter-spacing: 0.08em; }
.band.early { color: #8fb8d6; }
.band.mid { color: #d6c88f; }
.band.late { color: #d69a8f; }
.band.redMoon { color: #e05c5c; font-weight: 600; }
.name { white-space: nowrap; }
.thr { color: var(--muted); font-size: 0.72rem; }

.player { padding: 0.4rem 0; border-bottom: 1px solid #272a33; }
.player:last-of-type { border-bottom: none; }
.player-head { display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; }
.order { color: var(--good); font-size: 0.72rem; margin-top: 0.2rem; word-break: break-word; }
.small { font-size: 0.72rem; }
.muted { color: var(--muted); }
.res { margin-right: 0.8rem; }

.locations { margin: 0; padding-left: 1.4rem; columns: 3; font-size: 0.78rem; }
.locations li { margin-bottom: 0.15rem; break-inside: avoid; }

@media (max-width: 900px) {
  main { grid-template-columns: 1fr; }
  .locations { columns: 1; }
}
</style>
