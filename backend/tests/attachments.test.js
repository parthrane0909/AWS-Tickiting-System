import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRepository } from "../src/repositories/ticketRepository.js";
import { createTicketService } from "../src/services/ticketService.js";
import { createStorage, sanitizeFileName } from "../src/adapters/storage/localAttachments.js";

const alice = { id: "cust_alice", name: "Alice", email: "a@x.com", role: "customer" };
const bob = { id: "cust_bob", name: "Bob", email: "b@x.com", role: "customer" };
const eve = { id: "agent_eve", name: "Eve", email: "e@x.com", role: "agent" };

function fresh() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tix-att-"));
  const storage = createStorage(dir);
  const svc = createTicketService(createRepository(dir), storage);
  return { dir, storage, svc };
}

const png = (text) => Buffer.from(text).toString("base64");
const valid = {
  title: "Export broken download",
  description: "The CSV export download never starts after clicking the button twice.",
  priority: "MEDIUM",
  category: "TECHNICAL",
};

function uploadAs(svc, storage, user, overrides = {}) {
  const meta = storage.store(
    { fileName: "notes.txt", mimeType: "text/plain", size: 11, contentBase64: png("hello world"), ...overrides },
    user.id,
  );
  return meta;
}

test("valid upload stores bytes; ticket links metadata; detail returns it", async () => {
  const { dir, storage, svc } = fresh();
  const meta = uploadAs(svc, storage, alice);
  assert.ok(meta.fileKey.startsWith("local/"));
  const files = fs.readdirSync(path.join(dir, "uploads"));
  assert.equal(files.length, 1); // bytes really on disk, not base64 in JSON
  const dbFile = path.join(dir, "db.json");
  const db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile, "utf8")) : null;
  if (db) assert.ok(!JSON.stringify(db).includes("hello world")); // JSON stays clean
  const t = await svc.create({ ...valid, attachment: { fileName: meta.fileName, fileKey: meta.fileKey } }, alice);
  assert.equal(t.attachment.fileKey, meta.fileKey);
  assert.equal((await svc.get(t.id, alice)).attachment.fileName, "notes.txt");
});

test("download returns exact bytes; auth enforced (owner ok, other customer denied, agent allowed)", async () => {
  const { svc, storage } = fresh();
  const meta = uploadAs(svc, storage, alice);
  const t = await svc.create({ ...valid, attachment: { fileName: meta.fileName, fileKey: meta.fileKey } }, alice);
  const got = await svc.downloadAttachment(t.id, alice);
  assert.equal(Buffer.from("hello world").toString("base64"), got.bytes.toString("base64"));
  assert.equal(got.mimeType, "text/plain");
  await assert.rejects(() => svc.downloadAttachment(t.id, bob), (e) => e.status === 403);
  assert.ok((await svc.downloadAttachment(t.id, eve)).bytes.length > 0);
});

test("oversize, bad type, empty content, size mismatch rejected", async () => {
  const { storage } = fresh();
  assert.throws(
    () => storage.store({ fileName: "big.pdf", mimeType: "application/pdf", size: 6 * 1024 * 1024, contentBase64: png("x") }, alice.id),
    (e) => e.status === 400,
  );
  assert.throws(
    () => storage.store({ fileName: "run.exe", mimeType: "application/x-msdownload", size: 3, contentBase64: png("xxx") }, alice.id),
    (e) => e.status === 400,
  );
  assert.throws(
    () => storage.store({ fileName: "e.txt", mimeType: "text/plain", size: 3, contentBase64: "" }, alice.id),
    (e) => e.status === 400,
  );
  assert.throws(
    () => storage.store({ fileName: "e.txt", mimeType: "text/plain", size: 999, contentBase64: png("short") }, alice.id),
    (e) => e.status === 400,
  );
});

