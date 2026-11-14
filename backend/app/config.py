from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str = "https://xatbfyiytcnogfbtfsym.supabase.co"
    # Publishable (anon) key — public by design. All data access runs as the *user* via their JWT, so RLS applies.
    supabase_publishable_key: str = "sb_publishable_QpEcKrru1S6jW-k6llv30Q_4mV1QXO7"

    max_upload_bytes: int = 8 * 1024 * 1024
    max_pdf_pages: int = 80
    rate_limit_per_minute: int = 30
    auth_cache_seconds: int = 300
    request_timeout_s: float = 15.0
    environment: str = "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
