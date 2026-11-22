"""Platform admin. Role comes only from paisa.user_roles (granted via SQL editor), never from user metadata."""
from __future__ import annotations

import re
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from ...core.errors import NotFound
from ...core.security import Identity, require_admin
from ..deps import audit, pool, rec

router = APIRouter(prefix="/v1/admin", tags=["admin"])


class ModerationIn(BaseModel):
    action: Literal["hide", "unhide"]
    reason: str = ""


@router.get("/metrics")
async def metrics(admin: Identity = Depends(require_admin), db=Depends(pool)):
    row = await db.fetchrow("""select
        (select count(*) from paisa.profiles)::int users,
        (select count(*) from paisa.profiles where created_at > now()-interval '7 days')::int new_users_7d,
        (select count(distinct owner_id) from paisa.registries where status<>'archived')::int active_couples,
        (select count(*) from paisa.registries where status='published')::int published_registries,
        (select count(*) from paisa.registries where plan='premium')::int premium_registries,
        (select count(*) from paisa.goals where status<>'archived')::int goals,
        (select count(*) from paisa.contributions where status='confirmed')::int confirmed_gifts,
        (select coalesce(sum(amount_paise),0) from paisa.contributions where status='confirmed')::bigint confirmed_paise,
        (select coalesce(sum(amount_paise),0) from paisa.orders where status='succeeded')::bigint premium_revenue_paise""")
    signups = await db.fetch("""select to_char(date_trunc('week', created_at),'YYYY-MM-DD') as week, count(*)::int n
                                from paisa.profiles where created_at > now()-interval '12 weeks' group by 1 order by 1""")
    states = await db.fetch("select status, count(*)::int n from paisa.contributions group by 1")
    return {"totals": dict(row), "weekly_signups": [dict(s) for s in signups], "contribution_states": [dict(s) for s in states]}


@router.get("/registries")
async def search(q: str = Query("", max_length=60), limit: int = Query(50, le=200),
                 admin: Identity = Depends(require_admin), db=Depends(pool)):
    rows = await db.fetch("""select r.id, r.slug, r.partner_one, r.partner_two, r.status, r.plan, r.moderation, r.created_at,
                                    p.username owner_username
                             from paisa.registries r left join paisa.profiles p on p.user_id=r.owner_id
                             where $1 = '' or r.slug ilike '%'||$1||'%' or r.partner_one ilike '%'||$1||'%'
                                   or r.partner_two ilike '%'||$1||'%' or p.username ilike '%'||$1||'%'
                             order by r.created_at desc limit $2""", q.strip(), limit)
    return {"items": [rec(r) for r in rows]}


@router.post("/registries/{registry_id}/moderation")
async def moderate(registry_id: str, body: ModerationIn, admin: Identity = Depends(require_admin), db=Depends(pool)):
    row = await db.fetchrow("update paisa.registries set moderation=$2 where id=$1::uuid returning id, slug, moderation",
                            registry_id, "hidden" if body.action == "hide" else "ok")
    if not row:
        raise NotFound("Registry not found.")
    await audit(db, admin.user_id, f"admin.registry_{body.action}", "registry", registry_id, {"reason": body.reason[:200]})
    return rec(row)


@router.get("/audit")
async def audit_log(limit: int = Query(100, le=500), admin: Identity = Depends(require_admin), db=Depends(pool)):
    rows = await db.fetch("select * from paisa.audit_logs order by created_at desc limit $1", limit)
    return {"items": [rec(r) for r in rows]}


class ConfigIn(BaseModel):
    value: Any


@router.put("/config/{key}")
async def set_config(key: str, body: ConfigIn, admin: Identity = Depends(require_admin), db=Depends(pool)):
    """Change a server-driven app setting live (announcement, flags, min_version, maintenance, legal)."""
    import json
    if not re.fullmatch(r"[a-z_]{1,40}", key) or key not in {"announcement", "maintenance", "min_version", "flags", "legal"}:
        raise NotFound("Unknown config key.")
    if len(json.dumps(body.value)) > 60_000:
        from ...core.errors import AppError
        raise AppError("Config value too large.", status=422, code="config_too_large")
    await db.execute("""insert into paisa.app_config(key, value) values ($1, $2::jsonb)
                        on conflict (key) do update set value = excluded.value, updated_at = now()""", key, json.dumps(body.value))
    await audit(db, admin.user_id, "admin.config_set", "app_config", key, {})
    return {"ok": True}
