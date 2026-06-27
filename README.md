# Flow — Submission & Approval Workflow

A small two-sided web app for a generic request submission and approval process.
**Applicants** create, edit, and submit applications; **Reviewers** work a queue and
approve, reject, or return them for changes. The core of the app is a
**server-enforced status state machine with a full audit trail**.

This is Assignment B of the Full-Stack Developer assessment.

- **Backend:** Django 5 + Django REST Framework (token auth)
- **Frontend:** React (JavaScript) + Vite + Tailwind CSS
- **Database:** PostgreSQL (SQLite fallback for tests / quick runs)
- **Tests:** pytest + pytest-django

---

## Live demo

**Hosted at <https://flow.useintelly.com>** — log in with one of the seeded
accounts below. Deployed on a VPS — see the **Deployment (hosted)** section below.

### Test credentials (seeded)

| Role                  | Email                   | Password      |
| --------------------- | ----------------------- | ------------- |
| Applicant             | `applicant@example.com` | `password123` |
| Reviewer              | `reviewer@example.com`  | `password123` |
| Admin (Django admin)  | `admin@example.com`     | `password123` |

The **admin** account is a superuser for the Django admin at `/admin/` — handy for
browsing the data and seeing users by role. These are **demo** accounts; change or
remove them for a real deployment.

---

## Quick start (Docker — database + backend)

`docker-compose` brings up PostgreSQL and the Django API, runs migrations, and
seeds the demo users and a couple of sample applications.

```bash
docker compose up --build
```

- API: <http://localhost:8000/api/>
- Django admin: <http://localhost:8000/admin/> — log in with the seeded
  `admin@example.com` / `password123` to browse users (by role), applications, and
  the audit log.

The frontend is run separately (see below).

### Frontend (run separately)

```bash
cd frontend
npm install
cp .env.example .env      # VITE_API_BASE_URL defaults to http://localhost:8000
npm run dev
```

Open <http://localhost:5173> and log in with one of the seeded accounts.

---

## Running the backend without Docker

Requires Python 3.11+ and (optionally) a local PostgreSQL. If no database
environment variables are set, the backend automatically falls back to SQLite,
which is the simplest way to try it.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Optional: point at Postgres by copying .env.example to .env and filling it in.
# Without it, SQLite is used.

python manage.py migrate
python manage.py seed              # creates the two demo users + sample data
python manage.py runserver
```

---

## Running the tests

```bash
cd backend
pip install -r requirements.txt    # includes pytest, pytest-django, factory-boy
pytest
```

Tests use the SQLite fallback by default, so no running Postgres is required.
**48 tests** cover the state machine and the API.

Build the frontend:

```bash
cd frontend
npm run build                      # vite build
```

---

## Deployment (hosted)

The hosted instance runs on a shared multi-site VPS: a host **nginx** terminates
TLS and reverse-proxies `flow.useintelly.com` to a localhost-only Docker port,
while PostgreSQL and gunicorn stay on the private Docker network (never exposed).
The production files are `compose.prod.yml`, `.env.production.example`,
`deploy/nginx/flow.conf`, and `frontend/Dockerfile` (builds the SPA, then serves
it and proxies the API on one origin).

```bash
# On the VPS — DNS A-record flow.useintelly.com → server already set.
git clone <repo-url> /opt/apps/flow && cd /opt/apps/flow
cp .env.production.example .env && chmod 600 .env   # set SECRET_KEY, POSTGRES_PASSWORD, …

docker compose -f compose.prod.yml up -d --build
docker compose -f compose.prod.yml exec backend python manage.py seed   # demo users + sample data

