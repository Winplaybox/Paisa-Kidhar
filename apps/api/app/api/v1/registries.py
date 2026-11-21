"""Couple-owned registries and goals. Every query is scoped by owner_id from the verified JWT."""
from __future__ import annotations

import datetime as dt
from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator

from ... import domain
from ...core.errors import AppError, Conflict, NotFound
from ...core.security import Identity, current_identity
from ..deps import audit, owned_registry, pool, rec
from .auth import ensure_profile

router = APIRouter(prefix="/v1", tags=["registries"])

Theme = Literal["rose", "plum", "marigold", "emerald", "ink"]
CATEGORY_KEY = r"^[a-z][a-z0-9_]{1,30}$"


class RegistryIn(BaseModel):
    partner_one: str = Field(min_length=1, max_length=60)
    partner_two: str = Field(min_length=1, max_length=60)
    wedding_date: dt.date | None = None
    city: str | None = Field(default=None, max_length=60)
    story: str = Field(default="", max_length=1200)
    upi_vpa: str | None = None
    upi_payee_name: str | None = Field(default=None, max_length=60)
    theme: Theme = "rose"
    slug: str | None = None
    show_progress: bool = True

    @field_validator("upi_vpa")
    @classmethod
    def _vpa(cls, v):
        return domain.normalize_vpa(v) if v else None

    @field_validator("slug")
    @classmethod
    def _slug(cls, v):
        return domain.normalize_slug(v) if v else None


class RegistryPatch(BaseModel):
    partner_one: str | None = Field(default=None, min_length=1, max_length=60)
    partner_two: str | None = Field(default=None, min_length=1, max_length=60)
    wedding_date: dt.date | None = None
    city: str | None = Field(default=None, max_length=60)
    story: str | None = Field(default=None, max_length=1200)
    upi_vpa: str | None = None
    upi_payee_name: str | None = Field(default=None, max_length=60)
    theme: Theme | None = None
    slug: str | None = None
    show_progress: bool | None = None

    @field_validator("upi_vpa")
    @classmethod
    def _vpa(cls, v):
        return domain.normalize_vpa(v) if v else v

    @field_validator("slug")
    @classmethod
    def _slug(cls, v):
        return domain.normalize_slug(v) if v else v


class GoalIn(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=600)
    category: str = Field(default="other", pattern=CATEGORY_KEY)
    custom_category: str | None = Field(default=None, max_length=40)
    target_rupees: int = Field(ge=100, le=100_000_000)
    target_date: dt.date | None = None
    visibility: Literal["public", "private"] = "public"


class GoalPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=600)
    category: str | None = Field(default=None, pattern=CATEGORY_KEY)
    custom_category: str | None = Field(default=None, max_length=40)
    target_rupees: int | None = Field(default=None, ge=100, le=100_000_000)
    target_date: dt.date | None = None
    visibility: Literal["public", "private"] | None = None
    status: Literal["active", "paused", "archived", "completed"] | None = None


def _clean_custom(category: str | None, custom: str | None) -> str | None:
    """A custom label only makes sense for 'other'; empty means none."""
    custom = " ".join((custom or "").split()) or None
    if custom and len(custom) < 2:
        raise AppError("Category name is too short.", code="invalid_category", status=422)
    return custom if category == "other" else None


async def _check_category(conn, key: str) -> None:
    if not await conn.fetchval("select 1 from paisa.categories where key=$1 and active", key):
        raise AppError("Unknown category.", code="invalid_category", status=422)


class OrderIn(BaseModel):
    goal_ids: list[str] = Field(min_length=1, max_length=100)


GOAL_SELECT = """
select g.*,
       coalesce(sum(c.amount_paise) filter (where c.status = 'confirmed'), 0)::bigint as raised_paise,
       count(c.id) filter (where c.status = 'confirmed')::int as contributions_count,
       count(c.id) filter (where c.status in ('pledged','guest_marked_paid'))::int as pending_count
from paisa.goals g left join paisa.contributions c on c.goal_id = g.id
"""


def registry_out(r) -> dict:
    d = rec(r)
    d["public_path"] = f"/r/{d['slug']}"
    return d


@router.get("/registries")
async def list_registries(ident: Identity = Depends(current_identity), db=Depends(pool)):
    rows = await db.fetch("select * from paisa.registries where owner_id=$1::uuid and status <> 'archived' order by created_at", ident.user_id)
    return {"items": [registry_out(r) for r in rows]}


