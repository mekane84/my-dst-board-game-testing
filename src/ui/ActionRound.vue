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
  reselectCurrentAction,
} from '../engine/actions.js'
import { workOptions } from '../engine/crafting.js'
import { GEAR_BY_ID, isTwoUse } from '../data/gear.js'

const props = defineProps({ game: { type: Object, required: true } })
const emit = defineEmits(['dayComplete', 'roundResolved'])

/**
 * Testing convenience, not a rules change.
 *
 * The engine still models reveal / choose-order / resolve as separate steps --
 * hotseat secrecy and the team-chosen resolution order are real rules, and both
 * the eventual player-facing UI and the simulator need them. This simply drives
 * those steps for you, resolving in seat order, so a Day costs as few clicks as
 * possible. Switch it off to step through by hand.
 */
const auto = ref(true)

/** Log types that are an OUTCOME worth showing, rather than bookkeeping. */
const OUTCOME_TYPES = new Set([
  'gather', 'prepare', 'recover', 'craft', 'build', 'eat', 'pass',
  'health-lost', 'health-healed', 'hunger-lost',
  'fear-gained', 'fear-removed', 'garland-wasted',
  'gear-used', 'gear-broke', 'action-fizzled',
])

/** `${playerId}:${uid}` of the card whose options are showing. */
const expanded = ref(null)
/** True while the expanded card is showing Work targets instead of its effect. */
const workMode = ref(false)
const error = ref('')

const round = computed(() => props.game.round)
const phase = computed(() => round.value.phase)
const everyoneLocked = computed(() => allSelected(props.game))
const reselecting = computed(() => phase.value === 'reselecting')

/** Who needs to choose right now. During a reselect, only the one survivor. */
const pickers = computed(() =>
  reselecting.value
    ? props.game.players.filter((p) => p.id === round.value.reselectFor)
    : props.game.players,
)

/** Survives the pause when a reselect interrupts resolution mid-round. */
const pending = ref(null)

function run(fn) {
  const result = fn()
  error.value = result && result.ok === false ? result.reason : ''
  return result
}

/* -------------------------------------------------- modifier lookup */

/** A Ready Gear card that could boost this Gather, if the player has one. */
function gatherModifier(player, resource) {
  return player.readyGear.find((c) => {
    const gear = GEAR_BY_ID[c.cardId]
    return gear?.gatherBonus?.resource === resource && (!isTwoUse(c.cardId) || c.uses > 0)
  })
}

/** A Ready Spear or Torch that could upgrade this Prepare. */
function prepareModifier(player, choice) {
  return player.readyGear.find((c) => {
    const gear = GEAR_BY_ID[c.cardId]
    return gear?.prepareBonus?.choice === choice && (!isTwoUse(c.cardId) || c.uses > 0)
  })
}

function gearName(card) {
  return GEAR_BY_ID[card.cardId]?.name ?? card.cardId
}

/** Buttons for cards whose effect takes no further choice. */
const SINGLE_CHOICE_LABELS = {
  recover: 'Heal 1 Health',
  explore: 'Explore',
}

/** The ways this card's printed effect can be resolved right now. */
function effectChoices(player, entry) {
  if (entry.cardId === 'gather') {
    return props.game.constants.gather.campResources.flatMap((resource) => {
      const rows = [{ label: resource, options: { resource } }]
      const mod = gatherModifier(player, resource)
      if (mod) {
        const bonus = GEAR_BY_ID[mod.cardId].gatherBonus.amount
        rows.push({
          label: `${resource} +${bonus} (${gearName(mod)})`,
          boosted: true,
          options: { resource, gearUid: mod.uid },
        })
      }
      return rows
    })
  }

  if (entry.cardId === 'prepare') {
    return ['combat', 'protection'].flatMap((choice) => {
      const rows = [{ label: `+1 ${choice}`, options: { choice } }]
      const mod = prepareModifier(player, choice)
      if (mod) {
        const total = GEAR_BY_ID[mod.cardId].prepareBonus.total
        rows.push({
          label: `+${total} ${choice} (${gearName(mod)})`,
          boosted: true,
          options: { choice, gearUid: mod.uid },
        })
      }
      return rows
    })
  }

  // Cards with no choice to make still need a confirm button, so label it
  // with what the card actually does rather than a generic "Resolve".
  return [{ label: SINGLE_CHOICE_LABELS[entry.cardId] ?? entry.name ?? 'Resolve', options: {} }]
}

