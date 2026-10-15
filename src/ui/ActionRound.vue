<script setup>
import { computed, ref } from 'vue'
import {
  selectAction,
  clearSelection,
  allSelected,
  revealSelections,
  setResolutionOrder,
  resolveNextAction,
  roundComplete,
  advanceRound,
  legalSelections,
  describeSelection,
} from '../engine/actions.js'

const props = defineProps({ game: { type: Object, required: true } })
const emit = defineEmits(['dayComplete'])

/** Which card is expanded to show its sub-options, as `${playerId}:${uid}`. */
const expanded = ref(null)
const error = ref('')

const round = computed(() => props.game.round)
const phase = computed(() => round.value.phase)
const everyoneLocked = computed(() => allSelected(props.game))

/** Cards needing a follow-up choice before they can be selected. */
const NEEDS_OPTION = {
  gather: (game) => game.constants.gather.campResources.map((r) => ({ key: 'resource', value: r, label: r })),
  prepare: () => [
    { key: 'choice', value: 'combat', label: '+1 Combat' },
    { key: 'choice', value: 'protection', label: '+1 Protection' },
  ],
}

function optionsFor(cardId) {
  return NEEDS_OPTION[cardId]?.(props.game) ?? null
}

function handFor(player) {
  return legalSelections(props.game, player)
}

function selectionOf(playerId) {
  return round.value.selections[playerId]
}

/** Runs an engine call and surfaces its rejection reason, if any. */
function run(fn) {
  const result = fn()
  error.value = result && result.ok === false ? result.reason : ''
  return result
}

function pick(player, entry) {
  const options = optionsFor(entry.cardId)
  const key = `${player.id}:${entry.uid}`

  if (options && expanded.value !== key) {
    expanded.value = key
    return
  }

  expanded.value = null
  run(() => selectAction(props.game, player.id, { kind: 'card', uid: entry.uid, mode: 'effect' }))
}

function pickWithOption(player, entry, option) {
  expanded.value = null
  run(() =>
    selectAction(props.game, player.id, {
      kind: 'card',
      uid: entry.uid,
      mode: 'effect',
      options: { [option.key]: option.value },
    }),
  )
}

function unlock(playerId) {
  run(() => clearSelection(props.game, playerId))
}

function passFor(playerId) {
  run(() => selectAction(props.game, playerId, { kind: 'pass' }))
}

function reveal() {
  run(() => revealSelections(props.game))
}

function chooseOrder(order) {
  run(() => setResolutionOrder(props.game, order))
}

function resolveOne() {
  run(() => resolveNextAction(props.game))
}

function resolveAll() {
  while (!roundComplete(props.game)) {
    const result = run(() => resolveNextAction(props.game))
    if (!result.ok) break
  }
}

function next() {
  const result = run(() => advanceRound(props.game))
  if (result.ok && result.dayComplete) emit('dayComplete')
}

function summarise(playerId) {
  return describeSelection(props.game, selectionOf(playerId))
}

const orderChoices = computed(() => {
  const ids = props.game.players.map((p) => p.id)
  return [ids, [...ids].reverse()]
})

function nameOf(id) {
  return props.game.players.find((p) => p.id === id)?.name ?? id
}
</script>

