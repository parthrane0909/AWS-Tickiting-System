import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { badRequest } from "../../utils/errors.js";

// Genuine local file storage for Phase 1. Explicitly NOT S3: bytes live in
// <DATA_DIR>/uploads/, metadata travels with the ticket. Phase 2 replaces this
// module with S3 presigned-URL generation + direct browser upload.
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024);
export const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "application/pdf",
  "text/plain",
]);

export function createStorage(dataDir) {
  const dir = path.join(dataDir, "uploads");
  const indexFile = path.join(dataDir, "uploads.json");

  function loadIndex() {
    try {
      return JSON.parse(fs.readFileSync(indexFile, "utf8"));
    } catch {
      return {};
    }
  }
  function saveIndex(index) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(indexFile, JSON.stringify(index, null, 2), "utf8");
  }
  function storedPath(storedName) {
    return path.join(dir, storedName);
  }

  return {
    // Persist uploaded bytes. Returns metadata; the ticket links it later via claim().
    store({ fileName, mimeType, size, contentBase64 }, uploaderId) {
      if (typeof fileName !== "string" || !fileName.trim() || fileName.length > 255) {
        throw badRequest("fileName is required (max 255 chars).");
      }
      if (!ALLOWED_MIME.has(mimeType)) {
        throw badRequest(`File type not allowed. Allowed: ${[...ALLOWED_MIME].join(", ")}.`);
      }
      if (!Number.isInteger(size) || size <= 0 || size > MAX_UPLOAD_BYTES) {
        throw badRequest(`File size must be between 1 byte and ${MAX_UPLOAD_BYTES} bytes.`);
      }
      if (typeof contentBase64 !== "string" || contentBase64.length === 0) {
        throw badRequest("File content is required.");
      }
      let bytes;
      try {
        bytes = Buffer.from(contentBase64, "base64");
      } catch {
        throw badRequest("File content must be valid base64.");
      }
      if (bytes.length !== size) {
        throw badRequest("File content does not match the declared size.");
      }
      const attachmentId = randomUUID().replace(/-/g, "");
      const safeName = sanitizeFileName(fileName);
      const storedName = `${attachmentId}_${safeName}`;
      const uploadedAt = new Date().toISOString();
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(storedPath(storedName), bytes);
      const fileKey = `local/${attachmentId}/${safeName}`;
      const index = loadIndex();
      index[fileKey] = {
        attachmentId, fileName: fileName.trim(), storedName, mimeType, size,
        uploadedBy: uploaderId, uploadedAt, ticketId: null,
      };
      saveIndex(index);
      return { attachmentId, fileName: fileName.trim(), mimeType, size, fileKey, uploadedAt };
    },

    // Link a previously uploaded fileKey to a ticket. Fails when unknown/missing,
    // so a ticket can never reference an attachment that was not actually stored.
    claim(fileKey, ticketId) {
      const index = loadIndex();
      const rec = index[fileKey];
      if (!rec || !fs.existsSync(storedPath(rec.storedName))) {
        throw badRequest("Unknown attachment. Upload the file before creating the ticket.");
      }
      rec.ticketId = ticketId;
      saveIndex(index);
      const { storedName, uploadedBy, ...meta } = rec;
      return { ...meta, fileKey };
    },

    // Delete bytes + index entry (attachment removed or replaced).
    release(fileKey) {
      const index = loadIndex();
      const rec = index[fileKey];
      if (!rec) return false;
      try {
        fs.unlinkSync(storedPath(rec.storedName));
      } catch {
        // File already gone; still drop the index entry.
      }
      delete index[fileKey];
      saveIndex(index);
      return true;
    },

    // Resolve bytes for download. Only ever resolves keys from our own index —
    // client-supplied paths are never trusted.
    read(fileKey) {
      const index = loadIndex();
      const rec = index[fileKey];
      if (!rec) return null;
      try {
        const bytes = fs.readFileSync(storedPath(rec.storedName));
        return { bytes, mimeType: rec.mimeType, fileName: rec.fileName };
      } catch {
        return null;
      }
    },

    // Recovery: delete files uploaded but never linked to a ticket (e.g. ticket
    // creation failed after upload). Runs at server boot; returns removed count.
    reapOrphans() {
      const index = loadIndex();
      let removed = 0;
      for (const [key, rec] of Object.entries(index)) {
        if (!rec.ticketId) {
          try {
            fs.unlinkSync(storedPath(rec.storedName));
          } catch {
            // ignore
          }
          delete index[key];
          removed++;
        }
      }
      if (removed) saveIndex(index);
      return removed;
    },
  };
}

// Strip directories and hostile characters; never trust the client path.
export function sanitizeFileName(name) {
  const base = path.basename(String(name)).replace(/[\0-\x1f<>:"/\\|?*]/g, "_").trim();
  const clean = base.replace(/^\.+/, "").slice(0, 100);
  return clean || "file";
}
