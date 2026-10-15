import assert from "node:assert/strict";
import test from "node:test";

import { ListUsersInGroupCommand } from
  "@aws-sdk/client-cognito-identity-provider";

import {
  createAgentDirectory
} from "../src/adapters/auth/agentDirectory.js";

import {
  createTicketService
} from "../src/services/ticketService.js";

test("local Agent directory preserves dev identities", async () => {
  const directory = createAgentDirectory({ mode: "dev" });

  assert.equal((await directory.find("agent_eve")).role, "agent");
  assert.equal(await directory.find("cust_alice"), null);
});

test("Cognito directory handles pagination and eligible Agents", async () => {
  const client = {
    async send(command) {
      assert.ok(command instanceof ListUsersInGroupCommand);
      assert.equal(command.input.GroupName, "Agent");

      if (!command.input.NextToken) {
        return {
          Users: [{
            Enabled: true,
            UserStatus: "CONFIRMED",
            Attributes: [
              { Name: "sub", Value: "agent-sub-1" },
              { Name: "email", Value: "agent@example.com" }
            ]
          }],
          NextToken: "page-2"
        };
      }

      return {
        Users: [{
          Enabled: false,
          UserStatus: "CONFIRMED",
          Attributes: [
            { Name: "sub", Value: "disabled-agent" }
          ]
        }]
      };
    }
  };

  const directory = createAgentDirectory({
    mode: "cognito",
    userPoolId: "ap-south-1_test",
    client
  });

  const agents = await directory.list();

  assert.equal(agents.length, 1);
  assert.equal(agents[0].id, "agent-sub-1");
  assert.equal(agents[0].role, "agent");
  assert.equal(await directory.find("disabled-agent"), null);
});

test("ticket assignment rejects non-Agent identities", async () => {
  const ticket = {
    id: "TIX-TEST",
    customerId: "customer-sub",
    status: "OPEN",
    assigneeId: null,
    assigneeName: null
  };

  const repo = {
    async getTicket() {
      return ticket;
    },
    async updateTicket(id, updates) {
      return { ...ticket, ...updates };
    },
    async insertActivity() {}
  };

  const directory = {
    async find(id) {
      return id === "agent-sub"
        ? { id, name: "Test Agent", role: "agent" }
        : null;
    }
  };

  const service = createTicketService(repo, null, directory);

  const actor = {
    id: "operator-sub",
    name: "Operator",
    role: "agent"
  };

  await assert.rejects(
    service.update(
      "TIX-TEST",
      { assigneeId: "customer-sub" },
      actor
    ),
    /Assignee must be a known agent/
  );

  const updated = await service.update(
    "TIX-TEST",
    { assigneeId: "agent-sub" },
    actor
  );

  assert.equal(updated.assigneeId, "agent-sub");
  assert.equal(updated.assigneeName, "Test Agent");
});
