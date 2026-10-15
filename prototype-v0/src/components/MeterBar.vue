<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: Number, required: true },
  max: { type: Number, required: true },
  color: { type: String, required: true },
})

const pct = computed(() => Math.max(0, Math.min(100, (props.value / props.max) * 100)))

/** Below a quarter the bar pulses, so a dying meter is hard to miss. */
const critical = computed(() => pct.value <= 25)
</script>

<template>
  <div class="meter">
    <div class="row">
      <span class="label">{{ label }}</span>
      <span class="value" :class="{ critical }">{{ Math.round(value) }}</span>
    </div>
    <div class="track">
      <div
        class="fill"
        :class="{ critical }"
        :style="{ width: `${pct}%`, background: color }"
      />
    </div>
  </div>
</template>

<style scoped>
.meter + .meter {
  margin-top: 0.55rem;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.2rem;
}

.label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--muted);
}

.value {
  font-variant-numeric: tabular-nums;
  font-size: 0.9rem;
}

.value.critical {
  color: var(--bad);
  font-weight: 600;
}

.track {
  height: 9px;
  background: #100e0a;
  border: 1px solid var(--border);
  border-radius: 2px;
  overflow: hidden;
}

.fill {
  height: 100%;
  transition: width 0.25s ease;
}

.fill.critical {
  animation: pulse 1.1s ease-in-out infinite;
}

@keyframes pulse {
  50% { opacity: 0.45; }
}

@media (prefers-reduced-motion: reduce) {
  .fill { transition: none; }
  .fill.critical { animation: none; }
}
</style>
