import assert from "node:assert/strict";
import test from "node:test";

import {
  HeadObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand
} from "@aws-sdk/client-s3";

import {
  createS3Storage,
  MAX_S3_UPLOAD_BYTES
} from "../src/adapters/storage/s3Attachments.js";

const bucket = "offline-test-bucket";
const owner = "customer-test-123";
const otherCustomer = "customer-other-456";
const ticketId = "TIX-TEST123";

const pendingKey =
  "pending/11111111-2222-4333-8444-555555555555";

const ticketKey =
  "tickets/TIX-TEST123/11111111-2222-4333-8444-555555555555";

function validHead() {
  return {
    ContentLength: 1024,
    ContentType: "image/png",
    ETag: '"test-object-etag"',
    Metadata: {
      "owner-id": owner,
      "file-name": encodeURIComponent("screenshot.png"),
      "file-size": "1024"
    },
    LastModified: new Date("2026-10-15T10:00:00Z")
  };
}

function mockS3(head = validHead()) {
  const commands = [];

  const client = {
    async send(command) {
      commands.push(command);

      if (command instanceof HeadObjectCommand) {
        return head;
      }

      return {};
    }
  };

  return { client, commands };
}

test("presigned POST includes upload limits and owner metadata", async () => {
  let options;

  const storage = createS3Storage({
    bucket,
    client: mockS3().client,
    signPost: async (_client, input) => {
      options = input;

      return {
        url: "https://example.invalid/upload",
        fields: { key: input.Key }
      };
    }
  });

  const result = await storage.createUpload(
    {
      fileName: "screenshot.png",
      mimeType: "image/png",
      size: 1024
    },
    owner
  );

  assert.match(result.fileKey, /^pending\/[0-9a-f-]{36}$/);
  assert.equal(result.upload.expiresIn, 120);
  assert.equal(options.Expires, 120);
  assert.equal(options.Bucket, bucket);
  assert.equal(options.Fields["x-amz-meta-owner-id"], owner);
  assert.equal(options.Fields["Content-Type"], "image/png");

  assert.ok(
    options.Conditions.some(
      condition =>
        Array.isArray(condition) &&
        condition[0] === "content-length-range" &&
        condition[1] === 1 &&
        condition[2] === MAX_S3_UPLOAD_BYTES
    )
  );
});

test("invalid upload types and sizes are rejected", async () => {
  const storage = createS3Storage({
    bucket,
    client: mockS3().client,
    signPost: async () => {
      throw new Error("Signing should not be reached.");
    }
  });

  for (const input of [
    { fileName: "script.exe", mimeType: "application/x-msdownload", size: 100 },
    { fileName: "large.png", mimeType: "image/png", size: MAX_S3_UPLOAD_BYTES + 1 },
    { fileName: "empty.png", mimeType: "image/png", size: 0 },
    { fileName: "", mimeType: "image/png", size: 100 }
  ]) {
    await assert.rejects(storage.createUpload(input, owner));
  }

  await assert.rejects(
    storage.createUpload(
      { fileName: "valid.png", mimeType: "image/png", size: 100 },
      ""
    )
  );
});

test("claim verifies object and moves it to ticket storage", async () => {
  const { client, commands } = mockS3();
  const storage = createS3Storage({ bucket, client });

  const result = await storage.claim(pendingKey, ticketId, owner);

  assert.equal(result.fileName, "screenshot.png");
  assert.equal(result.size, 1024);
  assert.equal(result.mimeType, "image/png");
  assert.match(
    result.fileKey,
    /^tickets\/TIX-TEST123\/[0-9a-f-]{36}$/
  );

  assert.equal(commands.length, 3);
  assert.ok(commands[0] instanceof HeadObjectCommand);
  assert.ok(commands[1] instanceof CopyObjectCommand);
  assert.ok(commands[2] instanceof DeleteObjectCommand);

  assert.equal(commands[1].input.CopySource, `${bucket}/${pendingKey}`);
  assert.equal(commands[1].input.CopySourceIfMatch, validHead().ETag);
  assert.equal(commands[2].input.Key, pendingKey);
});

