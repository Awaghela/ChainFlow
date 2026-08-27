import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, engine
from app.routers import exceptions, metrics, records, seed, settings as settings_router

logging.basicConfig(level=logging.INFO)
settings = get_settings()

app = FastAPI(
    title="ChainFlow API",
    description="AI-assisted supply chain exception triage — ingestion, "
                 "rule-based validation, LLM-generated triage briefs, and "
                 "the human review workflow.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


app.include_router(records.router, prefix="/api")
app.include_router(exceptions.router, prefix="/api")
app.include_router(seed.router, prefix="/api")
app.include_router(metrics.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
