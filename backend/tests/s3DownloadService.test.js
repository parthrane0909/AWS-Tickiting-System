import assert from "node:assert/strict";
import test from "node:test";

import {
  createTicketService
} from "../src/services/ticketService.js";

const owner = {
  id: "customer-owner",
  name: "Owner",
  role: "customer"
};

const otherCustomer = {
  id: "customer-other",
  name: "Other Customer",
  role: "customer"
};

const agent = {
  id: "agent-test",
  name: "Agent",
  role: "agent"
};

function fixture() {
  const signed = [];

  const ticket = {
    id: "TIX-TEST123",
    customerId: owner.id,
    status: "OPEN",
    attachment: {
      fileKey:
        "tickets/TIX-TEST123/11111111-2222-4333-8444-555555555555",
      fileName: "screenshot.png"
    }
  };

  const repo = {
    async getTicket(id) {
      return id === ticket.id ? ticket : null;
    }
  };

  const storage = {
    async downloadUrl(fileKey, fileName) {
      signed.push({ fileKey, fileName });

      return {
        url: "https://example.invalid/signed-download",
        expiresIn: 60
      };
    }
  };

  return {
    service: createTicketService(repo, storage, {}),
    signed
  };
}

test("ticket owner receives an authorized S3 download URL", async () => {
  const { service, signed } = fixture();

  const result = await service.downloadAttachment(
    "TIX-TEST123",
    owner
  );

  assert.equal(result.expiresIn, 60);
  assert.match(result.url, /^https:/);
  assert.equal(signed.length, 1);
  assert.equal(signed[0].fileName, "screenshot.png");
});

test("other Customer cannot sign URL, while Agent can", async () => {
  const { service, signed } = fixture();

  await assert.rejects(
    service.downloadAttachment("TIX-TEST123", otherCustomer),
    /only access your own tickets/i
  );

  assert.equal(
    signed.length,
    0,
    "Unauthorized requests must never reach the URL signer"
  );

  const result = await service.downloadAttachment(
    "TIX-TEST123",
    agent
  );

  assert.equal(result.expiresIn, 60);
  assert.equal(signed.length, 1);
});