test("path traversal filenames are neutralized in storage", async () => {
  assert.equal(sanitizeFileName("../../etc/passwd"), "passwd");
  assert.equal(sanitizeFileName("..."), "file");
  const { dir, storage } = fresh();
  const meta = storage.store({ fileName: "../evil.txt", mimeType: "text/plain", size: 2, contentBase64: png("hi") }, alice.id);
  assert.ok(!meta.fileKey.includes(".."));
  assert.deepEqual(fs.readdirSync(path.join(dir, "uploads")).length, 1);
});

test("unknown fileKey aborts creation — no ticket, no false success", async () => {
  const { svc } = fresh();
  await assert.rejects(
    () => svc.create({ ...valid, attachment: { fileName: "ghost.txt", fileKey: "local/nope/ghost.txt" } }, alice),
    (e) => e.status === 400,
  );
  assert.equal((await svc.list({ page: 1, limit: 20 }, alice)).total, 0);
});

test("attachment replace/remove on own OPEN ticket; orphan bytes cleaned", async () => {
  const { dir, storage, svc } = fresh();
  const m1 = uploadAs(svc, storage, alice);
  const t = await svc.create({ ...valid, attachment: { fileName: m1.fileName, fileKey: m1.fileKey } }, alice);
  const m2 = storage.store({ fileName: "v2.txt", mimeType: "text/plain", size: 5, contentBase64: png("v2-ok") }, alice.id);
  const replaced = await svc.update(t.id, { attachment: { fileName: m2.fileName, fileKey: m2.fileKey } }, alice);
  assert.equal(replaced.attachment.fileKey, m2.fileKey);
  assert.equal(fs.readdirSync(path.join(dir, "uploads")).length, 1); // old bytes gone
  const removed = await svc.update(t.id, { attachment: null }, alice);
  assert.equal(removed.attachment, null);
  assert.equal(fs.readdirSync(path.join(dir, "uploads")).length, 0);
  await assert.rejects(() => svc.downloadAttachment(t.id, alice), (e) => e.status === 404);
});

test("orphan sweeper removes unlinked uploads, keeps linked ones", async () => {
  const { dir, storage, svc } = fresh();
  const orphan = uploadAs(svc, storage, alice);
  const linked = uploadAs(svc, storage, alice, { fileName: "keep.txt" });
  await svc.create({ ...valid, attachment: { fileName: linked.fileName, fileKey: linked.fileKey } }, alice);
  const reaped = storage.reapOrphans();
  assert.equal(reaped, 1);
  assert.ok(!fs.existsSync(path.join(dir, "uploads", `${orphan.attachmentId}_${orphan.fileName}`)));
  assert.equal(fs.readdirSync(path.join(dir, "uploads")).length, 1);
});

test("nonexistent ticket and ticket-without-attachment return 404", async () => {
  const { svc, storage } = fresh();
  await assert.rejects(() => svc.downloadAttachment("TIX-DOESNOTEXIST", alice), (e) => e.status === 404);
  const t = await svc.create(valid, alice);
  await assert.rejects(() => svc.downloadAttachment(t.id, alice), (e) => e.status === 404);
});

test("missing file on disk is handled gracefully (404, no crash)", async () => {
  const { dir, storage, svc } = fresh();
  const meta = uploadAs(svc, storage, alice);
  const t = await svc.create({ ...valid, attachment: { fileName: meta.fileName, fileKey: meta.fileKey } }, alice);
  // Simulate the stored file being deleted behind the metadata's back.
  fs.unlinkSync(path.join(dir, "uploads", `${meta.attachmentId}_${meta.fileName}`));
  await assert.rejects(() => svc.downloadAttachment(t.id, alice), (e) => e.status === 404);
});

test("attachment survives backend restart (fresh service instance, same dir)", async () => {
  const { dir, storage, svc } = fresh();
  const meta = uploadAs(svc, storage, alice);
  const t = await svc.create({ ...valid, attachment: { fileName: meta.fileName, fileKey: meta.fileKey } }, alice);
  // Simulate a restart: brand-new repository + storage instances on the same data dir.
  const restarted = createTicketService(createRepository(dir), createStorage(dir));
  const got = await restarted.downloadAttachment(t.id, alice);
  assert.equal(Buffer.from("hello world").toString("base64"), got.bytes.toString("base64"));
  assert.equal(got.mimeType, "text/plain");
  assert.equal(got.fileName, "notes.txt");
});

