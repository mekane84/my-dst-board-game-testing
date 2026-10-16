<script setup>
import { computed, reactive, watch } from 'vue'

/**
 * Shows whatever decision the engine is waiting on.
 *
 * Two shapes: a list of options ("Spend 1 Food or gain 1 Fear"), or a tally of
 * resources to take ("3 total, maximum 2 of the same").
 */
const props = defineProps({ pending: { type: Object, required: true } })
const emit = defineEmits(['choose', 'take'])

/** Working tally for the `take` form. */
const tally = reactive({})

watch(
  () => props.pending,
  (pending) => {
    for (const key of Object.keys(tally)) delete tally[key]
    if (pending?.kind === 'take') {
      for (const resource of pending.from) tally[resource] = 0
    }
  },
  { immediate: true },
)

const taken = computed(() => Object.values(tally).reduce((sum, n) => sum + n, 0))
const remaining = computed(() => (props.pending.total ?? 0) - taken.value)
const canConfirm = computed(() => remaining.value === 0)

function bump(resource, delta) {
  const next = (tally[resource] ?? 0) + delta
  if (next < 0 || next > props.pending.maxSame) return
  if (delta > 0 && taken.value >= props.pending.total) return
  tally[resource] = next
}
</script>

<template>
  <div class="decision">
    <div class="prompt">{{ pending.prompt }}</div>

    <!-- Pick one of several branches -->
    <div v-if="pending.kind === 'choice'" class="options">
      <button
        v-for="option in pending.options"
        :key="option.index"
        class="option"
        :class="{ dim: !option.available }"
        :disabled="!option.available"
        :title="option.reason || ''"
        @click="emit('choose', option.index)"
      >
        {{ option.label }}
        <span v-if="!option.available" class="why">{{ option.reason }}</span>
      </button>
    </div>

    <!-- Build a tally of resources -->
    <div v-else class="take">
      <div class="counters">
        <div v-for="resource in pending.from" :key="resource" class="counter">
          <span class="res-name">{{ resource }}</span>
          <button class="step" :disabled="!tally[resource]" @click="bump(resource, -1)">&minus;</button>
          <span class="count">{{ tally[resource] ?? 0 }}</span>
          <button
            class="step"
            :disabled="taken >= pending.total || (tally[resource] ?? 0) >= pending.maxSame"
            @click="bump(resource, 1)"
          >+</button>
        </div>
      </div>
      <div class="take-foot">
        <span class="muted">
          {{ taken }} of {{ pending.total }} chosen &middot; max {{ pending.maxSame }} of a kind
        </span>
        <button class="confirm" :disabled="!canConfirm" @click="emit('take', { ...tally })">
          Take these
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.decision {
  margin-top: 0.5rem;
  padding: 0.6rem 0.7rem;
  background: #1f2128;
  border: 1px solid #4a4335;
  border-left: 3px solid var(--accent);
  border-radius: 3px;
}

.prompt { font-size: 0.82rem; margin-bottom: 0.5rem; }

.options { display: flex; flex-direction: column; gap: 0.3rem; align-items: flex-start; }

.option {
  display: flex; align-items: baseline; gap: 0.5rem;
  font-size: 0.76rem; padding: 0.25rem 0.5rem;
  border-color: var(--border-bright, #574e3a);
}
.option:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.option.dim { opacity: 0.45; }
.why { color: #d9776b; font-size: 0.68rem; }

.counters { display: flex; gap: 0.9rem; flex-wrap: wrap; }
.counter { display: flex; align-items: center; gap: 0.25rem; }
.res-name { font-size: 0.72rem; color: var(--muted); min-width: 3.2rem; }
.step { padding: 0 0.35rem; font-size: 0.78rem; line-height: 1.4; }
.count { min-width: 1.1rem; text-align: center; font-variant-numeric: tabular-nums; }

.take-foot {
  display: flex; align-items: center; gap: 0.7rem;
  margin-top: 0.5rem; flex-wrap: wrap;
}
.confirm { border-color: var(--accent); color: var(--accent); font-size: 0.74rem; }
.confirm:disabled { opacity: 0.4; }

.muted { color: var(--muted); font-size: 0.72rem; }
</style>
