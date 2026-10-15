<script setup>
import { computed } from 'vue'
import { useGameStore } from '../stores/game.js'

const store = useGameStore()

const over = computed(() => store.game.status !== 'playing')

const gatherable = computed(() => {
  const biome = store.rules.biomes[store.tile.biome]
  return Boolean(biome.resource) && store.tile.remaining > 0
})

const canCook = computed(
  () => store.tile.structure?.durability > 0 && store.resources.berries > 0,
)

function costText(cost) {
  return Object.entries(cost)
    .map(([resource, n]) => `${n} ${resource}`)
    .join(', ')
}
</script>

<template>
  <div class="panel">
    <div class="panel-title">Actions &mdash; {{ store.game.actionPoints }} AP left</div>

    <div class="grid">
      <button :disabled="over || !gatherable" @click="store.act({ type: 'gather' })">
        Gather
      </button>
      <button :disabled="over" @click="store.act({ type: 'rest' })">Rest</button>
      <button :disabled="over || !canCook" @click="store.act({ type: 'cook' })">Cook</button>
      <button :disabled="over" @click="store.skipPhase()">Skip phase</button>
    </div>

    <template v-if="store.edibles.length">
      <div class="panel-title spaced">Eat</div>
      <div class="grid">
        <button
          v-for="food in store.edibles"
          :key="food.name"
          :disabled="over"
          :title="`+${food.hunger} hunger`"
          @click="store.act({ type: 'eat', food: food.name })"
        >
          {{ food.name }} &times;{{ food.count }}
        </button>
      </div>
    </template>

    <div class="panel-title spaced">Craft</div>
    <div class="recipes">
      <button
        v-for="recipe in store.recipes"
        :key="recipe.name"
        class="recipe"
        :disabled="over || !recipe.affordable"
        @click="store.act({ type: 'craft', recipe: recipe.name })"
      >
        <span class="name">
          {{ recipe.label }}
          <span v-if="recipe.owned && recipe.durability" class="badge">
            {{ recipe.durability }} left
          </span>
          <span v-else-if="recipe.owned" class="badge owned">held</span>
        </span>
        <span class="cost">{{ costText(recipe.cost) }}</span>
      </button>
    </div>

    <p v-if="store.lastError" class="error">{{ store.lastError }}</p>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.4rem;
}

.spaced {
  margin-top: 0.9rem;
}

.recipes {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.recipe {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  text-align: left;
}

.name {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.badge {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fire);
  border: 1px solid var(--border-bright);
  border-radius: 2px;
  padding: 0.05rem 0.25rem;
}

.badge.owned {
  color: var(--good);
}

.cost {
  font-size: 0.75rem;
  color: var(--muted);
  white-space: nowrap;
}

.error {
  margin: 0.75rem 0 0;
  padding: 0.4rem 0.55rem;
  font-size: 0.8rem;
  color: var(--bad);
  background: rgba(192, 57, 43, 0.1);
  border-left: 2px solid var(--bad);
  border-radius: 2px;
}
</style>
