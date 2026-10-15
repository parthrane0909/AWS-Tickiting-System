// Single HTTP service layer. All backend calls go through here.
import {
  getCognitoSession,
  clearCognitoSession
} from "./cognitoOAuth.js";

const BASE = import.meta.env.VITE_API_BASE_URL || "";
const CLOUD_API = BASE.trim().length > 0;

function userHeaders() {
  if (import.meta.env.VITE_AUTH_MODE === "cognito") {
    const session = getCognitoSession();

    return session
      ? { Authorization: `Bearer ${session.accessToken}` }
      : {};
  }

  const raw = localStorage.getItem("tickdesk-dev-user");
  const user = raw ? JSON.parse(raw) : null;

  return user?.id ? { "x-dev-user-id": user.id } : {};
}

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", ...userHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
        if (
      import.meta.env.VITE_AUTH_MODE === "cognito" &&
      res.status === 401 &&
      path !== "/api/me"
    ) {
      clearCognitoSession();
      window.location.replace("/login?reason=session-expired");
    }
    const err = new Error(json?.error?.message || `Request failed (${res.status}).`);
    err.status = res.status;
    err.details = json?.error?.details;
    throw err;
  }
  return json;
}

export const api = {
  me: () => request("/api/me").then((r) => r.data),
devLogin: (email, password) =>
    request("/api/dev-login", { method: "POST", body: { email, password } }).then((r) => r.data),
  devUsers: () => request("/api/dev-users").then((r) => r.data),
  agents: () => request("/api/agents").then((r) => r.data),
  // Local JSON mode preserves the existing base64 upload endpoint.
  uploadAttachment: (payload) =>
    CLOUD_API
      ? Promise.reject(new Error("Use uploadFile for AWS attachments."))
      : request("/api/attachments", { method: "POST", body: payload }).then((r) => r.data),

  // AWS mode: request a signed form, then upload bytes directly to S3.
  uploadFile: async (file) => {
    if (!CLOUD_API) {
      throw new Error("Direct S3 uploads require AWS API mode.");
    }

    const allowed = new Set([
      "image/png",
      "image/jpeg",
      "application/pdf",
      "text/plain"
    ]);

    if (!allowed.has(file?.type)) {
      throw new Error("Unsupported file type. Use PNG, JPG, PDF or TXT.");
    }

    if (file.size < 1 || file.size > 5 * 1024 * 1024) {
      throw new Error("File must be between 1 byte and 5 MB.");
    }

    const signed = await request("/api/attachments/presign", {
      method: "POST",
      body: {
        fileName: file.name,
        mimeType: file.type,
        size: file.size
      }
    }).then((result) => result.data);

    if (!signed?.upload?.url || !signed?.upload?.fields || !signed?.fileKey) {
      throw new Error("Invalid S3 upload authorization response.");
    }

    const form = new FormData();

    for (const [key, value] of Object.entries(signed.upload.fields)) {
      form.append(key, value);
    }

    // The file must be the final multipart form field.
    form.append("file", file);

    // Never forward the Cognito bearer token to S3.
    // Let the browser set the multipart Content-Type boundary.
    const response = await fetch(signed.upload.url, {
      method: "POST",
      body: form
    });

    if (!response.ok) {
      throw new Error("S3 upload failed (HTTP " + response.status + ").");
    }

    return {
      attachmentId: signed.attachmentId,
      fileKey: signed.fileKey,
      fileName: signed.fileName,
      mimeType: signed.mimeType,
      size: signed.size
    };
  },
  listTickets: (params = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    const qs = q.toString();
    return request(`/api/tickets${qs ? `?${qs}` : ""}`);
  },
  getTicket: (id) => request(`/api/tickets/${encodeURIComponent(id)}`).then((r) => r.data),
  createTicket: (payload) => request("/api/tickets", { method: "POST", body: payload }).then((r) => r.data),
  updateTicket: (id, payload) => request(`/api/tickets/${encodeURIComponent(id)}`, { method: "PUT", body: payload }).then((r) => r.data),
  listComments: (id) => request(`/api/tickets/${encodeURIComponent(id)}/comments`).then((r) => r.data),
  addComment: (id, body) => request(`/api/tickets/${encodeURIComponent(id)}/comments`, { method: "POST", body: { body } }).then((r) => r.data),
  history: (id) => request(`/api/tickets/${encodeURIComponent(id)}/history`).then((r) => r.data),
  // Binary download. Only attempt a JSON parse on the ERROR path —
  // calling res.json() on a successful binary response consumes the
  // body stream, which previously made the following res.blob() throw
  // "Body has already been read" and broke every successful download.
  downloadAttachment: async (ticketId) => {
    if (CLOUD_API) {
      // First ask Lambda to authorize the ticket download.
      const signed = await request(
        `/api/tickets/${encodeURIComponent(ticketId)}/attachment`
      ).then((result) => result.data);

      if (!signed?.url) {
        throw new Error("Invalid S3 download authorization response.");
      }

      // The temporary S3 URL is already signed.
      // Do not send Authorization headers to S3.
      const response = await fetch(signed.url);

      if (!response.ok) {
        throw new Error("S3 download failed (HTTP " + response.status + ").");
      }

      return response.blob();
    }

    const res = await fetch(`${BASE}/api/tickets/${encodeURIComponent(ticketId)}/attachment`, {
      headers: userHeaders(),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      const err = new Error(json?.error?.message || `Download failed (${res.status}).`);
      err.status = res.status;
      throw err;
    }
    return res.blob();
  },
};
