<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <div class="text-center">
      <p class="text-4xl font-black">404</p>
      <p class="mt-2 text-sm text-muted">Page not found.</p>
      <div class="mt-4"><AppButton @click="$router.push('/')">Go home</AppButton></div>
    </div>
  </div>
</template>
<script setup>
import AppButton from "../components/common/AppButton.vue";
</script>
