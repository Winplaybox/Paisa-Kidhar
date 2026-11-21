"""Couple view of gifts: list, filter, confirm/reject (the only path to 'confirmed'), CSV export."""
from __future__ import annotations

import csv
import datetime as dt
import io
from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ... import domain
from ...core.errors import AppError, NotFound
from ...core.security import Identity, current_identity
from ..deps import audit, owned_registry, pool, rec

router = APIRouter(prefix="/v1", tags=["contributions"])

Status = Literal["pledged", "guest_marked_paid", "confirmed", "rejected", "expired"]


class DecisionIn(BaseModel):
    decision: Literal["confirmed", "rejected"]


def _filters(registry_id, status, goal_id, date_from, date_to):
    where, args = ["c.registry_id = $1"], [registry_id]
    if status:
        args.append(status)
        where.append(f"c.status = ${len(args)}")
    if goal_id:
        args.append(goal_id)
        where.append(f"c.goal_id = ${len(args)}::uuid")
    if date_from:
        args.append(date_from)
        where.append(f"c.created_at >= ${len(args)}::date")
    if date_to:
        args.append(date_to)
        where.append(f"c.created_at < (${len(args)}::date + 1)")
    return " and ".join(where), args


@router.get("/registries/{registry_id}/contributions")
async def list_contributions(registry_id: str, status: Status | None = None, goal_id: str | None = None,
                             date_from: dt.date | None = Query(None, alias="from"), date_to: dt.date | None = Query(None, alias="to"),
                             limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
                             ident: Identity = Depends(current_identity), db=Depends(pool)):
    r = await owned_registry(db, registry_id, ident.user_id)
    where, args = _filters(r["id"], status, goal_id, date_from, date_to)
    rows = await db.fetch(f"""select c.id, c.reference, c.goal_id, g.title goal_title, c.amount_paise, c.currency, c.guest_name,
                                     c.guest_message, c.is_anonymous, c.status, c.created_at, c.marked_paid_at, c.decided_at,
                                     exists(select 1 from paisa.card_orders k where k.contribution_id=c.id and k.status='succeeded') as card
                              from paisa.contributions c join paisa.goals g on g.id=c.goal_id
                              where {where} order by c.created_at desc limit {limit} offset {offset}""", *args)
    total = await db.fetchval(f"select count(*) from paisa.contributions c where {where}", *args)
    return {"items": [rec(x) for x in rows], "total": total}


@router.post("/contributions/{contribution_id}/decision")
async def decide(contribution_id: str, body: DecisionIn, ident: Identity = Depends(current_identity), db=Depends(pool)):
    async with db.acquire() as conn, conn.transaction():
        c = await conn.fetchrow("""select c.* from paisa.contributions c join paisa.registries r on r.id=c.registry_id
                                   where c.id=$1::uuid and r.owner_id=$2::uuid for update of c""", contribution_id, ident.user_id)
        if not c:
            raise NotFound("Gift not found.")
        if c["status"] == body.decision:
            return rec(c)
        if not domain.can_transition("owner", c["status"], body.decision):
            raise AppError("This gift can't be changed to that status.", code="invalid_state", status=409)
        row = await conn.fetchrow("""update paisa.contributions set status=$2, decided_at=now(), decided_by=$3::uuid
                                     where id=$1 returning *""", c["id"], body.decision, ident.user_id)
        await audit(conn, ident.user_id, f"contribution.{body.decision}", "contribution", contribution_id,
                    {"from": c["status"], "amount_paise": c["amount_paise"]})
        if body.decision == "confirmed":  # auto-complete goal when fully funded
            await conn.execute("""update paisa.goals g set status='completed'
                                  where g.id=$1 and g.status='active' and g.target_paise <=
                                  (select coalesce(sum(amount_paise),0) from paisa.contributions where goal_id=$1 and status='confirmed')""",
                               c["goal_id"])
    return rec(row)


def _csv_safe(v) -> str:
    s = "" if v is None else str(v)
    return "'" + s if s[:1] in ("=", "+", "-", "@", "\t", "\r") else s  # CSV/formula injection guard


@router.get("/registries/{registry_id}/contributions.csv")
async def export_csv(registry_id: str, ident: Identity = Depends(current_identity), db=Depends(pool)):
    r = await owned_registry(db, registry_id, ident.user_id)
    rows = await db.fetch("""select c.reference, g.title, c.amount_paise, c.status, c.is_anonymous, c.guest_name, c.guest_message,
                                    c.created_at, c.decided_at
                             from paisa.contributions c join paisa.goals g on g.id=c.goal_id
                             where c.registry_id=$1 order by c.created_at""", r["id"])
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["reference", "goal", "amount_inr", "status", "from", "message", "created_at", "decided_at"])
    for x in rows:
        who = "Anonymous" if x["is_anonymous"] else (x["guest_name"] or "")
        w.writerow([x["reference"], _csv_safe(x["title"]), domain.paise_to_upi_amount(x["amount_paise"]), x["status"],
                    _csv_safe(who), _csv_safe(x["guest_message"]), x["created_at"].isoformat(),
                    x["decided_at"].isoformat() if x["decided_at"] else ""])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"content-disposition": f'attachment; filename="{r["slug"]}-gifts.csv"'})
