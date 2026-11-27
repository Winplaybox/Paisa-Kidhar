"""Guest-facing endpoints. No login. Only a published, non-moderated registry's public projection is exposed."""
from __future__ import annotations

import datetime as dt

import asyncpg
from fastapi import APIRouter, Depends, Header, Request, Response
from pydantic import BaseModel, Field

from ... import domain
from ...core.errors import AppError, NotFound
from ...core.security import card_edit_key, client_ip, hash_ip, pledge_token, rate_limit, verify_card_edit_key, verify_pledge_token
from ..deps import http, pool, rec, settings

router = APIRouter(prefix="/v1/public", tags=["public"])


class PledgeIn(BaseModel):
    goal_id: str
    amount_paise: int = Field(ge=domain.MIN_CONTRIBUTION_PAISE, le=domain.MAX_CONTRIBUTION_PAISE)
    guest_name: str | None = Field(default=None, max_length=60)
    guest_message: str | None = Field(default=None, max_length=280)
    is_anonymous: bool = False


class MarkPaidIn(BaseModel):
    token: str = Field(min_length=64, max_length=64)


class CardStyle(BaseModel):
    """Everything the buyer can personalise. `design` is the legacy name of `template` (old app builds still send it)."""
    template: str | None = Field(default=None, max_length=32)
    design: str | None = Field(default=None, max_length=32)
    occasion: str | None = Field(default=None, max_length=24)
    palette: int | None = Field(default=None, ge=0, le=domain.CARD_PALETTES - 1)
    lang: str | None = Field(default=None, max_length=2)
    recipient: str | None = Field(default=None, max_length=80)
    event_date: dt.date | None = None
    sender: str | None = Field(default=None, max_length=60)
    blessing: str | None = Field(default=None, max_length=280)


class CardRewardIn(CardStyle):
    token: str = Field(min_length=64, max_length=64)


