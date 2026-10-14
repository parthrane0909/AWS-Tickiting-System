<template>
  <div class="flex min-h-screen items-center justify-center bg-canvas px-4 py-8">
    <div class="anim-rise grid w-full max-w-4xl overflow-hidden rounded-card border border-black/5 bg-white shadow-lift md:grid-cols-2">
      <!-- Left panel: sign-in form -->
      <div class="anim-fade stagger-1 flex flex-col p-6 sm:p-10">
        <div class="flex items-center gap-2">
          <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-coal text-xs font-black text-white">TD</span>
          <span class="font-bold">TickDesk</span>
        </div>
        <h1 class="anim-rise stagger-1 mt-8 text-2xl font-bold">Welcome back</h1>
        <p class="anim-rise stagger-2 mt-1 text-sm text-muted">Sign in to track requests and collaborate with support.</p>

        <form class="anim-rise stagger-2 mt-6 flex flex-col gap-4" @submit.prevent="submit" novalidate>
          <label class="block">
            <span class="mb-1 block text-xs font-semibold">Email Address</span>
            <input
              v-model="email"
              type="email"
              autocomplete="username"
              placeholder="Enter your email address"
              class="t-control w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none placeholder:text-zinc-400 focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <span v-if="fieldErrors.email" class="mt-1 block text-xs text-rose-600">{{ fieldErrors.email }}</span>
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-semibold">Password</span>
            <span class="relative block">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="Enter your password"
                class="t-control w-full rounded-xl border border-line bg-white px-3 py-2.5 pr-11 text-sm outline-none placeholder:text-zinc-400 focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <button
                type="button"
                class="t-control absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-lavender hover:text-ink"
                @click="showPassword = !showPassword"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
              >
                {{ showPassword ? "Hide" : "Show" }}
              </button>
            </span>
            <span v-if="fieldErrors.password" class="mt-1 block text-xs text-rose-600">{{ fieldErrors.password }}</span>
          </label>
          <AppButton type="submit" variant="accent" :loading="submitting" :disabled="submitting" class="w-full !py-2.5">Sign In</AppButton>
          <p v-if="authError" role="alert" class="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ authError }}</p>
        </form>

        <details class="mt-4 rounded-xl border border-dashed border-line bg-lavender/40 px-3 py-2 text-xs">
          <summary class="cursor-pointer font-semibold text-ink">Local development access (test identities)</summary>
          <div v-if="devUsers.length === 0" class="py-2 text-muted">Loading…</div>
          <ul class="mt-2 flex flex-col gap-1.5">
            <li v-for="u in devUsers" :key="u.id" class="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5">
              <span class="min-w-0 truncate"><span class="font-semibold">{{ u.email }}</span> <span class="text-muted">· {{ u.role }}</span></span>
              <button class="t-control shrink-0 rounded-pill border border-line px-2.5 py-0.5 font-semibold hover:bg-lavender" @click="fill(u.email)">Fill</button>
            </li>
          </ul>
          <p class="mt-1.5 text-muted">Dev password: <code class="rounded bg-white px-1 font-semibold text-ink">local-dev-pass</code>. See README.</p>
        </details>

        <p class="mt-auto pt-8 text-center text-[11px] text-muted">TickDesk local build · Terms &amp; Privacy apply in production only</p>
      </div>

      <!-- Right panel: animated branding illustration (decorative, not an app preview) -->
      <div class="relative hidden overflow-hidden bg-gradient-to-br from-accent via-accentdark to-deepgreen p-8 text-white md:block">
        <!-- Layer 1: ambient background -->
        <div aria-hidden="true" class="anim-glow pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
        <div aria-hidden="true" class="anim-drift pointer-events-none absolute -bottom-20 -left-14 h-72 w-72 rounded-full bg-black/15" style="--d: 1200ms" />
        <div aria-hidden="true" class="anim-drift pointer-events-none absolute right-10 top-1/2 h-24 w-24 rounded-2xl border border-white/20" style="--d: 600ms" />

        <!-- Layer 2 + 3: illustration with floating accents -->
        <div aria-hidden="true" class="anim-illustration relative mx-auto mt-4 h-56 w-full max-w-xs">
          <div class="anim-float absolute left-2 top-6 w-40 -rotate-6 rounded-2xl bg-white/95 p-3 text-ink shadow-lift">
            <svg viewBox="0 0 24 24" class="h-6 w-6 text-accent" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z"/><path d="M4 11h16" stroke-dasharray="2 2"/></svg>
            <div class="mt-2 h-2 w-3/4 rounded-full bg-lavender" />
            <div class="mt-1.5 h-2 w-1/2 rounded-full bg-zinc-100" />
            <span class="mt-2 inline-block rounded-pill bg-skysoft px-2 py-0.5 text-[10px] font-bold text-sky-800">OPEN</span>
          </div>
          <div class="anim-float absolute right-2 top-0 w-40 rotate-3 rounded-2xl bg-white/95 p-3 text-ink shadow-lift" style="animation-delay: 1.4s">
            <svg viewBox="0 0 24 24" class="h-6 w-6 text-accent" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a8 8 0 1 1-3.2-6.4"/><path d="M9 12l2 2 4-4"/></svg>
            <div class="mt-2 h-2 w-2/3 rounded-full bg-mint" />
            <div class="mt-1.5 h-2 w-1/3 rounded-full bg-zinc-100" />
            <span class="mt-2 inline-block rounded-pill bg-mint px-2 py-0.5 text-[10px] font-bold text-accentdark">RESOLVED</span>
          </div>
          <div class="anim-float absolute bottom-0 left-10 right-10 rounded-2xl bg-coal/85 p-3 shadow-lift backdrop-blur" style="animation-delay: 2.6s">
            <div class="flex items-center gap-2">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-black text-white">EV</span>
              <div class="min-w-0">
                <div class="h-2 w-28 rounded-full bg-white/70" />
                <div class="mt-1.5 h-2 w-20 rounded-full bg-white/30" />
              </div>
            </div>
          </div>
        </div>

        <!-- Layer 4: copy -->
        <div class="anim-rise stagger-3 relative mt-6">
          <div class="flex items-center gap-2">
            <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 text-xs font-black">TD</span>
          </div>
          <p class="mt-3 text-xl font-bold leading-snug">Support, without the chaos.</p>
          <p class="mt-2 text-sm text-white/80">Bring requests, conversations, and resolution into one clear workflow.</p>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppButton from "../components/common/AppButton.vue";
