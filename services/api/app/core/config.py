from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration comes from the environment. See .env.example."""

    model_config = SettingsConfigDict(env_file=".env", env_prefix="VENN_", extra="ignore")

    env: str = "local"
    database_url: str = "postgresql+psycopg://venn:venn@localhost:5432/venn"
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: list[str] = ["http://localhost:5174", "http://localhost:5180"]
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