test("ticket updates do not remove or corrupt a valid attachment", async () => {
  const { storage, svc } = fresh();
  const meta = uploadAs(svc, storage, alice);
  const t = await svc.create({ ...valid, attachment: { fileName: meta.fileName, fileKey: meta.fileKey } }, alice);
  // Customer edits details (no attachment field in the patch).
  await svc.update(t.id, { title: "Updated title", priority: "HIGH" }, alice);
  // Agent changes workflow state.
  await svc.update(t.id, { status: "IN_PROGRESS", assigneeId: "agent_eve" }, eve);
  const got = await svc.downloadAttachment(t.id, alice);
  assert.equal(Buffer.from("hello world").toString("base64"), got.bytes.toString("base64"));
  assert.equal((await svc.get(t.id, alice)).attachment.fileKey, meta.fileKey);
});

test("HTTP: customer upload + download round-trip; agent upload rejected", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tix-att-http-"));
  process.env.DATA_DIR = dir;
  // Import app.js in a cache-busted specifier so its module-level
  // dataDir/storage pick up the temp DATA_DIR set above.
  const spec = `../src/app.js?dir=${encodeURIComponent(dir)}`;
  const { createServer } = await import(spec);
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://localhost:${server.address().port}`;
  try {
    const up = await fetch(`${base}/api/attachments`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-dev-user-id": "cust_alice" },
      body: JSON.stringify({ fileName: "a.txt", mimeType: "text/plain", size: 4, contentBase64: png("data") }),
    });
    assert.equal(up.status, 201);
    const meta = (await up.json()).data;

    const denied = await fetch(`${base}/api/attachments`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-dev-user-id": "agent_eve" },
      body: JSON.stringify({ fileName: "a.txt", mimeType: "text/plain", size: 4, contentBase64: png("data") }),
    });
    assert.equal(denied.status, 403);

    const created = await fetch(`${base}/api/tickets`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-dev-user-id": "cust_alice" },
      body: JSON.stringify({ ...valid, attachment: { fileName: meta.fileName, fileKey: meta.fileKey } }),
    });
    assert.equal(created.status, 201);
    const ticket = (await created.json()).data;

    const dl = await fetch(`${base}/api/tickets/${ticket.id}/attachment`, {
      headers: { "x-dev-user-id": "agent_eve" },
    });
    assert.equal(dl.status, 200);
    assert.equal(await dl.text(), "data");

    const blocked = await fetch(`${base}/api/tickets/${ticket.id}/attachment`, {
      headers: { "x-dev-user-id": "cust_bob" },
    });
    assert.equal(blocked.status, 403);

    // Binary response contract: real bytes + preserving headers.
    assert.equal(dl.headers.get("content-type"), "text/plain");
    assert.equal(dl.headers.get("content-length"), "4");
    assert.match(dl.headers.get("content-disposition"), /attachment; filename="a\.txt"/);

    // Error paths through the real endpoint.
    const missing = await fetch(`${base}/api/tickets/TIX-NOPE/attachment`, {
      headers: { "x-dev-user-id": "cust_alice" },
    });
    assert.equal(missing.status, 404);
    const noAttach = await fetch(`${base}/api/tickets`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-dev-user-id": "cust_alice" },
      body: JSON.stringify({ ...valid, title: "No attachment ticket" }),
    });
    const bare = (await noAttach.json()).data;
    const empty = await fetch(`${base}/api/tickets/${bare.id}/attachment`, {
      headers: { "x-dev-user-id": "cust_alice" },
    });
    assert.equal(empty.status, 404);
  } finally {
    server.close();
  }
});