function workChoices(player) {
  return workOptions(props.game, player)
}

function costText(cost) {
  return Object.entries(cost)
    .map(([r, n]) => `${n} ${r}`)
    .join(', ')
}

/* -------------------------------------------------- selection flow */

function handFor(player) {
  return legalSelections(props.game, player)
}

function selectionOf(playerId) {
  return round.value.selections[playerId]
}

function keyFor(player, entry) {
  return `${player.id}:${entry.uid}`
}

function toggleCard(player, entry) {
  const key = keyFor(player, entry)
  workMode.value = false
  expanded.value = expanded.value === key ? null : key
}

function chooseEffect(player, entry, choice) {
  expanded.value = null
  run(() =>
    selectAction(props.game, player.id, {
      kind: 'card',
      uid: entry.uid,
      mode: 'effect',
      options: choice.options,
    }),
  )
  autoResolveRound()
}

function chooseWork(player, entry, target) {
  expanded.value = null
  workMode.value = false
  run(() =>
    selectAction(props.game, player.id, {
      kind: 'card',
      uid: entry.uid,
      mode: 'work',
      work: { type: target.kind, id: target.id },
    }),
  )
  autoResolveRound()
}

/**
 * Once both survivors have locked in, run the whole round through.
 *
 * An action that was legal when selected can be impossible by the time it
 * resolves, so a failure fizzles that action rather than stalling the round.
 */
function autoResolveRound() {
  if (!auto.value) return
  const r = round.value

  if (r.phase === 'selecting') {
    if (!allSelected(props.game)) return
    pending.value = { number: r.number, logStart: props.game.log.length }
    revealSelections(props.game)
    setResolutionOrder(props.game, props.game.players.map((p) => p.id))
  } else if (r.phase !== 'resolving') {
    return
  }

  while (!roundComplete(props.game)) {
    const result = resolveNextAction(props.game)
    if (!result.ok) {
      // Their action became impossible, so hand it back and wait for them.
      error.value = result.reason
      reselectCurrentAction(props.game, result.reason)
      return
    }
  }

  // Selections are still readable here, so the summary reflects what was
  // actually done -- including anything chosen during a reselect.
  const captured = pending.value ?? { number: r.number, logStart: 0 }
  emit('roundResolved', {
    number: captured.number,
    chosen: props.game.players.map((p) => ({
      name: p.name,
      text: describeSelection(props.game, selectionOf(p.id)),
    })),
    events: props.game.log.slice(captured.logStart).filter((e) => OUTCOME_TYPES.has(e.type)),
  })

  pending.value = null
  error.value = ''

  const advanced = advanceRound(props.game)
  if (advanced.ok && advanced.dayComplete) emit('dayComplete')
}

function unlock(playerId) {
  run(() => clearSelection(props.game, playerId))
}

function passFor(playerId) {
  run(() => selectAction(props.game, playerId, { kind: 'pass' }))
  autoResolveRound()
}

/* -------------------------------------------------- round flow */

function reveal() { run(() => revealSelections(props.game)) }
function chooseOrder(order) { run(() => setResolutionOrder(props.game, order)) }
function resolveOne() { run(() => resolveNextAction(props.game)) }

