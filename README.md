# ChainFlow

AI-assisted supply chain exception triage. Ingests purchase orders, shipment
updates, inventory changes, supplier emails, and delivery exceptions; runs
rule-based constraint checks; generates LLM-based triage summaries; and
routes exceptions through a human review workflow with a full audit trail.

This repo ships with a 150-record simulated dataset and the code that
**measures** (rather than asserts) its two headline metrics:

| Metric | Result |
|---|---|
| Missing-field detection rate | **72.0% → 88.0%** (recall, +16 points) after iterating the validation ruleset |
| Exception triage time | **10.74 min → 6.95 min** mean, a **35.2%** reduction, across 40 simulated triage scenarios |

Re-run `backend/scripts/compute_metrics.py` (or hit `POST /api/metrics/recompute`
on the running API) and you'll get the same numbers back — they're computed
from `app/rules/validation_v1.py` / `validation_v2.py` against ground-truth
labels baked into the seed data, and from a documented triage-time
simulation. See [`METHODOLOGY.md`](./METHODOLOGY.md) for exactly how.

## Stack

- **Backend**: Python, FastAPI, SQLAlchemy, PostgreSQL, Redis (with automatic
  in-process fallback), Anthropic Claude API (with a deterministic offline
  fallback so the app runs with zero external calls)
- **Frontend**: React, TypeScript, Vite, Tailwind CSS v4, Framer Motion,
  Recharts
- **Infra**: Docker Compose

## Quickstart (Docker)

```bash
git clone <this repo> && cd chainflow
docker compose up --build
```

- API: http://localhost:8000/api (docs at `/docs`)
- App: http://localhost:8080

On first load, the dashboard will prompt you to **load the simulated
dataset** — this seeds all 150 records into Postgres via `POST
/api/seed/load`.

To use a real Claude model for the AI triage briefs instead of the
deterministic offline fallback, set `ANTHROPIC_API_KEY` before starting:

```bash
ANTHROPIC_API_KEY=sk-ant-... docker compose up --build
```

Without a key, `/exceptions/{id}/summarize` still works — it uses a
template-based summary so the whole review workflow (including the Redis
cache) is fully demoable offline.

## Quickstart (local, no Docker)

**Backend** (SQLite instead of Postgres, in-process cache instead of Redis —
zero external services required):

```bash
cd backend
pip install -r requirements.txt
python3 scripts/generate_data.py      # regenerate the 150-record dataset (already committed)
python3 scripts/compute_metrics.py    # regenerate the metrics report (already committed)
python3 -m pytest tests/ -v           # proof suite — should be 5 passed
uvicorn app.main:app --reload         # http://localhost:8000
```

**Frontend**:

```bash
cd frontend
npm install
npm run dev                            # http://localhost:5173
```

Set `VITE_API_BASE` in `frontend/.env` if your API isn't on
`http://localhost:8000/api`.

## Project layout

```
backend/
  app/
    routers/        # ingestion, exceptions workflow, metrics, seed
    services/        cache.py (Redis + fallback), llm.py (Claude + fallback), metrics.py
    rules/            validation_v1.py, validation_v2.py — the two rulesets being compared
    models.py, schemas.py, database.py, config.py
    data/             seed_dataset.json, metrics_report.json (generated, committed for convenience)
  scripts/
    generate_data.py  builds the 150-record seed dataset with ground-truth labels
    compute_metrics.py  measures both headline metrics
  tests/
    test_metrics_proof.py  automated proof suite
frontend/
  src/
    pages/            Dashboard, Exceptions (queue), Metrics (proof)
    components/        ExceptionRow, ExceptionDrawer, StatusStamp, KpiCard, Layout, toasts
docker-compose.yml
METHODOLOGY.md
```

## API surface

| Method | Path | Purpose |
|---|---|---|
| GET / PUT | `/api/settings` | Workspace company name (drives onboarding) |
| POST | `/api/seed/load` | Load the 150-record simulated dataset |
| DELETE | `/api/records/all` | Clear all workspace data (keeps settings) |
| POST | `/api/purchase-orders` `/api/shipments` `/api/inventory-changes` `/api/supplier-emails` | Create/update a record of that type |
| GET | `/api/purchase-orders` `/api/shipments` `/api/inventory-changes` `/api/supplier-emails` | List records of that type |
| POST | `/api/exceptions` | Log a new delivery exception |
| GET | `/api/exceptions` | List delivery exceptions (filter by `state`) |
| POST | `/api/exceptions/{id}/summarize` | Generate (or fetch cached) AI triage brief |
| POST | `/api/exceptions/{id}/review` | `approve` / `reject` / `escalate` / `start_review` |
| GET | `/api/exceptions/{id}/audit` | Full audit trail for an exception |
| GET | `/api/metrics` | The measured benchmark report (see Data quality page) |
| POST | `/api/metrics/recompute` | Re-run the validators + simulation live |

Full interactive docs at `/docs` once the backend is running.

## Using it as a real workspace

On first load the app asks for a company name, then lets you either start
blank or load the 150-record sample dataset to explore. From there:

- **Overview** — KPI cards, a records-by-type breakdown, and a severity
  donut for your exceptions, computed live from whatever is actually in
  your database.
- **Records** — sortable, searchable tables for purchase orders, shipments,
  inventory changes, and supplier emails, each with an "Add record" form
  (purchase orders support multiple line items).
- **Exceptions** — the review queue: AI-generated triage briefs, an
  approve/reject/escalate workflow, and a full audit trail per exception.
- **Data quality** — live completeness stats on your own records, plus the
  72.0%→88.0% / 35.2% benchmark numbers kept separately and clearly labeled
  as a historical benchmark (there's no ground truth for your real data, so
  the app doesn't pretend to grade it against one).
- **Workspace settings** (gear icon in the sidebar) — rename the workspace,
  reload the sample dataset, or clear all data.
