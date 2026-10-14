<template>
  <label class="block">
    <span v-if="label" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{{ label }}</span>
    <input
      :value="modelValue"
      :type="type"
      :placeholder="placeholder"
      @input="$emit('update:modelValue', $event.target.value)"
      class="t-control w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-accent focus:ring-2 focus:ring-accent/20"
    />
    <span v-if="error" class="mt-1 block text-xs text-rose-600">{{ error }}</span>
  </label>
</template>
<script setup>
defineProps({
  modelValue: { type: [String, Number], default: "" },
  label: String,
  type: { type: String, default: "text" },
  placeholder: String,
  error: String,
});
defineEmits(["update:modelValue"]);
</script>
