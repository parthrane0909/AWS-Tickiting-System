# IMPLEMENTATION_PLAN.md — AWS Serverless Ticketing System (Phase 1: Local First)

**Status:** Phase 1 COMPLETE and verified locally (2026-10-12), final UI refinement COMPLETE, workflows/permissions/attachments COMPLETE. Phase 2 (AWS) NOT STARTED.
**Date:** 2026-10-12
**Constraint:** Phase 1 is local-only. No AWS credentials required. No fake-AWS claims.

---

## 0. Step 0 — Inspection Findings

- Working directory `/home/parthrane/Parth/Intership/Tickiting_system` is **empty** (0 entries, no hidden files, no package.json).
- Toolchain: Node `v20.20.2`, npm `10.8.2` — satisfies Node 20 requirement.
- No existing frontend/backend to reuse; greenfield scaffold required.
- No second app risk: there is nothing to overwrite.
- Blockers: none. Network access for `npm install` assumed; will verify on scaffold.

## 1. Objectives & Scope

**Objective:** Minimal but fully functional ticketing system with Customer + Agent roles, verified locally, architected for future AWS migration (Cognito, API Gateway, Lambda, DynamoDB, S3).

**In scope (Phase 1):**
- Local auth adapter with Customer/Agent switching (clearly dev-only).
- Dashboard + ticket list (search, status/priority filters, stats from real data).
- Create ticket (validation, optional attachment metadata).
- Ticket details (comments, activity timeline, status/assignee controls for Agent).
- Reusable dialogs, design system matching Dribbble reference visual language.
- Backend: validation, RBAC enforcement, services, JSON-file repositories, local attachment adapter.
- Tests (backend `node:test`, frontend build + manual checklist), README.

**Out of scope (Phase 1):**
- Any AWS provisioning, Cognito Hosted UI, real S3 presigned URLs, DynamoDB, API Gateway.
- Payments, event management, marketing, AI classification, realtime chat, notifications.

## 2. Functional Requirements

### Customer (from spec §6)
1. Sign in via local adapter. 2. Dashboard. 3. See only own tickets. 4. Search/filter own tickets.
5. Create ticket. 6. Open detail. 7. Read comments/activity. 8. Add comment. 9. View status/assignee. 10. View attachment info.

### Agent (from spec §6)
1. Sign in via local adapter. 2. View all tickets. 3. Search/filter. 4. Open detail.
5. Update status. 6. Assign/reassign. 7. Add comments. 8. Review activity history.

### General
Backend validation, graceful 404/400 handling, stable unique IDs (`TIX-XXXX` + uuid fallback), created/updated timestamps, persistence, centralized constants, no stack-trace leaks, duplicate-submit guards, consistent UI after mutations.

## 3. Frontend Architecture

- **Stack:** Vue 3 (Composition API, SFC), Vite 5, Tailwind CSS 3, Vue Router 4, Pinia (auth + tickets stores only), single `apiClient` service layer (`fetch`, JSON, `x-dev-user-id` header).
- **Structure:**
  ```
  frontend/src/
    assets/  components/{layout,common,tickets}/  pages/  router/
    services/  stores/  composables/  constants/  utils/
  ```
- Pages: `LoginPage`, `DashboardPage` (stats + table), `CreateTicketPage`, `TicketDetailPage`, `NotFoundPage`.
- Design system components first: `AppLayout`, `AppHeader` (dark pill nav), `StatCard`, `StatusBadge`, `PriorityBadge`, `TicketTable`, `SearchInput`, `FilterSelect`, `AppButton`, `AppInput`, `AppDialog`, `EmptyState`, `LoadingSpinner`, `Toast`.
- Visual mapping (Dribbble): pastel bg `#f6f4f1`-ish, white rounded-2xl cards, black pill nav, compact table, pills for status, right-side detail panel language → ticket detail two-column layout.

## 4. Backend Architecture

- **Stack:** Node 20, ES modules, **zero production dependencies** (`node:http` + `node:fs` + `node:crypto`). Rationale: proof-of-concept, no DB server, Lambda-mappable handlers.
- **Structure:**
  ```
  backend/src/
    app.js (server+routing)  routes/tickets.js  handlers/tickets.js
    services/ticketService.js  repositories/ticketRepository.js
    validation/tickets.js  middleware/{auth.js,json.js}  adapters/{auth/devUsers.js, storage/localAttachments.js, persistence/jsonStore.js}
    constants.js  utils/{ids.js,errors.js}
  backend/tests/*.test.js (node:test + assert)  backend/data/*.json (gitignored seed + runtime)
  ```
