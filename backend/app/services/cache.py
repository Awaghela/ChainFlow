"""
Caches LLM-generated exception summaries keyed on a hash of the exception's
content, so re-triaging the same exception (or replaying a demo) doesn't
re-call the LLM. Real Redis in docker-compose; falls back to a process-local
dict automatically if Redis isn't reachable, so `uvicorn app.main:app` works
standalone too.
"""
import hashlib
import json
import logging
import time

from app.config import get_settings

logger = logging.getLogger("chainflow.cache")
settings = get_settings()

_memory_store: dict[str, tuple[float, str]] = {}
_TTL_SECONDS = 60 * 60 * 6  # 6 hours

_redis_client = None
_redis_available = False

try:
    import redis as redis_lib

    _redis_client = redis_lib.from_url(settings.redis_url, socket_connect_timeout=0.3, decode_responses=True)
    _redis_client.ping()
    _redis_available = True
    logger.info("Connected to Redis at %s", settings.redis_url)
except Exception as e:  # noqa: BLE001
    logger.warning("Redis unavailable (%s) — using in-process cache fallback", e)
    _redis_available = False


def cache_key(exception_payload: dict) -> str:
    canonical = json.dumps(exception_payload, sort_keys=True, default=str)
    return "chainflow:ai_summary:" + hashlib.sha256(canonical.encode()).hexdigest()[:24]


def get(key: str) -> str | None:
    if _redis_available:
        try:
            return _redis_client.get(key)
        except Exception:  # noqa: BLE001
            pass
    entry = _memory_store.get(key)
    if not entry:
        return None
    expires_at, value = entry
    if time.time() > expires_at:
        _memory_store.pop(key, None)
        return None
    return value


def set(key: str, value: str, ttl: int = _TTL_SECONDS) -> None:
    if _redis_available:
        try:
            _redis_client.setex(key, ttl, value)
            return
        except Exception:  # noqa: BLE001
            pass
    _memory_store[key] = (time.time() + ttl, value)


def backend_name() -> str:
    return "redis" if _redis_available else "in-process (redis unavailable)"
