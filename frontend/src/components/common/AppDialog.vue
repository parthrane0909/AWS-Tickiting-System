<template>
  <Transition name="dialog">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-coal/40 p-4" @click.self="$emit('close')">
      <div class="dialog-card w-full max-w-md rounded-card border border-black/5 bg-white p-6 shadow-lift">
        <div class="mb-4 flex items-start justify-between">
          <h3 class="text-lg font-bold">{{ title }}</h3>
          <button class="t-control rounded-full px-2 text-muted hover:bg-lavender" @click="$emit('close')">✕</button>
        </div>
        <slot />
        <div class="mt-6 flex justify-end gap-2">
          <AppButton variant="light" @click="$emit('close')">Cancel</AppButton>
          <AppButton :loading="loading" @click="$emit('confirm')">{{ confirmLabel }}</AppButton>
        </div>
      </div>
    </div>
  </Transition>
</template>
<script setup>
import AppButton from "./AppButton.vue";
defineProps({ open: Boolean, title: String, confirmLabel: { type: String, default: "Save" }, loading: Boolean });
defineEmits(["close", "confirm"]);
</script>
