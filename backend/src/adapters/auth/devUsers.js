// Local development identities ONLY. This is not Cognito and must never be
// mistaken for production auth. Phase 2 replaces this module with JWT verification.
// The backend trusts the x-dev-user-id header's value only because both ends run
// on the developer's machine; callers must not send arbitrary userIds in bodies.

export const DEV_USERS = [
  { id: "cust_alice", name: "Alice Customer", email: "alice@example.com", role: "customer" },
  { id: "cust_bob", name: "Bob Customer", email: "bob@example.com", role: "customer" },
  { id: "agent_eve", name: "Eve Agent", email: "eve@example.com", role: "agent" },
];

export function findDevUser(id) {
  return DEV_USERS.find((u) => u.id === id) || null;
}

// Development-only credential check for the email/password login form.
// The password is a single shared local secret (env TICKDESK_DEV_PASSWORD,
// default below) — NOT real security. It exists only so the local form has
// coherent behavior; Phase 2 deletes this entire module in favor of Cognito.
export function devPassword() {
  return process.env.TICKDESK_DEV_PASSWORD || "local-dev-pass";
}

export function verifyDevCredentials(email, password) {
  const user = DEV_USERS.find(
    (u) => u.email.toLowerCase() === String(email || "").trim().toLowerCase(),
  );
  if (!user || typeof password !== "string" || password !== devPassword()) return null;
  return user;
}
