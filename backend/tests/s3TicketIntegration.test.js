import assert from "node:assert/strict";
import test from "node:test";

import {
  createTicketService
} from "../src/services/ticketService.js";

const user = {
  id: "customer-test-123",
  name: "Test Customer",
  role: "customer"
};

const attachmentInput = {
  fileName: "test.png",
  fileKey: "pending/11111111-2222-4333-8444-555555555555"
};

function mockStorage() {
  const claims = [];
  const released = [];

  const storage = {
    async claim(fileKey, ticketId, uploaderId) {
      claims.push({ fileKey, ticketId, uploaderId });

      return {
        fileKey: `tickets/${ticketId}/11111111-2222-4333-8444-555555555555`,
        fileName: "test.png",
        mimeType: "image/png",
        size: 1024
      };
    },

    async release(fileKey) {
      released.push(fileKey);
      return true;
    }
  };

  return { storage, claims, released };
}

test("failed ticket creation releases newly claimed attachment", async () => {
  const { storage, claims, released } = mockStorage();

  const repo = {
    async insertTicket() {
      throw new Error("Simulated DynamoDB insert failure");
    }
  };

  const service = createTicketService(repo, storage, {});

  await assert.rejects(
    service.create(
      {
        title: "S3 upload test",
        description: "Testing attachment failure recovery.",
        priority: "MEDIUM",
        category: "GENERAL",
        attachment: attachmentInput
      },
      user
    ),
    /Simulated DynamoDB insert failure/
  );

  assert.equal(claims.length, 1);
  assert.equal(claims[0].uploaderId, user.id);
  assert.equal(released.length, 1);
  assert.match(released[0], /^tickets\//);
});

test("failed ticket update releases new attachment", async () => {
  const { storage, claims, released } = mockStorage();

  const repo = {
    async getTicket() {
      return {
        id: "TIX-TEST123",
        customerId: user.id,
        status: "OPEN",
        attachment: null
      };
    },

    async updateTicket() {
      throw new Error("Simulated DynamoDB update failure");
    }
  };

  const service = createTicketService(repo, storage, {});

  await assert.rejects(
    service.update(
      "TIX-TEST123",
      { attachment: attachmentInput },
      user
    ),
    /Simulated DynamoDB update failure/
  );

  assert.equal(claims.length, 1);
  assert.equal(claims[0].uploaderId, user.id);
  assert.equal(released.length, 1);
  assert.match(released[0], /^tickets\//);
});
