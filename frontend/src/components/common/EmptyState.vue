<template>
  <div class="flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-white/60 px-6 py-12 text-center">
    <p class="text-sm font-semibold">{{ title }}</p>
    <p class="mt-1 max-w-sm text-sm text-muted">{{ hint }}</p>
    <div class="mt-4"><slot /></div>
  </div>
</template>
<script setup>
defineProps({ title: { type: String, default: "Nothing here yet" }, hint: String });
</script>
