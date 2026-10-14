<template>
  <label class="block">
    <span v-if="label" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{{ label }}</span>
    <select
      :value="modelValue"
      @change="$emit('update:modelValue', $event.target.value)"
      class="t-control w-full appearance-none rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
    >
      <option v-if="placeholder" value="">{{ placeholder }}</option>
      <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>
    <span v-if="error" class="mt-1 block text-xs text-rose-600">{{ error }}</span>
  </label>
</template>
<script setup>
defineProps({
  modelValue: { type: [String, Number], default: "" },
  options: { type: Array, default: () => [] },
  label: String,
  placeholder: String,
  error: String,
});
defineEmits(["update:modelValue"]);
</script>