@router.post("/registries", status_code=201)
async def create_registry(body: RegistryIn, ident: Identity = Depends(current_identity), db=Depends(pool)):
    await ensure_profile(db, ident)
    count = await db.fetchval("select count(*) from paisa.registries where owner_id=$1::uuid and status<>'archived'", ident.user_id)
    if count >= 3:
        raise AppError("You can have up to 3 active registries.", code="limit_reached", status=409)
    # custom links and themes are Premium; a new registry is always free
    base = domain.slugify(body.partner_one, body.partner_two)
    for attempt in range(6):
        slug = base if attempt == 0 else f"{base[:40]}-{domain.new_reference()[-4:].lower()}"
        try:
            row = await db.fetchrow(
                """insert into paisa.registries(owner_id, slug, partner_one, partner_two, wedding_date, city, story,
                                                 upi_vpa, upi_payee_name, theme, show_progress)
                   values ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *""",
                ident.user_id, slug, body.partner_one.strip(), body.partner_two.strip(), body.wedding_date, body.city,
                body.story, body.upi_vpa, body.upi_payee_name, "rose", body.show_progress)
            await audit(db, ident.user_id, "registry.created", "registry", str(row["id"]))
            return registry_out(row)
        except asyncpg.UniqueViolationError:
            continue
    raise Conflict("Could not reserve a link. Please try again.")


@router.get("/registries/{registry_id}")
async def get_registry(registry_id: str, ident: Identity = Depends(current_identity), db=Depends(pool)):
    r = await owned_registry(db, registry_id, ident.user_id)
    goals = await db.fetch(GOAL_SELECT + " where g.registry_id=$1 and g.status<>'archived' group by g.id order by g.position, g.created_at", r["id"])
    return {**registry_out(r), "goals": [rec(g) for g in goals], "goal_limit": domain.goal_limit(r["plan"])}


@router.patch("/registries/{registry_id}")
async def update_registry(registry_id: str, body: RegistryPatch, ident: Identity = Depends(current_identity), db=Depends(pool)):
    r = await owned_registry(db, registry_id, ident.user_id)
    fields = body.model_dump(exclude_unset=True)
    if r["plan"] != "premium":
        if "theme" in fields and fields["theme"] != "rose":
            raise AppError("Themes are part of Premium.", code="premium_required", status=402)
        if "slug" in fields and fields["slug"] and fields["slug"] != r["slug"]:
            raise AppError("Custom links are part of Premium.", code="premium_required", status=402)
    if "slug" in fields and not fields["slug"]:
        fields.pop("slug")
    if r["status"] == "published" and "upi_vpa" in fields and not fields["upi_vpa"]:
        raise AppError("A published registry needs a UPI ID.", code="upi_required", status=422)
    if not fields:
        return registry_out(r)
    cols = list(fields)
    sql = "update paisa.registries set " + ", ".join(f"{c} = ${i + 2}" for i, c in enumerate(cols)) + " where id = $1 returning *"
    try:
        row = await db.fetchrow(sql, r["id"], *[fields[c] for c in cols])
    except asyncpg.UniqueViolationError:
        raise Conflict("That link is already taken.") from None
    await audit(db, ident.user_id, "registry.updated", "registry", registry_id, {"fields": cols})
    return registry_out(row)


async def _set_status(db, registry_id: str, ident: Identity, status: str):
    r = await owned_registry(db, registry_id, ident.user_id)
    if status == "published":
        if not r["upi_vpa"]:
            raise AppError("Add your UPI ID before publishing so guests can send gifts.", code="upi_required", status=422)
        if not await db.fetchval("select 1 from paisa.goals where registry_id=$1 and status='active' and visibility='public'", r["id"]):
            raise AppError("Add at least one public goal before publishing.", code="goal_required", status=422)
    row = await db.fetchrow("update paisa.registries set status=$2 where id=$1 returning *", r["id"], status)
    await audit(db, ident.user_id, f"registry.{status}", "registry", registry_id)
    return registry_out(row)


@router.post("/registries/{registry_id}/publish")
async def publish(registry_id: str, ident: Identity = Depends(current_identity), db=Depends(pool)):
    return await _set_status(db, registry_id, ident, "published")


@router.post("/registries/{registry_id}/pause")
async def pause(registry_id: str, ident: Identity = Depends(current_identity), db=Depends(pool)):
    return await _set_status(db, registry_id, ident, "paused")


