<template>
  <AppLayout>
    <div v-if="loading" class="py-12 text-center text-sm text-muted">Loading ticket…</div>
    <div v-else-if="loadError" class="rounded-card bg-white p-8 text-center shadow-card">
      <p class="text-sm font-semibold text-rose-600">{{ loadError }}</p>
      <div class="mt-4"><AppButton variant="light" @click="$router.push('/')">Back to list</AppButton></div>
    </div>
    <div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <!-- Main detail panel (reference: centered detail card) -->
      <div class="anim-rise rounded-card border border-black/5 bg-white p-6 shadow-card lg:col-span-2">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p class="text-xs text-muted">{{ ticket.id }} · {{ formatDate(ticket.createdAt) }}</p>
            <h1 class="mt-1 text-2xl font-bold">{{ ticket.title }}</h1>
          </div>
          <button class="t-control rounded-full px-2 text-muted hover:bg-lavender" @click="$router.push('/')">✕</button>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <StatusBadge :status="ticket.status" />
          <PriorityBadge :priority="ticket.priority" />
          <span class="rounded-pill bg-zinc-100 px-2.5 py-0.5 text-xs">{{ ticket.category }}</span>
        </div>
        <p class="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{{ ticket.description }}</p>

        <dl class="mt-6 grid grid-cols-1 gap-3 rounded-2xl bg-lavender/50 p-4 text-sm sm:grid-cols-2">
          <div><dt class="text-xs text-muted">Customer</dt><dd class="font-medium">{{ ticket.customerName }}</dd></div>
          <div><dt class="text-xs text-muted">Assignee</dt><dd class="font-medium">{{ ticket.assigneeName || "Unassigned" }}</dd></div>
          <div><dt class="text-xs text-muted">Created</dt><dd>{{ formatDate(ticket.createdAt) }}</dd></div>
          <div><dt class="text-xs text-muted">Updated</dt><dd>{{ formatDate(ticket.updatedAt) }}</dd></div>
          <div v-if="ticket.attachment" class="sm:col-span-2">
            <dt class="text-xs text-muted">Attachment</dt>
            <dd class="flex flex-wrap items-center gap-2">
              <span class="font-medium">{{ ticket.attachment.fileName }}</span>
              <span class="text-xs text-muted">{{ formatSize(ticket.attachment.size) }} · {{ ticket.attachment.mimeType }}</span>
              <AppButton v-if="!cloudApiMode" variant="light" :loading="downloading" @click="downloadAttachment">Download</AppButton>
              <span v-else class="text-xs text-muted">
                Download available after S3 integration.
              </span>
              <template v-if="canEdit && !cloudApiMode">
                <label class="t-control cursor-pointer rounded-pill border border-line px-2.5 py-1 text-xs font-semibold hover:bg-lavender">
                  Replace
                  <input ref="replaceInput" type="file" class="sr-only" accept="image/png,image/jpeg,application/pdf,text/plain" @change="onReplaceFile" />
                </label>
                <AppButton variant="danger" @click="removeAttachment">Remove</AppButton>
              </template>
            </dd>
          </div>
          <div v-else-if="cloudApiMode" class="sm:col-span-2">
            <dt class="text-xs text-muted">Attachment</dt>
            <dd class="text-sm text-muted">
              Attachments will be available after S3 integration.
            </dd>
          </div>
          <div v-else-if="canEdit" class="sm:col-span-2">
            <dt class="text-xs text-muted">Attachment</dt>
            <dd>
              <label class="t-control inline-block cursor-pointer rounded-pill border border-line px-2.5 py-1 text-xs font-semibold hover:bg-lavender">
                Add attachment
                <input ref="replaceInput" type="file" class="sr-only" accept="image/png,image/jpeg,application/pdf,text/plain" @change="onReplaceFile" />
              </label>
            </dd>
          </div>
        </dl>

        <!-- Customer edit (own OPEN tickets) / Agent workflow controls -->
        <div class="mt-4 flex flex-wrap gap-2">
          <template v-if="canEdit">
            <AppButton variant="light" @click="openEdit">Edit ticket</AppButton>
          </template>
          <template v-else-if="auth.isAgent">
            <AppButton variant="light" @click="statusDialog = true">Update status</AppButton>
            <AppButton
              variant="light"
              :disabled="!!agentDirectoryError"
              @click="assignDialog = true"
            >
              Assign agent
            </AppButton>
            <span v-if="agentDirectoryError" class="text-xs text-rose-600">
              Agent directory unavailable.
            </span>
          </template>
        </div>

        <!-- Comments -->
        <h2 class="mt-8 font-bold">Comments ({{ comments.length }})</h2>
        <div class="mt-2 flex flex-col gap-2">
          <div v-for="c in comments" :key="c.id" class="rounded-2xl border border-zinc-100 px-4 py-3">
            <p class="text-xs text-muted">{{ c.authorName }} · {{ c.authorRole }} · {{ formatDate(c.createdAt) }}</p>
            <p class="mt-1 text-sm">{{ c.body }}</p>
          </div>
          <p v-if="comments.length === 0" class="text-sm text-muted">No comments yet.</p>
        </div>
        <form class="mt-3 flex gap-2" @submit.prevent="postComment">
          <input
            v-model="draft"
            placeholder="Write a comment…"
            class="t-control flex-1 rounded-xl border border-line px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <AppButton type="submit" :loading="commenting" :disabled="!draft.trim()">Send</AppButton>
        </form>
        <p v-if="commentError" class="mt-1 text-xs text-rose-600">{{ commentError }}</p>
      </div>

      <!-- Activity timeline (reference: side activity panel) -->
      <aside class="anim-rise stagger-1 rounded-card border border-black/5 bg-white p-6 shadow-card">
        <h2 class="font-bold">Activity</h2>
        <ol class="mt-3 flex flex-col gap-3 border-l border-line pl-4">
          <li v-for="a in activity" :key="a.id" class="text-sm">
            <p class="font-medium">{{ activityLabel(a.type) }}</p>
            <p class="text-xs text-muted">{{ a.detail }}</p>
            <p class="text-xs text-muted">{{ a.actorName }} · {{ formatDate(a.createdAt) }}</p>
          </li>
        </ol>
        <p v-if="activity.length === 0" class="mt-2 text-sm text-muted">No activity yet.</p>
      </aside>
    </div>

    <!-- Edit dialog (Customer, own OPEN tickets) -->
    <AppDialog :open="editDialog" title="Edit ticket" confirm-label="Save Changes" :loading="editSaving" @close="editDialog = false" @confirm="saveEdit">
      <AppInput v-model="editForm.title" label="Title" :error="editErrors.title" maxlength="120" />
      <div class="mt-3">
        <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Description</label>
        <textarea
          v-model="editForm.description"
          rows="4"
          maxlength="5000"
          class="t-control w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <span v-if="editErrors.description" class="mt-1 block text-xs text-rose-600">{{ editErrors.description }}</span>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-3">
        <AppSelect v-model="editForm.priority" label="Priority" :options="editPriorityOptions" :error="editErrors.priority" />
        <AppSelect v-model="editForm.category" label="Category" :options="editCategoryOptions" :error="editErrors.category" />
      </div>
      <p v-if="editErrors.form" class="mt-3 text-sm text-rose-600">{{ editErrors.form }}</p>
    </AppDialog>

    <!-- Status dialog -->
    <AppDialog :open="statusDialog" title="Update status" confirm-label="Save" :loading="saving" @close="statusDialog = false" @confirm="saveStatus">
      <AppSelect v-model="statusDraft" label="Status" :options="STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))" />
    </AppDialog>

    <!-- Assign dialog -->
    <AppDialog :open="assignDialog" title="Assign agent" confirm-label="Save" :loading="saving" @close="assignDialog = false" @confirm="saveAssignee">
      <AppSelect v-model="assigneeDraft" label="Agent" placeholder="Unassigned" :options="agentOptions" />
    </AppDialog>
  </AppLayout>