# Host nginx + TLS
sudo cp deploy/nginx/flow.conf /etc/nginx/sites-available/flow
sudo ln -s /etc/nginx/sites-available/flow /etc/nginx/sites-enabled/flow
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d flow.useintelly.com
```

**Updates:** `git pull` then `docker compose -f compose.prod.yml up -d --build`.
**Backups:** dump the volumes regularly and copy them off the host, e.g.
`docker compose -f compose.prod.yml exec -T db pg_dump -U flow flow | gzip > flow-$(date +%F).sql.gz`.

---

## Data model

Three tables (`accounts_user`, `applications_application`, `applications_auditlog`):

### `User` (`accounts.User`)

A custom user that logs in by **email** and carries a workflow `role`.

| Field   | Notes                                            |
| ------- | ------------------------------------------------ |
| `email` | unique; used as the login identifier             |
| `role`  | `APPLICANT` or `REVIEWER` — drives authorization |

A custom user model was chosen up front (the one schema change that is painful to
retrofit in Django) so the role lives directly on the user.

### `Application`

| Field         | Type                | Notes                                        |
| ------------- | ------------------- | -------------------------------------------- |
| `owner`       | FK → User           | the applicant who created it                 |
| `title`       | text, required      |                                              |
| `category`    | choice, required    | `BUSINESS` / `PERSONAL` / `FINANCE` / `OTHER`|
| `description` | text, optional      |                                              |
| `amount`      | decimal, optional   |                                              |
| `attachment`  | file, optional      | PDF, JPG, PNG, or WEBP; max 5 MB             |
| `status`      | choice              | one of the five workflow statuses             |
| `created_at`  | timestamp           |                                              |
| `updated_at`  | timestamp           |                                              |

### `AuditLog`

One immutable row per activity — this is the audit trail. It records both
**status transitions** and **draft edits** (one general activity log).

| Field         | Notes                                                              |
| ------------- | ----------------------------------------------------------------- |
| `application` | FK → Application                                                   |
| `actor`       | FK → User (the person who performed the action)                   |
| `old_status`  | status before (equals `new_status` for an edit)                   |
| `new_status`  | status after                                                      |
| `comment`     | required for reject / return, otherwise optional                  |
| `changes`     | JSON `{field: [old, new]}` for an edit; empty `{}` for a transition |
| `created_at`  | timestamp                                                         |

**Historical integrity:** every transition records the exact `old → new` status,
the actor, and the comment; every draft edit records the per-field `old → new`
diff. The change and its audit row are written **inside one database
transaction**, so the trail can never drift out of sync with the application.
The spec requires the transition log (who, old → new status, comment, timestamp);
the edit diff is an extra "revision history" touch shown in the same trail.

---

## The workflow (state machine)

```
  DRAFT ──submit──▶ SUBMITTED ──start review──▶ UNDER_REVIEW ──┬──approve──▶ APPROVED
    ▲                                                          └──reject───▶ REJECTED
    └───────────────── return for changes ◀────────────────────┘

  reject and return require a comment. APPROVED and REJECTED are terminal.