<template>
  <div class="panel round">
    <div class="head">
      <h2>Action round {{ round.number }} of {{ game.constants.meta.actionsPerDay }}</h2>
      <span class="phase" :class="phase">{{ phase }}</span>
      <span class="muted small">
        tonight: {{ game.tonight.combat }} combat &middot; {{ game.tonight.protection }} protection
      </span>
    </div>

    <!-- SELECTING ------------------------------------------------- -->
    <div v-if="phase === 'selecting'" class="players">
      <div v-for="p in game.players" :key="p.id" class="pick">
        <div class="pick-head">
          <strong>{{ p.name }}</strong>
          <span v-if="selectionOf(p.id)" class="locked">locked in</span>
        </div>

        <div v-if="selectionOf(p.id)" class="row">
          <span class="muted small">hidden until reveal</span>
          <button class="mini" @click="unlock(p.id)">Change</button>
        </div>

        <div v-else class="row wrap">
          <template v-for="entry in handFor(p)" :key="entry.uid">
            <button
              class="mini"
              :class="{ dim: !entry.available }"
              :disabled="!entry.available"
              :title="entry.reason || ''"
              @click="pick(p, entry)"
            >
              {{ entry.name || entry.cardId }}
            </button>

            <span
              v-if="expanded === `${p.id}:${entry.uid}`"
              class="options"
            >
              <button
                v-for="opt in optionsFor(entry.cardId)"
                :key="opt.value"
                class="mini opt"
                @click="pickWithOption(p, entry, opt)"
              >{{ opt.label }}</button>
            </span>
          </template>

          <button
            v-if="!handFor(p).some((e) => e.available)"
            class="mini"
            @click="passFor(p.id)"
          >Pass</button>
        </div>
      </div>

      <button class="primary" :disabled="!everyoneLocked" @click="reveal">
        Reveal both
      </button>
    </div>

    <!-- REVEALED -------------------------------------------------- -->
    <div v-else-if="phase === 'revealed'" class="stage">
      <div class="reveal">
        <div v-for="p in game.players" :key="p.id" class="revealed-line">
          <strong>{{ p.name }}</strong>
          <span class="chose">{{ summarise(p.id) }}</span>
        </div>
      </div>
      <p class="muted small">Choose the order to resolve in:</p>
      <div class="row">
        <button
          v-for="(order, i) in orderChoices"
          :key="i"
          class="mini"
          @click="chooseOrder(order)"
        >{{ order.map(nameOf).join(' then ') }}</button>
      </div>
    </div>

    <!-- RESOLVING ------------------------------------------------- -->
    <div v-else-if="phase === 'resolving'" class="stage">
      <p class="muted small">
        Resolving {{ round.resolvedCount }} of {{ round.order.length }} &mdash;
        next up <strong>{{ nameOf(round.order[round.resolvedCount]) }}</strong>
      </p>
      <div class="row">
        <button class="mini" @click="resolveOne">Resolve next</button>
        <button class="mini" @click="resolveAll">Resolve all</button>
      </div>
    </div>

    <!-- COMPLETE -------------------------------------------------- -->
    <div v-else class="stage">
      <p class="muted small">Round {{ round.number }} resolved.</p>
      <button class="primary" @click="next">
        {{ round.number >= game.constants.meta.actionsPerDay ? 'Finish Day' : 'Next round' }}
      </button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<style scoped>
.round { margin-top: 0.9rem; }

.head { display: flex; align-items: baseline; gap: 0.7rem; flex-wrap: wrap; margin-bottom: 0.7rem; }
h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); margin: 0; }

.phase {
  font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.08em;
  padding: 0.1rem 0.35rem; border: 1px solid var(--border); border-radius: 2px;
}
.phase.selecting { color: #8fb8d6; }
.phase.revealed { color: var(--accent); }
.phase.resolving { color: #d6c88f; }
.phase.complete { color: var(--good); }

.players { display: flex; flex-direction: column; gap: 0.6rem; }
.pick { padding: 0.45rem 0; border-bottom: 1px solid #272a33; }
.pick-head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem; }
.locked { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--good); }

.row { display: flex; align-items: center; gap: 0.3rem; }
.wrap { flex-wrap: wrap; }

.mini { padding: 0.15rem 0.4rem; font-size: 0.72rem; }
.mini.dim { opacity: 0.35; }
.opt { border-color: var(--accent); color: var(--accent); }
.options { display: inline-flex; gap: 0.2rem; margin-right: 0.3rem; }

.primary { align-self: flex-start; border-color: var(--accent); color: var(--accent); }

.stage { display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start; }
.reveal { display: flex; flex-direction: column; gap: 0.2rem; }
.revealed-line { display: flex; gap: 0.5rem; font-size: 0.8rem; }
.chose { color: var(--accent); }

.error {
  margin: 0.6rem 0 0; padding: 0.35rem 0.5rem; font-size: 0.75rem;
  color: #d9776b; background: rgba(192, 57, 43, 0.1);
  border-left: 2px solid #c0392b; border-radius: 2px;
}

.muted { color: var(--muted); }
.small { font-size: 0.72rem; }
</style>
