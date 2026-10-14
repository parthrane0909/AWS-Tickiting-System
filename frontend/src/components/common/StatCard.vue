<template>
  <div class="t-control rounded-card border border-black/5 p-5 shadow-card hover:shadow-lift" :class="toneClass">
    <p class="text-xs font-semibold uppercase tracking-wide text-muted">{{ title }}</p>
    <div class="mt-2 flex items-baseline gap-2">
      <span class="text-3xl font-bold tabular-nums">{{ value }}</span>
      <span v-if="hint" class="text-xs text-muted">{{ hint }}</span>
    </div>
    <div v-if="bar !== null" class="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10">
      <div class="t-control h-full rounded-full bg-accent" :style="{ width: `${Math.min(100, bar)}%` }" />
    </div>
  </div>
</template>
<script setup>
import { computed } from "vue";
const props = defineProps({
  title: String,
  value: { type: [Number, String], default: 0 },
  hint: String,
  bar: { type: Number, default: null },
  tone: { type: String, default: "white" }, // white | lavender | sky | mint | pink
});
const toneClass = computed(() => ({
  white: "bg-white",
  lavender: "bg-lavender",
  sky: "bg-skysoft",
  mint: "bg-mint",
  pink: "bg-pinksoft",
}[props.tone] || "bg-white"));
</script>
