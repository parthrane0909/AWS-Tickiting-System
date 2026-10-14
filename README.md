# TickDesk — AWS Serverless Ticketing System (Phase 1: Local Application)

Minimal but fully functional ticketing system with **Customer** and **Agent** roles.
Phase 1 runs **entirely locally** — no AWS credentials required, no AWS services contacted.

> **Dev-auth notice:** sign-in is an email/password form backed by a local development
> credential check (`POST /api/dev-login`). It is **not** Amazon Cognito and provides no
> real security — Cognito Hosted UI replaces it in Phase 2.
> **Test credentials (dev-only):** any of `alice@example.com`, `bob@example.com`
> (customers), `eve@example.com` (agent) with password `local-dev-pass`
> (or `TICKDESK_DEV_PASSWORD`). A labeled "Local development access" panel on the
> login page lists them.
> **Attachment notice:** `POST /tickets/presigned-url` is a local stub that reserves a
> `fileKey` and validates metadata. It does **not** generate a real S3 presigned URL.

## Prerequisites

- Node.js 20 (`node --version` → v20.x), npm 10+

## Installation

```bash
npm run install:all
# or individually:
npm --prefix backend install    # (no production deps — zero-dependency API)
npm --prefix frontend install
```

## Environment configuration

```bash
cp backend/.env.example backend/.env          # PORT=3001, DATA_DIR= (default ./data)
cp frontend/.env.example frontend/.env        # VITE_API_BASE_URL= (empty = Vite proxy to :3001)
```

## Local startup

Terminal 1 — backend (seeds `[DEMO]` tickets on first run):

```bash
npm run dev:backend   # http://localhost:3001
```

Terminal 2 — frontend:

```bash
npm run dev:frontend  # http://localhost:5173
```

Sign in with a dev email + dev password (see notice above). Alice/Bob are customers, Eve is an agent.

## Role permission matrix (enforced by the backend service layer)

| Operation | Customer | Agent |
|---|---|---|
| View own tickets | ✅ | ✅ |
| View other customers' tickets | ❌ (403) | ✅ |
| Create a ticket | ✅ | ❌ (403) |
| Edit own ticket details (title/description/priority/category) | ✅ while OPEN | ❌ (403) |
| Edit another customer's ticket | ❌ (403) | ❌ (403) |
| Update ticket status | ❌ (403) | ✅ |
| Assign/reassign agent | ❌ (403) | ✅ |
| Add/view comments | ✅ | ✅ |
| Upload attachments | ✅ | ❌ (403) |
| Add/replace/remove attachment on own OPEN ticket | ✅ | ❌ (403) |
| Download attachment | own tickets only | any ticket |

The frontend hides/disables prohibited actions (router guard, nav, buttons),
but the backend is authoritative: crafted requests are rejected with 403/400
regardless of what the browser sends. Identity comes from the trusted
`x-dev-user-id` header, never from body fields like `userId` or `status`.

## Routes & features

| Route | Who | What |
|---|---|---|
| `/login` | public | Two-panel sign-in (email/password form with explicit Sign In button + animated branding panel). No role picker in the normal flow; a collapsed dev-only disclosure lists test identities (Fill populates, never auto-submits) |
| `/` | authed | Dashboard: live stat cards, search, status/priority filters, ticket table |
| `/tickets/new` | authed | Create ticket (validation, optional attachment metadata) |
| `/tickets/:id` | owner or agent | Detail, comments, activity timeline, agent status/assign dialogs |
| `*` | public | 404 page |

Customers see only their own tickets; agents see all. All rules are enforced in the backend
service layer (`backend/src/services/ticketService.js`), never just in the UI.

## API endpoints (base `http://localhost:3001`)