test("another Customer cannot claim an uploaded file", async () => {
  const { client, commands } = mockS3();
  const storage = createS3Storage({ bucket, client });

  await assert.rejects(
    storage.claim(pendingKey, ticketId, otherCustomer),
    /cannot attach another user's file/i
  );

  assert.equal(commands.length, 1);
  assert.ok(commands[0] instanceof HeadObjectCommand);
});

test("claim rejects invalid object sizes", async () => {
  const head = validHead();
  head.ContentLength = 2048;

  const { client, commands } = mockS3(head);
  const storage = createS3Storage({ bucket, client });

  await assert.rejects(
    storage.claim(pendingKey, ticketId, owner),
    /size is invalid/i
  );

  assert.equal(commands.length, 1);
});

test("claim rejects missing S3 objects", async () => {
  const client = {
    async send() {
      const error = new Error("Not found");
      error.name = "NotFound";
      throw error;
    }
  };

  const storage = createS3Storage({ bucket, client });

  await assert.rejects(
    storage.claim(pendingKey, ticketId, owner),
    /was not uploaded to S3/i
  );
});

test("failed S3 copy does not delete pending object", async () => {
  const commands = [];

  const client = {
    async send(command) {
      commands.push(command);

      if (command instanceof HeadObjectCommand) {
        return validHead();
      }

      if (command instanceof CopyObjectCommand) {
        throw new Error("Simulated S3 copy failure");
      }

      return {};
    }
  };

  const storage = createS3Storage({ bucket, client });

  await assert.rejects(
    storage.claim(pendingKey, ticketId, owner),
    /copy failure/i
  );

  assert.equal(commands.length, 2);
  assert.ok(
    !commands.some(command => command instanceof DeleteObjectCommand)
  );
});

test("download URL uses a short expiry and verified ticket key", async () => {
  const { client } = mockS3();
  let signedCommand;
  let signedOptions;

  const storage = createS3Storage({
    bucket,
    client,
    signGet: async (_client, command, options) => {
      signedCommand = command;
      signedOptions = options;
      return "https://example.invalid/download";
    }
  });

  const result = await storage.downloadUrl(
    ticketKey,
    "screenshot.png"
  );

  assert.equal(result.expiresIn, 60);
  assert.equal(signedOptions.expiresIn, 60);
  assert.ok(signedCommand instanceof GetObjectCommand);
  assert.equal(signedCommand.input.Key, ticketKey);

  await assert.rejects(
    storage.downloadUrl(pendingKey, "screenshot.png"),
    /invalid stored attachment key/i
  );
});

test("release only deletes keys in ticket storage", async () => {
  const { client, commands } = mockS3();
  const storage = createS3Storage({ bucket, client });

  await assert.rejects(
    storage.release(pendingKey),
    /invalid stored attachment key/i
  );

  assert.equal(commands.length, 0);

  await storage.release(ticketKey);

  assert.equal(commands.length, 1);
  assert.ok(commands[0] instanceof DeleteObjectCommand);
  assert.equal(commands[0].input.Key, ticketKey);
});

test("claim rejects an object without ETag before copying", async () => {
  const head = validHead();
  delete head.ETag;

  const { client, commands } = mockS3(head);
  const storage = createS3Storage({ bucket, client });

  await assert.rejects(
    storage.claim(pendingKey, ticketId, owner),
    /missing ETag/i
  );

  assert.equal(commands.length, 1);
  assert.ok(commands[0] instanceof HeadObjectCommand);
});

test("claim handles S3 403 without copying or deleting", async () => {
  const commands = [];

  const client = {
    async send(command) {
      commands.push(command);

      const error = new Error("AccessDenied");
      error.name = "AccessDenied";
      error.$metadata = { httpStatusCode: 403 };
      throw error;
    }
  };

  const storage = createS3Storage({ bucket, client });

  await assert.rejects(
    storage.claim(pendingKey, ticketId, owner),
    /could not be verified in S3/i
  );

  assert.equal(commands.length, 1);
  assert.ok(commands[0] instanceof HeadObjectCommand);
});
