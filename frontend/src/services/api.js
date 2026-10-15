// Single HTTP service layer. All backend calls go through here.
import {
  getCognitoSession,
  clearCognitoSession
} from "./cognitoOAuth.js";

const BASE = import.meta.env.VITE_API_BASE_URL || "";

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
  uploadAttachment: (payload) =>
    request("/api/attachments", { method: "POST", body: payload }).then((r) => r.data),
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
