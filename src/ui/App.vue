<script setup>
import { computed, ref } from 'vue'
import { createGame, logEvent } from '../engine/setup.js'
import { randomSeed } from '../engine/rng.js'
import { refillAllHands, cleanupAllPlayers, gainFear, usableHand, fearCount } from '../engine/draw.js'
import { startActionRounds } from '../engine/actions.js'
import { NIGHT_CARDS, RED_MOON, thresholdValue } from '../data/nights.js'
import { LOCATIONS } from '../data/locations.js'
import { STARTER_CARDS } from '../data/starterCards.js'
import { GEAR_BY_ID } from '../data/gear.js'
import { BUILDABLE_BY_ID } from '../data/campImprovements.js'
import { majorImprovementCount } from '../engine/crafting.js'
import { LOCATIONS_BY_ID } from '../data/locations.js'
import { foodSourceOptions } from '../engine/food.js'
import ActionRound from './ActionRound.vue'

/**
 * Phases 1-3 harness, in developer mode: both hands are visible, which the
 * implementation plan allows until hotseat pass-screens are built.
 *
 * Night resolution is Phase 8, so "Finish Day" currently just cleans up and
 * rolls the Day counter without resolving the Night card.
 */
/**
 * Deeply reactive on purpose. A shallowRef would need manual re-wrapping after
 * every engine mutation, and nested computeds would still cache stale values
 * because the inner objects keep their identity.
 */
const game = ref(createGame({ seed: randomSeed() }))
const seedInput = ref('')

/** What happened in each round of the Day just played. Survives the Day end. */
const roundResults = ref([])
const lastDayPlayed = ref(null)

const nightsById = Object.fromEntries([...NIGHT_CARDS, RED_MOON].map((n) => [n.id, n]))
const locationsById = Object.fromEntries(LOCATIONS.map((l) => [l.id, l]))

const playerCount = computed(() => game.value.players.length)
const dayStarted = computed(() => game.value.players.some((p) => p.hand.length > 0))

const schedule = computed(() =>
  game.value.nightSchedule.map((id, i) => {
    const card = nightsById[id]
    return { day: i + 1, name: card.name, band: card.band, thresholds: summarise(card) }
  }),
)

const tonightCard = computed(() => nightsById[game.value.nightSchedule[game.value.day - 1]])

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

function cardLabel(card) {
  if (card.kind === 'fear') return 'Fear'
  return GEAR_BY_ID[card.cardId]?.name ?? STARTER_CARDS[card.cardId]?.name ?? card.cardId
}

/** Gear label carrying its remaining durability, for the two-use family. */
function gearLabel(card) {
  const name = GEAR_BY_ID[card.cardId]?.name ?? card.cardId
  return card.uses === undefined ? name : `${name} (${card.uses})`
}

/** Explored Locations with a short status, from the acting team's view. */
const explored = computed(() =>
  game.value.locations.explored.map((record) => {
    const def = LOCATIONS_BY_ID[record.id]
    let status = 'ready'
    let note = null

    if (!def.gatherEffects) {
      status = 'spent'
      note = 'no repeat gather'
    } else if (def.clearable && record.cleared) {
      status = 'spent'
      note = 'cleared out'
    } else if (record.availableOnDay !== null && game.value.day < record.availableOnDay) {
      status = 'resting'
      note = `back on Day ${record.availableOnDay}`
    } else if (record.gatheredOnDay === game.value.day) {
      status = 'used'
      note = 'gathered today'
    } else if (def.gatherRequiresGear) {
      status = 'gated'
      note = `needs ${def.gatherRequiresGear.replace(/_/g, ' ')}`
    }

    const transplant =
      record.transplantSlots > 0 ? (record.transplantUsed ? 'transplanted' : 'transplant free') : null

    return { id: record.id, name: record.name, status, note, transplant }
  }),
)

const camp = computed(() => {
  const g = game.value
  return {
    major: Object.keys(g.camp.improvements).map((id) => BUILDABLE_BY_ID[id]?.name ?? id),
    majorCount: majorImprovementCount(g),
    food: foodSourceOptions(g),
  }
})

