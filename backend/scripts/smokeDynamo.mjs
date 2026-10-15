// Explicit, opt-in live DynamoDB smoke test. Never run from the regular test suite.
// Creates three temporary records and removes them even if an assertion fails.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { createDynamoRepository } from "../src/repositories/dynamoTicketRepository.js";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Refusing to write to DynamoDB.`);
  return value;
}

const tables = {
  tickets: requiredEnv("TICKETS_TABLE"),
  comments: requiredEnv("COMMENTS_TABLE"),
  activities: requiredEnv("ACTIVITIES_TABLE"),
};
if (Object.values(tables).some((name) => !name.startsWith("tickdesk-poc-data-"))) {
  throw new Error("Expected only tables created by tickdesk-poc-data stack.");
}
const region = requiredEnv("AWS_REGION");
const profile = requiredEnv("AWS_PROFILE");
if (profile !== "tickdesk-builder") {
  throw new Error(`Expected AWS_PROFILE=tickdesk-builder, got ${profile}. Refusing to write.`);
}
if (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_SECRET_ACCESS_KEY) {
  throw new Error("Unset AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY first; this test uses the login profile.");
}
const rawClient = new DynamoDBClient({ region });
const client = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true },
});
const repo = createDynamoRepository({ client, tables });
const suffix = randomUUID();
const ticketId = `SMOKE-${suffix}`;
const commentId = `SMOKE-C-${suffix}`;
const activityId = `SMOKE-A-${suffix}`;
const customerId = `SMOKE-CUSTOMER-${suffix}`;
const timestamp = new Date().toISOString();
const written = [];

async function waitFor(label, predicate) {
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await predicate()) return;
    await delay(750); // GSIs and eventually consistent scans can lag after writes.
  }
  throw new Error(`Timed out waiting for ${label}`);
}

try {
  const ticket = {
    id: ticketId,
    customerId,
    customerName: "Smoke Test",
    title: "Temporary DynamoDB smoke test",
    description: "Automatically removed after verification",
    priority: "LOW",
    category: "TECHNICAL",
    status: "OPEN",
    assigneeId: null,
    assigneeName: null,
    attachment: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await repo.insertTicket(ticket);
  written.push({ table: tables.tickets, id: ticketId });
  assert.equal((await repo.getTicket(ticketId))?.customerId, customerId);
  const updated = await repo.updateTicket(ticketId, { status: "IN_PROGRESS" });
  assert.equal(updated?.status, "IN_PROGRESS");
  console.log("PASS: ticket PutItem, GetItem and UpdateItem");

  await repo.insertComment({
    id: commentId, ticketId, authorId: customerId,
    authorName: "Smoke Test", authorRole: "customer",
    body: "Temporary comment", createdAt: timestamp,
  });
  written.push({ table: tables.comments, id: commentId });
  await repo.insertActivity({
    id: activityId, ticketId, actorId: customerId,
    actorName: "Smoke Test", type: "created",
    detail: "Temporary activity", createdAt: timestamp,
  });
  written.push({ table: tables.activities, id: activityId });
  await waitFor("customer ticket index", async () =>
    (await repo.listTickets(customerId)).some((t) => t.id === ticketId));
  await waitFor("all-ticket scan", async () =>
    (await repo.listTickets()).some((t) => t.id === ticketId));
  await waitFor("ticket comments index", async () =>
    (await repo.listComments(ticketId)).some((c) => c.id === commentId));
  await waitFor("ticket activities index", async () =>
    (await repo.listActivities(ticketId)).some((a) => a.id === activityId));
  console.log("PASS: DynamoDB Query, Scan, comments and activity history");
  console.log("PASS: live adapter smoke test complete");
} finally {
  for (const { table, id } of written.reverse()) {
    try {
      await client.send(new DeleteCommand({ TableName: table, Key: { id } }));
      console.log(`Cleaned up ${id} from ${table}`);
    } catch (error) {
      console.error(`CLEANUP FAILED for ${id} in ${table}: ${error.message}`);
      process.exitCode = 1;
    }
  }
  rawClient.destroy();
}
