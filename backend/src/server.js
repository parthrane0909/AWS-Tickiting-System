import { createServer } from "./app.js";
import { resolveDataDir } from "./adapters/persistence/jsonStore.js";
import { createStorage } from "./adapters/storage/localAttachments.js";
import { ensureSeeded } from "./seed.js";

const port = Number(process.env.PORT || 3001);
ensureSeeded();
// Recovery: drop files uploaded but never linked to a ticket (e.g. ticket
// creation failed after upload). Documented in README.
const reaped = createStorage(resolveDataDir()).reapOrphans();
if (reaped) console.log(`[ticketing-api] removed ${reaped} orphaned upload(s)`);
createServer().listen(port, () => {
  console.log(`[ticketing-api] listening on http://localhost:${port} (local dev, no AWS)`);
});
