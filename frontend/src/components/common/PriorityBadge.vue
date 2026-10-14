<template>
  <span
    class="t-control inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-medium"
    :class="PRIORITY_STYLES[priority] || 'bg-zinc-100 text-zinc-600'"
  >
    {{ PRIORITY_LABELS[priority] || priority }}
  </span>
</template>
<script setup>
import { PRIORITY_LABELS, PRIORITY_STYLES } from "../../constants/index.js";
defineProps({ priority: { type: String, required: true } });
</script>
