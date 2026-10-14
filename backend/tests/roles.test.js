import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRepository } from "../src/repositories/ticketRepository.js";
import { createTicketService } from "../src/services/ticketService.js";
import { createStorage } from "../src/adapters/storage/localAttachments.js";

const alice = { id: "cust_alice", name: "Alice", email: "a@x.com", role: "customer" };
const bob = { id: "cust_bob", name: "Bob", email: "b@x.com", role: "customer" };
const eve = { id: "agent_eve", name: "Eve", email: "e@x.com", role: "agent" };

function freshService() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tix-roles-"));
  return createTicketService(createRepository(dir), createStorage(dir));
}

const valid = {
  title: "Login fails on retry",
  description: "A sufficiently long description of the login failure observed.",
  priority: "HIGH",
  category: "TECHNICAL",
};

test("customer can create; agent cannot (incl. crafted requests)", async () => {
  const svc = freshService();
  assert.match((await svc.create(valid, alice)).id, /^TIX-/);
  await assert.rejects(() => svc.create(valid, eve), (e) => e.status === 403);
  // Crafted: agent smuggling owner fields still rejected.
  await assert.rejects(
    () => svc.create({ ...valid, customerId: "cust_alice", status: "OPEN", role: "customer" }, eve),
    (e) => e.status === 403,
  );
});

test("customer can edit own ticket; immutable/system fields rejected", async () => {
  const svc = freshService();
  const t = await svc.create(valid, alice);
  const before = t.updatedAt;
  const saved = await svc.update(t.id, { title: "Login fails often", priority: "URGENT" }, alice);
  assert.equal(saved.title, "Login fails often");
  assert.equal(saved.priority, "URGENT");
  assert.ok(saved.updatedAt >= before);
  assert.equal(saved.customerId, alice.id); // ownership preserved
  // Crafted system/workflow fields → 403, nothing applied.
  for (const body of [
    { status: "RESOLVED" },
    { assigneeId: "agent_eve" },
    { customerId: "cust_bob" },
    { id: "TIX-FAKE" },
    { createdAt: "2000-01-01" },
  ]) {
    await assert.rejects(() => svc.update(t.id, body, alice), (e) => e.status === 403, JSON.stringify(body));
  }
  assert.equal((await svc.get(t.id, alice)).status, "OPEN");
});

test("customer cannot edit another customer's ticket", async () => {
  const svc = freshService();
  const t = await svc.create(valid, alice);
  await assert.rejects(() => svc.update(t.id, { title: "Hijacked" }, bob), (e) => e.status === 403);
});

test("agent manages workflow but cannot edit ticket details", async () => {
  const svc = freshService();
  const t = await svc.create(valid, alice);
  const updated = await svc.update(t.id, { status: "IN_PROGRESS", assigneeId: "agent_eve" }, eve);
  assert.equal(updated.status, "IN_PROGRESS");
  assert.equal(updated.assigneeId, "agent_eve");
  for (const body of [{ title: "Agent rewrite" }, { description: "Agent rewrite long enough." }, { priority: "LOW" }, { category: "BILLING" }]) {
    await assert.rejects(() => svc.update(t.id, body, eve), (e) => e.status === 403, JSON.stringify(body));
  }
  assert.equal((await svc.get(t.id, eve)).title, valid.title);
});

test("customer edit recorded as activity; list isolation intact", async () => {
  const svc = freshService();
  const t = await svc.create(valid, alice);
  await svc.update(t.id, { title: "New title here" }, alice);
  const types = (await svc.history(t.id, alice)).map((a) => a.type);
  assert.ok(types.includes("edited"));
  assert.equal((await svc.list({ page: 1, limit: 20 }, alice)).total, 1);
  assert.equal((await svc.list({ page: 1, limit: 20 }, bob)).total, 0);
  assert.equal((await svc.list({ page: 1, limit: 20 }, eve)).total, 1);
});
