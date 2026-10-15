<template>
  <main class="flex min-h-screen items-center justify-center bg-canvas p-6">
    <div class="w-full max-w-md rounded-2xl bg-white p-8 shadow-lift">
      <h1 class="text-2xl font-bold">Cognito Authentication</h1>

      <p v-if="loading" class="mt-4">
        Completing secure login...
      </p>

      <div v-else-if="error" class="mt-4">
        <p class="text-red-600">{{ error }}</p>
        <RouterLink to="/auth/cognito-test" class="mt-4 block underline">
          Try again
        </RouterLink>
      </div>

      <div v-else class="mt-4 space-y-3">
        <p class="font-semibold text-green-700">
          Cognito login successful!
        </p>

        <p><strong>Email:</strong> {{ user.email }}</p>

        <p>
          <strong>Groups:</strong>
          {{ user.groups.join(", ") || "No group assigned" }}
        </p>

        <p class="text-sm text-muted">
          Authentication succeeded. The application backend
          has not yet been switched to Cognito JWT authentication.
        </p>
      </div>
    </div>
  </main>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth.js";
import { finishCognitoLogin } from "../services/cognitoOAuth.js";

const router = useRouter();
const auth = useAuthStore();

const loading = ref(true);
const error = ref("");
const user = ref({ email: "", groups: [] });

onMounted(async () => {
  try {
    user.value = await finishCognitoLogin();

    const authenticated = await auth.restoreCognitoSession();

    if (!authenticated) {
      throw new Error(
        "Cognito login succeeded, but backend verification failed."
      );
    }

    await router.replace({ name: "dashboard" });
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
});
</script>
