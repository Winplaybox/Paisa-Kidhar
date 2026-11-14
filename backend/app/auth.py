"""Supabase JWT verification.

We ask Supabase Auth (`GET /auth/v1/user`) to validate the bearer token instead of verifying the
signature locally. This works for both legacy HS256 and new asymmetric signing keys, honours
revocation/sign-out, and needs no secret on this server. Results are cached briefly per token.
"""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass

import httpx
from cachetools import TTLCache
from fastapi import Depends, Header, HTTPException, status

from .config import Settings, get_settings
from .http import client


@dataclass(frozen=True)
class User:
    id: str
    email: str | None
    token: str


_cache: TTLCache[str, User] = TTLCache(maxsize=10_000, ttl=300)
_hits: TTLCache[str, list[float]] = TTLCache(maxsize=50_000, ttl=120)


def _key(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def current_user(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Login required")
    token = authorization.split(" ", 1)[1].strip()
    if len(token) < 20 or len(token) > 8192:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

    k = _key(token)
    user = _cache.get(k)
    if user is None:
        try:
            r = await client().get(
                f"{settings.supabase_url}/auth/v1/user",
                headers={"apikey": settings.supabase_publishable_key, "Authorization": f"Bearer {token}"},
            )
        except httpx.HTTPError as e:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Auth service unreachable") from e
        if r.status_code != 200:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired — sign in again")
        data = r.json()
        user = User(id=data["id"], email=data.get("email"), token=token)
        _cache[k] = user

    _rate_limit(user.id, settings.rate_limit_per_minute)
    return user


def _rate_limit(uid: str, per_minute: int) -> None:
    now = time.monotonic()
    window = [t for t in _hits.get(uid, []) if now - t < 60]
    if len(window) >= per_minute:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Thoda ruk jao — bahut saari requests")
    window.append(now)
    _hits[uid] = window
