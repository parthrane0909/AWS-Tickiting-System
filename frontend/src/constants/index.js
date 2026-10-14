// Mirrors backend/src/constants.js — keep in sync.
export const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
export const CATEGORIES = ["GENERAL", "BILLING", "TECHNICAL", "ACCOUNT", "FEEDBACK"];

export const STATUS_LABELS = { OPEN: "Open", IN_PROGRESS: "In Progress", RESOLVED: "Resolved", CLOSED: "Closed" };
export const PRIORITY_LABELS = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" };

// Pastel dot + pill tones for badges (reference: small consistent status indicators).
export const STATUS_STYLES = {
  OPEN: "bg-sky-100 text-sky-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  RESOLVED: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-zinc-200 text-zinc-600",
};
export const PRIORITY_STYLES = {
  LOW: "bg-zinc-100 text-zinc-600",
  MEDIUM: "bg-indigo-100 text-indigo-700",
  HIGH: "bg-orange-100 text-orange-800",
  URGENT: "bg-rose-100 text-rose-800",
};
