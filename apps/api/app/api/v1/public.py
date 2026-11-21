"""Guest-facing endpoints. No login. Only a published, non-moderated registry's public projection is exposed."""
from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends, Header, Request
from pydantic import BaseModel, Field

from ... import domain
from ...core.errors import AppError, NotFound
from ...core.security import client_ip, hash_ip, pledge_token, rate_limit, verify_pledge_token
from ..deps import pool, rec, settings

router = APIRouter(prefix="/v1/public", tags=["public"])


class PledgeIn(BaseModel):
    goal_id: str
    amount_paise: int = Field(ge=domain.MIN_CONTRIBUTION_PAISE, le=domain.MAX_CONTRIBUTION_PAISE)
    guest_name: str | None = Field(default=None, max_length=60)
    guest_message: str | None = Field(default=None, max_length=280)
    is_anonymous: bool = False


class MarkPaidIn(BaseModel):
    token: str = Field(min_length=64, max_length=64)


async def _published(db, slug: str):
    r = await db.fetchrow("select * from paisa.registries where slug=$1 and status='published' and moderation='ok'", slug.lower())
    if not r:
        raise NotFound("This registry isn't available.")
    return r


@router.get("/registries/{slug}", dependencies=[rate_limit("public_read", 120, 60)])
async def public_registry(slug: str, db=Depends(pool)):
    r = await _published(db, slug)
    goals = await db.fetch(
        """select g.id, g.title, g.description, g.category, g.target_paise, g.status, g.target_date,
                  coalesce(sum(c.amount_paise) filter (where c.status='confirmed'),0)::bigint raised_paise,
                  count(c.id) filter (where c.status='confirmed')::int contributions_count
           from paisa.goals g left join paisa.contributions c on c.goal_id=g.id
           where g.registry_id=$1 and g.visibility='public' and g.status in ('active','completed')
           group by g.id order by g.position, g.created_at""", r["id"])
    wishes = await db.fetch(
        """select case when is_anonymous or coalesce(guest_name,'')='' then null else guest_name end as name,
                  guest_message as message, decided_at as at
           from paisa.contributions
           where registry_id=$1 and status='confirmed' and coalesce(guest_message,'')<>''
           order by decided_at desc limit 20""", r["id"])
    show = r["show_progress"]
    out_goals = []
    for g in goals:
        d = rec(g)
        if not show:
            d.pop("raised_paise"), d.pop("contributions_count")
        out_goals.append(d)
    return {
        "slug": r["slug"], "partner_one": r["partner_one"], "partner_two": r["partner_two"],
        "wedding_date": r["wedding_date"].isoformat() if r["wedding_date"] else None, "city": r["city"],
        "story": r["story"], "theme": r["theme"], "show_progress": show, "premium": r["plan"] == "premium",
        "goals": out_goals, "wishes": [rec(w) for w in wishes],
        "suggested_amounts_paise": list(domain.SUGGESTED_AMOUNTS_PAISE),
    }


@router.post("/registries/{slug}/pledges", status_code=201, dependencies=[rate_limit("pledge", 12, 600)])
async def create_pledge(slug: str, body: PledgeIn, request: Request,
                        idempotency_key: str = Header(min_length=8, max_length=80),
                        db=Depends(pool), cfg=Depends(settings)):
    r = await _published(db, slug)
    g = await db.fetchrow("select * from paisa.goals where id=$1::uuid and registry_id=$2 and visibility='public' and status='active'",
                          body.goal_id, r["id"])
    if not g:
        raise AppError("This goal isn't accepting gifts right now.", code="goal_unavailable", status=409)
    amount = domain.validate_contribution_amount(body.amount_paise)
    name = (body.guest_name or "").strip() or None
    message = (body.guest_message or "").strip() or None

    existing = await db.fetchrow("select * from paisa.contributions where registry_id=$1 and idempotency_key=$2", r["id"], idempotency_key)
    row = existing
    if not row:
        for _ in range(5):
            try:
                row = await db.fetchrow(
                    """insert into paisa.contributions(registry_id, goal_id, reference, amount_paise, guest_name, guest_message,
                                                        is_anonymous, idempotency_key, client_ip_hash)
                       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *""",
                    r["id"], g["id"], domain.new_reference(), amount, name, message, body.is_anonymous, idempotency_key,
                    hash_ip(client_ip(request), cfg))
                break
            except asyncpg.UniqueViolationError:
                row = await db.fetchrow("select * from paisa.contributions where registry_id=$1 and idempotency_key=$2", r["id"], idempotency_key)
                if row:
                    break
    if not row:
        raise AppError("Could not start your gift. Please retry.", status=503)
    payee = r["upi_payee_name"] or f"{r['partner_one']} & {r['partner_two']}"
    return {
        "reference": row["reference"], "token": pledge_token(row["reference"], cfg), "status": row["status"],
        "amount_paise": row["amount_paise"], "goal_title": g["title"], "payee_name": payee, "upi_vpa": r["upi_vpa"],
        "upi_link": domain.upi_link(r["upi_vpa"], payee, row["amount_paise"], row["reference"], g["title"]),
    }


@router.post("/pledges/{reference}/mark-paid", dependencies=[rate_limit("mark_paid", 20, 600)])
async def mark_paid(reference: str, body: MarkPaidIn, db=Depends(pool), cfg=Depends(settings)):
    if not verify_pledge_token(reference, body.token, cfg):
        raise NotFound("Gift not found.")
    row = await db.fetchrow("select status from paisa.contributions where reference=$1", reference)
    if not row:
        raise NotFound("Gift not found.")
    if row["status"] == "guest_marked_paid":
        return {"reference": reference, "status": row["status"]}
    if not domain.can_transition("guest", row["status"], "guest_marked_paid"):
        raise AppError("This gift can no longer be updated.", code="invalid_state", status=409)
    new = await db.fetchval("""update paisa.contributions set status='guest_marked_paid', marked_paid_at=now()
                               where reference=$1 and status='pledged' returning status""", reference)
    return {"reference": reference, "status": new or "guest_marked_paid"}


@router.get("/pledges/{reference}", dependencies=[rate_limit("pledge_read", 60, 60)])
async def pledge_status(reference: str, token: str, db=Depends(pool), cfg=Depends(settings)):
    if not verify_pledge_token(reference, token, cfg):
        raise NotFound("Gift not found.")
    row = await db.fetchrow("select reference, status, amount_paise, created_at from paisa.contributions where reference=$1", reference)
    if not row:
        raise NotFound("Gift not found.")
    return rec(row)