Auth header for all `/tickets*`: `x-dev-user-id: <cust_alice|cust_bob|agent_eve>` (local trust boundary).

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/tickets` | Create ticket (customers only) |
| GET | `/api/tickets?search=&status=&priority=&category=&page=&limit=` | List / filter / search (customers auto-scoped) |
| GET | `/api/tickets/:ticketId` | Ticket detail |
| PUT | `/api/tickets/:ticketId` | Update — customers: own OPEN-ticket fields + attachment; agents: status/assignee |
| POST | `/api/tickets/:ticketId/comments` | Add comment |
| GET | `/api/tickets/:ticketId/comments` | List comments |
| GET | `/api/tickets/:ticketId/history` | Activity timeline (supplement to the 7-contract set) |
| POST | `/api/attachments` | **Real local upload** — JSON body `{fileName, mimeType, size, contentBase64}`; stores bytes on disk, returns `{attachmentId, fileName, mimeType, size, fileKey, uploadedAt}` (customers only) |
| GET | `/api/tickets/:ticketId/attachment` | Download attachment bytes (authorized users only) |
| POST | `/api/dev-login` | **Dev-only, additive** — verifies dev email + `TICKDESK_DEV_PASSWORD`, returns identity |
| GET | `/api/dev-users` | Dev identities (feeds the login disclosure + agent assign list; deleted in Phase 2) |
| GET | `/api/health` | Health check |

> **Attachment note (Phase 1):** uploads are genuine — bytes are written to
> `backend/data/uploads/` with server-generated names, metadata to
> `backend/data/uploads.json`, and the ticket references the `fileKey`.
> The former `POST /api/tickets/presigned-url` stub (which returned a fake
> URL) was **removed** and replaced by the real upload endpoint above.
> Files are transmitted as base64 inside the JSON body (dev PoC only,
> 5 MB `MAX_UPLOAD_BYTES` cap); Phase 2 replaces this with S3 presigned URLs
> and direct browser-to-S3 upload.

Success: `{ data, meta? }` · Errors: `{ error: { message, details? } }` with 200/201/400/401/403/404.

## Test commands & results (2026-10-12)

```bash
npm run test:backend  # node --test → 28/28 pass (tickets, roles/RBAC, attachments incl. HTTP round-trip + restart persistence, dev-login)
npm run build         # vite build → success
```

Manual integration run (curl against fresh server, all green):
agent create → **403**; customer create → 201; customer upload → 201 with
server-generated `fileKey`; attach via PUT → metadata on ticket; download as
agent → raw bytes + `content-disposition`; download as other customer → **403**;
customer edit own → 200 with `edited` activity; customer smuggles `status` →
**403**; agent edits title → **403**; agent status+assignee → 200; customer
edit after status change (not OPEN) → **403**; cross-customer access → **403**;
unknown `fileKey` on create → **400** with no ticket persisted; attachment
remove → bytes deleted from disk; download after "restart" (fresh service
instance, same data dir) → identical bytes. Frontend `vite dev` serves
`/login`, `/`, `/tickets/new`, `/tickets/:id` HTTP 200.

**Attachment download fix (2026-10-12):** the backend was verified healthy
(HTTP 200, exact bytes, MD5 identical to disk). The defect was in
`frontend/src/services/api.js`: `downloadAttachment` called `res.json()`
*before* the `res.ok` check, which consumed the binary response body stream
and made the following `res.blob()` throw `TypeError: Body has already been
read`. Fix: parse JSON only on the error path. Also fixed the object-URL
revocation timing in `TicketDetailPage.vue` (revoke after 1s, not
synchronously after click) and added a duplicate-click guard.

## Design system (final refinement)

- Warm ivory page `#F5F3EE`; white primary cards; lavender `#F0EAF8`, blue `#EAF2FC`,
  mint `#E7F4EC`, blush `#F8E8F1`, cream `#FBF7EE` used intentionally; dark `#171717`
  pill nav; text `#252332`/`#777487`; teal accent `#0E7C6B`; soft borders `#E7E0EB`.
  All centralized in `tailwind.config.js` (`line` token for borders) — no scattered hex.
- Authenticated pages have a pure-CSS 3D animated background
  (`components/layout/AnimatedBackground.vue`): translucent pastel spheres
  drifting in a perspective scene, slowly rotating wireframe rings, and
  ambient particles. `position: fixed; z-index: -1; pointer-events: none`
  — it never covers or blocks cards, dialogs, or inputs, and cards
  themselves are never transformed. GPU-friendly transform/opacity-only
  keyframes; `prefers-reduced-motion` renders a static scene; shapes shrink
  at ≤768px. No new dependencies.
- Responsive: bento collapses 4→2→stacked; login stacks to single column (panel hidden) on mobile;
  table scrolls in-card at 390px. Class-level audit at 390/768/1280; no screenshot tooling
  in this environment, so pixel-level review was not performed.

## Known limitations (Phase 1)

- Single-process JSON-file store; no concurrent-write locking (fine for PoC).
- Attachments: base64-in-JSON upload (dev PoC only), one attachment per
  ticket, 5 MB cap; no multipart streaming. Bytes live in
  `backend/data/uploads/`, never inside `db.json`.
- Orphaned uploads (uploaded but never linked to a ticket) are swept at
  server boot (`reapOrphans`).
- Offset pagination (`page`/`limit`), no realtime updates, no password
  security (dev header).
- Runtime data lives in `backend/data/` (fixed this pass — it previously
  resolved to `backend/src/data/`, inside the source tree).

## Future AWS integration (Phase 2, not started)

| Local | AWS replacement |
|---|---|
| `adapters/auth/devUsers.js` + `x-dev-user-id` | Cognito Hosted UI + verified JWT claims/role |
| `handlers/*` + `app.js` | Lambda handlers behind API Gateway HTTP API (contracts unchanged) |
| `JsonStore` repository | DynamoDB repository (same method signatures) |
| `localAttachments` stub | Real S3 presigned-URL + browser-to-S3 upload |
| `VITE_API_BASE_URL=localhost` | API Gateway URL via environment |