class CardCheckoutIn(CardRewardIn):
    email: str = Field(min_length=5, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")


class FeedbackIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    message: str | None = Field(default=None, max_length=1000)
    email: str | None = Field(default=None, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
    app_version: str | None = Field(default=None, max_length=20)
    platform: str | None = Field(default=None, pattern=r"^(android|ios|web)$")
    lang: str | None = Field(default=None, pattern=r"^(en|hi|gu|mr)$")


class CardEditIn(CardStyle):
    edit_key: str = Field(min_length=64, max_length=64)


def _validated_style(b: CardStyle) -> dict:
    """Validate the catalogue choices and clean the free text. Returns only the fields the caller actually sent."""
    out: dict = {}
    template = b.template or b.design
    if template is not None:
        if template not in domain.CARD_TEMPLATES:
            raise AppError("Pick a card design.", code="invalid_design", status=422)
        out["design"] = template
    if b.occasion is not None:
        if b.occasion not in domain.CARD_OCCASIONS:
            raise AppError("Pick an occasion.", code="invalid_occasion", status=422)
        out["occasion"] = b.occasion
    if b.palette is not None:
        out["palette"] = b.palette
    if b.lang is not None:
        if b.lang not in domain.CARD_LANGS:
            raise AppError("Pick a card language.", code="invalid_lang", status=422)
        out["lang"] = b.lang
    if "recipient" in b.model_fields_set:
        out["recipient"] = domain.clean_text(b.recipient, 80)
    if "sender" in b.model_fields_set:
        out["sender_name"] = domain.clean_text(b.sender, 60)
    if "blessing" in b.model_fields_set:
        out["blessing"] = domain.clean_text(b.blessing, 280, multiline=True)
    if "event_date" in b.model_fields_set:
        out["event_date"] = b.event_date
    return out


async def _published(db, slug: str):
    r = await db.fetchrow("select * from paisa.registries where slug=$1 and status='published' and moderation='ok'", slug.lower())
    if not r:
        raise NotFound("This registry isn't available.")
    return r


@router.get("/categories", dependencies=[rate_limit("public_read", 120, 60)])
async def categories(db=Depends(pool)):
    rows = await db.fetch("select key, label, icon from paisa.categories where active order by position, label")
    return {"categories": [dict(r) for r in rows]}


@router.get("/registries/{slug}", dependencies=[rate_limit("public_read", 120, 60)])
async def public_registry(slug: str, db=Depends(pool)):
    r = await _published(db, slug)
    goals = await db.fetch(
        """select g.id, g.title, g.description, g.category, g.custom_category, g.target_paise, g.status, g.target_date,
                  coalesce(sum(c.amount_paise) filter (where c.status='confirmed'),0)::bigint raised_paise,
                  count(c.id) filter (where c.status='confirmed')::int contributions_count
           from paisa.goals g left join paisa.contributions c on c.goal_id=g.id
           where g.registry_id=$1 and g.visibility='public' and g.status in ('active','completed')
           group by g.id order by g.position, g.created_at""", r["id"])
    wishes = await db.fetch(
        """select case when c.is_anonymous or coalesce(c.guest_name,'')='' then null else c.guest_name end as name,
                  c.guest_message as message, c.decided_at as at,
                  exists(select 1 from paisa.card_orders k where k.contribution_id=c.id and k.status='succeeded') as card
           from paisa.contributions c
           where c.registry_id=$1 and c.status='confirmed' and coalesce(c.guest_message,'')<>''
           order by c.decided_at desc limit 20""", r["id"])
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


async def _lock_card_gift(conn, reference):
    c = await conn.fetchrow("""select c.*, r.status as registry_status, r.plan, r.moderation
                                from paisa.contributions c join paisa.registries r on r.id=c.registry_id
                                where c.reference=$1 for update of c""", reference)
    if not c or c["status"] == "rejected" or c["registry_status"] != "published":
        raise AppError("This gift can't get a card.", code="invalid_state", status=409)
    return c


async def _create_card_order(conn, gift, style, provider, amount, email=None):
    return await conn.fetchrow(
        """insert into paisa.card_orders(contribution_id, registry_id, design, occasion, palette, lang, recipient,
                                         event_date, sender_name, blessing, provider, amount_paise, buyer_email)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           on conflict (contribution_id) where provider = 'admob_reward' do update
           set design=excluded.design, occasion=excluded.occasion, palette=excluded.palette, lang=excluded.lang,
               recipient=excluded.recipient, event_date=excluded.event_date, sender_name=excluded.sender_name, blessing=excluded.blessing
           where card_orders.status='created' returning *""",
        gift["id"], gift["registry_id"], style.get("design", "marigold"), style.get("occasion", "wedding"),
        style.get("palette", 0), style.get("lang", "en"), style.get("recipient"), style.get("event_date"),
        style.get("sender_name"), style.get("blessing"), provider, amount, email,
    )


@router.post("/pledges/{reference}/card-reward", dependencies=[rate_limit("card_reward", 10, 600)])
async def card_reward(reference: str, body: CardRewardIn, db=Depends(pool), cfg=Depends(settings)):
    if not verify_pledge_token(reference, body.token, cfg):
        raise NotFound("Gift not found.")
    if not cfg.admob_rewarded_ad_unit_id:
        raise AppError("Rewarded cards aren't available yet.", code="rewards_disabled", status=503)
    style = _validated_style(body)
    async with db.acquire() as conn, conn.transaction():
        gift = await _lock_card_gift(conn, reference)
        if gift["status"] not in ("guest_marked_paid", "confirmed") or gift["plan"] == "premium" or gift["moderation"] != "ok":
            raise AppError("This gift can't get a rewarded card.", code="invalid_state", status=409)
        order = await conn.fetchrow(
            "select id, provider, status from paisa.card_orders where contribution_id=$1 and status='succeeded'", gift["id"],
        )
        if order and order["provider"] != "admob_reward":
            raise AppError("You already sent a card with this gift.", code="already_sent", status=409)
        if not order:
            if await conn.fetchval(
                """select 1 from paisa.card_orders where contribution_id=$1 and provider='dodo'
                   and (status='created' or (provider_session_id is not null and status != 'refunded'))""", gift["id"],
            ):
                raise AppError("A paid checkout is already pending for this gift.", code="checkout_pending", status=409)
            order = await _create_card_order(conn, gift, style, "admob_reward", 0)
    card_id = str(order["id"])
    return {"card_id": card_id, "edit_key": card_edit_key(card_id, cfg), "reward_user_id": str(gift["id"]), "status": order["status"]}


@router.post("/pledges/{reference}/card-checkout", dependencies=[rate_limit("card_checkout", 10, 600)])
async def card_checkout(reference: str, body: CardCheckoutIn, db=Depends(pool), cfg=Depends(settings), client=Depends(http)):
    """Guest buys a ₹49 Digital Shagun Card (a digital product sold by the platform). Gift money is untouched."""
    if not verify_pledge_token(reference, body.token, cfg):
        raise NotFound("Gift not found.")
    if not (cfg.payments_enabled and cfg.dodo_shagun_card_product_id):
        raise AppError("Shagun cards aren't available yet.", code="payments_disabled", status=503)
    style = _validated_style(body)
    async with db.acquire() as conn, conn.transaction():
        c = await _lock_card_gift(conn, reference)
        if await conn.fetchval("select 1 from paisa.card_orders where contribution_id=$1 and status='succeeded'", c["id"]):
            raise AppError("You already sent a card with this gift.", code="already_sent", status=409)
        order = await _create_card_order(conn, c, style, "dodo", cfg.shagun_card_price_paise, body.email.strip().lower())
    payload = {
        "product_cart": [{"product_id": cfg.dodo_shagun_card_product_id, "quantity": 1}],
        "customer": {"email": body.email.strip().lower(), "name": (c["guest_name"] or "Guest")[:60]},
        "billing_currency": "INR",
        "billing_address": {"country": "IN"},
        "return_url": f"{cfg.public_web_url}/card/{order['id']}",
        "metadata": {"app": "paisa_kidhar", "kind": "shagun_card", "order_id": str(order["id"]), "reference": reference},
    }
    res = await client.post(f"{cfg.dodo_base_url}/checkouts", json=payload, headers={"authorization": f"Bearer {cfg.dodo_payments_api_key}"})
    if res.status_code >= 300:
        await db.execute("update paisa.card_orders set status='failed' where id=$1", order["id"])
        raise AppError("Payment page couldn't be opened. Please try again.", code="checkout_failed", status=502)
    data = res.json()
    await db.execute("update paisa.card_orders set provider_session_id=$2 where id=$1", order["id"], data.get("session_id"))
    return {"card_id": str(order["id"]), "checkout_url": data.get("checkout_url"), "edit_key": card_edit_key(str(order["id"]), cfg)}


_CARD_SELECT = """select k.id, k.status, k.provider, k.design, k.occasion, k.palette, k.lang, k.recipient, k.event_date, k.sender_name, k.blessing,
                         k.created_at, c.guest_name, c.guest_message, c.is_anonymous,
                         r.partner_one, r.partner_two, r.wedding_date, r.city, r.slug, r.theme
                  from paisa.card_orders k join paisa.contributions c on c.id=k.contribution_id
                  join paisa.registries r on r.id=k.registry_id
                  where k.id=$1::uuid and r.moderation='ok'"""


def _card_out(k) -> dict:
    sender = k["sender_name"] or (None if k["is_anonymous"] else (k["guest_name"] or None))
    event = k["event_date"] or k["wedding_date"]
    return {
        "id": str(k["id"]), "status": "succeeded", "design": k["design"], "occasion": k["occasion"], "palette": k["palette"],
        "lang": k["lang"], "recipient": k["recipient"], "from": sender, "message": k["blessing"] or k["guest_message"],
        "partner_one": k["partner_one"], "partner_two": k["partner_two"], "slug": k["slug"], "theme": k["theme"],
        "wedding_date": event.isoformat() if event else None, "city": k["city"],
    }


@router.get("/cards/{card_id}", dependencies=[rate_limit("card_read", 60, 60)])
async def get_card(card_id: str, db=Depends(pool)):
    try:
        k = await db.fetchrow(_CARD_SELECT, card_id)
    except asyncpg.DataError:
        raise NotFound("Card not found.") from None
    if not k:
        raise NotFound("Card not found.")
    if k["status"] != "succeeded":
        pending = {"id": str(k["id"]), "status": k["status"]}
        if k["provider"] == "admob_reward":
            pending["source"] = "admob_reward"
        return pending
    return _card_out(k)


@router.patch("/cards/{card_id}", dependencies=[rate_limit("card_edit", 30, 600)])
async def edit_card(card_id: str, body: CardEditIn, db=Depends(pool), cfg=Depends(settings)):
    """The buyer re-styles their paid card (design, colours, language, text) — the ₹49 unlocks the whole collection."""
    if not verify_card_edit_key(card_id, body.edit_key, cfg):
        raise NotFound("Card not found.")
    changes = _validated_style(body)
    async with db.acquire() as conn, conn.transaction():
        k = await conn.fetchrow("select status, edit_count from paisa.card_orders where id=$1::uuid for update", card_id)
        if not k:
            raise NotFound("Card not found.")
        if k["status"] != "succeeded":
            raise AppError("Your card isn't ready yet.", code="invalid_state", status=409)
        if k["edit_count"] >= 50:
            raise AppError("You've reached the edit limit for this card.", code="edit_limit", status=429)
        if changes:
            cols = list(changes)
            sets = ", ".join(f"{c}=${i + 2}" for i, c in enumerate(cols))  # column names come from our fixed allow-list above
            await conn.execute(f"update paisa.card_orders set {sets}, edit_count=edit_count+1 where id=$1::uuid", card_id, *changes.values())
        out = await conn.fetchrow(_CARD_SELECT, card_id)
    return _card_out(out)


@router.post("/feedback", status_code=201, dependencies=[rate_limit("feedback", 5, 3600)])
async def send_feedback(body: FeedbackIn, db=Depends(pool)):
    """Rating + optional note from the app's Settings screen. No login needed so a locked-out user can still reach us."""
    message = domain.clean_text(body.message, 1000) if body.message else None
    await db.execute(
        "insert into paisa.app_feedback (rating, message, email, app_version, platform, lang) values ($1,$2,$3,$4,$5,$6)",
        body.rating, message or None, body.email, body.app_version, body.platform, body.lang)
    return {"ok": True}


CONFIG_DEFAULTS = {
    "announcement": {"active": False, "id": "none", "level": "info", "text": {"en": ""}, "url": None},
    "maintenance": {"on": False, "text": {"en": ""}},
    "min_version": {"android": "1.0.0"},
    "flags": {"shagun_cards": True, "premium": True, "feedback": True, "ads": True},
    "legal": {},
}


@router.get("/config", dependencies=[rate_limit("config", 120, 60)])
async def app_config(response: Response, db=Depends(pool)):
    """Server-driven app config (announcement, flags, force-update, maintenance, legal text overrides)."""
    import json
    rows = await db.fetch("select key, value from paisa.app_config")
    out = {k: v for k, v in CONFIG_DEFAULTS.items()}
    for r in rows:
        v = r["value"]
        out[r["key"]] = json.loads(v) if isinstance(v, str) else v
    response.headers["Cache-Control"] = "public, max-age=60"
    return out