import { api } from "../services/api.js";
import { useAuthStore } from "../stores/auth.js";

const email = ref("");
const password = ref("");
const showPassword = ref(false);
const submitting = ref(false);
const fieldErrors = ref({});
const authError = ref("");
const devUsers = ref([]);
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

onMounted(async () => {
  // Dev-only helper: identity list for the disclosure. Not part of sign-in itself.
  try {
    devUsers.value = await api.devUsers();
  } catch {
    devUsers.value = [];
  }
});

// Fill populates the form only; the user still presses Sign In explicitly.
function fill(addr) {
  email.value = addr;
  password.value = "local-dev-pass";
  authError.value = "";
}

async function submit() {
  if (submitting.value) return;
  fieldErrors.value = {};
  authError.value = "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) fieldErrors.value.email = "Enter a valid email address.";
  if (!password.value) fieldErrors.value.password = "Enter your password.";
  if (Object.keys(fieldErrors.value).length) return;
  submitting.value = true;
  try {
    const user = await api.devLogin(email.value.trim(), password.value);
    auth.signIn(user);
    router.push(route.query.next || "/");
  } catch (e) {
    authError.value = e.status === 401 ? e.message : `Cannot reach the backend: ${e.message}`;
  } finally {
    submitting.value = false;
  }
}
</script>
