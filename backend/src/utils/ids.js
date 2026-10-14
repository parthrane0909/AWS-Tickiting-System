import { randomUUID } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newTicketId() {
  let suffix = "";
  const bytes = randomUUID().replace(/-/g, "");
  for (let i = 0; i < 6; i++) {
    suffix += ALPHABET[parseInt(bytes.slice(i * 2, i * 2 + 2), 16) % ALPHABET.length];
  }
  return `TIX-${suffix}`;
}

export function newId(prefix = "id") {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

export function nowIso() {
  return new Date().toISOString();
}
