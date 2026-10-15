<template>
  <AppLayout>
    <div class="anim-rise flex flex-wrap items-center justify-between gap-3">
      <div>
        <AppButton variant="light" @click="$router.push('/')">← Back to Tickets</AppButton>
        <h1 class="mt-3 text-2xl font-bold">Create a support ticket</h1>
        <p class="mt-1 text-sm text-muted">Describe your issue and we'll track it through to resolution.</p>
      </div>
    </div>

    <div class="mt-5 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
      <form
        class="anim-rise stagger-1 rounded-card border border-black/5 bg-white p-6 shadow-card lg:col-span-2"
        @submit.prevent="submit"
        novalidate
      >
        <AppInput
          v-model="form.title"
          label="Title"
          placeholder="Brief summary of the issue"
          :error="fieldError('title')"
          maxlength="120"
        />
        <div class="mt-4">
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Description</label>
          <textarea
            v-model="form.description"
            rows="6"
            maxlength="5000"
            placeholder="What happened? Steps to reproduce, expected vs actual result…"
            class="t-control w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <div class="mt-1 flex items-center justify-between">
            <span v-if="errors.description" class="text-xs text-rose-600">{{ errors.description }}</span>
            <span class="ml-auto text-[11px] text-muted">{{ form.description.length }}/5000</span>
          </div>
        </div>
        <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AppSelect v-model="form.priority" label="Priority" :options="priorityOptions" :error="fieldError('priority')" />
          <AppSelect v-model="form.category" label="Category" :options="categoryOptions" :error="fieldError('category')" />
        </div>

        <!-- Attachment section -->
        <section class="mt-5 rounded-2xl bg-cream p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted">Attachment (optional)</p>
          <label class="mt-2 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line bg-white px-4 py-5 text-center hover:border-accent">
            <span class="text-sm font-medium text-ink">Choose a file to attach</span>
            <span class="text-xs text-muted">PNG, JPG, PDF or TXT · up to 5&nbsp;MB</span>
            <input ref="fileInput" type="file" :disabled="uploading || submitting" class="sr-only" accept="image/png,image/jpeg,application/pdf,text/plain" @change="onFileSelected" />
          </label>
          <template v-if="attachment">
            <div class="mt-2 flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lavender">
                <svg viewBox="0 0 24 24" class="h-4 w-4 text-accent" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.5l-8.5 8.5a5.5 5.5 0 0 1-7.8-7.8l9.2-9.2a3.7 3.7 0 0 1 5.2 5.2l-8.8 8.8a1.8 1.8 0 0 1-2.6-2.6l8.2-8.2"/></svg>
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold">{{ attachment.fileName }}</span>
                <span class="block text-xs text-muted">{{ formatSize(attachment.size) }} · {{ attachment.mimeType || "unknown type" }}</span>
              </span>
              <button
                type="button"
                class="t-control rounded-pill border border-line px-2.5 py-1 text-xs font-semibold hover:bg-pinksoft"
                @click="removeAttachment"
              >Remove</button>
            </div>
            <p class="mt-1.5 text-xs text-muted">
              <span v-if="uploading" class="text-accent">Uploading…</span>
              <span v-else-if="uploaded" class="text-accentdark">Stored securely — will attach to the ticket on submit.</span>
              <span v-else>Will be uploaded when you submit.</span>
            </p>
          </template>
          <p v-if="errors.attachment" class="mt-2 text-xs text-rose-600">{{ errors.attachment }}</p>
          <button
            v-if="errors.attachment"
            type="button"
            class="mt-2 text-xs font-semibold text-accent underline"
            @click="removeAttachment"
          >
            Continue without an attachment
          </button>
        </section>

        <p v-if="errors.form" role="alert" class="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ errors.form }}</p>

        <div class="mt-6 flex gap-2">
          <AppButton type="submit" variant="accent" :loading="submitting" :disabled="submitting || uploading">Create Ticket</AppButton>
          <AppButton variant="light" type="button" @click="$router.push('/')">Cancel</AppButton>
        </div>
      </form>

      <aside class="anim-rise stagger-2 rounded-card border border-black/5 bg-white p-5 shadow-card">
        <h2 class="font-bold">Before you submit</h2>
        <ul class="mt-3 flex flex-col gap-2.5 text-sm">
          <li class="flex gap-2"><span class="text-accent">✓</span><span>Include steps to reproduce the issue.</span></li>
          <li class="flex gap-2"><span class="text-accent">✓</span><span>Mention expected vs actual behavior.</span></li>
          <li class="flex gap-2"><span class="text-accent">✓</span><span>Attach screenshots or logs if relevant.</span></li>
        </ul>
        <p class="mt-4 rounded-xl bg-mint px-3 py-2 text-xs text-accentdark">
          Your ticket is routed to the support team automatically. You can edit it while it is Open.
        </p>
      </aside>
    </div>
  </AppLayout>
