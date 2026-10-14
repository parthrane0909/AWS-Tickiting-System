<template>
  <div class="overflow-x-auto rounded-card border border-black/5 bg-white shadow-card">
    <table class="w-full min-w-[760px] text-left text-sm">
      <thead>
        <tr class="border-b border-[#ECE8F1] bg-lavender/50 text-xs uppercase tracking-wide text-muted">
          <th class="px-4 py-3 font-semibold">Ticket</th>
          <th class="px-4 py-3 font-semibold">Status</th>
          <th class="px-4 py-3 font-semibold">Priority</th>
          <th class="px-4 py-3 font-semibold">Category</th>
          <th class="px-4 py-3 font-semibold">Assignee</th>
          <th class="px-4 py-3 font-semibold">Updated</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="t in tickets"
          :key="t.id"
          tabindex="0"
          class="t-control cursor-pointer border-b border-[#F1EDF5] last:border-0 hover:bg-mint/40 focus:bg-mint/40"
          @click="$emit('open', t)"
          @keydown.enter="$emit('open', t)"
        >
          <td class="px-4 py-3">
            <p class="font-semibold">{{ t.id }} · {{ t.title }}</p>
            <p class="max-w-md truncate text-xs text-muted">{{ t.description }}</p>
          </td>
          <td class="px-4 py-3"><StatusBadge :status="t.status" /></td>
          <td class="px-4 py-3"><PriorityBadge :priority="t.priority" /></td>
          <td class="px-4 py-3 text-xs">{{ t.category }}</td>
          <td class="px-4 py-3 text-xs">{{ t.assigneeName || "—" }}</td>
          <td class="px-4 py-3 text-xs text-muted">{{ formatDate(t.updatedAt) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
<script setup>
import PriorityBadge from "../common/PriorityBadge.vue";
import StatusBadge from "../common/StatusBadge.vue";
defineProps({ tickets: { type: Array, default: () => [] } });
defineEmits(["open"]);
function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
</script>
