import { createServer } from "./app.js";
import { resolveDataDir } from "./adapters/persistence/jsonStore.js";
import { createStorage } from "./adapters/storage/localAttachments.js";
import { ensureSeeded } from "./seed.js";

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "127.0.0.1";
const persistenceBackend = process.env.PERSISTENCE_BACKEND || "json";

if (persistenceBackend === "json") {
  await ensureSeeded();
  const reaped = createStorage(resolveDataDir()).reapOrphans();
  if (reaped) {
    console.log(`[ticketing-api] removed ${reaped} orphaned upload(s)`);
  }
}

createServer().listen(port, host, () => {
  console.log(`[ticketing-api] listening on http://${host}:${port} (persistence=${persistenceBackend}, LOCAL DEV AUTH)`);
});