</template>
<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppLayout from "../components/layout/AppLayout.vue";
import AppButton from "../components/common/AppButton.vue";
import AppDialog from "../components/common/AppDialog.vue";
import AppInput from "../components/common/AppInput.vue";
import AppSelect from "../components/common/AppSelect.vue";
import PriorityBadge from "../components/common/PriorityBadge.vue";
import StatusBadge from "../components/common/StatusBadge.vue";
import { CATEGORIES, PRIORITIES, STATUSES, STATUS_LABELS } from "../constants/index.js";
import { useToast } from "../composables/useToast.js";
import { api } from "../services/api.js";

const cloudApiMode = Boolean(import.meta.env.VITE_API_BASE_URL?.trim());
import { useAuthStore } from "../stores/auth.js";

const props = defineProps({ id: String });
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const cognitoMode =
  import.meta.env.VITE_AUTH_MODE === "cognito";
const { push } = useToast();
const ticketId = props.id || route.params.id;

const ticket = ref(null);
const comments = ref([]);
const activity = ref([]);
const loading = ref(true);
const loadError = ref("");
const draft = ref("");
const commenting = ref(false);
const commentError = ref("");
const statusDialog = ref(false);
const assignDialog = ref(false);
const statusDraft = ref("");
const assigneeDraft = ref("");
const saving = ref(false);
const agentOptions = ref([]);
const agentDirectoryError = ref("");
const downloading = ref(false);
const replaceInput = ref(null);

