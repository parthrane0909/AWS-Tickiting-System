import fs from "node:fs";
import path from "node:path";

// Minimal JSON-file persistence adapter (Phase 1 local-only).
// Interface is intentionally narrow so a DynamoDB repository can replace it:
//   load() -> { tickets, comments, activities }
//   save(db) -> void
// Synchronous read-modify-write is acceptable for a single-process PoC.

export function resolveDataDir() {
  // Backend package root (<backend>/data), regardless of cwd.
  // src/adapters/persistence -> up 3 = backend/
  return process.env.DATA_DIR || path.join(path.dirname(new URL(import.meta.url).pathname), "../../../data");
}

export function loadDb(dataDir = resolveDataDir()) {
  const file = path.join(dataDir, "db.json");
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    return {
      tickets: Array.isArray(parsed.tickets) ? parsed.tickets : [],
      comments: Array.isArray(parsed.comments) ? parsed.comments : [],
      activities: Array.isArray(parsed.activities) ? parsed.activities : [],
    };
  } catch {
    return { tickets: [], comments: [], activities: [] };
  }
}

export function saveDb(db, dataDir = resolveDataDir()) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "db.json");
  fs.writeFileSync(file, JSON.stringify(db, null, 2), "utf8");
}
