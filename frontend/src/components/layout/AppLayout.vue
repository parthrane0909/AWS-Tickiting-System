<template>
  <div class="min-h-screen">
    <!-- 3D animated pastel background layer (behind all content;
         never interactive; cards are untouched by design) -->
    <AnimatedBackground />
    <header class="sticky top-0 z-40 border-b border-black/5 bg-canvas/90 backdrop-blur">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <RouterLink to="/" class="flex items-center gap-2">
          <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-coal text-xs font-black text-white">TD</span>
          <span class="font-bold">TickDesk</span>
        </RouterLink>
        <nav class="mx-auto flex items-center gap-1 overflow-x-auto rounded-pill bg-coal p-1 text-sm text-white">
          <RouterLink to="/" class="t-control whitespace-nowrap rounded-pill px-4 py-1.5" :class="navClass('/')">Dashboard</RouterLink>
          <RouterLink
            v-if="!auth.isAgent"
            to="/tickets/new"
            class="t-control whitespace-nowrap rounded-pill px-4 py-1.5"
            :class="navClass('/tickets/new')"
          >New Ticket</RouterLink>
        </nav>
        <div class="flex items-center gap-2">
          <span class="hidden rounded-pill border border-black/5 bg-white px-3 py-1.5 text-xs font-medium shadow-card sm:inline">
            {{ auth.user?.name }} · {{ auth.user?.role }}
          </span>
          <button class="t-control rounded-pill border border-line bg-white px-3 py-1.5 text-xs font-semibold hover:bg-lavender" @click="logout">
            Sign out
          </button>
        </div>
      </div>
    </header>
    <main class="mx-auto max-w-6xl px-4 py-6">
      <slot />
    </main>
    <div class="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="anim-fade pointer-events-auto rounded-xl px-4 py-2 text-sm text-white shadow-lift"
        :class="t.kind === 'error' ? 'bg-rose-700' : 'bg-coal'"
      >
        {{ t.message }}
      </div>
    </div>
  </div>
</template>
<script setup>
import { beginCognitoLogout } from "../../services/cognitoOAuth.js";
import { useRoute, useRouter } from "vue-router";
import AnimatedBackground from "./AnimatedBackground.vue";
import { useAuthStore } from "../../stores/auth.js";
import { useToast } from "../../composables/useToast.js";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { toasts } = useToast();

function navClass(path) {
  const active = path === "/" ? route.path === "/" : route.path.startsWith(path);
  return active ? "bg-white text-coal font-semibold" : "text-white/70 hover:text-white hover:bg-white/10";
}
function logout() {
  auth.signOut();

  if (import.meta.env.VITE_AUTH_MODE === "cognito") {
    beginCognitoLogout();
    return;
  }

  router.push("/login");
}
</script>
