import { CATEGORIES, PRIORITIES, STATUSES } from "../constants.js";
import { DEV_USERS, verifyDevCredentials } from "../adapters/auth/devUsers.js";
import { resolveDataDir } from "../adapters/persistence/jsonStore.js";
import { createStorage } from "../adapters/storage/localAttachments.js";
import { authenticate } from "../middleware/auth.js";
import { readJsonBody, sendError, sendJson } from "../middleware/json.js";
import { createConfiguredRepository } from "../repositories/configuredRepository.js";
import { createTicketService } from "../services/ticketService.js";
import { createAgentDirectory } from "../adapters/auth/agentDirectory.js";
import { badRequest, forbidden } from "../utils/errors.js";

const dataDir = resolveDataDir();
const persistenceBackend = process.env.PERSISTENCE_BACKEND || "json";
const repo = createConfiguredRepository({
  backend: persistenceBackend,
  dataDir
});
const storage = persistenceBackend === "json"
  ? createStorage(dataDir)
  : null;
const agentDirectory = createAgentDirectory();
const service = createTicketService(repo, storage, agentDirectory);

// Upload bodies carry base64 file bytes; all other JSON bodies stay small.
const UPLOAD_BODY_LIMIT = 8 * 1024 * 1024;

function queryOf(url) {
  const q = {};
  for (const [k, v] of url.searchParams.entries()) q[k] = v;
  return {
    search: q.search || "",
    status: q.status || "",
    priority: q.priority || "",
    category: q.category || "",
    page: q.page ? Number(q.page) : 1,
    limit: q.limit ? Number(q.limit) : 20,
  };
}

function sanitizeListQuery(q) {
  if (q.status && !STATUSES.includes(q.status)) throw badRequest(`Invalid status filter. Use: ${STATUSES.join(", ")}.`);
  if (q.priority && !PRIORITIES.includes(q.priority)) throw badRequest(`Invalid priority filter. Use: ${PRIORITIES.join(", ")}.`);
  if (q.category && !CATEGORIES.includes(q.category)) throw badRequest(`Invalid category filter. Use: ${CATEGORIES.join(", ")}.`);
  return q;
}

export async function handleRequest(req, res) {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;
  const method = req.method.toUpperCase();

  const authMode = process.env.AUTH_MODE || "dev";

  if (
    authMode !== "dev" &&
    (path === "/api/dev-users" || path === "/api/dev-login")
  ) {
    return sendJson(res, 404, {
      error: { message: "Not found." }
    });
  }

  if (method === "GET" && path === "/api/me") {
    try {
      const user = await authenticate(req);
      return sendJson(res, 200, { data: user });
    } catch (err) {
      return sendError(res, err);
    }
  }

  // Public (dev-only): health + dev identity listing for the login screen.
  if (method === "GET" && path === "/api/health") return sendJson(res, 200, { data: { ok: true } });
  if (method === "GET" && path === "/api/dev-users") {
    return sendJson(res, 200, {
      data: DEV_USERS,
      meta: { note: "LOCAL-DEV-ONLY: stand-in for Cognito Hosted UI." },
    });
  }
  // Public (dev-only): email/password check backing the local login form.
  // Additive endpoint; the 7 ticket contracts are unchanged.
  if (method === "POST" && path === "/api/dev-login") {
    const body = await readJsonBody(req);
    const user = verifyDevCredentials(body?.email, body?.password);
    if (!user) {
      return sendJson(res, 401, {
        error: { message: "Invalid email or password. (Local dev auth — see README for test credentials.)" },
      });
    }
    return sendJson(res, 200, {
      data: user,
      meta: { note: "LOCAL-DEV-ONLY: not Cognito. Session is the x-dev-user-id header." },
    });
  }

  // All ticket routes require dev auth.
  if (
    !path.startsWith("/api/tickets") &&
    path !== "/api/attachments" &&
    path !== "/api/agents"
  ) {
    return sendJson(res, 404, { error: { message: "Not found." } });
  }

  let user;
  try {
    user = await authenticate(req);
  } catch (err) {
    return sendError(res, err);
  }

  try {
    // Only authenticated Agents may access the Agent directory.
    if (method === "GET" && path === "/api/agents") {
      if (user.role !== "agent") {
        throw forbidden("Only agents can view the agent directory.");
      }

      return sendJson(res, 200, {
        data: await agentDirectory.list()
      });
    }

    // POST /api/attachments — genuine local upload (customers only).
    // Replaces the former presigned-url stub, which returned a fake URL.
    if (method === "POST" && path === "/api/attachments") {
      if (user.role !== "customer") throw forbidden("Only customers can upload attachments.");
      if (!storage) {
        return sendJson(res, 501, {
          error: { message: "Attachments require S3 in DynamoDB mode." }
        });
      }
      const body = await readJsonBody(req, UPLOAD_BODY_LIMIT);
      return sendJson(res, 201, { data: storage.store(body, user.id) });
    }
    // POST /api/tickets
    if (method === "POST" && path === "/api/tickets") {
      const body = await readJsonBody(req);
      return sendJson(res, 201, { data: await service.create(body, user) });
    }
    // GET /api/tickets (list)
    if (method === "GET" && path === "/api/tickets") {
      const q = sanitizeListQuery(queryOf(url));
      const result = await service.list(q, user);
      return sendJson(res, 200, { data: result.items, meta: { total: result.total, page: result.page, limit: result.limit } });
    }
    // Ticket-scoped routes
    const m = path.match(/^\/api\/tickets\/([^/]+)(\/(comments|history|attachment))?$/);
    if (m) {
      const ticketId = decodeURIComponent(m[1]);
      const sub = m[3];
      if (method === "GET" && !sub) return sendJson(res, 200, { data: await service.get(ticketId, user) });
      if (method === "PUT" && !sub) {
        const body = await readJsonBody(req);
        return sendJson(res, 200, { data: await service.update(ticketId, body, user) });
      }
      if (method === "GET" && sub === "attachment") {
        const file = await service.downloadAttachment(ticketId, user);
        res.writeHead(200, {
          "content-type": file.mimeType,
          "content-length": file.bytes.length,
          "content-disposition": `attachment; filename="${file.fileName.replace(/"/g, "")}"`,
        });
        res.end(file.bytes);
        return;
      }
      if (method === "GET" && sub === "comments") return sendJson(res, 200, { data: await service.listComments(ticketId, user) });
      if (method === "POST" && sub === "comments") {
        const body = await readJsonBody(req);
        return sendJson(res, 201, { data: await service.addComment(ticketId, body, user) });
      }
      if (method === "GET" && sub === "history") return sendJson(res, 200, { data: await service.history(ticketId, user) });
    }
    return sendJson(res, 404, { error: { message: "Not found." } });
  } catch (err) {
    return sendError(res, err);
  }
}
