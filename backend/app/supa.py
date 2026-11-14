"""Read the caller's own data through PostgREST *as the caller* — RLS guarantees isolation."""

from __future__ import annotations

from datetime import datetime

import httpx
from fastapi import HTTPException

from .auth import User
from .config import get_settings
from .http import client


def _headers(user: User) -> dict[str, str]:
    s = get_settings()
    return {"apikey": s.supabase_publishable_key, "Authorization": f"Bearer {user.token}", "Accept": "application/json"}


async def fetch_profile(user: User) -> dict | None:
    s = get_settings()
    try:
        r = await client().get(
            f"{s.supabase_url}/rest/v1/pk_profiles", headers=_headers(user), params={"select": "*", "id": f"eq.{user.id}"}
        )
    except httpx.HTTPError as e:
        raise HTTPException(503, "Database unreachable") from e
    if r.status_code != 200:
        raise HTTPException(502, "Profile fetch failed")
    rows = r.json()
    return rows[0] if rows else None


async def fetch_txns(user: User, start: datetime, end: datetime) -> list[dict]:
    s = get_settings()
    out: list[dict] = []
    for page in range(20):
        params = [
            ("select", "amount,category,merchant,occurred_at"),
            ("occurred_at", f"gte.{start.isoformat()}"),
            ("occurred_at", f"lt.{end.isoformat()}"),
            ("order", "occurred_at.asc"),
        ]
        headers = {**_headers(user), "Range-Unit": "items", "Range": f"{page * 1000}-{page * 1000 + 999}"}
        try:
            r = await client().get(f"{s.supabase_url}/rest/v1/pk_transactions", headers=headers, params=params)
        except httpx.HTTPError as e:
            raise HTTPException(503, "Database unreachable") from e
        if r.status_code not in (200, 206):
            raise HTTPException(502, "Transactions fetch failed")
        rows = r.json()
        out.extend(rows)
        if len(rows) < 1000:
            break
    return out