// Customer may edit own tickets while they are OPEN (backend enforces this too).
const canEdit = computed(
  () => !auth.isAgent && ticket.value && ticket.value.customerId === auth.user?.id && ticket.value.status === "OPEN",
);

const editDialog = ref(false);
const editSaving = ref(false);
const editErrors = ref({});
const editForm = reactive({ title: "", description: "", priority: "MEDIUM", category: "GENERAL" });
const editPriorityOptions = PRIORITIES.map((p) => ({ value: p, label: p }));
const editCategoryOptions = CATEGORIES.map((c) => ({ value: c, label: c }));

function openEdit() {
  editForm.title = ticket.value.title;
  editForm.description = ticket.value.description;
  editForm.priority = ticket.value.priority;
  editForm.category = ticket.value.category;
  editErrors.value = {};
  editDialog.value = true;
}

async function saveEdit() {
  if (editSaving.value) return;
  editSaving.value = true;
  editErrors.value = {};
  try {
    ticket.value = await api.updateTicket(ticketId, { ...editForm });
    activity.value = await api.history(ticketId);
    editDialog.value = false;
    push("Ticket updated.");
  } catch (e) {
    editErrors.value = { form: e.message, ...(e.details || {}) };
  } finally {
    editSaving.value = false;
  }
}

function formatSize(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function downloadAttachment() {
  if (downloading.value) return; // duplicate-click guard
  downloading.value = true;
  try {
    const blob = await api.downloadAttachment(ticketId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ticket.value.attachment?.fileName || "attachment";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke only after the browser has started the download;
    // immediate revocation can abort it in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    push("Download started.");
  } catch (e) {
    push(e.message, "error");
  } finally {
    downloading.value = false;
  }
}

// Replace or add an attachment on an own OPEN ticket.
async function onReplaceFile(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const contentBase64 = await readAsBase64(f);
    const meta = await api.uploadAttachment({ fileName: f.name, mimeType: f.type, size: f.size, contentBase64 });
    ticket.value = await api.updateTicket(ticketId, {
      attachment: { fileName: f.name, fileKey: meta.fileKey },
    });
    activity.value = await api.history(ticketId);
    push("Attachment saved.");
  } catch (err) {
    push(err.message, "error");
  } finally {
    if (replaceInput.value) replaceInput.value.value = "";
  }
}

async function removeAttachment() {
  try {
    ticket.value = await api.updateTicket(ticketId, { attachment: null });
    activity.value = await api.history(ticketId);
    push("Attachment removed.");
  } catch (e) {
    push(e.message, "error");
  }
}

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      resolve(raw.slice(raw.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
function activityLabel(t) {
  return { created: "Created", edited: "Edited", status_changed: "Status changed", assigned: "Assignment", commented: "Comment" }[t] || t;
}

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const [t, c, h] = await Promise.all([api.getTicket(ticketId), api.listComments(ticketId), api.history(ticketId)]);
    ticket.value = t;
    comments.value = c;
    activity.value = h;
    statusDraft.value = t.status;
    assigneeDraft.value = t.assigneeId || "";
    // Local development uses test identities.
    // Cognito agents will use a verified agent directory.
    if (auth.isAgent) {
      agentDirectoryError.value = "";

      try {
        const users = cognitoMode
          ? await api.agents()
          : await api.devUsers();

        agentOptions.value = users
          .filter(u => u.role === "agent")
          .map(u => ({
            value: u.id,
            label: u.name
          }));
      } catch (error) {
        console.warn("Agent directory unavailable:", error.message);
        agentOptions.value = [];
        agentDirectoryError.value = error.message;
      }
    }
  } catch (e) {
    loadError.value = e.status === 404 ? "Ticket not found." : e.message;
  } finally {
    loading.value = false;
  }
}

async function postComment() {
  if (commenting.value || !draft.value.trim()) return;
  commenting.value = true;
  commentError.value = "";
  try {
    const c = await api.addComment(ticketId, draft.value.trim());
    comments.value.push(c);
    draft.value = "";
    activity.value = await api.history(ticketId);
    push("Comment added.");
  } catch (e) {
    commentError.value = e.message;
  } finally {
    commenting.value = false;
  }
}

async function saveStatus() {
  saving.value = true;
  try {
    ticket.value = await api.updateTicket(ticketId, { status: statusDraft.value });
    activity.value = await api.history(ticketId);
    statusDialog.value = false;
    push("Status updated.");
  } catch (e) {
    push(e.message, "error");
  } finally {
    saving.value = false;
  }
}

async function saveAssignee() {
  saving.value = true;
  try {
    ticket.value = await api.updateTicket(ticketId, { assigneeId: assigneeDraft.value || null });
    activity.value = await api.history(ticketId);
    assignDialog.value = false;
    push("Assignment saved.");
  } catch (e) {
    push(e.message, "error");
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
