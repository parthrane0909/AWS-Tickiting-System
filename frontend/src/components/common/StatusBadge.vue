<template>
  <span
    class="t-control inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-medium"
    :class="STATUS_STYLES[status] || 'bg-zinc-100 text-zinc-600'"
  >
    <span class="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
    {{ STATUS_LABELS[status] || status }}
  </span>
</template>
<script setup>
import { STATUS_LABELS, STATUS_STYLES } from "../../constants/index.js";
defineProps({ status: { type: String, required: true } });
</script>
