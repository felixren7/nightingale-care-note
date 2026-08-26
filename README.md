# Nightingale Shared Care Note

A local-first, synthetic-data clinical collaboration prototype for the Nightingale 72 Hour Build. It turns fragmented free-text notes into one role-aware longitudinal record with a five-item consult Glance, immutable revisions, threaded coordination, exact source provenance, deterministic AI-scribe simulation, adaptive importance feedback, and verified cold archiving.

> **SYNTHETIC DATA ONLY.** This prototype is not a medical device and must not be used with real patient data.

## Fastest path

Requirements: Node.js 24.14.x, npm 11+, SQLite 3 (only for manual inspection), and OpenSSL.

```bash
npm install
npm run setup
npm run dev
```

Open <http://localhost:3000>. `npm run setup` creates a private AES key and 30-day loopback certificate under ignored paths, applies the checked SQLite migration, and resets the synthetic demo data.

Demo roles are selected from the server allowlist—not declared by the browser:

| Demo identity | What to verify |
|---|---|
| Clinician · Dr Evan Lim | Glance, clinician-owned edits, history/diff/revert, comments, source verification, MockScribe |
| Staff · Aisha Rahman | Staff-owned note creation, task status, comments; clinician note edit is denied |
| Patient · Maya Tan | Only patient-facing instructions; no raw AI, comments, tasks, highlights, or audit fields |
| Admin · Sara Chen | Clinic-scoped overview and `/api/audit?patientId=patient-maya` |
| North clinic staff | Maya returns 404, avoiding cross-clinic existence disclosure |

## What is implemented

- **Under-10-second Glance:** at most five scored risk/action/change cards, each with a plain-language `risk_reason`, current score, feedback controls, and exact provenance pointer.
- **Longitudinal Care Note:** role-labelled manual, system, and patient-facing entries across April 2025, February 2026, and the current consult.
- **Collaboration:** internal threaded comments, assignment, resolve/reopen, and tasks. Patient DTOs omit these fields server-side.
- **Revision safety:** full immutable snapshots, word-level changes since the previous version, revert-by-append, and atomic `{baseVersion}` locking. The second same-version writer receives `409 VERSION_CONFLICT`; its draft is preserved for comparison.
- **AI integration without a key:** three distinct scribe interaction types are supported through a deterministic `MockScribeProvider`. The demo never calls an LLM or sends data off-machine.
- **Trust:** `entryId + versionId + startOffset + endOffset + sourceArtifactId?` resolves to the exact source text. Clinician corrections append a new Entry plus `supersedes` relation instead of mutating AI/patient history.
- **Adaptive importance:** accept/pin adds `+2`, reject adds `-2`, clinic/feature weights are clamped to `[-15, 15]`, and matching highlights are re-scored with an auditable reason.
- **Cold archive:** only old, low-risk, resolved, unpinned versions are eligible. `archive:apply` writes gzip + AES-256-GCM blobs, verifies SHA-256, retains metadata/provenance, and supports transparent reads.
- **Realtime:** patient-scoped SSE polls the outbox and refreshes another open browser after entries, comments, tasks, feedback, or scribe ingestion.

## Security model

All authorization is performed in Route Handlers and the server data-access layer. The opaque session token is random, stored only as SHA-256, and returned in an `HttpOnly; SameSite=Lax` cookie. Clinic scope and patient linkage are checked on every object access; unauthorized cross-scope reads return 404.

Free text in entries, versions, tasks, comments, highlights, Glance explanations, and source artifacts is encrypted with AES-256-GCM. Audit rows contain only actor, action, object IDs, version numbers, and non-sensitive control metadata.

The scribe boundary is deliberately ordered:

```text
synthetic transcript
  → encrypt raw source locally
  → redact known names + SG ID/NRIC/FIN-like values + telephone numbers
  → pass redacted text to MockScribeProvider
  → encrypt summary and provenance
```

Run `npm run test:encrypted-db` to verify known seeded phrases do not appear in the SQLite bytes. HTTPS demo termination is local and self-signed:

```bash
npm run build
npm run start:https
# https://localhost:3443
```

In production, use managed identity, CSRF protection, a secrets manager with key rotation, a trusted reverse proxy for TLS, managed audit retention, and PostgreSQL/RLS rather than treating this demo cookie and SQLite as a compliance boundary.

## Tests and acceptance commands

```bash
npm run verify             # lint + types + Vitest + real HTTP Python tests + encryption check + build
npm run test:brief         # exact required Python filenames, stdlib HTTP client
npm run bench:glance       # production build: 50 warmups, 200 requests, concurrency 10
npm run archive:preview    # default, makes no changes
npm run archive:apply      # explicit synthetic-data archive mutation
```

The required files are under `tests/brief/`:

- `test_rbac_scope.py`
- `test_revision_history.py`
- `test_highlight_provenance.py`
- `test_concurrent_edits.py`
- `test_self_learning_importance.py`

Each test talks to the real HTTP API. The harness reuses an existing local dev server when available or starts a loopback-only server on port 3100. On the recorded Apple M4 / 16 GB run, 50 warmups followed by 200 requests at concurrency 10 produced P50 **5.35 ms** and P95 **9.55 ms** (target: below 300 ms). The complete machine-readable result is in `reports/latest-benchmark.json`.

## Docker

Run `npm run setup` once so Docker Compose can read the ignored `DATA_ENCRYPTION_KEY` from `.env`, then:

```bash
docker compose up --build
```

The container applies the checked migration and seeds only synthetic data. SQLite persists in the named `nightingale-data` volume.

## Main API

| Method | Route | Purpose |
|---|---|---|
| POST / GET | `/api/session` | Select allowlisted demo identity / inspect current identity |
| GET | `/api/patients/:id/care-note` | Role-filtered patient, Glance, timeline, tasks |
| POST | `/api/patients/:id/entries` | Create a role-owned Entry |
| PATCH | `/api/entries/:id` | Append version using `baseVersion` |
| GET / POST | `/api/entries/:id/versions`, `/revert` | Full history/diff and append-only revert |
| POST / PATCH | `/api/entries/:id/comments`, `/api/comments/:id` | Thread, assign, resolve/reopen |
| POST | `/api/highlights/:id/feedback` | Accept, reject, pin, resolve and learn |
| GET | `/api/provenance/:highlightId` | Resolve an exact authorized source span |
| GET | `/api/events?patientId=&after=` | Scoped SSE outbox |
| POST | `/api/dev/scribe-ingest` | DEMO_MODE-only deterministic scribe ingest |

## Project map

```text
app/                 Next.js pages, client UI, authenticated Route Handlers
src/core/            encryption, redaction, importance, MockScribe, archive format
src/server/          Prisma adapter, DAL, RBAC, sessions, mutations, audit/outbox
prisma/              checked schema, SQL migration, idempotent synthetic seed
tests/unit/          fast deterministic unit tests
tests/brief/         candidate-brief micro-tests over real HTTP
scripts/             setup, migration, archive, HTTPS, benchmark, test harness
docs/                architecture brief and demo script
output/pdf/          rendered 2–3 page technical brief
```

## Scope decisions

Voice capture, transcription, diarization, code-switching, and a real LLM were intentionally excluded. The 72-hour core is trust and collaboration: server-enforced separation, non-destructive history, reliable provenance, fast triage, and reproducible local delivery. SQLite WAL lowers demo friction; the outbox, repository boundaries, opaque sessions, and relational IDs preserve a clear migration path to PostgreSQL and production identity.