function stats(player) {
  return {
    usable: usableHand(player).length,
    fear: fearCount(player),
    total: player.draw.length + player.hand.length + player.played.length +
      player.discard.length + player.readyGear.length + player.usedGear.length,
  }
}

const recentLog = computed(() => [...game.value.log].slice(-16).reverse())

function newGame(seed) {
  game.value = createGame({ seed: seed || randomSeed() })
}

function startSeeded() {
  newGame(seedInput.value.trim())
  seedInput.value = ''
}

function onRoundResolved(summary) {
  roundResults.value.push(summary)
}

function startDay() {
  roundResults.value = []
  lastDayPlayed.value = null
  refillAllHands(game.value)
  startActionRounds(game.value)
}

/** Night resolution lands in Phase 8; for now the Day just ends. */
function finishDay() {
  const state = game.value
  lastDayPlayed.value = state.day
  cleanupAllPlayers(state)
  state.tonight = { combat: 0, protection: 0 }
  state.day += 1
  logEvent(state, 'day-end', `Day ${state.day - 1} ended. Night resolution arrives in Phase 8.`)
}

function addFear(player) {
  gainFear(game.value, player, 1)
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
        <h1>Alpha 1.0 &mdash; engine harness</h1>
        <p class="sub">
          Phases 1&ndash;3, developer mode (both hands visible).
          Camp Gather, Prepare and Recover resolve; Explore needs Phase 5, Work needs Phase 4.
        </p>
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

    <div class="controls">
      <strong>Day {{ game.day }}</strong>
      <span class="muted">tonight: {{ tonightCard.name }}</span>
      <button :disabled="dayStarted" @click="startDay">Start Day</button>
      <span class="muted hint">
        Start the Day to draw hands and open action round 1.
      </span>
    </div>

    <ActionRound
      v-if="dayStarted"
      :game="game"
      @round-resolved="onRoundResolved"
      @day-complete="finishDay"
    />

    <section v-if="roundResults.length" class="panel results">
      <h2>
        Day {{ lastDayPlayed ?? game.day }} results
        <span v-if="lastDayPlayed" class="done">complete</span>
      </h2>
      <div v-for="r in roundResults" :key="r.number" class="round-result">
        <div class="r-head">
          <span class="r-num">Round {{ r.number }}</span>
          <span v-for="c in r.chosen" :key="c.name" class="r-chose">
            <strong>{{ c.name }}</strong> {{ c.text }}
          </span>
        </div>
        <ul class="r-events">
          <li v-for="e in r.events" :key="e.index" :class="e.type">{{ e.message }}</li>
          <li v-if="!r.events.length" class="muted">nothing happened</li>
        </ul>
      </div>
    </section>

    <main>
      <section class="panel">
        <h2>Survivors</h2>
        <div v-for="p in game.players" :key="p.id" class="player">
          <div class="player-head">
            <strong>{{ p.name }}</strong>
            <span class="muted">{{ p.health }} HP &middot; {{ p.hunger }} Hunger</span>
            <button class="mini" @click="addFear(p)">+1 Fear</button>
          </div>

          <div class="zones muted">
            draw {{ p.draw.length }} &middot; discard {{ p.discard.length }} &middot;
            played {{ p.played.length }} &middot; deck total {{ stats(p).total }} &middot;
            fear {{ stats(p).fear }}
          </div>

          <div class="row">
            <span class="tag">hand {{ p.hand.length }}</span>
            <span v-if="!p.hand.length" class="muted small">&mdash;</span>
            <span
              v-for="c in p.hand"
              :key="c.uid"
              class="card"
              :class="{ fear: c.kind === 'fear' }"
            >{{ cardLabel(c) }}</span>
          </div>

          <div class="row">
            <span class="tag gear">ready gear {{ p.readyGear.length }}</span>
            <span v-if="!p.readyGear.length" class="muted small">&mdash;</span>
            <span v-for="c in p.readyGear" :key="c.uid" class="card gear">{{ gearLabel(c) }}</span>
          </div>

          <div v-if="p.usedGear.length || p.removed.length" class="row">
            <span class="tag">spent</span>
            <span v-for="c in p.usedGear" :key="c.uid" class="card used">{{ gearLabel(c) }}</span>
            <span v-for="c in p.removed" :key="c.uid" class="card broken">{{ cardLabel(c) }}</span>
          </div>

          <div class="playable">
            playable: <strong>{{ stats(p).usable }}</strong> of {{ p.hand.length }}
          </div>
        </div>

        <h2 class="spaced">Shared resources</h2>
        <div class="muted">
          <span v-for="(v, k) in game.resources" :key="k" class="res">{{ k }}: {{ v }}</span>
        </div>
      </section>

      <section class="panel">
        <h2>Camp &mdash; {{ camp.majorCount }} of 4 major improvements</h2>
        <div class="row">
          <span class="tag">major</span>
          <span v-if="!camp.major.length" class="muted small">none built</span>
          <span v-for="name in camp.major" :key="name" class="card major">{{ name }}</span>
        </div>
        <div class="row">
          <span class="tag">food</span>
          <span v-if="!camp.food.length" class="muted small">none built</span>
          <span
            v-for="f in camp.food"
            :key="f.uid"
            class="card food"
            :class="{ resting: !f.available }"
            :title="f.reason || 'ready to harvest'"
          >{{ f.name }} +{{ f.yield }}<span v-if="!f.available" class="rest">resting</span></span>
        </div>

        <h2 class="spaced">Night schedule</h2>
        <table>
          <tbody>
            <tr v-for="n in schedule" :key="n.day" :class="{ current: n.day === game.day }">
              <td class="day">Day {{ n.day }}</td>
              <td class="band" :class="n.band">{{ n.band === 'redMoon' ? 'Red Moon' : n.band }}</td>
              <td class="name">{{ n.name }}</td>
              <td class="thr"><div v-for="t in n.thresholds" :key="t">{{ t }}</div></td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="panel wide">
        <h2>Event log &mdash; most recent first</h2>
        <ol class="log">
          <li v-for="e in recentLog" :key="e.index">
            <span class="muted">{{ e.type }}</span> {{ e.message }}
          </li>
        </ol>
      </section>

      <section class="panel wide">
        <h2>
          Explored ({{ explored.length }})
          <span class="muted small">&mdash; {{ game.locations.deck.length }} left in the deck</span>
        </h2>
        <p v-if="!explored.length" class="muted small">
          Nothing explored yet. Spend an Explore action to turn a card face up.
        </p>
        <ul class="explored">
          <li v-for="loc in explored" :key="loc.id" :class="loc.status">
            <span class="loc-name">{{ loc.name }}</span>
            <span class="loc-status">{{ loc.status }}</span>
            <span v-if="loc.note" class="muted small">{{ loc.note }}</span>
            <span v-if="loc.transplant" class="transplant">{{ loc.transplant }}</span>
          </li>
        </ul>
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
  display: flex; flex-wrap: wrap; justify-content: space-between;
  align-items: center; gap: 1rem;
  padding-bottom: 0.9rem; border-bottom: 1px solid var(--border);
}

