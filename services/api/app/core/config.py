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
    web_url: str = "http://localhost:5174"  # used in links inside emails
    # Supabase tokens: verify with the project JWKS (asymmetric keys) or, for local projects, the shared secret.
    jwks_url: str = ""
    jwt_secret: str = ""
    jwt_audience: str = "authenticated"
    jwt_issuer: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
