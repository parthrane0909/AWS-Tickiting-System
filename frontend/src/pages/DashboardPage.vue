<template>
  <AppLayout>
    <div class="anim-rise mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">{{ auth.isAgent ? "All Tickets" : "My Tickets" }}</h1>
        <p class="text-sm text-muted">Tracked from live application data — no fixed numbers.</p>
      </div>
      <AppButton v-if="!auth.isAgent" @click="$router.push('/tickets/new')">+ Create Ticket</AppButton>
    </div>

    <div class="anim-rise grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div class="anim-rise stagger-1 col-span-2 lg:row-span-2">
        <div class="t-control flex h-full min-h-[10rem] flex-col justify-between rounded-card border border-black/5 bg-lavender p-5 shadow-card hover:shadow-lift">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted">Total Tickets</p>
          <p class="text-5xl font-bold tabular-nums">{{ stats.total }}</p>
          <p class="text-xs text-muted">{{ stats.OPEN }} open · {{ stats.IN_PROGRESS }} in progress · {{ stats.RESOLVED }} resolved</p>
        </div>
      </div>
      <div class="anim-rise stagger-1"><StatCard title="Open" :value="stats.OPEN" :bar="pct('OPEN')" tone="sky" /></div>
      <div class="anim-rise stagger-2"><StatCard title="In Progress" :value="stats.IN_PROGRESS" :bar="pct('IN_PROGRESS')" tone="pink" /></div>
      <div class="anim-rise stagger-3"><StatCard title="Resolved" :value="stats.RESOLVED" :bar="pct('RESOLVED')" tone="mint" /></div>
      <div class="anim-rise stagger-4"><StatCard title="Closed" :value="stats.CLOSED" :bar="pct('CLOSED')" tone="white" /></div>
    </div>

    <div class="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div class="anim-rise stagger-2 rounded-card border border-black/5 bg-white p-5 shadow-card">
        <p class="text-xs font-semibold uppercase tracking-wide text-muted">Ticket status overview</p>
        <div class="mt-3 flex flex-col gap-2.5">
          <div v-for="row in statusDist" :key="row.status" class="flex items-center gap-3 text-sm">
            <span class="w-24 shrink-0 text-xs font-medium">{{ STATUS_LABELS[row.status] }}</span>
            <div class="h-2 flex-1 overflow-hidden rounded-full bg-lavender">
              <div class="t-control h-full rounded-full" :class="row.bar" :style="{ width: `${row.pct}%` }" />
            </div>
            <span class="w-8 shrink-0 text-right text-xs tabular-nums text-muted">{{ row.count }}</span>
          </div>
        </div>
      </div>
      <div class="anim-rise stagger-3 rounded-card border border-black/5 bg-cream p-5 shadow-card">
        <div class="flex items-baseline justify-between">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted">Recent activity</p>
          <p class="text-[11px] text-muted">Latest updates in your queue</p>
        </div>
        <ul v-if="recentTickets.length" class="mt-3 flex flex-col">
          <li v-for="t in recentTickets" :key="t.id">
            <button class="t-control flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-white" @click="$router.push(`/tickets/${t.id}`)">
              <StatusBadge :status="t.status" />
              <span class="min-w-0 flex-1 truncate text-sm"><span class="font-semibold">{{ t.id }}</span> <span class="text-muted">· {{ t.title }}</span></span>
              <span class="shrink-0 text-[11px] text-muted">{{ shortDate(t.updatedAt) }}</span>
            </button>
          </li>
        </ul>
        <p v-else class="mt-3 text-sm text-muted">No tickets yet.</p>
      </div>
    </div>

    <div class="anim-rise stagger-2 mt-4 flex flex-col gap-2 rounded-card border border-black/5 bg-white p-4 shadow-card md:flex-row">
      <input
        v-model="filters.search"
        placeholder="Search title, description, or ID…"
        class="t-control flex-1 rounded-xl border border-line px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-accent focus:ring-2 focus:ring-accent/20"
        @input="debouncedFetch"
      />
      <div class="flex flex-wrap gap-2">
        <select v-model="filters.status" class="t-control rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent" @change="fetchTickets">
          <option value="">All statuses</option>
          <option v-for="s in STATUSES" :key="s" :value="s">{{ STATUS_LABELS[s] }}</option>
        </select>
        <select v-model="filters.priority" class="t-control rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent" @change="fetchTickets">
          <option value="">All priorities</option>
          <option v-for="p in PRIORITIES" :key="p" :value="p">{{ PRIORITY_LABELS[p] }}</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="py-12 text-center text-sm text-muted">Loading tickets…</div>
    <div v-else-if="loadError" class="anim-fade mt-4 rounded-card border border-black/5 bg-white p-6 text-center text-sm text-rose-600 shadow-card">
      {{ loadError }}
    </div>
    <div v-else class="anim-fade stagger-3 mt-4">
      <EmptyState
        v-if="tickets.length === 0"
        title="No tickets found"
        hint="Try clearing search/filters, or create your first ticket."
      >
        <AppButton v-if="!auth.isAgent" @click="$router.push('/tickets/new')">Create Ticket</AppButton>
      </EmptyState>
      <TicketTable v-else :tickets="tickets" @open="(t) => $router.push(`/tickets/${t.id}`)" />
      <p class="mt-2 text-xs text-muted">{{ total }} ticket(s) · page {{ page }}</p>
    </div>
  </AppLayout>
