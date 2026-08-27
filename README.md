# ChainFlow

AI-assisted supply chain exception triage. Ingests purchase orders, shipments,
inventory changes, and supplier emails, validates them for missing/incomplete
data, and generates AI-written triage summaries for delivery exceptions with
a human approve/reject/escalate review workflow and audit trail.

Ships with a 150-record simulated dataset for exploring it out of the box.

## Tech stack

- **Backend**: Python, FastAPI, SQLAlchemy
- **Database**: PostgreSQL (falls back to SQLite for local dev)
- **Cache**: Redis (falls back to in-process cache if unavailable)
- **AI**: Anthropic Claude or OpenAI, auto-detected from whichever API key is set (falls back to a deterministic template if neither is set)
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Framer Motion, Recharts
- **Infra**: Docker Compose

## Quickstart

### Docker

```bash
docker compose up --build
```

- API: http://localhost:8000/api (docs at `/docs`)
- App: http://localhost:8080

### Local, no Docker

**Backend:**

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload   # http://localhost:8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

Set `VITE_API_BASE` in `frontend/.env` if your API isn't on `http://localhost:8000/api`.

## Environment variables

Copy `backend/.env.example` to `backend/.env` and fill in what you need. Real
secrets go only in `.env` (gitignored) — never in `.env.example`.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | SQLite file | Postgres connection string in production |
| `REDIS_URL` | `redis://localhost:6379/0` | Omit to use the in-process cache |
| `ANTHROPIC_API_KEY` | unset | Enables real Claude triage briefs |
| `OPENAI_API_KEY` | unset | Enables real GPT triage briefs (takes priority if both are set) |
| `CORS_ORIGINS` | localhost origins | JSON array of allowed frontend origins |

## Features

- Ingest purchase orders, shipments, inventory changes, supplier emails, and delivery exceptions via API or the in-app "Add record" forms
- Rule-based validation flags missing required fields (including nested and conditional checks)
- AI-generated triage briefs summarize an exception plus its related PO/shipment/email context
- Redis-cached AI summaries
- Review workflow: pending → in review → approved / rejected / escalated, with a full audit trail
- Live data-quality dashboard showing completeness stats on your own data

## API

Key endpoints — full interactive docs at `/docs` once running:

| Method | Path |
|---|---|
| `GET`/`PUT` | `/api/settings` |
| `POST` | `/api/seed/load` |
| `DELETE` | `/api/records/all` |
| `POST`/`GET` | `/api/purchase-orders`, `/api/shipments`, `/api/inventory-changes`, `/api/supplier-emails` |
| `POST`/`GET` | `/api/exceptions` |
| `POST` | `/api/exceptions/{id}/summarize` |
| `POST` | `/api/exceptions/{id}/review` |
| `GET` | `/api/exceptions/{id}/audit` |
| `GET` | `/api/metrics` |

## Testing

```bash
cd backend
python3 -m pytest tests/ -v
```

## Deploying

Frontend on Vercel, backend on Railway or Render (both auto-detect
`backend/Dockerfile`; no Postgres/Redis needed for a demo deploy — SQLite and
the in-process cache work fine). Set `CORS_ORIGINS` on the backend to your
frontend's URL, and `VITE_API_BASE` on the frontend to your backend's URL + `/api`.