function resolveAll() {
  while (!roundComplete(props.game)) {
    if (!run(() => resolveNextAction(props.game)).ok) break
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
      <label class="auto">
        <input v-model="auto" type="checkbox" />
        auto-resolve
      </label>
      <span class="muted small">
        tonight: {{ game.tonight.combat }} combat &middot; {{ game.tonight.protection }} protection
      </span>
    </div>

    <!-- SELECTING ------------------------------------------------- -->
    <div v-if="phase === 'selecting' || reselecting" class="players">
      <p v-if="reselecting" class="notice">
        That action could not resolve, so it comes back to you &mdash; your card was
        never spent. Choose again.
      </p>
      <div v-for="p in pickers" :key="p.id" class="pick">
        <div class="pick-head">
          <strong>{{ p.name }}</strong>
          <span v-if="selectionOf(p.id)" class="locked">locked in</span>
          <button v-if="selectionOf(p.id)" class="mini" @click="unlock(p.id)">Change</button>
        </div>

        <div v-if="selectionOf(p.id)" class="muted small">hidden until reveal</div>

        <template v-else>
          <div class="row wrap">
            <button
              v-for="entry in handFor(p)"
              :key="entry.uid"
              class="mini"
              :class="{ dim: !entry.available, open: expanded === keyFor(p, entry) }"
              :disabled="!entry.available"
              :title="entry.reason || ''"
              @click="toggleCard(p, entry)"
            >{{ entry.name || entry.cardId }}</button>

            <button
              v-if="!handFor(p).some((e) => e.available)"
              class="mini"
              @click="passFor(p.id)"
            >Pass</button>
          </div>

          <!-- Expanded card: its effect options, or its Work targets -->
          <template v-for="entry in handFor(p)" :key="`x-${entry.uid}`">
            <div v-if="expanded === keyFor(p, entry)" class="expand">
              <template v-if="!workMode">
                <span class="tag">effect</span>
                <button
                  v-for="choice in effectChoices(p, entry)"
                  :key="choice.label"
                  class="mini opt"
                  :class="{ boosted: choice.boosted }"
                  @click="chooseEffect(p, entry, choice)"
                >{{ choice.label }}</button>
                <button class="mini work" @click="workMode = true">Work instead &rarr;</button>
              </template>

              <template v-else>
                <span class="tag">work</span>
                <button class="mini" @click="workMode = false">&larr; back</button>
                <div class="work-grid">
                  <button
                    v-for="target in workChoices(p)"
                    :key="target.id"
                    class="mini work-item"
                    :class="{ dim: !target.available, major: target.family === 'major' }"
                    :disabled="!target.available"
                    :title="target.reason || ''"
                    @click="chooseWork(p, entry, target)"
                  >
                    <span>{{ target.name }}</span>
                    <span class="cost">{{ costText(target.cost) }}</span>
                  </button>
                </div>
              </template>
            </div>
          </template>
        </template>
      </div>

      <button v-if="!auto" class="primary" :disabled="!everyoneLocked" @click="reveal">
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

.auto {
  display: inline-flex; align-items: center; gap: 0.25rem;
  font-size: 0.7rem; color: var(--muted); cursor: pointer;
}
.auto input { margin: 0; }

.notice {
  margin: 0 0 0.5rem; padding: 0.4rem 0.55rem; font-size: 0.75rem;
  color: #e2c37a; background: rgba(214, 200, 143, 0.08);
  border-left: 2px solid #d6c88f; border-radius: 2px;
}

.players { display: flex; flex-direction: column; gap: 0.6rem; }
.pick { padding: 0.45rem 0; border-bottom: 1px solid #272a33; }
.pick-head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem; }
.locked { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--good); }

.row { display: flex; align-items: center; gap: 0.3rem; }
.wrap { flex-wrap: wrap; }

.mini { padding: 0.15rem 0.4rem; font-size: 0.72rem; }
.mini.dim { opacity: 0.35; }
.mini.open { border-color: var(--accent); color: var(--accent); }

.expand {
  display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap;
  margin-top: 0.35rem; padding: 0.4rem 0.5rem;
  background: #1a1c22; border: 1px solid var(--border); border-radius: 3px;
}

.tag {
  font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--muted); margin-right: 0.2rem;
}

.opt { border-color: #44485a; }
.opt.boosted { border-color: var(--accent); color: var(--accent); }
.work { margin-left: auto; border-color: #44485a; }

.work-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: 0.25rem; width: 100%; margin-top: 0.3rem;
}
.work-item { display: flex; justify-content: space-between; gap: 0.5rem; text-align: left; }
.work-item.major { border-left: 2px solid var(--accent); }
.cost { color: var(--muted); font-size: 0.66rem; white-space: nowrap; }

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