h1 { font-size: 1.1rem; color: var(--accent); }
h2 {
  font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--muted); margin-bottom: 0.6rem;
}
.spaced { margin-top: 1.2rem; }
.sub { margin: 0.2rem 0 0; color: var(--muted); font-size: 0.75rem; max-width: 46rem; }

.seed { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
.seed code { color: var(--accent); }
.seed input { width: 8rem; }

.controls {
  display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap;
  margin-top: 0.9rem; padding: 0.6rem 0.8rem;
  background: var(--panel); border: 1px solid var(--border); border-radius: 4px;
}
.hint { font-size: 0.72rem; }

main {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem;
  margin-top: 0.9rem; align-items: start;
}

.panel {
  background: var(--panel); border: 1px solid var(--border);
  border-radius: 4px; padding: 0.9rem;
}
.wide { grid-column: 1 / -1; }

table { width: 100%; border-collapse: collapse; }
td { padding: 0.25rem 0.4rem; border-bottom: 1px solid #272a33; vertical-align: top; }
tr:last-child td { border-bottom: none; }
tr.current td { background: #262a33; }

.day { color: var(--muted); white-space: nowrap; }
.band { text-transform: uppercase; font-size: 0.65rem; letter-spacing: 0.08em; }
.band.early { color: #8fb8d6; }
.band.mid { color: #d6c88f; }
.band.late { color: #d69a8f; }
.band.redMoon { color: #e05c5c; font-weight: 600; }
.name { white-space: nowrap; }
.thr { color: var(--muted); font-size: 0.72rem; }

.player { padding: 0.6rem 0; border-bottom: 1px solid #272a33; }
.player:last-of-type { border-bottom: none; }
.player-head { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.zones { font-size: 0.7rem; margin: 0.25rem 0 0.4rem; }

.row { display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; margin-bottom: 0.3rem; }

.tag {
  font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--muted); min-width: 6.5rem;
}
.tag.gear { color: var(--accent); }

.card {
  font-size: 0.72rem; padding: 0.1rem 0.35rem;
  background: #272a33; border: 1px solid var(--border); border-radius: 2px;
}
.card.fear { color: #d9776b; border-color: #553c38; }
.card.gear { color: var(--accent); border-color: #5a4426; }
.card.used { color: var(--muted); opacity: 0.7; }
.card.broken { color: #8a6a66; text-decoration: line-through; }
.card.major { color: var(--accent); border-color: #5a4426; }
.card.food { color: var(--good); border-color: #3f5436; }
.card.food.resting { color: #d6c88f; border-color: #4e4731; }
.rest {
  margin-left: 0.3rem; font-size: 0.6rem; text-transform: uppercase;
  letter-spacing: 0.06em; opacity: 0.8;
}

.mini { padding: 0.1rem 0.35rem; font-size: 0.68rem; }
.playable { font-size: 0.72rem; color: var(--good); margin-top: 0.2rem; }

.results { margin-top: 0.9rem; }
.results h2 { display: flex; align-items: center; gap: 0.5rem; }
.done {
  font-size: 0.6rem; letter-spacing: 0.08em; color: var(--good);
  border: 1px solid #3f5436; border-radius: 2px; padding: 0.05rem 0.3rem;
}

.round-result { padding: 0.4rem 0; border-bottom: 1px solid #272a33; }
.round-result:last-child { border-bottom: none; }

.r-head { display: flex; gap: 1rem; flex-wrap: wrap; align-items: baseline; font-size: 0.76rem; }
.r-num { color: var(--muted); min-width: 4.5rem; }
.r-chose { color: var(--accent); }
.r-chose strong { color: var(--text); margin-right: 0.3rem; }

.r-events { list-style: none; margin: 0.2rem 0 0 4.5rem; padding: 0; font-size: 0.74rem; }
.r-events li { padding: 0.08rem 0; color: var(--good); }
.r-events li.health-lost,
.r-events li.hunger-lost,
.r-events li.fear-gained,
.r-events li.gear-broke { color: #d9776b; }
.r-events li.muted { color: var(--muted); }

.log { list-style: none; margin: 0; padding: 0; font-size: 0.74rem; }
.log li { padding: 0.15rem 0; border-bottom: 1px solid #22252c; }
.log li:last-child { border-bottom: none; }
.log .muted { display: inline-block; min-width: 8rem; }

.explored { list-style: none; margin: 0; padding: 0; }
.explored li {
  display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap;
  padding: 0.22rem 0; border-bottom: 1px solid #22252c; font-size: 0.78rem;
}
.explored li:last-child { border-bottom: none; }
.loc-name { min-width: 17rem; }
.loc-status {
  font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.08em;
  border: 1px solid var(--border); border-radius: 2px; padding: 0.05rem 0.3rem;
}
.explored li.ready .loc-status { color: var(--good); border-color: #3f5436; }
.explored li.resting .loc-status { color: #d6c88f; border-color: #4e4731; }
.explored li.used .loc-status { color: var(--muted); }
.explored li.gated .loc-status { color: #8fb8d6; border-color: #35444e; }
.explored li.spent { opacity: 0.5; }
.transplant { font-size: 0.66rem; color: var(--accent); }

.locations { margin: 0; padding-left: 1.4rem; columns: 3; font-size: 0.78rem; }
.locations li { margin-bottom: 0.15rem; break-inside: avoid; }

.muted { color: var(--muted); }
.small { font-size: 0.72rem; }
.res { margin-right: 0.8rem; }

@media (max-width: 900px) {
  main { grid-template-columns: 1fr; }
  .locations { columns: 1; }
}
</style>
