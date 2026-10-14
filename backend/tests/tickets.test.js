import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRepository } from "../src/repositories/ticketRepository.js";
import { createTicketService } from "../src/services/ticketService.js";

const alice = { id: "cust_alice", name: "Alice", email: "a@x.com", role: "customer" };
const bob = { id: "cust_bob", name: "Bob", email: "b@x.com", role: "customer" };
const eve = { id: "agent_eve", name: "Eve", email: "e@x.com", role: "agent" };

function freshService() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tix-"));
  return createTicketService(createRepository(dir));
}

const valid = {
  title: "Login fails on retry",
  description: "A sufficiently long description of the login failure observed.",
  priority: "HIGH",
  category: "TECHNICAL",
};

test("valid ticket creation assigns id + timestamps", () => {
  const svc = freshService();
  const t = svc.create(valid, alice);
  assert.match(t.id, /^TIX-/);
  assert.equal(t.status, "OPEN");
  assert.equal(t.customerId, alice.id);
  assert.ok(t.createdAt && t.updatedAt);
});

test("invalid ticket data is rejected", () => {
  const svc = freshService();
  assert.throws(() => svc.create({ ...valid, title: "x" }, alice), (e) => e.status === 400);
  assert.throws(() => svc.create({ ...valid, priority: "NOPE" }, alice), (e) => e.status === 400);
  assert.throws(() => svc.create({ ...valid, description: "short" }, alice), (e) => e.status === 400);
});

test("retrieval + 404 for missing tickets", () => {
  const svc = freshService();
  const t = svc.create(valid, alice);
  assert.equal(svc.get(t.id, alice).id, t.id);
  assert.throws(() => svc.get("TIX-NOPE", alice), (e) => e.status === 404);
});

test("customer list isolation; agent sees all", () => {
  const svc = freshService();
  svc.create(valid, alice);
  svc.create({ ...valid, title: "Bob ticket here" }, bob);
  assert.equal(svc.list({ page: 1, limit: 20 }, alice).total, 1);
  assert.equal(svc.list({ page: 1, limit: 20 }, bob).total, 1);
  assert.equal(svc.list({ page: 1, limit: 20 }, eve).total, 2);
});

test("unauthorized cross-customer access rejected", () => {
  const svc = freshService();
  const t = svc.create(valid, alice);
  assert.throws(() => svc.get(t.id, bob), (e) => e.status === 403);
  assert.throws(() => svc.addComment(t.id, { body: "hi" }, bob), (e) => e.status === 403);
});

test("agent status + assignee updates; customer cannot escalate", () => {
  const svc = freshService();
  const t = svc.create(valid, alice);
  const updated = svc.update(t.id, { status: "IN_PROGRESS", assigneeId: "agent_eve" }, eve);
  assert.equal(updated.status, "IN_PROGRESS");
  assert.equal(updated.assigneeId, "agent_eve");
  assert.throws(() => svc.update(t.id, { status: "RESOLVED" }, alice), (e) => e.status === 400 || e.status === 403);
});

test("comments round-trip + activity recorded", () => {
  const svc = freshService();
  const t = svc.create(valid, alice);
  svc.addComment(t.id, { body: "First comment" }, alice);
  svc.addComment(t.id, { body: "Agent reply" }, eve);
  assert.equal(svc.listComments(t.id, alice).length, 2);
  const types = svc.history(t.id, eve).map((a) => a.type);
  assert.ok(types.includes("created") && types.includes("commented"));
  assert.throws(() => svc.addComment(t.id, { body: "" }, alice), (e) => e.status === 400);
});

test("persistence across repository instances (restart simulation)", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tix-persist-"));
  const svc1 = createTicketService(createRepository(dir));
  const t = svc1.create(valid, alice);
  const svc2 = createTicketService(createRepository(dir)); // new instance, same dir
  assert.equal(svc2.get(t.id, alice).title, valid.title);
});