</template>
<script setup>
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import AppLayout from "../components/layout/AppLayout.vue";
import AppButton from "../components/common/AppButton.vue";
import AppInput from "../components/common/AppInput.vue";
import AppSelect from "../components/common/AppSelect.vue";
import { CATEGORIES, PRIORITIES } from "../constants/index.js";
import { useToast } from "../composables/useToast.js";
import { api } from "../services/api.js";

const cloudApiMode = Boolean(import.meta.env.VITE_API_BASE_URL?.trim());

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "application/pdf", "text/plain"]);

const router = useRouter();
const { push } = useToast();
const form = reactive({ title: "", description: "", priority: "MEDIUM", category: "GENERAL" });
const errors = reactive({ details: {} });
const submitting = ref(false);
const uploading = ref(false);
const uploaded = ref(false);
const attachment = ref(null); // { fileName, mimeType, size, contentBase64, fileKey }
const fileInput = ref(null);

const priorityOptions = PRIORITIES.map((p) => ({ value: p, label: p }));
const categoryOptions = CATEGORIES.map((c) => ({ value: c, label: c }));

function fieldError(name) {
  return errors.details?.[name] || errors[name];
}
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Upload immediately on selection so failures surface before submit.
async function onFileSelected(e) {
  const f = e.target.files?.[0];
  if (!f || uploading.value || submitting.value) return;

  attachment.value = null;
  uploaded.value = false;
  errors.attachment = "";

  if (!ALLOWED_TYPES.has(f.type)) {
    errors.attachment = "Unsupported file type. Allowed: PNG, JPG, PDF, TXT.";
    return;
  }
  if (f.size < 1 || f.size > MAX_BYTES) {
    errors.attachment = "File must be between 1 byte and 5 MB.";
    return;
  }
  uploading.value = true;
  try {
    const meta = cloudApiMode
      ? await api.uploadFile(f)
      : await api.uploadAttachment({
          fileName: f.name,
          mimeType: f.type,
          size: f.size,
          contentBase64: await readAsBase64(f),
        });
    attachment.value = { fileName: f.name, mimeType: f.type, size: f.size, fileKey: meta.fileKey };
    uploaded.value = true;
  } catch (err) {
    errors.attachment = err.message;
    attachment.value = null;
    uploaded.value = false;
    if (fileInput.value) fileInput.value.value = "";
  } finally {
    uploading.value = false;
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

function removeAttachment() {
  attachment.value = null;
  uploaded.value = false;
  errors.attachment = "";
  if (fileInput.value) fileInput.value.value = "";
}

async function submit() {
  if (submitting.value || uploading.value) return; // duplicate-submit guard

  if (errors.attachment) {
    errors.form = "Fix the attachment error or continue without a file.";
    return;
  }
  Object.keys(errors).forEach((k) => delete errors[k]);
  errors.details = {};
  submitting.value = true;
  try {
    const ticket = await api.createTicket({
      ...form,
      attachment: attachment.value
        ? { fileName: attachment.value.fileName, fileKey: attachment.value.fileKey }
        : null,
    });
    push("Ticket created.");
    router.push(`/tickets/${ticket.id}`);
  } catch (e) {
    errors.form = e.message;
    errors.details = e.details || {};
  } finally {
    submitting.value = false;
  }
}
</script>
