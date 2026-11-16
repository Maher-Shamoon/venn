from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration comes from the environment. See .env.example."""

    model_config = SettingsConfigDict(env_file=".env", env_prefix="VENN_", extra="ignore")

    secrets_key: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "https://venn-api.vercel.app/api/v1/integrations/gmail/callback"
    qbo_client_id: str = ""
    qbo_client_secret: str = ""
    qbo_env: str = "sandbox"
    qbo_redirect_uri: str = "https://venn-api.vercel.app/api/v1/integrations/quickbooks/callback"
    cron_secret: str = ""
    llm_provider: str = ""
    llm_model: str = ""
    llm_api_key: str = ""
    clamd_host: str = ""
    clamd_port: int = 3310
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_tls: bool = True
    smtp_user: str = ""
    smtp_password: str = ""
    mail_from: str = ""
    mail_from_name: str = "venn"
    rate_limit_per_minute: int = 600
    rate_limit_heavy_per_minute: int = 30
    rate_limit_anonymous_per_minute: int = 120
    rate_limit_address_per_minute: int = 1200  # every request counts against its address too, so a stream of made-up tokens cannot dodge the limits

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
    supabase_anon_key: str = ""  # the public key; with it, a token is accepted as verified only if Supabase itself says the email is confirmed


@lru_cache
def get_settings() -> Settings:
    return Settings()
