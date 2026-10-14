import assert from "node:assert/strict";
import test from "node:test";
import { verifyDevCredentials } from "../src/adapters/auth/devUsers.js";
import { createServer } from "../src/app.js";

test("dev-login accepts known email + dev password", () => {
  const user = verifyDevCredentials("alice@example.com", "local-dev-pass");
  assert.equal(user?.id, "cust_alice");
});

test("dev-login rejects unknown email, wrong password, and missing fields", () => {
  assert.equal(verifyDevCredentials("nobody@example.com", "local-dev-pass"), null);
  assert.equal(verifyDevCredentials("alice@example.com", "wrong"), null);
  assert.equal(verifyDevCredentials("", ""), null);
  assert.equal(verifyDevCredentials(" EVE@EXAMPLE.COM ", "local-dev-pass")?.id, "agent_eve");
});

test("POST /api/dev-login over HTTP (success + 401 paths)", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://localhost:${server.address().port}`;
  try {
    const ok = await fetch(`${base}/api/dev-login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "eve@example.com", password: "local-dev-pass" }),
    });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).data.role, "agent");

    const bad = await fetch(`${base}/api/dev-login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "eve@example.com", password: "nope" }),
    });
    assert.equal(bad.status, 401);
  } finally {
    server.close();
  }
});