</template>
<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import AppLayout from "../components/layout/AppLayout.vue";
import AppButton from "../components/common/AppButton.vue";
import EmptyState from "../components/common/EmptyState.vue";
import StatCard from "../components/common/StatCard.vue";
import StatusBadge from "../components/common/StatusBadge.vue";
import TicketTable from "../components/tickets/TicketTable.vue";
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS } from "../constants/index.js";
import { api } from "../services/api.js";
import { useAuthStore } from "../stores/auth.js";

const auth = useAuthStore();
const tickets = ref([]);
const total = ref(0);
const page = ref(1);
const loading = ref(true);
const loadError = ref("");
const filters = reactive({ search: "", status: "", priority: "" });
// Stats are computed from the full unfiltered list so cards reflect real data.
const allMine = ref([]);
let timer = null;

const stats = computed(() => {
  const s = { total: allMine.value.length, OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 };
  for (const t of allMine.value) if (s[t.status] !== undefined) s[t.status]++;
  return s;
});
function pct(k) {
  return stats.value.total ? (stats.value[k] / stats.value.total) * 100 : 0;
}

// Real-data derivations for the bento cards: status distribution + most
// recently updated tickets. No fabricated activity, no chart library.
const STATUS_BAR = { OPEN: "bg-sky-400", IN_PROGRESS: "bg-amber-400", RESOLVED: "bg-emerald-500", CLOSED: "bg-zinc-400" };
const statusDist = computed(() =>
  STATUSES.map((s) => ({ status: s, count: stats.value[s], pct: pct(s), bar: STATUS_BAR[s] })),
);
const recentTickets = computed(() =>
  [...allMine.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
);
function shortDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
  } catch {
    return "";
  }
}

async function fetchTickets() {
  loading.value = true;
  loadError.value = "";
  try {
    const [filtered, unfiltered] = await Promise.all([
      api.listTickets({ ...filters, page: page.value, limit: 50 }),
      api.listTickets({ limit: 100 }),
    ]);
    tickets.value = filtered.data;
    total.value = filtered.meta.total;
    allMine.value = unfiltered.data;
  } catch (e) {
    loadError.value = e.message;
  } finally {
    loading.value = false;
  }
}
function debouncedFetch() {
  clearTimeout(timer);
  timer = setTimeout(fetchTickets, 300);
}
onMounted(fetchTickets);
</script>