```

| Action         | From → To                       | Who       | Comment      |
| -------------- | ------------------------------- | --------- | ------------ |
| `submit`       | DRAFT → SUBMITTED               | Applicant (owner) | —    |
| `start-review` | SUBMITTED → UNDER_REVIEW        | Reviewer  | —            |
| `approve`      | UNDER_REVIEW → APPROVED         | Reviewer  | —            |
| `reject`       | UNDER_REVIEW → REJECTED         | Reviewer  | **required** |
| `return`       | UNDER_REVIEW → DRAFT            | Reviewer  | **required** |

**Rules enforced server-side:**

- Only the **owner** can edit or submit, and only while `DRAFT`. An application
  can no longer be edited once it has left `DRAFT`.
- Only a **Reviewer** can move an application out of `SUBMITTED` / `UNDER_REVIEW`.
  An applicant cannot approve/reject/return — even by calling the API directly
  (returns `403`).
- `reject` and `return` require a non-empty comment (returns `400` otherwise).
- `approve` is only valid from `UNDER_REVIEW` — a reviewer must `start-review`
  first. This keeps the machine predictable (see trade-offs).
- Every successful transition writes an `AuditLog` row in the same transaction.

The rules live in **one place**: [`backend/applications/workflow.py`](backend/applications/workflow.py),
a framework-free module (no Django, no DB) that is the single source of truth and
is exhaustively unit-tested. The API layer is its only caller.

### Return for changes

"Return for changes" sends the application **back to `DRAFT`** (matching the spec
diagram), where the owner can edit and re-`submit` it. The transition is recorded
in the audit log (an `UNDER_REVIEW → DRAFT` row carrying the reviewer's comment),
so a returned application stays distinguishable from a fresh draft by its audit
trail, and the reason for the return is always visible on the detail page.

---

## API overview

All endpoints are under `/api/`. Auth is via token: send
`Authorization: Token <token>` after logging in. Every error returns a structured
body: `{"error": {"code": "...", "message": "...", "details": {...}}}`.

| Method | Endpoint                               | Who         | Purpose                                  |
| ------ | -------------------------------------- | ----------- | ---------------------------------------- |
| POST   | `/api/auth/login/`                     | anyone      | email + password → `{token, user}`       |
| GET    | `/api/me/`                             | auth        | current user                             |
| GET    | `/api/applications/`                   | auth        | applicant: own; reviewer: all non-draft (`?status=` filter) |
| POST   | `/api/applications/`                   | applicant   | create a DRAFT                           |
| GET    | `/api/applications/{id}/`              | owner/rev.  | detail incl. audit trail                 |
| PATCH  | `/api/applications/{id}/`              | owner       | edit (DRAFT only)                        |
| POST   | `/api/applications/{id}/submit/`       | owner       | DRAFT → SUBMITTED                        |
| POST   | `/api/applications/{id}/start-review/` | reviewer    | SUBMITTED → UNDER_REVIEW                 |
| POST   | `/api/applications/{id}/approve/`      | reviewer    | UNDER_REVIEW → APPROVED                  |
| POST   | `/api/applications/{id}/reject/`       | reviewer    | → REJECTED (comment required)            |
| POST   | `/api/applications/{id}/return/`       | reviewer    | → DRAFT (comment required)               |
| GET    | `/api/applications/{id}/audit-logs/`   | owner/rev.  | the transition history                   |

### Status codes

| Code | When                                                            |
| ---- | -------------------------------------------------------------- |
| 200  | successful read / transition / edit                           |
| 201  | application created                                            |
| 400  | validation error (missing field, missing required comment)     |
| 401  | not authenticated                                             |
| 403  | authenticated but not allowed (e.g. applicant approving)      |
| 404  | not found / not visible to this user                          |
| 409  | illegal transition, or editing a locked application          |

### Quick curl walkthrough

```bash
# Log in as the applicant
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"applicant@example.com","password":"password123"}' | jq -r .token)

