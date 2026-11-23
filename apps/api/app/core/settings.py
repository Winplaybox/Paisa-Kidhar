"""Immutable settings, validated once at startup."""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore", frozen=True)

    environment: Literal["development", "test", "production"] = "development"

    # Supabase (shared WinPlayBox project, isolated `paisa` schema)
    supabase_url: str = Field(..., description="https://<ref>.supabase.co")
    supabase_anon_key: str = Field(..., description="publishable/anon key — used only for the password grant proxy")
    supabase_jwt_secret: str = Field("", description="legacy HS256 secret; leave empty when the project uses JWKS signing keys")
    # Transition only: also accept sessions issued by the previous Supabase project (installed apps keep
    # signing in there until they receive the OTA). Empty = disabled. Remove after the soak period.
    legacy_supabase_url: str = Field("", description="previous project URL; sessions from it stay valid during the move")
    legacy_supabase_jwt_secret: str = Field("", description="HS256 secret of the previous project, if it uses one")
    database_url: str = Field(..., description="postgres://paisa_api.<ref>:<pw>@<pooler-host>:6543/postgres")
    db_pool_min: int = 1
    db_pool_max: int = 5

    # App
    public_web_url: str = "https://paisa.winplaybox.in"
    cors_origins: str = "https://paisa.winplaybox.in"
    pledge_token_secret: str = Field(..., min_length=32, description="HMAC key for guest pledge tokens")
    ip_hash_salt: str = Field(..., min_length=16)
    trusted_proxy_hops: int = Field(1, ge=0, le=5, description="reverse proxies in front of the API (Render = 1)")

    # Firebase App Check (Play Integrity). monitor = log only; enforce = reject Android requests without a valid token.
    app_check_mode: Literal["off", "monitor", "enforce"] = "monitor"
    firebase_project_number: str = "139598541085"

    # Dodo Payments (Premium Registry — digital product the platform sells to the couple)
    payments_enabled: bool = False
    dodo_payments_api_key: str = ""
    dodo_payments_webhook_key: str = ""
    dodo_payments_environment: Literal["test_mode", "live_mode"] = "test_mode"
    dodo_premium_product_id: str = ""
    premium_price_paise: int = 49900
    dodo_shagun_card_product_id: str = ""
    shagun_card_price_paise: int = 4900
    checkout_return_url: str = "https://paisa.winplaybox.in/billing/return"

    @field_validator("supabase_url", "public_web_url", "checkout_return_url")
    @classmethod
    def _https(cls, v: str) -> str:
        v = v.rstrip("/")
        if not (v.startswith("https://") or v.startswith("http://localhost") or v.startswith("http://127.0.0.1")):
            raise ValueError("must be an https URL")
        return v

    @property
    def dodo_base_url(self) -> str:
        return "https://live.dodopayments.com" if self.dodo_payments_environment == "live_mode" else "https://test.dodopayments.com"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def assert_payments_ready(self) -> None:
        missing = [k for k in ("dodo_payments_api_key", "dodo_payments_webhook_key", "dodo_premium_product_id") if not getattr(self, k)]
        if missing:
            raise RuntimeError(f"payments enabled but missing: {', '.join(missing)}")


@lru_cache
def get_settings() -> Settings:
    s = Settings()  # type: ignore[call-arg]
    if s.payments_enabled:
        s.assert_payments_ready()
    return s
