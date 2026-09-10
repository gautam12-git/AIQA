# AIQA API Contract (v0)

The single source of truth for the interface between the **frontend** (`aiqa/`, Next.js)
and the **backend** (`aiqa/backend/`, FastAPI on Modal, GLM for reasoning).

Both sides build against this file. The frontend consumes it through `lib/data.ts`
(one swap point); the backend implements it in `backend/app/api/*`. The Pydantic
schemas and the TypeScript types in `lib/types.ts` are mirror images — same field
names, **camelCase on the wire**.

---

## Conventions

- **Base URL**: `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`). All routes under `/api`.
- **JSON casing**: **camelCase** in every request and response body. The backend uses
  snake_case internally and serializes with `by_alias=True` (see `backend/app/schemas`).
- **IDs**: opaque strings (`prj_…`, `run_…`, `BUG-####`).
- **Timestamps**: ISO-8601 UTC strings (`2026-09-05T06:12:00Z`).
- **Errors**: non-2xx responses return
  ```json
  { "error": { "code": "not_found", "message": "Run run_x not found" } }
  ```
- **Auth** (later): `Authorization: Bearer <token>` header; out of scope for v0 local dev.
- **CORS**: backend allows the frontend origin (configurable via `CORS_ORIGINS`).

---

## Read endpoints

These map 1:1 to the functions in `lib/data.ts`. All return bare domain objects/arrays
(no envelope), matching the types in `lib/types.ts`.

| Function (`lib/data.ts`)      | Method & path                          | Returns                        |
| ----------------------------- | -------------------------------------- | ------------------------------ |
| `getDashboardStats()`         | `GET /api/dashboard`                   | `DashboardStats`               |
| `getProjects()`               | `GET /api/projects`                    | `Project[]`                    |
| `getProject(id)`              | `GET /api/projects/{id}`               | `Project`                      |
| `getAppMap(id)`               | `GET /api/projects/{id}/app-map`       | `AppMapNode`                   |
| `getRuns(projectId?)`         | `GET /api/runs?projectId=…`            | `TestRun[]` (newest first)     |
| `getRun(id)`                  | `GET /api/runs/{id}`                    | `TestRun`                      |
| `getBugs(filter?)`            | `GET /api/bugs?projectId=&runId=&category=&severity=` | `Bug[]` (severity-ranked) |
| `getBug(id)`                  | `GET /api/bugs/{id}`                    | `Bug`                          |

Query params are all optional filters. Unknown/empty params are ignored.

---

## Write endpoints

### `POST /api/scans` — start a run

Called by the scan launcher (`components/scan/scan-form.tsx`). Creates a `TestRun` in
`queued` status and hands it to the orchestrator.

Request:
```json
{
  "url": "https://staging.yourapp.com",
  "environment": "staging",
  "mode": "standard",
  "instruction": "Test checkout and coupons.",
  "authorized": true,
  "credentials": [{ "label": "Customer", "username": "test@ex.dev" }]
}
```
- `authorized` **must** be `true` or the API returns `403 { error.code: "authorization_required" }`.
- `credentials` is optional; secrets are never returned in any response.
- Production + a non-safe `mode` → `422 { error.code: "unsafe_in_production" }`.

Response `201`: the created `TestRun`.

### `POST /api/projects` — register a project (optional, later)
Request: `{ "name", "url", "environment" }` → `201 Project`.

### `POST /api/runs/{id}/cancel` — cancel a running/queued run
Response `200`: the updated `TestRun`.

---

## Live run stream

### `GET /api/runs/{id}/events` — Server-Sent Events

Streams run progress so the run detail page updates without polling. Chosen over
WebSocket: one-way, proxy-friendly, trivial to emit from the orchestrator.

Event types (each `data:` line is a JSON object):
```
event: phase     data: { "name": "Execute & verify", "status": "active", "detail": "checkout" }
event: progress  data: { "progress": 63, "actionsExecuted": 1284 }
event: finding   data: <Bug>            // a newly-verified bug
event: coverage  data: <Coverage>
event: status    data: { "status": "completed" }
```
Client closes on `status: completed | failed | cancelled`. Until this lands, the frontend
falls back to polling `GET /api/runs/{id}`.

---

## Domain types

Authoritative definitions live in **`lib/types.ts`** (TS) and **`backend/app/schemas/`**
(Pydantic, camelCase aliases). Keep them in lockstep — a field added on one side is added
on the other in the same change. Core objects: `Project`, `TestRun`, `Bug`, `Evidence`,
`Coverage`, `AppMapNode`, `DashboardStats`.

---

## What the backend owns (not in this contract)

Internal, behind the endpoints above — free to evolve:
- **Orchestrator**: the observe→plan→act→verify loop (`backend/app/services/orchestrator.py`).
- **LLM**: provider-agnostic client, GLM by default (`backend/app/llm/`).
- **Browser workers**: Playwright/Chromium in Modal containers.
- **Evidence store**: screenshots/DOM/traces (object storage), referenced by URL in `Evidence`.
- **Persistence**: Postgres (swap the in-memory `store.py`).
