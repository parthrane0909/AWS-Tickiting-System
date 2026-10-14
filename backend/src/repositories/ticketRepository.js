// Persistence operations only — no business rules here. The service layer owns RBAC.
import { loadDb, saveDb, resolveDataDir } from "../adapters/persistence/jsonStore.js";

export function createRepository(dataDir = resolveDataDir()) {
  return {
    read() {
      return loadDb(dataDir);
    },
    listTickets() {
      return loadDb(dataDir).tickets;
    },
    getTicket(id) {
      return loadDb(dataDir).tickets.find((t) => t.id === id) || null;
    },
    insertTicket(ticket) {
      const db = loadDb(dataDir);
      db.tickets.unshift(ticket);
      saveDb(db, dataDir);
      return ticket;
    },
    updateTicket(id, patch) {
      const db = loadDb(dataDir);
      const idx = db.tickets.findIndex((t) => t.id === id);
      if (idx === -1) return null;
      db.tickets[idx] = { ...db.tickets[idx], ...patch };
      saveDb(db, dataDir);
      return db.tickets[idx];
    },
    listComments(ticketId) {
      return loadDb(dataDir)
        .comments.filter((c) => c.ticketId === ticketId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    insertComment(comment) {
      const db = loadDb(dataDir);
      db.comments.push(comment);
      saveDb(db, dataDir);
      return comment;
    },
    listActivities(ticketId) {
      return loadDb(dataDir)
        .activities.filter((a) => a.ticketId === ticketId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    insertActivity(activity) {
      const db = loadDb(dataDir);
      db.activities.push(activity);
      saveDb(db, dataDir);
      return activity;
    },
  };
}
