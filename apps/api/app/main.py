"""FastAPI app factory. All process-wide clients are created/closed here (lifespan)."""
from __future__ import annotations

import json
import logging
import time
import uuid
from contextlib import asynccontextmanager

import asyncpg
import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.v1 import admin, auth, billing, contributions, events, health, insights, public, registries
from .core import errors
from .core.admob import AdMobVerifier
from .core.appcheck import AppCheckVerifier
from .core.security import JwtVerifier, RateLimiter
from .core.settings import Settings, get_settings


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        out = {"t": round(record.created, 3), "lvl": record.levelname, "logger": record.name, "msg": record.getMessage()}
        for k in ("request_id", "path", "status", "ms"):
            if hasattr(record, k):
                out[k] = getattr(record, k)
        if record.exc_info:
            out["exc"] = self.formatException(record.exc_info)
        return json.dumps(out, ensure_ascii=False)


def _configure_logging() -> None:
    h = logging.StreamHandler()
    h.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers[:] = [h]
    root.setLevel(logging.INFO)


async def _init_conn(conn: asyncpg.Connection) -> None:
    await conn.execute("set search_path = paisa, public")


def create_app(settings: Settings | None = None, *, pool_factory=None, http_factory=None) -> FastAPI:
    settings = settings or get_settings()
    _configure_logging()
    access = logging.getLogger("paisa.access")

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if pool_factory:
            app.state.pool = await pool_factory()
        else:
            # statement_cache_size=0 → compatible with Supabase transaction pooler (port 6543)
            app.state.pool = await asyncpg.create_pool(settings.database_url, min_size=settings.db_pool_min,
                                                       max_size=settings.db_pool_max, statement_cache_size=0,
                                                       command_timeout=10, init=_init_conn)
        app.state.http = http_factory() if http_factory else httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0))
        try:
            yield
        finally:
            await app.state.http.aclose()
            await app.state.pool.close()

    app = FastAPI(title="Paisa Kidhar API", version="1.0.0", lifespan=lifespan,
                  docs_url="/docs" if settings.environment != "production" else None, redoc_url=None)
    app.state.settings = settings
    app.state.jwt = JwtVerifier(settings)
    app.state.limiter = RateLimiter()
    app.state.appcheck = AppCheckVerifier(settings)
    app.state.admob = AdMobVerifier()

    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=False,
                       allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
                       allow_headers=["authorization", "content-type", "idempotency-key", "x-request-id", "x-client-platform", "x-firebase-appcheck"], max_age=600)

    @app.middleware("http")
    async def app_check(request: Request, call_next):
        # Only the Android app announces itself; web and server-to-server callers (webhooks) are rate-limited instead.
        mode = settings.app_check_mode
        if mode != "off" and request.headers.get("x-client-platform") == "android" and request.url.path.startswith("/v1/"):
            token = request.headers.get("x-firebase-appcheck", "")
            ok = await app.state.appcheck.verify(token) if token else False
            # One greppable line per outcome so the rollout can be judged from logs: app_check_ok vs app_check_missing/app_check_failed.
            if ok:
                access.info("app_check_ok", extra={"path": request.url.path})
            else:
                access.warning("app_check_missing" if not token else "app_check_failed", extra={"path": request.url.path, "mode": mode})
                if mode == "enforce":
                    return JSONResponse({"error": {"code": "app_check", "message": "Please update Paisa Kidhar from Google Play."}}, status_code=403)
        return await call_next(request)

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex
        request.state.request_id = rid[:64]
        start = time.perf_counter()
        response = await call_next(request)
        ms = round((time.perf_counter() - start) * 1000, 1)
        response.headers["x-request-id"] = request.state.request_id
        response.headers["x-content-type-options"] = "nosniff"
        response.headers["referrer-policy"] = "no-referrer"
        response.headers["cache-control"] = response.headers.get("cache-control", "no-store")
        access.info("req", extra={"request_id": request.state.request_id, "path": request.url.path,
                                  "status": response.status_code, "ms": ms})
        return response

    errors.install(app)
    for r in (health.router, auth.router, registries.router, contributions.router, insights.router,
              public.router, billing.router, admin.router, events.router):
        app.include_router(r)
    return app