@router.delete("/registries/{registry_id}")
async def archive(registry_id: str, ident: Identity = Depends(current_identity), db=Depends(pool)):
    await _set_status(db, registry_id, ident, "archived")
    return {"ok": True}


# ---------- goals ----------
@router.post("/registries/{registry_id}/goals", status_code=201)
async def create_goal(registry_id: str, body: GoalIn, ident: Identity = Depends(current_identity), db=Depends(pool)):
    async with db.acquire() as conn, conn.transaction():
        r = await conn.fetchrow("select * from paisa.registries where id=$1::uuid and owner_id=$2::uuid for update", registry_id, ident.user_id)
        if not r:
            raise NotFound("Registry not found.")
        n = await conn.fetchval("select count(*) from paisa.goals where registry_id=$1 and status<>'archived'", r["id"])
        if n >= domain.goal_limit(r["plan"]):
            raise AppError(f"Free registries can have {domain.FREE_PLAN_GOAL_LIMIT} goals. Upgrade to Premium for more.",
                           code="premium_required", status=402)
        await _check_category(conn, body.category)
        pos = await conn.fetchval("select coalesce(max(position),-1)+1 from paisa.goals where registry_id=$1", r["id"])
        g = await conn.fetchrow(
            """insert into paisa.goals(registry_id,title,description,category,custom_category,target_paise,target_date,visibility,position)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *""",
            r["id"], body.title.strip(), body.description, body.category, _clean_custom(body.category, body.custom_category),
            domain.rupees_to_paise(body.target_rupees), body.target_date, body.visibility, pos)
    return {**rec(g), "raised_paise": 0, "contributions_count": 0, "pending_count": 0}


async def _owned_goal(db, goal_id: str, owner_id: str):
    g = await db.fetchrow("""select g.* from paisa.goals g join paisa.registries r on r.id=g.registry_id
                             where g.id=$1::uuid and r.owner_id=$2::uuid""", goal_id, owner_id)
    if not g:
        raise NotFound("Goal not found.")
    return g


@router.patch("/goals/{goal_id}")
async def update_goal(goal_id: str, body: GoalPatch, ident: Identity = Depends(current_identity), db=Depends(pool)):
    g = await _owned_goal(db, goal_id, ident.user_id)
    fields = body.model_dump(exclude_unset=True)
    if fields.get("status") in ("active", "paused", "completed") and g["status"] == "archived":
        r = await db.fetchrow("select plan from paisa.registries where id=$1", g["registry_id"])
        n = await db.fetchval("select count(*) from paisa.goals where registry_id=$1 and status<>'archived'", g["registry_id"])
        if n >= domain.goal_limit(r["plan"]):
            raise AppError("Goal limit reached for this plan.", code="premium_required", status=402)
    if "category" in fields or "custom_category" in fields:
        cat = fields.get("category") or g["category"]
        if "category" in fields:
            await _check_category(db, cat)
        fields["custom_category"] = _clean_custom(cat, fields.get("custom_category", g["custom_category"]))
    if "target_rupees" in fields:
        fields["target_paise"] = domain.rupees_to_paise(fields.pop("target_rupees"))
    if not fields:
        return rec(g)
    cols = list(fields)
    sql = "update paisa.goals set " + ", ".join(f"{c} = ${i + 2}" for i, c in enumerate(cols)) + " where id=$1 returning *"
    row = await db.fetchrow(sql, g["id"], *[fields[c] for c in cols])
    return rec(row)


@router.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str, ident: Identity = Depends(current_identity), db=Depends(pool)):
    g = await _owned_goal(db, goal_id, ident.user_id)
    has_money = await db.fetchval("select 1 from paisa.contributions where goal_id=$1 limit 1", g["id"])
    if has_money:  # keep the ledger intact; hide instead of deleting
        await db.execute("update paisa.goals set status='archived' where id=$1", g["id"])
    else:
        await db.execute("delete from paisa.goals where id=$1", g["id"])
    return {"ok": True}


@router.put("/registries/{registry_id}/goals/order")
async def reorder(registry_id: str, body: OrderIn, ident: Identity = Depends(current_identity), db=Depends(pool)):
    r = await owned_registry(db, registry_id, ident.user_id)
    async with db.acquire() as conn, conn.transaction():
        for i, gid in enumerate(body.goal_ids):
            await conn.execute("update paisa.goals set position=$3 where id=$1::uuid and registry_id=$2", gid, r["id"], i)
    return {"ok": True}
