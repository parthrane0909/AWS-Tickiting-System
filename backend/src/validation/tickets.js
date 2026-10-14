import { CATEGORIES, PRIORITIES, STATUSES } from "../constants.js";
import { badRequest, forbidden } from "../utils/errors.js";

function isNonEmptyString(v, max) {
  return typeof v === "string" && v.trim().length > 0 && v.trim().length <= max;
}

function checkAttachmentShape(a) {
  if (a === null) return; // explicit removal
  if (typeof a !== "object" || typeof a.fileName !== "string" || typeof a.fileKey !== "string") {
    throw badRequest("Attachment must include fileName and fileKey, or be null to remove it.");
  }
}

export function validateCreateTicket(body) {
  const errors = {};
  if (!isNonEmptyString(body?.title, 120)) errors.title = "Title is required (3-120 chars).";
  else if (body.title.trim().length < 3) errors.title = "Title must be at least 3 chars.";
  if (!isNonEmptyString(body?.description, 5000)) errors.description = "Description is required (10-5000 chars).";
  else if (body.description.trim().length < 10) errors.description = "Description must be at least 10 chars.";
  if (!PRIORITIES.includes(body?.priority)) errors.priority = `Priority must be one of: ${PRIORITIES.join(", ")}.`;
  if (!CATEGORIES.includes(body?.category)) errors.category = `Category must be one of: ${CATEGORIES.join(", ")}.`;
  if (body?.attachment !== undefined && body.attachment !== null) {
    const a = body.attachment;
    if (typeof a !== "object" || !a.fileName || !a.fileKey) errors.attachment = "Attachment must include fileName and fileKey.";
  }
  if (Object.keys(errors).length) throw badRequest("Invalid ticket data.", errors);
  return {
    title: body.title.trim(),
    description: body.description.trim(),
    priority: body.priority,
    category: body.category,
    attachment: body.attachment ?? null,
  };
}

export function validateUpdateTicket(body, actorRole) {
  // Role-specific allowlists. Fields outside the caller's role are an
  // authorization violation (403), malformed values are a 400.
  const allowedCustomer = ["title", "description", "priority", "category", "attachment"];
  const allowedAgent = ["status", "assigneeId"];
  const allowed = actorRole === "agent" ? allowedAgent : allowedCustomer;
  const denied = Object.keys(body ?? {}).filter((k) => !allowed.includes(k));
  if (denied.length) {
    throw forbidden(`Role ${actorRole} may not modify: ${denied.join(", ")}.`);
  }
  const errors = {};
  if (body?.title !== undefined && !isNonEmptyString(body.title, 120)) errors.title = "Title must be 3-120 chars.";
  if (body?.description !== undefined && !isNonEmptyString(body.description, 5000)) errors.description = "Description must be 10-5000 chars.";
  if (body?.priority !== undefined && !PRIORITIES.includes(body.priority)) errors.priority = `Priority must be one of: ${PRIORITIES.join(", ")}.`;
  if (body?.category !== undefined && !CATEGORIES.includes(body.category)) errors.category = `Category must be one of: ${CATEGORIES.join(", ")}.`;
  if (body?.attachment !== undefined) {
    try {
      checkAttachmentShape(body.attachment);
    } catch (e) {
      errors.attachment = e.message;
    }
  }
  if (body?.status !== undefined && !STATUSES.includes(body.status)) errors.status = `Status must be one of: ${STATUSES.join(", ")}.`;
  if (body?.assigneeId !== undefined && body.assigneeId !== null && typeof body.assigneeId !== "string") {
    errors.assigneeId = "assigneeId must be a string or null.";
  }
  if (Object.keys(errors).length) throw badRequest("Invalid update.", errors);
  const out = {};
  for (const k of allowed) if (body?.[k] !== undefined) out[k] = typeof body[k] === "string" ? body[k].trim() : body[k];
  if (Object.keys(out).length === 0) throw badRequest("Empty update body.");
  return out;
}
export function validateComment(body) {
  if (!isNonEmptyString(body?.body, 2000) || body.body.trim().length < 1) {
    throw badRequest("Comment body is required (1-2000 chars).");
  }
  return { body: body.body.trim() };
}
