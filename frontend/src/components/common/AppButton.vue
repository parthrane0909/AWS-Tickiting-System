<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="t-control inline-flex items-center justify-center gap-2 rounded-pill px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:-translate-y-px enabled:active:translate-y-0 enabled:active:scale-[0.98]"
    :class="variantClasses"
  >
    <span v-if="loading" class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
    <slot />
  </button>
</template>
<script setup>
import { computed } from "vue";
const props = defineProps({
  variant: { type: String, default: "dark" },
  type: { type: String, default: "button" },
  loading: Boolean,
  disabled: Boolean,
});
const variantClasses = computed(() => ({
  dark: "bg-coal text-white hover:bg-black hover:shadow-lift",
  accent: "bg-accent text-white hover:bg-accentdark hover:shadow-lift",
  light: "bg-white text-ink border border-line hover:bg-lavender hover:shadow-card",
  danger: "bg-white text-rose-700 border border-rose-200 hover:bg-rose-50",
}[props.variant]));
</script>
