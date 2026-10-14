import test from "node:test";
import assert from "node:assert/strict";
import { GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { createDynamoRepository } from "../src/repositories/dynamoTicketRepository.js";

const tables = { tickets: "Tickets", comments: "Comments", activities: "Activities" };

test("DynamoDB writes and retrieves records using the right tables", async () => {
  const seen = [];
  const client = { async send(command) {
    seen.push(command);
    if (command instanceof GetCommand) return { Item: { id: "TIX-1" } };
    if (command instanceof UpdateCommand) return { Attributes: { id: "TIX-1", status: "OPEN" } };
    return {};
  }};
  const repo = createDynamoRepository({ client, tables });
  assert.equal((await repo.insertTicket({ id: "TIX-1" })).id, "TIX-1");
  await repo.insertComment({ id: "c1", ticketId: "TIX-1" });
  await repo.insertActivity({ id: "a1", ticketId: "TIX-1" });
  assert.equal((await repo.getTicket("TIX-1")).id, "TIX-1");
  assert.equal((await repo.updateTicket("TIX-1", { status: "OPEN" })).status, "OPEN");
  assert.deepEqual(seen.map((cmd) => cmd.input.TableName),
    ["Tickets", "Comments", "Activities", "Tickets", "Tickets"]);
  assert.ok(seen[0] instanceof PutCommand);
  assert.ok(seen[4] instanceof UpdateCommand);
  assert.equal(seen[4].input.ConditionExpression, "attribute_exists(#pk)");
});

test("DynamoDB ticket searches and comment pagination", async () => {
  const seen = [];
  const client = { async send(command) {
    seen.push(command);
    if (command instanceof ScanCommand) return { Items: [{ id: "t1" }] };
    if (command instanceof QueryCommand && command.input.TableName === "Comments") {
      return command.input.ExclusiveStartKey
        ? { Items: [{ id: "c2" }] }
        : { Items: [{ id: "c1" }], LastEvaluatedKey: { id: "c1" } };
    }
    return { Items: [] };
  }};
  const repo = createDynamoRepository({ client, tables });
  assert.equal((await repo.listTickets()).length, 1);
  assert.equal((await repo.listTickets("cust1")).length, 0);
  assert.deepEqual((await repo.listComments("t1")).map((c) => c.id), ["c1", "c2"]);
  assert.ok(seen.some((cmd) => cmd instanceof QueryCommand && cmd.input.IndexName === "ByCustomerCreatedAt"));
  assert.ok(seen.some((cmd) => cmd instanceof QueryCommand && cmd.input.IndexName === "ByTicketCreatedAt"));
});

test("DynamoDB missing ticket update returns null", async () => {
  const error = new Error("missing");
  error.name = "ConditionalCheckFailedException";
  const client = { async send() { throw error; } };
  const repo = createDynamoRepository({ client, tables });
  assert.equal(await repo.updateTicket("missing", { status: "OPEN" }), null);
});
