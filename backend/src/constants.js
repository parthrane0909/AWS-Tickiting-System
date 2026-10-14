// Central domain definitions — single source of truth for backend.
// Frontend mirrors these in frontend/src/constants. Keep in sync.
// Status/priority values are implementation decisions (spec section 7), not assignment-mandated.

export const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
export const CATEGORIES = ["GENERAL", "BILLING", "TECHNICAL", "ACCOUNT", "FEEDBACK"];
export const ROLES = ["customer", "agent"];

export const STATUS_LABELS = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const PRIORITY_LABELS = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};
