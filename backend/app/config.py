from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Defaults to a local SQLite file so `uvicorn app.main:app` works with
    # zero setup. docker-compose.yml overrides this to the Postgres service.
    database_url: str = "sqlite:///./chainflow.db"

    # Falls back to an in-process dict cache automatically if unreachable
    # (see app/services/cache.py) so the API still works without Redis.
    redis_url: str = "redis://localhost:6379/0"

    anthropic_api_key: str | None = None
    llm_model: str = "claude-sonnet-5"

    # If set, OpenAI is used instead of Anthropic (see app/services/llm.py) --
    # the two are mutually exclusive; OpenAI takes priority if both are set.
    # OpenAI's model lineup moves fast -- check https://platform.openai.com/docs/models
    # for the current recommended default and override via OPENAI_MODEL if needed.
    openai_api_key: str | None = None
    openai_model: str = "gpt-5.1"

    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()