- Routing: explicit method+path matcher preserving the 7-contract table (path-param syntax `:ticketId` documented; implemented via regex).
- Auth: `x-dev-user-id` header → dev user lookup; service layer receives `{id, role}`. Frontend never trusted for `userId`.
- Attachments: local adapter stores file **bytes** in `backend/data/uploads/`
  (server-generated names) + metadata in `backend/data/uploads.json`;
  `POST /api/attachments` performs the real upload; ticket creation only
  succeeds if the `fileKey` was actually stored (claim step). Phase 2
  replaces with S3 presigned URLs. Never claims S3.

## 5. Data Models

```js
Ticket { id, title, description, priority, category, status, customerId, customerName,
         assigneeId|null, assigneeName|null, attachment|null{fileName,mimeType,size,fileKey},
         createdAt, updatedAt }
Comment { id, ticketId, authorId, authorName, authorRole, body, createdAt }
Activity { id, ticketId, actorId, actorName, type, detail, createdAt } // types: created,status_changed,assigned,commented
User (dev) { id, name, email, role: 'customer'|'agent' }
```

Constants (single source `backend/src/constants.js` mirrored in `frontend/src/constants/`):
- Status: `OPEN, IN_PROGRESS, RESOLVED, CLOSED`
- Priority: `LOW, MEDIUM, HIGH, URGENT`
- Category: `GENERAL, BILLING, TECHNICAL, ACCOUNT, FEEDBACK` (documented as implementation decision)

## 6. API Contracts

