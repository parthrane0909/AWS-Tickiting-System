
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { createConfiguredRepository } from "../src/repositories/configuredRepository.js";

test("JSON persistence remains available", async () => {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), "tickdesk-mode-")
  );

  try {
    const repo = createConfiguredRepository({
      backend: "json",
      dataDir: dir
    });

    await repo.insertTicket({
      id: "TIX-LOCAL",
      customerId: "cust_alice"
    });

    const ticket = await repo.getTicket("TIX-LOCAL");
    assert.equal(ticket.customerId, "cust_alice");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("DynamoDB mode selects the AWS adapter", async () => {
  const calls = [];

  const client = {
    async send(command) {
      calls.push(command);
      return { Item: { id: "TIX-AWS" } };
    }
  };

  const repo = createConfiguredRepository({
    backend: "dynamodb",
    client,
    tables: {
      tickets: "Tickets",
      comments: "Comments",
      activities: "Activities"
    }
  });

  const ticket = await repo.getTicket("TIX-AWS");

  assert.equal(ticket.id, "TIX-AWS");
  assert.ok(calls[0] instanceof GetCommand);
  assert.equal(calls[0].input.TableName, "Tickets");
});

test("Unsupported persistence mode is rejected", () => {
  assert.throws(
    () => createConfiguredRepository({
      backend: "unknown"
    }),
    /Unsupported PERSISTENCE_BACKEND/
  );
});
