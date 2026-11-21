"""Premium Registry plan via Dodo Payments (a digital product the platform sells to the couple).

Guest gifts never go through Dodo — they are direct UPI transfers to the couple.
Premium is activated ONLY after a signature-verified webhook AND an authoritative re-fetch of the payment.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import time

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ... import domain
from ...core.errors import AppError, NotFound
from ...core.security import Identity, current_identity, rate_limit
from ...core.settings import Settings
from ..deps import audit, http, owned_registry, pool, rec, settings
from .auth import ensure_profile

log = logging.getLogger("paisa.billing")
router = APIRouter(prefix="/v1", tags=["billing"])
WEBHOOK_TOLERANCE_S = 300
APP_TAG = "paisa_kidhar"
ORDER_TABLES = {"premium": "paisa.orders", "shagun_card": "paisa.card_orders"}  # fixed identifiers, never user input


class CheckoutIn(BaseModel):
    registry_id: str


@router.get("/billing/plans")
async def plans(cfg: Settings = Depends(settings)):
    return {"payments_enabled": cfg.payments_enabled, "plans": [{
        "code": "premium_registry", "name": "Premium Registry", "price_paise": cfg.premium_price_paise, "currency": "INR",
        "billing": "one-time, per registry",
        "features": ["Up to 50 goals", "5 premium themes", "No ads for you or your guests", "Custom registry link",
                     "Full insights + CSV export"]}],
        "shagun_card": {"enabled": cfg.payments_enabled and bool(cfg.dodo_shagun_card_product_id),
                        "price_paise": cfg.shagun_card_price_paise, "designs": list(domain.CARD_TEMPLATES),
                        "occasions": list(domain.CARD_OCCASIONS), "languages": list(domain.CARD_LANGS)}}


@router.post("/billing/checkout", dependencies=[rate_limit("checkout", 10, 600)])
async def checkout(body: CheckoutIn, ident: Identity = Depends(current_identity), db=Depends(pool),
                   cfg: Settings = Depends(settings), client=Depends(http)):
    if not cfg.payments_enabled:
        raise AppError("Premium checkout isn't open yet.", code="payments_disabled", status=503)
    r = await owned_registry(db, body.registry_id, ident.user_id)
    if r["plan"] == "premium":
        raise AppError("This registry is already Premium.", code="already_premium", status=409)
    profile = await ensure_profile(db, ident)
    order = await db.fetchrow("""insert into paisa.orders(owner_id, registry_id, plan_code, amount_paise)
                                 values ($1::uuid,$2,'premium_registry',$3) returning *""",
                              ident.user_id, r["id"], cfg.premium_price_paise)
    payload = {
        "product_cart": [{"product_id": cfg.dodo_premium_product_id, "quantity": 1}],
        "customer": {"email": profile["email"] or ident.email, "name": profile["display_name"] or profile["username"]},
        "billing_currency": "INR",
        "billing_address": {"country": "IN"},
        "return_url": f"{cfg.checkout_return_url}?order={order['id']}",
        "metadata": {"app": APP_TAG, "kind": "premium", "order_id": str(order["id"]), "registry_id": str(r["id"]), "user_id": ident.user_id},
    }
    res = await client.post(f"{cfg.dodo_base_url}/checkouts", json=payload,
                            headers={"authorization": f"Bearer {cfg.dodo_payments_api_key}"})
    if res.status_code >= 300:
        log.error("dodo checkout failed status=%s", res.status_code)
        await db.execute("update paisa.orders set status='failed' where id=$1", order["id"])
        raise AppError("Payment page couldn't be opened. Please try again.", code="checkout_failed", status=502)
    data = res.json()
    await db.execute("update paisa.orders set provider_session_id=$2 where id=$1", order["id"], data.get("session_id"))
    await audit(db, ident.user_id, "billing.checkout_created", "order", str(order["id"]))
    return {"order_id": str(order["id"]), "checkout_url": data.get("checkout_url")}


@router.get("/billing/orders/{order_id}")
async def order_status(order_id: str, ident: Identity = Depends(current_identity), db=Depends(pool)):
    o = await db.fetchrow("select id, registry_id, plan_code, amount_paise, currency, status, created_at, updated_at "
                          "from paisa.orders where id=$1::uuid and owner_id=$2::uuid", order_id, ident.user_id)
    if not o:
        raise NotFound("Order not found.")
    return rec(o)


def verify_standard_webhook(secret: str, body: bytes, headers) -> bool:
    """Standard Webhooks: base64(HMAC-SHA256(secret, f"{id}.{ts}.{body}")), header 'v1,<sig> ...', 5-minute window."""
    wid, ts, sig_header = headers.get("webhook-id", ""), headers.get("webhook-timestamp", ""), headers.get("webhook-signature", "")
    if not (secret and wid and ts.isdigit() and sig_header):
        return False
    if abs(time.time() - int(ts)) > WEBHOOK_TOLERANCE_S:
        return False
    raw = secret[6:] if secret.startswith("whsec_") else secret
    try:
        key = base64.b64decode(raw, validate=True)
    except Exception:
        return False
    expected = base64.b64encode(hmac.new(key, f"{wid}.{ts}.".encode() + body, hashlib.sha256).digest()).decode()
    return any(p.partition(",")[0] == "v1" and hmac.compare_digest(p.partition(",")[2], expected) for p in sig_header.split())


@router.post("/webhooks/dodo", include_in_schema=False, dependencies=[rate_limit("webhook", 300, 60)])
async def dodo_webhook(request: Request, db=Depends(pool), cfg: Settings = Depends(settings), client=Depends(http)):
    body = await request.body()
    if len(body) > 256_000:
        return JSONResponse({"ok": False}, status_code=413)
    if not verify_standard_webhook(cfg.dodo_payments_webhook_key, body, request.headers):
        return JSONResponse({"ok": False}, status_code=401)
    event = json.loads(body)
    etype = str(event.get("type") or "")
    data = event.get("data") or {}
    meta = data.get("metadata") or {}
    event_id = request.headers["webhook-id"]

    inserted = await db.fetchval(
        """insert into paisa.payment_events(provider, event_id, event_type, payload_sha256, payload)
           values ('dodo',$1,$2,$3,$4::jsonb) on conflict (provider, event_id) do nothing returning id""",
        event_id, etype, hashlib.sha256(body).hexdigest(), body.decode())
    if not inserted:
        return {"ok": True, "duplicate": True}
    if meta.get("app") != APP_TAG or not meta.get("order_id"):
        return {"ok": True, "ignored": True}  # another WinPlayBox product on the same Dodo account

    kind = meta.get("kind") or "premium"
    if kind not in ORDER_TABLES:
        return {"ok": True, "ignored": True}
    table = ORDER_TABLES[kind]
    payment_id = str(data.get("payment_id") or "")
    order_id = str(meta["order_id"])
    done = "update paisa.payment_events set processed_at=now() where provider='dodo' and event_id=$1"
    if etype == "payment.succeeded":
        # authoritative verification: re-fetch the payment from Dodo, never trust the webhook body alone
        res = await client.get(f"{cfg.dodo_base_url}/payments/{payment_id}",
                               headers={"authorization": f"Bearer {cfg.dodo_payments_api_key}"})
        if res.status_code != 200:
            await db.execute("delete from paisa.payment_events where provider='dodo' and event_id=$1", event_id)
            return JSONResponse({"ok": False, "retry": True}, status_code=503)  # Dodo will retry
        p = res.json()
        pmeta = p.get("metadata") or {}
        async with db.acquire() as conn, conn.transaction():
            o = await conn.fetchrow(f"select * from {table} where id=$1::uuid for update", order_id)
            ok = (o is not None and p.get("status") == "succeeded" and str(pmeta.get("order_id")) == order_id
                  and int(p.get("total_amount") or 0) >= o["amount_paise"] and str(p.get("currency", "INR")).upper() == o["currency"])
            if not ok:
                log.warning("dodo payment verification mismatch kind=%s order=%s", kind, order_id)
            elif o["status"] != "succeeded":
                await conn.execute(f"update {table} set status='succeeded', provider_payment_id=$2 where id=$1", o["id"], payment_id)
                if kind == "premium":
                    await conn.execute("update paisa.registries set plan='premium', premium_since=now() where id=$1", o["registry_id"])
                    await audit(conn, str(o["owner_id"]), "billing.premium_activated", "registry", str(o["registry_id"]), {"order_id": order_id})
                else:
                    await audit(conn, None, "billing.shagun_card_paid", "contribution", str(o["contribution_id"]), {"order_id": order_id})
            await conn.execute(done, event_id)
    elif etype in ("payment.failed", "payment.cancelled"):
        await db.execute(f"update {table} set status=$2 where id=$1::uuid and status='created'", order_id,
                         "failed" if etype == "payment.failed" else "cancelled")
        await db.execute(done, event_id)
    elif etype == "refund.succeeded":
        async with db.acquire() as conn, conn.transaction():
            o = await conn.fetchrow(f"update {table} set status='refunded' where id=$1::uuid returning *", order_id)
            if o and kind == "premium":
                await conn.execute("update paisa.registries set plan='free' where id=$1", o["registry_id"])
                await audit(conn, None, "billing.refunded", "registry", str(o["registry_id"]), {"order_id": order_id})
            await conn.execute(done, event_id)
    return {"ok": True}
