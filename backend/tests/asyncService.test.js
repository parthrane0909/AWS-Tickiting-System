import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRepository } from "../src/repositories/ticketRepository.js";
import { createTicketService } from "../src/services/ticketService.js";

const alice = { id: "cust_alice", name: "Alice", role: "customer" };
const bob = { id: "cust_bob", name: "Bob", role: "customer" };
const eve = { id: "agent_eve", name: "Eve", role: "agent" };
const valid = {
  title: "Intermittent login issue",
  description: "Login fails intermittently after a password reset.",
  priority: "HIGH",
  category: "TECHNICAL",
};

// Emulates the Promise-based contract exposed by createDynamoRepository,
// without making AWS API calls or requiring DynamoDB runtime permissions.
function asyncRepository() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tix-async-"));
  const local = createRepository(dir);
  const result = {};
  for (const name of [
    "listTickets", "getTicket", "insertTicket", "updateTicket",
    "listComments", "insertComment", "listActivities", "insertActivity",
  ]) {
    result[name] = async (...args) => local[name](...args);
  }
  return result;
}

test("async repository supports create/read/filter/update/comment/history", async () => {
  const service = createTicketService(asyncRepository());
  const t = await service.create(valid, alice);
  assert.equal((await service.get(t.id, alice)).id, t.id);
  assert.equal((await service.list({ page: 1, limit: 20 }, alice)).total, 1);
  assert.equal((await service.list({ page: 1, limit: 20 }, bob)).total, 0);
  assert.equal((await service.list({ page: 1, limit: 20 }, eve)).total, 1);
  const updated = await service.update(t.id, { status: "IN_PROGRESS" }, eve);
  assert.equal(updated.status, "IN_PROGRESS");
  await service.addComment(t.id, { body: "Investigating this now" }, eve);
  assert.equal((await service.listComments(t.id, alice)).length, 1);
  const types = (await service.history(t.id, alice)).map((a) => a.type);
  assert.ok(types.includes("created") && types.includes("status_changed") && types.includes("commented"));
});

test("async repository preserves authorization and not-found errors", async () => {
  const service = createTicketService(asyncRepository());
  const t = await service.create(valid, alice);
  await assert.rejects(() => service.get(t.id, bob), (error) => error.status === 403);
  await assert.rejects(() => service.update(t.id, { status: "RESOLVED" }, alice), (error) => error.status === 403);
  await assert.rejects(() => service.get("TIX-NONEXISTENT", eve), (error) => error.status === 404);
  await assert.rejects(() => service.addComment(t.id, { body: "Blocked" }, bob), (error) => error.status === 403);
});
