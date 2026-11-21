"""Supabase JWT verification, request identity, rate limiting, pledge tokens."""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import time
from collections import defaultdict, deque
from dataclasses import dataclass

import jwt
from fastapi import Depends, Request

from .errors import Forbidden, RateLimited, Unauthorized
from .settings import Settings, get_settings


@dataclass(frozen=True)
class Identity:
    user_id: str
    email: str | None
    name: str | None


class JwtVerifier:
    """One per process (created in lifespan). Supports JWKS (asymmetric) and legacy HS256 projects."""

    def __init__(self, settings: Settings):
        self._settings = settings
        self._jwks = jwt.PyJWKClient(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json", cache_keys=True, lifespan=3600)
        self._issuer = f"{settings.supabase_url}/auth/v1"

    async def verify(self, token: str) -> Identity:
        try:
            header = jwt.get_unverified_header(token)
            alg = header.get("alg", "")
            if alg == "HS256":
                if not self._settings.supabase_jwt_secret:
                    raise Unauthorized("Session not accepted.")
                key = self._settings.supabase_jwt_secret
            elif alg in ("RS256", "ES256"):
                signing_key = await asyncio.to_thread(self._jwks.get_signing_key_from_jwt, token)
                key = signing_key.key
            else:
                raise Unauthorized("Session not accepted.")
            claims = jwt.decode(token, key, algorithms=[alg], audience="authenticated", issuer=self._issuer,
                                options={"require": ["exp", "sub", "iat"]}, leeway=30)
        except Unauthorized:
            raise
        except jwt.PyJWTError as exc:
            raise Unauthorized("Your session has expired. Please sign in again.") from exc
        if claims.get("role") != "authenticated":
            raise Unauthorized("Session not accepted.")
        meta = claims.get("user_metadata") or {}
        return Identity(user_id=str(claims["sub"]), email=claims.get("email"),
                        name=meta.get("full_name") or meta.get("name"))


def _bearer(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip() or None
    return None


async def current_identity(request: Request) -> Identity:
    token = _bearer(request)
    if not token:
        raise Unauthorized("Please sign in.")
    verifier: JwtVerifier = request.app.state.jwt
    return await verifier.verify(token)


async def require_admin(request: Request, ident: Identity = Depends(current_identity)) -> Identity:
    pool = request.app.state.pool
    row = await pool.fetchval("select 1 from paisa.user_roles where user_id = $1 and role = 'admin'", ident.user_id)
    if not row:
        raise Forbidden("Admins only.")
    return ident


class RateLimiter:
    """Sliding-window limiter, per process. Good for a single Render instance; swap for Redis if scaled out."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, limit: int, window_s: float) -> None:
        now = time.monotonic()
        q = self._hits[key]
        while q and now - q[0] > window_s:
            q.popleft()
        if len(q) >= limit:
            raise RateLimited("Too many requests. Please wait a moment and try again.")
        q.append(now)
        if len(self._hits) > 50_000:  # bound memory
            for k in list(self._hits)[:10_000]:
                self._hits.pop(k, None)


def client_ip(request: Request) -> str:
    """Take the entry appended by our own proxy (counted from the right) — the left side is client-controlled."""
    hops = request.app.state.settings.trusted_proxy_hops
    fwd = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",") if p.strip()]
    if hops > 0 and len(fwd) >= hops:
        return fwd[-hops]
    return (request.client.host if request.client else "") or "unknown"


def rate_limit(bucket: str, limit: int, window_s: float):
    async def dep(request: Request) -> None:
        request.app.state.limiter.check(f"{bucket}:{client_ip(request)}", limit, window_s)
    return Depends(dep)


def hash_ip(ip: str, settings: Settings | None = None) -> str:
    s = settings or get_settings()
    return hashlib.sha256(f"{s.ip_hash_salt}:{ip}".encode()).hexdigest()[:32]


def pledge_token(reference: str, settings: Settings | None = None) -> str:
    s = settings or get_settings()
    return hmac.new(s.pledge_token_secret.encode(), f"pledge:{reference}".encode(), hashlib.sha256).hexdigest()


def verify_pledge_token(reference: str, token: str, settings: Settings | None = None) -> bool:
    return hmac.compare_digest(pledge_token(reference, settings), token or "")


def card_edit_key(card_id: str, settings: Settings | None = None) -> str:
    """Capability key handed only to the buyer at checkout; lets them re-style their paid card without paying again."""
    s = settings or get_settings()
    return hmac.new(s.pledge_token_secret.encode(), f"cardedit:{card_id}".encode(), hashlib.sha256).hexdigest()


def verify_card_edit_key(card_id: str, key: str, settings: Settings | None = None) -> bool:
    return hmac.compare_digest(card_edit_key(card_id, settings), key or "")
