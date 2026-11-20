from __future__ import annotations

import asyncpg
from fastapi import Request

from ..core.errors import NotFound
from ..core.settings import Settings


def pool(request: Request) -> asyncpg.Pool:
    return request.app.state.pool


def settings(request: Request) -> Settings:
    return request.app.state.settings


def http(request: Request):
    return request.app.state.http


async def owned_registry(db: asyncpg.Pool | asyncpg.Connection, registry_id: str, owner_id: str) -> asyncpg.Record:
    row = await db.fetchrow("select * from paisa.registries where id = $1::uuid and owner_id = $2::uuid", registry_id, owner_id)
    if not row:
        raise NotFound("Registry not found.")
    return row


async def audit(db, actor_id: str | None, action: str, entity: str, entity_id: str | None, details: dict | None = None) -> None:
    import json
    await db.execute("insert into paisa.audit_logs(actor_id, action, entity, entity_id, details) values ($1,$2,$3,$4,$5::jsonb)",
                     actor_id, action, entity, entity_id, json.dumps(details or {}))


def rec(row) -> dict:
    """asyncpg Record -> JSON-safe dict."""
    import datetime
    import uuid
    out = {}
    for k, v in dict(row).items():
        if isinstance(v, uuid.UUID):
            v = str(v)
        elif isinstance(v, (datetime.datetime, datetime.date)):
            v = v.isoformat()
        out[k] = v
    return out
