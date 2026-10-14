// Seeds demo data through the service layer (same path as ordinary data),
// clearly marked [DEMO]. Runs only when db.json is absent/empty.
import { DEV_USERS } from "./adapters/auth/devUsers.js";
import { loadDb } from "./adapters/persistence/jsonStore.js";
import { createRepository } from "./repositories/ticketRepository.js";
import { createTicketService } from "./services/ticketService.js";

const DEMO = [
  { title: "[DEMO] Cannot access billing invoice", description: "Customer reports the March invoice PDF fails to download with a 500 error on retry.", priority: "HIGH", category: "BILLING" },
  { title: "[DEMO] Login loop after password reset", description: "After resetting the password, the user is redirected back to login repeatedly in Chrome.", priority: "URGENT", category: "ACCOUNT" },
  { title: "[DEMO] Feature request: export tickets to CSV", description: "Agent team requests a CSV export of filtered ticket views for weekly reporting.", priority: "LOW", category: "FEEDBACK" },
  { title: "[DEMO] API latency spikes at peak hours", description: "p95 latency exceeds 2s between 14:00-16:00 UTC; needs investigation of downstream calls.", priority: "MEDIUM", category: "TECHNICAL" },
  { title: "[DEMO] Mobile layout breaks on ticket detail", description: "On 390px wide screens the comment box overflows the card padding.", priority: "MEDIUM", category: "TECHNICAL" },
];

export async function ensureSeeded() {
  const existing = loadDb();
  if (existing.tickets.length > 0) return { seeded: false };
  const repo = createRepository();
  const service = createTicketService(repo);
  const alice = DEV_USERS.find((u) => u.id === "cust_alice");
  const bob = DEV_USERS.find((u) => u.id === "cust_bob");
  const eve = DEV_USERS.find((u) => u.id === "agent_eve");
  for (const [i, d] of DEMO.entries()) {
    const owner = i % 2 === 0 ? alice : bob;
    const t = await service.create(d, owner);
    if (i === 0) {
      await service.update(t.id, { status: "IN_PROGRESS", assigneeId: eve.id }, eve);
      await service.addComment(t.id, { body: "Thanks — I'm looking into the invoice service now." }, eve);
      await service.addComment(t.id, { body: "Appreciate the quick response!" }, owner);
    }
    if (i === 1) await service.update(t.id, { status: "IN_PROGRESS", assigneeId: eve.id }, eve);
    if (i === 3) await service.update(t.id, { status: "RESOLVED", assigneeId: eve.id }, eve);
  }
  return { seeded: true, count: DEMO.length };
}

// Allow `npm run seed` to force-check seeding.
if (process.argv[1]?.endsWith("seed.js")) {
  const r = await ensureSeeded();
  console.log(r.seeded ? `[seed] inserted ${r.count} demo tickets` : "[seed] db already populated, skipping");
}
