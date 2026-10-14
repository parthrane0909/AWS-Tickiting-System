import { badRequest, forbidden, notFound } from "../utils/errors.js";
import { newId, newTicketId, nowIso } from "../utils/ids.js";
import { validateComment, validateCreateTicket, validateUpdateTicket } from "../validation/tickets.js";
import { findDevUser } from "../adapters/auth/devUsers.js";

// Business rules + RBAC live here. Handlers stay thin; repositories stay dumb.
// `storage` (local attachment adapter) is injected; attachment references are
// only accepted after the bytes were actually stored (claim step).
export function createTicketService(repo, storage = null) {
  function assertCanRead(ticket, user) {
    if (user.role === "agent") return;
    if (ticket.customerId !== user.id) throw forbidden("You can only access your own tickets.");
  }

  function assertStorage() {
    if (!storage) throw badRequest("Attachments are not supported by this service instance.");
  }

  async function toList({ search, status, priority, category, page, limit }, user) {
    // Use the customer index in DynamoDB; still check ownership below.
    let items = await repo.listTickets(user.role === "customer" ? user.id : null);
    if (user.role === "customer") items = items.filter((t) => t.customerId === user.id);
    if (status) items = items.filter((t) => t.status === status);
    if (priority) items = items.filter((t) => t.priority === priority);
    if (category) items = items.filter((t) => t.category === category);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((t) =>
        [t.id, t.title, t.description].some((f) => String(f).toLowerCase().includes(q)),
      );
    }
    items = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const p = Math.max(1, page || 1);
    const l = Math.min(100, Math.max(1, limit || 20));
    const total = items.length;
    return { items: items.slice((p - 1) * l, p * l), total, page: p, limit: l };
  }

  return {
    list: (query, user) => toList(query, user),

    async get(ticketId, user) {
      const ticket = await repo.getTicket(ticketId);
      if (!ticket) throw notFound("Ticket not found.");
      assertCanRead(ticket, user);
      return ticket;
    },

    async create(body, user) {
      // Agents work existing tickets; only customers open new requests.
      if (user.role !== "customer") {
        throw forbidden("Agents cannot create tickets. Only customers can open support requests.");
      }
      const input = validateCreateTicket(body);
      const ts = nowIso();
      const ticketId = newTicketId();
      // Claim first: a ticket is never created referencing an unstored file.
      // Claim failures (400) abort creation, so no ticket is persisted.
      let attachment = null;
      if (input.attachment) {
        assertStorage();
        attachment = await storage.claim(input.attachment.fileKey, ticketId);
      }
      const ticket = {
        id: ticketId,
        ...input,
        attachment,
        status: "OPEN",
        customerId: user.id, // server-derived; body userId is ignored by design
        customerName: user.name,
        assigneeId: null,
        assigneeName: null,
        createdAt: ts,
        updatedAt: ts,
      };
      await repo.insertTicket(ticket);
      await repo.insertActivity({
        id: newId("act"), ticketId: ticket.id, actorId: user.id, actorName: user.name,
        type: "created", detail: "Ticket created.", createdAt: ts,
      });
      return ticket;
    },

    async update(ticketId, body, user) {
      const ticket = await repo.getTicket(ticketId);
      if (!ticket) throw notFound("Ticket not found.");
      assertCanRead(ticket, user);
      if (user.role === "customer") {
        // Owner-only detail edits, and only while the ticket is still OPEN.
        if (ticket.customerId !== user.id) throw forbidden("You can only edit your own tickets.");
        if (ticket.status !== "OPEN") {
          throw forbidden("Customers can only edit tickets that are still OPEN.");
        }
      }
      // Role violations (e.g. customer sending status, agent sending title)
      // throw 403 from validation; malformed values throw 400.
      const patch = validateUpdateTicket(body, user.role);
      const updates = {};
      const changed = [];
      let previousAttachmentToRelease = null;
      if (user.role === "customer") {
        for (const field of ["title", "description", "priority", "category"]) {
          if (patch[field] !== undefined && patch[field] !== ticket[field]) {
            updates[field] = patch[field];
            changed.push(field);
          }
        }
        if (patch.attachment !== undefined) {
          assertStorage();
          const nextKey = patch.attachment ? patch.attachment.fileKey : null;
          const prevKey = ticket.attachment ? ticket.attachment.fileKey : null;
          if (nextKey !== prevKey) {
            const claimed = nextKey ? await storage.claim(nextKey, ticketId) : null;
            // Release the previous file only AFTER the ticket update succeeds.
            // A persistence failure must not delete the attachment still referenced by the ticket.
            if (prevKey) previousAttachmentToRelease = prevKey;
            updates.attachment = claimed;
            changed.push(nextKey ? "attachment added" : "attachment removed");
          }
        }
      } else {
        if (patch.status !== undefined) updates.status = patch.status;
        if (patch.assigneeId !== undefined) {
          if (patch.assigneeId === null) {
            updates.assigneeId = null;
            updates.assigneeName = null;
          } else {
            const assignee = findDevUser(patch.assigneeId);
            if (!assignee || assignee.role !== "agent") throw forbidden("Assignee must be a known agent.");
            updates.assigneeId = assignee.id;
            updates.assigneeName = assignee.name;
          }
        }
      }
      updates.updatedAt = nowIso();
      const saved = await repo.updateTicket(ticketId, updates);
      if (!saved) throw notFound("Ticket not found.");
      if (previousAttachmentToRelease) await storage.release(previousAttachmentToRelease);
      const ts = updates.updatedAt;
      if (changed.length) {
        await repo.insertActivity({
          id: newId("act"), ticketId, actorId: user.id, actorName: user.name,
          type: "edited", detail: `Edited ${changed.join(", ")}.`, createdAt: ts,
        });
      }
      if (patch.status && patch.status !== ticket.status) {
        await repo.insertActivity({
          id: newId("act"), ticketId, actorId: user.id, actorName: user.name,
          type: "status_changed", detail: `${ticket.status} → ${patch.status}`, createdAt: ts,
        });
      }
      if (patch.assigneeId !== undefined) {
        await repo.insertActivity({
          id: newId("act"), ticketId, actorId: user.id, actorName: user.name,
          type: "assigned", detail: updates.assigneeName ? `Assigned to ${updates.assigneeName}.` : "Unassigned.",
          createdAt: ts,
        });
      }
      return saved;
    },

    async downloadAttachment(ticketId, user) {
      const ticket = await repo.getTicket(ticketId);
      if (!ticket) throw notFound("Ticket not found.");
      assertCanRead(ticket, user);
      if (!ticket.attachment) throw notFound("This ticket has no attachment.");
      assertStorage();
      const file = await storage.read(ticket.attachment.fileKey);
      if (!file) throw notFound("Attachment file is missing from local storage.");
      return file;
    },

    async listComments(ticketId, user) {
      const ticket = await repo.getTicket(ticketId);
      if (!ticket) throw notFound("Ticket not found.");
      assertCanRead(ticket, user);
      return await repo.listComments(ticketId);
    },

    async addComment(ticketId, body, user) {
      const ticket = await repo.getTicket(ticketId);
      if (!ticket) throw notFound("Ticket not found.");
      assertCanRead(ticket, user);
      const { body: text } = validateComment(body);
      const ts = nowIso();
      const comment = {
        id: newId("cmt"), ticketId, authorId: user.id, authorName: user.name,
        authorRole: user.role, body: text, createdAt: ts,
      };
      await repo.insertComment(comment);
      await repo.insertActivity({
        id: newId("act"), ticketId, actorId: user.id, actorName: user.name,
        type: "commented", detail: `${user.name} added a comment.`, createdAt: ts,
      });
      return comment;
    },

    async history(ticketId, user) {
      const ticket = await repo.getTicket(ticketId);
      if (!ticket) throw notFound("Ticket not found.");
      assertCanRead(ticket, user);
      return await repo.listActivities(ticketId);
    },
  };
}