Base: `http://localhost:3001/api` (configurable via `VITE_API_BASE_URL`).

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/api/tickets` | customer (agent denied 403) | Create ticket |
| GET | `/api/tickets?search=&status=&priority=&category=&page=&limit=` | scoped list | List/filter/search (customers auto-scoped) |
| GET | `/api/tickets/:ticketId` | owner or agent | Detail |
| PUT | `/api/tickets/:ticketId` | customer: own OPEN-ticket fields + attachment; agent: status/assignee only | Update |
| POST | `/api/tickets/:ticketId/comments` | owner or agent | Add comment |
| GET | `/api/tickets/:ticketId/comments` | owner or agent | List comments |
| GET | `/api/tickets/:ticketId/history` | owner or agent | Activity timeline |
| POST | `/api/attachments` | customer only | Real local upload; bytes to `backend/data/uploads/` |
| GET | `/api/tickets/:ticketId/attachment` | owner or agent | Download attachment bytes |
| POST | `/api/dev-login` | public (dev only) | Verify dev email + dev password, return identity (additive; ticket contracts unchanged) |
| GET | `/api/dev-users` | public (dev only) | List dev identities for login disclosure + agent assign list |
| GET | `/api/health` | public | Health check |

Response envelope: `{ data }` success; `{ error: { message, details? } }` failure. Status codes: 200/201/400/401/403/404/405/500.

## 7. Role-Based Access Rules

Backend-enforced matrix (service layer; frontend restrictions are UX only):
- Customer: create tickets; list scoped to self; read own tickets; edit own
  OPEN tickets (title/description/priority/category/attachment); comment;
  upload attachments; download own attachments.
- Agent: read all tickets; update status/assignee; comment; download any
  attachment. **Cannot create tickets** (403) and **cannot edit ticket
  detail fields** (403).
- Crafted requests (smuggled `status`, `assigneeId`, `customerId`, `id`,
  `createdAt`) are rejected 403; malformed values 400. Identity is derived
  from the trusted `x-dev-user-id` header, never from body fields.

## 8. Local Development Strategy

- Persistence: `JsonStore` (read-through, write-through JSON files in `backend/data/`). Replaceable by DynamoDB repo implementing same interface (`list/get/create/update`, comments appended atomically in file).
- Seed: `backend/src/seed.js` generates clearly-marked demo tickets (`[DEMO]`) through the service layer on first run if data files absent.
- Ports: backend `3001`, frontend `5173`. CORS open for localhost (documented dev-only).
- Env: `backend/.env.example` (`PORT`, `DATA_DIR`), `frontend/.env.example` (`VITE_API_BASE_URL`).

## 9. Future AWS Integration Strategy

| Local | AWS Phase 2 |
|---|---|
| `adapters/auth/devUsers.js` | Cognito JWT verify → `{id, role}` from claims/groups |
| `handlers/*` + `app.js` routing | Lambda handlers per route behind API Gateway HTTP API (contracts unchanged) |
| `JsonStore` repository | DynamoDB repository (same method signatures) |
| `localAttachments` adapter | S3 presigned-URL + direct browser upload |
| `VITE_API_BASE_URL=localhost` | API Gateway URL via env |
| `GET /dev-users`, `x-dev-user-id` | Deleted; replaced by Authorization header |

## 10. Directory Structure (target)

```
./
  IMPLEMENTATION_PLAN.md  README.md
  backend/{package.json, src/..., tests/..., data/.gitkeep}
  frontend/{package.json, vite.config.js, tailwind.config.js, index.html, src/...}
```

## 11. Ordered Implementation Phases

1. ✅ Phase 0 — Inspect + plan (this file). 2. ✅ Phase 1 — Backend core (constants, store, repo, service, handlers, seed) + `node:test` suite (9/9 pass).
3. ✅ Phase 2 — Frontend shell + design system + router + auth store + api client.
4. ✅ Phase 3 — Dashboard/list, create form, detail/comments/activity, dialogs.
5. ✅ Phase 4 — Integration (seeded data via services, no hardcoding), stats from live data.
6. ✅ Phase 5 — Verified (backend tests 9/9, `vite build` OK, curl integration 12-step workflow green, `vite dev` HTTP 200), README + plan updated.
7. ✅ Refinement pass — pastel design tokens + CSS-only motion system (reduced-motion aware); Kezak-inspired two-panel login (email/password via additive `POST /api/dev-login`, picker removed from normal flow, dev disclosure retained); dashboard/detail/create polish; regression green (backend 12/12, `vite build` OK, fresh-server curl incl. login 200/401, `/login` HTTP 200); docs updated.
8. ✅ Workflows/permissions/attachments — backend role matrix enforced (agent create 403, agent detail-edit 403, customer status/assignee smuggle 403, customer edit-own-OPEN allowed); genuine local attachment upload/download/replace/remove with bytes on disk (fake presigned-url stub removed); customer Edit dialog + agent-only workflow controls; Create Ticket page completed (upload-first, remove/replace, validation, loading/error states); data-dir defect fixed (`backend/src/data` → `backend/data`); regression green (backend 24/24, `vite build` OK, 14-step fresh-server curl all green); docs updated.
9. ✅ Attachment-download fix + 3D background — root cause found empirically: `api.js` `downloadAttachment` called `res.json()` before the `res.ok` check, consuming the binary body stream so `res.blob()` threw "Body has already been read" on every successful download (backend verified healthy: 200, exact bytes, MD5 match). Fixed to parse JSON only on error paths; object-URL revocation deferred 1s; duplicate-click guard added; dead `reserveUpload` (removed endpoint) deleted. Added pure-CSS 3D animated background (`AnimatedBackground.vue`: pastel spheres, orbital rings, particles; fixed/z-index -1/pointer-events-none; cards untouched; reduced-motion static; no new deps). Tests extended to 28/28 (404 paths, missing-file grace, restart persistence, update-safety, binary headers). Live proxy verification: 200, 1,560,506 bytes, MD5 matches disk.
8. ✅ Final UI refinement — warm-ivory token set centralized (`line` border token, stale-CSS `dist` rebuilt); login form order per spec with explicit Sign In button, dev paragraph removed, compact collapsed disclosure (Fill never auto-submits); animated 4-layer branding illustration replacing the app-preview cards; true bento dashboard (large Total + 4 stats + CSS status overview + recent-activity from live data); regression green (backend 12/12, build OK, fresh-server curl incl. 403 isolation + filtered search, `/login` `/` `/tickets/new` HTTP 200).

## 12. Testing Strategy

- Backend: `node --test tests/` covering §13 list (create valid/invalid, retrieval, customer isolation, agent access, unauthorized 403, status/assignee update, comments, 404, persistence reload).
- Frontend: `vite build` must pass; manual checklist mirrors integration workflow (12 steps in §13); responsive check at 390px/768px/1280px.
- Never delete failing tests to greenwash.

## 13. Acceptance Criteria (Phase 1 gate)

Per spec §15: documented start commands, reference-aligned UI, all screens, both role workflows, real persisted data, working search/filters, comments, agent status/assign, backend RBAC, all UI states, responsive, tests+build run with real results, README + this plan accurate, dev-auth/storage clearly labeled non-AWS.

## 14. Assumptions & Limitations

- **Decisions (not assignment-mandated):** status/priority values, category list, `TIX-` ID format, zero-dep backend, JSON-file persistence, `x-dev-user-id` trust header, Tailwind v3 (stable) over v4, shared dev password (`TICKDESK_DEV_PASSWORD`, default `local-dev-pass`) for the local login form, CSS-only motion (no animation lib).
- **Limitations:** single-process file store (no concurrent-write locking beyond synchronous read-modify-write; fine for PoC), attachments transmitted as base64 in JSON (dev PoC only; bytes on disk in `backend/data/uploads/`, 5 MB cap, one per ticket, orphaned uploads swept at boot), no pagination cursor (offset page/limit), no real auth security, no multipart upload streaming.
