"""Integration fixtures: a real Postgres with a stub `auth` schema + the production migration.

The API connects as the least-privileged `paisa_api` role, so grants and RLS are exercised for real.
Set TEST_DATABASE_URL to a superuser DSN of a throwaway database (CI uses a postgres:16 service).
"""
from __future__ import annotations

import base64
import json
import os
import pathlib
import time
import uuid

import asyncpg
import httpx
import jwt
import pytest

from app.core.settings import Settings
from app.main import create_app

ROOT = pathlib.Path(__file__).resolve().parents[3]
MIGRATIONS = sorted((ROOT / "supabase" / "migrations").glob("*.sql"))
ADMIN_DSN = os.environ.get("TEST_DATABASE_URL")
JWT_SECRET = "test-jwt-secret-test-jwt-secret-1234"
WEBHOOK_KEY = "whsec_" + base64.b64encode(b"super-secret-webhook-key-32bytes!").decode()

pytestmark = pytest.mark.skipif(not ADMIN_DSN, reason="TEST_DATABASE_URL not set")

BOOTSTRAP = """
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
"""


@pytest.fixture(scope="session")
async def api_dsn():
    if not ADMIN_DSN:
        pytest.skip("TEST_DATABASE_URL not set")
    conn = await asyncpg.connect(ADMIN_DSN)
    await conn.execute("drop schema if exists paisa cascade")
    await conn.execute(BOOTSTRAP)
    for m in MIGRATIONS:
        await conn.execute(m.read_text())
    await conn.execute("alter role paisa_api with login password 'paisa_test'")
    await conn.close()
    u = httpx.URL(ADMIN_DSN)
    return f"postgresql://paisa_api:paisa_test@{u.host}:{u.port or 5432}{u.path}"


class FakeUpstream:
    """Stands in for Supabase Auth + Dodo APIs."""

    def __init__(self):
        self.users: dict[str, str] = {}  # email -> password
        self.payments: dict[str, dict] = {}
        self.checkouts: list[dict] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if "/auth/v1/token" in url:
            body = json.loads(request.content)
            if self.users.get(body["email"]) == body["password"]:
                return httpx.Response(200, json={"access_token": "at", "refresh_token": "rt", "expires_in": 3600,
                                                 "expires_at": 1, "token_type": "bearer"})
            return httpx.Response(400, json={"error_description": "Invalid login credentials"})
        if url.endswith("/checkouts"):
            body = json.loads(request.content)
            self.checkouts.append(body)
            return httpx.Response(200, json={"session_id": f"cks_{len(self.checkouts)}", "checkout_url": "https://test.checkout/x"})
        if "/payments/" in url:
            pid = url.rsplit("/", 1)[1]
            return httpx.Response(200, json=self.payments[pid]) if pid in self.payments else httpx.Response(404)
        return httpx.Response(404)


@pytest.fixture(scope="session")
def upstream():
    return FakeUpstream()


@pytest.fixture(scope="session")
def settings(api_dsn):
    return Settings(environment="test", supabase_url="http://localhost:54321", supabase_anon_key="anon",
                    supabase_jwt_secret=JWT_SECRET, database_url=api_dsn, pledge_token_secret="p" * 40,
                    ip_hash_salt="s" * 20, payments_enabled=True, dodo_payments_api_key="dodo_test",
                    dodo_payments_webhook_key=WEBHOOK_KEY, dodo_premium_product_id="pdt_premium",
                    cors_origins="http://localhost:8081")


@pytest.fixture(scope="session")
async def client(settings, api_dsn, upstream):
    async def pool_factory():
        return await asyncpg.create_pool(api_dsn, min_size=1, max_size=4,
                                         init=lambda c: c.execute("set search_path = paisa, public"))
    app = create_app(settings, pool_factory=pool_factory,
                     http_factory=lambda: httpx.AsyncClient(transport=httpx.MockTransport(upstream.handler)))
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
            yield c


@pytest.fixture
async def admin_conn():
    conn = await asyncpg.connect(ADMIN_DSN)
    yield conn
    await conn.close()


@pytest.fixture
async def make_user(admin_conn):
    async def _make(name="Riya Sharma", email=None):
        uid = str(uuid.uuid4())
        email = email or f"{uid[:8]}@example.com"
        await admin_conn.execute("insert into auth.users(id, email) values ($1::uuid, $2)", uid, email)
        now = int(time.time())
        token = jwt.encode({"sub": uid, "email": email, "role": "authenticated", "aud": "authenticated",
                            "iss": "http://localhost:54321/auth/v1", "iat": now, "exp": now + 3600,
                            "user_metadata": {"full_name": name}}, JWT_SECRET, algorithm="HS256")
        return {"id": uid, "email": email, "h": {"authorization": f"Bearer {token}"}}
    return _make
