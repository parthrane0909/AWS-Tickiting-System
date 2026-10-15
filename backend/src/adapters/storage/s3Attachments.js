import { randomUUID } from "node:crypto";
import {
  S3Client,
  HeadObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { badRequest, forbidden } from "../../utils/errors.js";

export const MAX_S3_UPLOAD_BYTES = 5 * 1024 * 1024;

export const S3_ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "application/pdf",
  "text/plain"
]);

function validateUpload({ fileName, mimeType, size } = {}) {
  if (
    typeof fileName !== "string" ||
    !fileName.trim() ||
    fileName.length > 255
  ) {
    throw badRequest("fileName is required (max 255 characters).");
  }

  if (!S3_ALLOWED_MIME.has(mimeType)) {
    throw badRequest("Unsupported attachment type.");
  }

  if (
    !Number.isInteger(size) ||
    size < 1 ||
    size > MAX_S3_UPLOAD_BYTES
  ) {
    throw badRequest("Attachment must be between 1 byte and 5 MB.");
  }

  return {
    fileName: fileName.trim(),
    mimeType,
    size
  };
}

function validPendingKey(key) {
  return typeof key === "string" &&
    /^pending\/[0-9a-f-]{36}$/.test(key);
}

function validTicketKey(key) {
  return typeof key === "string" &&
    /^tickets\/TIX-[A-Z0-9]+\/[0-9a-f-]{36}$/.test(key);
}

export function createS3Storage({
  bucket = process.env.ATTACHMENTS_BUCKET,
  client = new S3Client({}),
  signPost = createPresignedPost,
  signGet = getSignedUrl
} = {}) {
  if (!bucket) {
    throw new Error("ATTACHMENTS_BUCKET must be configured.");
  }

  return {
    // Generate a signed browser-upload form.
    // The actual file bytes go directly to S3.
    async createUpload(input, uploaderId) {
      if (!uploaderId) throw forbidden("Uploader identity required.");

      const { fileName, mimeType, size } = validateUpload(input);

      const attachmentId = randomUUID();
      const fileKey = `pending/${attachmentId}`;

      const fields = {
        "Content-Type": mimeType,
        "x-amz-meta-owner-id": uploaderId,
        "x-amz-meta-file-name": encodeURIComponent(fileName),
        "x-amz-meta-file-size": String(size)
      };

      const conditions = [
        ["content-length-range", 1, MAX_S3_UPLOAD_BYTES],
        ...Object.entries(fields).map(
          ([name, value]) => ({ [name]: value })
        )
      ];

      const signed = await signPost(client, {
        Bucket: bucket,
        Key: fileKey,
        Fields: fields,
        Conditions: conditions,
        Expires: 120
      });

      return {
        attachmentId,
        fileKey,
        fileName,
        mimeType,
        size,
        upload: {
          url: signed.url,
          fields: signed.fields,
          expiresIn: 120
        }
      };
    },

    // Verify that the object really exists and was uploaded
    // by the Customer attaching it to a ticket.
    async claim(fileKey, ticketId, uploaderId) {
      if (!validPendingKey(fileKey)) {
        throw badRequest("Invalid pending attachment key.");
      }

      if (!uploaderId) {
        throw forbidden("Uploader identity required.");
      }

      let head;

      try {
        head = await client.send(
          new HeadObjectCommand({
            Bucket: bucket,
            Key: fileKey
          })
        );
      } catch (error) {
        const status = error.$metadata?.httpStatusCode;

        if (
          status === 404 ||
          error.name === "NotFound" ||
          error.name === "NoSuchKey"
        ) {
          throw badRequest("Attachment was not uploaded to S3.");
        }

        // S3 may return 403 for a missing object when the
        // role intentionally has no s3:ListBucket permission.
        if (status === 403 || error.name === "AccessDenied") {
          throw badRequest("Attachment could not be verified in S3.");
        }

        throw error;
      }

      const metadata = head.Metadata || {};

      if (metadata["owner-id"] !== uploaderId) {
        throw forbidden("You cannot attach another user's file.");
      }

      const size = head.ContentLength;
      const declaredSize = Number(metadata["file-size"]);
      const mimeType = head.ContentType;

      if (
        !Number.isInteger(size) ||
        size < 1 ||
        size > MAX_S3_UPLOAD_BYTES ||
        size !== declaredSize
      ) {
        throw badRequest("Uploaded file size is invalid.");
      }

      if (!S3_ALLOWED_MIME.has(mimeType)) {
        throw badRequest("Uploaded file type is invalid.");
      }

      let fileName;

      try {
        fileName = decodeURIComponent(metadata["file-name"] || "");
      } catch {
        throw badRequest("Uploaded filename is invalid.");
      }

      validateUpload({ fileName, mimeType, size });

      if (!/^TIX-[A-Z0-9]+$/.test(ticketId)) {
        throw badRequest("Invalid ticket identifier.");
      }

      // Prevent an object replacement between verification and copy.
      if (typeof head.ETag !== "string" || !head.ETag) {
        throw badRequest("Uploaded object verification failed: missing ETag.");
      }

      const finalKey = `tickets/${ticketId}/${randomUUID()}`;

      // Copy verified bytes out of the expiring pending/ prefix.
      await client.send(
        new CopyObjectCommand({
          Bucket: bucket,
          Key: finalKey,
          CopySource: `${bucket}/${fileKey}`,
          CopySourceIfMatch: head.ETag
        })
      );

      // The pending copy is no longer needed.
      // Lifecycle cleanup provides a fallback if deletion fails.
      try {
        await client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: fileKey
          })
        );
      } catch {
        // The pending object will expire under the lifecycle rule.
      }

      return {
        attachmentId: finalKey.split("/").at(-1),
        fileKey: finalKey,
        fileName,
        mimeType,
        size,
        uploadedAt: head.LastModified?.toISOString?.() ||
          new Date().toISOString()
      };
    },

    // Delete a previously linked ticket attachment.
    async release(fileKey) {
      if (!validTicketKey(fileKey)) {
        throw badRequest("Invalid stored attachment key.");
      }

      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: fileKey
        })
      );

      return true;
    },

    // Called only AFTER the ticket service checks RBAC.
    async downloadUrl(fileKey, fileName) {
      if (!validTicketKey(fileKey)) {
        throw badRequest("Invalid stored attachment key.");
      }

      const safeName = encodeURIComponent(
        typeof fileName === "string" ? fileName : "attachment"
      );

      const url = await signGet(
        client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: fileKey,
          ResponseContentDisposition:
            `attachment; filename*=UTF-8''${safeName}`
        }),
        { expiresIn: 60 }
      );

      return {
        url,
        expiresIn: 60
      };
    }
  };
}
