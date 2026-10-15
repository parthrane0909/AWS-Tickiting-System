<template>
  <main class="flex min-h-screen items-center justify-center bg-canvas p-6">
    <div class="w-full max-w-md rounded-2xl bg-white p-8 shadow-lift">
      <h1 class="text-2xl font-bold">TickDesk Cognito Test</h1>

      <p class="mt-3 text-sm text-muted">
        Test your AWS Cognito Customer or Agent login.
        Your existing local login remains unchanged.
      </p>

      <button
        type="button"
        class="mt-6 w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white"
        :disabled="busy"
        @click="login"
      >
        {{ busy ? "Redirecting..." : "Sign in with AWS Cognito" }}
      </button>

      <p v-if="error" class="mt-4 text-sm text-red-600">
        {{ error }}
      </p>

      <RouterLink to="/login" class="mt-5 block text-center text-sm">
        Back to local login
      </RouterLink>
    </div>
  </main>
</template>

<script setup>
import { ref } from "vue";
import { beginCognitoLogin } from "../services/cognitoOAuth.js";

const busy = ref(false);
const error = ref("");

async function login() {
  busy.value = true;
  error.value = "";

  try {
    await beginCognitoLogin();
  } catch (err) {
    error.value = err.message;
    busy.value = false;
  }
}
</script>