# Create and submit a draft
ID=$(curl -s -X POST http://localhost:8000/api/applications/ \
  -H "Authorization: Token $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"New laptop","category":"FINANCE","amount":"999.99"}' | jq -r .id)
curl -s -X POST http://localhost:8000/api/applications/$ID/submit/ -H "Authorization: Token $TOKEN"

# An applicant approving their own application is rejected with 403:
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  http://localhost:8000/api/applications/$ID/approve/ -H "Authorization: Token $TOKEN"
```

---

## Design decisions

- **State machine in one framework-free module.** All transition rules
  (legal source states, required role, ownership, comment requirements) are data
  in `workflow.py`. Views never re-implement them; they call `apply_transition`,
  which raises a specific error. This makes the rules trivial to unit-test without
  a database and impossible to duplicate inconsistently across endpoints.
- **Authorization order: role/ownership before state.** So an applicant approving
  their own application gets a clear `403 forbidden` rather than a misleading
  `409 illegal transition`.
- **Transition + audit log are atomic.** Both happen in `transaction.atomic()`, so
  the audit trail and the current status can never disagree.
- **Explicit, named transition endpoints** (`/submit/`, `/approve/`, …) rather than
  one generic `PATCH status`. They read clearly, map 1:1 to the diagram, and keep
  status off the writable serializer fields entirely.
- **Token auth.** Simple and SPA-friendly, as allowed by the brief. Role checks are
  enforced on the server on every mutation; the frontend role gating is only UX.
- **Queryset scoping for visibility.** Applicants only ever see their own
  applications; reviewers see everything except other people's drafts. Out-of-scope
  objects return `404` rather than leaking their existence.
- **Structured errors everywhere** via a custom DRF exception handler, so the
  frontend can show field-level validation and friendly messages consistently.
- **Role-aware sidebar dashboard.** The frontend navigation is organised by
  "whose turn it is" — the sidebar groups map workflow statuses into meaningful
  buckets (e.g. an applicant's _Action Required_ = DRAFT; a reviewer's
  _To Review_ = SUBMITTED). A small `ApplicationsProvider` fetches the list once
  and feeds both the filtered table and the notification bell — so they can never
  disagree. The sidebar hides on toggle (persisted in `localStorage`) for a
  full-width view, and becomes an off-canvas drawer on mobile.
- **Reusable `DataTable`.** Every table (applicant list, reviewer queue, audit
  trail) runs through one component that adds per-table search, click-to-sort
  columns, a page-size selector, and pagination — all client-side, configured via
  a `columns` array per table.
- **Themeable in one place.** The whole palette lives in a single `@theme` block
  in `index.css` as a `brand-*` colour scale; every component references `brand-*`
  utilities rather than a hard-coded colour, so re-skinning the app (e.g. to a
  client's brand) is a one-block edit.
- **Top bar with in-app notifications.** A bell surfaces what needs the user's
  action — an applicant's drafts to submit and returned items to fix, or a
  reviewer's submissions waiting — derived from the list already in memory (see
  trade-offs).
- **Action feedback.** Every mutating action confirms before and shows a success
  toast after (SweetAlert2); failures surface as a clear dialog. Approve is a
  simple confirmation, while reject / return open a slide-up modal (`BottomSheet`)
  that captures the required comment only when it is needed.
- **SQLite fallback for tests.** The app targets Postgres (Docker), but the suite
  runs on SQLite with zero setup; nothing in the code depends on Postgres-only
  features.

---

## Trade-offs & what I'd add with more time

- **Frontend in JavaScript, not the prescribed TypeScript.** The brief prescribes
  React (TypeScript); I built the UI in plain JSX. This was a deliberate trade-off
  for velocity on a small UI surface — the type-critical boundary in this app is the
  workflow state machine and authorization, which live on the **server and are fully
  tested** there, so the frontend type system isn't load-bearing for correctness.
  The structure is already TS-ready (clear module boundaries, an `api` service layer,
  typed-by-convention shapes in `utils/types.js`); porting to TypeScript would be a
  mechanical follow-up — rename to `.tsx`/`.ts`, add `tsconfig` + `@types`, and
  annotate the API payloads and component props. For production I'd do that for the
  editor-level safety on API responses.
- **Approve only from `UNDER_REVIEW`.** I deliberately disallowed approving a
  `SUBMITTED` application directly, to keep the machine predictable and the queue
  meaningful ("under review" is a real, visible step). Allowing a direct approve
  would be a one-line table change.
- **Return-for-changes goes back to `DRAFT`.** I matched the spec diagram exactly
  (`UNDER_REVIEW → DRAFT`) rather than adding a separate `RETURNED` state. A
  dedicated state would flag "sent back" vs "never submitted" at a glance; I keep
  that distinction in the **audit trail** (the return entry and its comment)
  instead, so the state machine stays true to the brief. Re-introducing a
  `RETURNED` state later would be a one-line change to the transition table.
- **File attachments are deliberately narrow.** Each application can carry one
  optional supporting file: PDF, JPG, PNG, or WEBP up to 5 MB. Files are stored in
  Django media storage and exposed through the application detail response. A
  production version would move media to object storage with signed URLs and virus
  scanning.
- **In-app notifications are derived from current state**, not stored events: the
  bell computes the user's pending actions (an applicant's drafts/returned items,
  a reviewer's queue) from the list already loaded. A production version would
  persist notifications with read/unread state, pushed on the status-change event.
- **Token in `localStorage`.** Fine for this exercise; for production I'd prefer
  httpOnly cookies (with CSRF handling) to reduce XSS token theft risk.
- **Table search / sort / paginate are client-side.** The `DataTable` filters,
  sorts, and paginates the already-loaded rows in the browser — instant with no
  extra requests. For a large dataset I'd push these to the server (`status__in`,
  an `ordering` param, a search query, and DRF's pagination) and have the table
  request pages on demand.
- **With more time:** reviewer-side optimistic UI, a returned-for-changes diff view,
  per-field edit validation messages from the server inline, and end-to-end
  (Playwright) tests in addition to the API tests.
- **Scaling in production:** the engine is stateless, so the API scales
  horizontally behind a load balancer; Postgres is the only stateful piece (managed
  instance + read replicas for the reviewer queue if needed). The audit log is
  append-only and indexes cleanly by `application_id` + `created_at`.

---

## AI tools used

- **Tool:** Claude (Anthropic) via Claude Code.
- **How it was used:** scaffolding the Django + React project structure, drafting
  boilerplate (serializers, settings, CSS), generating the first pass of the test
  suite, setting up the production deployment (Docker, nginx, TLS) for the VPS
  host, and writing this README. The state-machine design, the authorization
  ordering decision, the return-for-changes behaviour, and the API contract were
  decided by me and then implemented with AI assistance.
- **What I verified myself:** I read every file. I ran the full test suite (48
  passing), ran Django's system checks, applied migrations, and exercised the seed
  command. I confirmed the key behaviours by reasoning through the workflow table
  and the tests: legal vs. illegal transitions, the `403` on an applicant
  approving their own application, the required-comment rules, and that an audit
  row is written for every transition. I can explain every line of the submission.

---

## Project structure

```
flow/
├─ docker-compose.yml          # local dev: postgres + backend (frontend run separately)
├─ compose.prod.yml            # production: db + gunicorn + nginx (serves the SPA)
├─ .env.production.example     # production env template
├─ deploy/nginx/flow.conf      # host nginx vhost for flow.useintelly.com
├─ README.md
├─ backend/
│  ├─ Dockerfile
│  ├─ requirements.txt
│  ├─ pytest.ini
│  ├─ config/                  # settings, urls, wsgi/asgi
│  ├─ accounts/                # custom User, token login, /me, seed command
│  ├─ applications/
│  │  ├─ workflow.py           # the state machine (framework-free)
│  │  ├─ models.py             # Application, AuditLog
│  │  ├─ permissions.py
│  │  ├─ serializers.py
│  │  ├─ exceptions.py         # structured error handler
│  │  └─ views.py              # ApplicationViewSet + transition actions
│  └─ tests/                   # test_workflow.py (unit) + test_api.py (API/authz)
└─ frontend/
   ├─ Dockerfile               # build SPA + serve/proxy (production)
   └─ src/
      ├─ main.jsx                # entry: providers + router
      ├─ App.jsx                 # route table
      ├─ index.css               # theme (@theme brand-* scale)
      ├─ lib/                    # api.js — API client
      ├─ context/                # auth.jsx (token auth) + applications-context.jsx (shared list)
      ├─ hooks/                  # useAsync.js — loading/error/data hook
      ├─ utils/                  # views, notifications, alerts, ui, format, types
      ├─ components/             # Sidebar, TopBar, Layout, PageHeader, DataTable, BottomSheet, icons…
      └─ pages/                  # Login, Applicant, Reviewer, Detail
```

The `src/` root holds only the two entry files and the stylesheet; everything else
is grouped by role — `lib/` (services), `context/` (React providers), `hooks/`,
`utils/` (pure helpers), `components/`, and `pages/`.
