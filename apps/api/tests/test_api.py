import base64
import hashlib
import hmac
import json
import time
import uuid

import pytest

from .conftest import ADMIN_DSN, WEBHOOK_KEY

pytestmark = pytest.mark.skipif(not ADMIN_DSN, reason="TEST_DATABASE_URL not set")


async def _registry(client, user, **over):
    body = {"partner_one": "Riya", "partner_two": "Arjun", "upi_vpa": "riya@okaxis", "story": "Our story", **over}
    r = await client.post("/v1/registries", json=body, headers=user["h"])
    assert r.status_code == 201, r.text
    return r.json()


async def _goal(client, user, reg_id, title="Honeymoon in Bali", rupees=150000):
    r = await client.post(f"/v1/registries/{reg_id}/goals", json={"title": title, "target_rupees": rupees, "category": "honeymoon"},
                          headers=user["h"])
    assert r.status_code == 201, r.text
    return r.json()


async def test_health(client):
    assert (await client.get("/healthz")).json() == {"ok": True}
    assert (await client.get("/readyz")).status_code == 200


async def test_requires_auth(client):
    r = await client.get("/v1/me")
    assert r.status_code == 401 and r.json()["error"]["code"] == "unauthorized"
    r = await client.get("/v1/me", headers={"authorization": "Bearer nope"})
    assert r.status_code == 401


async def test_me_autogenerates_unique_username(client, make_user):
    a = await make_user("Riya Sharma")
    b = await make_user("Riya Sharma")
    ma = (await client.get("/v1/me", headers=a["h"])).json()
    mb = (await client.get("/v1/me", headers=b["h"])).json()
    assert ma["username"] != mb["username"]
    assert ma["username"].startswith("riya_sharma") and mb["username"].startswith("riya_sharma")
    assert ma["is_admin"] is False
    # idempotent
    assert (await client.get("/v1/me", headers=a["h"])).json()["username"] == ma["username"]


async def test_username_change_and_conflict(client, make_user):
    a, b = await make_user("A Person"), await make_user("B Person")
    uname = f"couple_{uuid.uuid4().hex[:6]}"
    r = await client.patch("/v1/me", json={"username": uname}, headers=a["h"])
    assert r.status_code == 200 and r.json()["username"] == uname
    r = await client.patch("/v1/me", json={"username": uname}, headers=b["h"])
    assert r.status_code == 409
    r = await client.patch("/v1/me", json={"username": "Bad Name"}, headers=b["h"])
    assert r.status_code == 422
    avail = (await client.get(f"/v1/auth/username-available?u={uname}")).json()
    assert avail["available"] is False


async def test_login_with_username_or_email(client, make_user, upstream):
    u = await make_user("Login User")
    me = (await client.get("/v1/me", headers=u["h"])).json()
    upstream.users[u["email"]] = "correct-horse"
    r = await client.post("/v1/auth/login", json={"identifier": me["username"], "password": "correct-horse"})
    assert r.status_code == 200 and r.json()["access_token"] == "at"
    r = await client.post("/v1/auth/login", json={"identifier": u["email"].upper(), "password": "correct-horse"})
    assert r.status_code == 200
    bad = await client.post("/v1/auth/login", json={"identifier": me["username"], "password": "wrong-pass"})
    unknown = await client.post("/v1/auth/login", json={"identifier": "nobody_here", "password": "wrong-pass"})
    assert bad.status_code == unknown.status_code == 401
    assert bad.json()["error"]["message"] == unknown.json()["error"]["message"]  # no user enumeration


async def test_registry_isolation_between_owners(client, make_user):
    owner, other = await make_user(), await make_user()
    reg = await _registry(client, owner)
    assert (await client.get(f"/v1/registries/{reg['id']}", headers=other["h"])).status_code == 404
    assert (await client.patch(f"/v1/registries/{reg['id']}", json={"story": "x"}, headers=other["h"])).status_code == 404
    assert (await client.get(f"/v1/registries/{reg['id']}/contributions", headers=other["h"])).status_code == 404
    assert (await client.get("/v1/registries/not-a-uuid", headers=owner["h"])).status_code == 404


async def test_publish_rules_and_free_goal_limit(client, make_user):
    u = await make_user()
    reg = await _registry(client, u, upi_vpa=None)
    r = await client.post(f"/v1/registries/{reg['id']}/publish", headers=u["h"])
    assert r.json()["error"]["code"] == "upi_required"
    await client.patch(f"/v1/registries/{reg['id']}", json={"upi_vpa": "riya@okicici"}, headers=u["h"])
    r = await client.post(f"/v1/registries/{reg['id']}/publish", headers=u["h"])
    assert r.json()["error"]["code"] == "goal_required"
    for i in range(3):
        await _goal(client, u, reg["id"], title=f"Goal {i}")
    r = await client.post(f"/v1/registries/{reg['id']}/goals", json={"title": "4th", "target_rupees": 1000}, headers=u["h"])
    assert r.status_code == 402 and r.json()["error"]["code"] == "premium_required"
    r = await client.patch(f"/v1/registries/{reg['id']}", json={"theme": "plum"}, headers=u["h"])
    assert r.status_code == 402
    assert (await client.post(f"/v1/registries/{reg['id']}/publish", headers=u["h"])).json()["status"] == "published"


async def test_guest_pledge_flow_and_totals(client, make_user):
    u = await make_user()
    reg = await _registry(client, u)
    goal = await _goal(client, u, reg["id"])
    private = (await client.post(f"/v1/registries/{reg['id']}/goals",
                                 json={"title": "Secret", "target_rupees": 1000, "visibility": "private"}, headers=u["h"])).json()
    slug = reg["slug"]
    assert (await client.get(f"/v1/public/registries/{slug}")).status_code == 404  # draft is hidden
    await client.post(f"/v1/registries/{reg['id']}/publish", headers=u["h"])

    pub = (await client.get(f"/v1/public/registries/{slug}")).json()
    assert [g["title"] for g in pub["goals"]] == ["Honeymoon in Bali"]  # private goal not exposed
    assert "upi_vpa" not in pub and "owner_id" not in pub

    # private goal cannot receive pledges
    r = await client.post(f"/v1/public/registries/{slug}/pledges", json={"goal_id": private["id"], "amount_paise": 10000},
                          headers={"idempotency-key": uuid.uuid4().hex})
    assert r.status_code == 409

    key = uuid.uuid4().hex
    body = {"goal_id": goal["id"], "amount_paise": 200000, "guest_name": "Mama ji", "guest_message": "Enjoy Bali!"}
    p1 = (await client.post(f"/v1/public/registries/{slug}/pledges", json=body, headers={"idempotency-key": key})).json()
    p2 = (await client.post(f"/v1/public/registries/{slug}/pledges", json=body, headers={"idempotency-key": key})).json()
    assert p1["reference"] == p2["reference"]  # idempotent retry
    assert p1["upi_link"].startswith("upi://pay?pa=riya@okaxis") and "am=2000.00" in p1["upi_link"]

    bad = await client.post(f"/v1/public/pledges/{p1['reference']}/mark-paid", json={"token": "0" * 64})
    assert bad.status_code == 404
    ok = await client.post(f"/v1/public/pledges/{p1['reference']}/mark-paid", json={"token": p1["token"]})
    assert ok.json()["status"] == "guest_marked_paid"

    # not counted until the couple confirms
    pub = (await client.get(f"/v1/public/registries/{slug}")).json()
    assert pub["goals"][0]["raised_paise"] == 0
    lst = (await client.get(f"/v1/registries/{reg['id']}/contributions", headers=u["h"])).json()
    cid = lst["items"][0]["id"]
    r = await client.post(f"/v1/contributions/{cid}/decision", json={"decision": "confirmed"}, headers=u["h"])
    assert r.json()["status"] == "confirmed"
    pub = (await client.get(f"/v1/public/registries/{slug}")).json()
    assert pub["goals"][0]["raised_paise"] == 200000
    assert pub["wishes"][0] == {"name": "Mama ji", "message": "Enjoy Bali!", "at": pub["wishes"][0]["at"]}

    ins = (await client.get(f"/v1/registries/{reg['id']}/insights", headers=u["h"])).json()
    assert ins["kpis"]["raised_paise"] == 200000 and ins["kpis"]["confirmed_count"] == 1
    assert sum(d["paise"] for d in ins["daily"]) == 200000

    csv_text = (await client.get(f"/v1/registries/{reg['id']}/contributions.csv", headers=u["h"])).text
    assert "2000.00" in csv_text and "Mama ji" in csv_text


async def test_anonymous_and_amount_validation(client, make_user):
    u = await make_user()
    reg = await _registry(client, u)
    goal = await _goal(client, u, reg["id"])
    await client.post(f"/v1/registries/{reg['id']}/publish", headers=u["h"])
    r = await client.post(f"/v1/public/registries/{reg['slug']}/pledges", json={"goal_id": goal["id"], "amount_paise": 50},
                          headers={"idempotency-key": uuid.uuid4().hex})
    assert r.status_code == 422
    r = await client.post(f"/v1/public/registries/{reg['slug']}/pledges", json={"goal_id": goal["id"], "amount_paise": 10000},
                          headers={})
    assert r.status_code == 422  # idempotency key required
    p = (await client.post(f"/v1/public/registries/{reg['slug']}/pledges",
                           json={"goal_id": goal["id"], "amount_paise": 10000, "guest_name": "Secret Uncle",
                                 "guest_message": "Blessings", "is_anonymous": True},
                           headers={"idempotency-key": uuid.uuid4().hex})).json()
    cid = (await client.get(f"/v1/registries/{reg['id']}/contributions", headers=u["h"])).json()["items"][0]["id"]
    await client.post(f"/v1/contributions/{cid}/decision", json={"decision": "confirmed"}, headers=u["h"])
    pub = (await client.get(f"/v1/public/registries/{reg['slug']}")).json()
    assert pub["wishes"][0]["name"] is None
    assert p["reference"].startswith("PK")


def _sign(body: bytes, wid: str, ts: int) -> str:
    key = base64.b64decode(WEBHOOK_KEY[6:])
    return "v1," + base64.b64encode(hmac.new(key, f"{wid}.{ts}.".encode() + body, hashlib.sha256).digest()).decode()


async def test_premium_checkout_and_verified_webhook(client, make_user, upstream):
    u = await make_user()
    reg = await _registry(client, u)
    r = await client.post("/v1/billing/checkout", json={"registry_id": reg["id"]}, headers=u["h"])
    assert r.status_code == 200, r.text
    order_id = r.json()["order_id"]
    sent = upstream.checkouts[-1]
    assert sent["metadata"]["order_id"] == order_id and sent["billing_currency"] == "INR"

    payment = {"payment_id": "pay_1", "status": "succeeded", "total_amount": 49900, "currency": "INR",
               "metadata": {"app": "paisa_kidhar", "order_id": order_id}}
    event = json.dumps({"type": "payment.succeeded", "data": payment}).encode()
    ts = int(time.time())

    # unsigned / bad signature / stale timestamp rejected
    assert (await client.post("/v1/webhooks/dodo", content=event)).status_code == 401
    h = {"webhook-id": "evt_1", "webhook-timestamp": str(ts), "webhook-signature": "v1,AAAA"}
    assert (await client.post("/v1/webhooks/dodo", content=event, headers=h)).status_code == 401
    h = {"webhook-id": "evt_1", "webhook-timestamp": str(ts - 3600), "webhook-signature": _sign(event, "evt_1", ts - 3600)}
    assert (await client.post("/v1/webhooks/dodo", content=event, headers=h)).status_code == 401

    # forged webhook for a payment Dodo doesn't confirm -> no premium
    h = {"webhook-id": "evt_forged", "webhook-timestamp": str(ts), "webhook-signature": _sign(event, "evt_forged", ts)}
    upstream.payments["pay_1"] = {**payment, "status": "failed"}
    assert (await client.post("/v1/webhooks/dodo", content=event, headers=h)).status_code == 200
    assert (await client.get(f"/v1/registries/{reg['id']}", headers=u["h"])).json()["plan"] == "free"

    upstream.payments["pay_1"] = payment
    h = {"webhook-id": "evt_ok", "webhook-timestamp": str(ts), "webhook-signature": _sign(event, "evt_ok", ts)}
    assert (await client.post("/v1/webhooks/dodo", content=event, headers=h)).json() == {"ok": True}
    dup = await client.post("/v1/webhooks/dodo", content=event, headers=h)
    assert dup.json().get("duplicate") is True
    detail = (await client.get(f"/v1/registries/{reg['id']}", headers=u["h"])).json()
    assert detail["plan"] == "premium" and detail["goal_limit"] == 50
    assert (await client.get(f"/v1/billing/orders/{order_id}", headers=u["h"])).json()["status"] == "succeeded"

    # other WinPlayBox products' events on the same Dodo account are ignored
    other = json.dumps({"type": "payment.succeeded", "data": {"payment_id": "x", "metadata": {"app": "ovd_editor"}}}).encode()
    h = {"webhook-id": "evt_ovd", "webhook-timestamp": str(ts), "webhook-signature": _sign(other, "evt_ovd", ts)}
    assert (await client.post("/v1/webhooks/dodo", content=other, headers=h)).json().get("ignored") is True


async def test_admin_requires_trusted_role(client, make_user, admin_conn):
    u = await make_user()
    await client.get("/v1/me", headers=u["h"])
    assert (await client.get("/v1/admin/metrics", headers=u["h"])).status_code == 403
    await admin_conn.execute("insert into paisa.user_roles(user_id, role) values ($1::uuid,'admin')", u["id"])
    m = await client.get("/v1/admin/metrics", headers=u["h"])
    assert m.status_code == 200 and m.json()["totals"]["users"] >= 1
    assert (await client.get("/v1/me", headers=u["h"])).json()["is_admin"] is True


async def test_api_role_cannot_self_grant_admin_or_rewrite_audit(api_dsn):
    import asyncpg
    conn = await asyncpg.connect(api_dsn)
    try:
        with pytest.raises(asyncpg.InsufficientPrivilegeError):
            await conn.execute("insert into paisa.user_roles(user_id, role) select id, 'admin' from auth.users limit 1")
        with pytest.raises(asyncpg.InsufficientPrivilegeError):
            await conn.execute("delete from paisa.audit_logs")
        with pytest.raises(asyncpg.InsufficientPrivilegeError):
            await conn.execute("select * from public.pg_stat_statements_info")  # nothing outside paisa
    except asyncpg.UndefinedTableError:
        pass
    finally:
        await conn.close()


async def test_anon_and_authenticated_roles_have_no_access(admin_conn):
    for role in ("anon", "authenticated"):
        has = await admin_conn.fetchval("select has_schema_privilege($1, 'paisa', 'USAGE')", role)
        assert has is False


async def test_account_deletion_request_hides_registries(client, make_user):
    u = await make_user()
    reg = await _registry(client, u)
    await _goal(client, u, reg["id"])
    await client.post(f"/v1/registries/{reg['id']}/publish", headers=u["h"])
    r = await client.post("/v1/me/deletion-request", headers=u["h"])
    assert r.json()["ok"] is True
    assert (await client.get(f"/v1/public/registries/{reg['slug']}")).status_code == 404


async def test_events_allowlist(client):
    assert (await client.post("/v1/events", json={"name": "app_open"})).status_code == 202
    assert (await client.post("/v1/events", json={"name": "steal_data"})).status_code == 422


async def test_free_plan_cannot_customise_link(client, make_user):
    u = await make_user()
    reg = await _registry(client, u, slug="my-custom-link", theme="plum")
    assert reg["slug"] != "my-custom-link" and reg["theme"] == "rose"
    r = await client.patch(f"/v1/registries/{reg['id']}", json={"slug": "another-link"}, headers=u["h"])
    assert r.status_code == 402


async def test_same_email_two_auth_users_get_profiles(client, make_user):
    a = await make_user("Dup One", email="dup@example.com")
    b = await make_user("Dup Two", email="dup@example.com")
    assert (await client.get("/v1/me", headers=a["h"])).status_code == 200
    assert (await client.get("/v1/me", headers=b["h"])).status_code == 200


def test_client_ip_ignores_spoofed_left_entries():
    from types import SimpleNamespace

    from app.core.security import client_ip
    req = SimpleNamespace(headers={"x-forwarded-for": "6.6.6.6, 1.2.3.4"}, client=SimpleNamespace(host="10.0.0.1"),
                          app=SimpleNamespace(state=SimpleNamespace(settings=SimpleNamespace(trusted_proxy_hops=1))))
    assert client_ip(req) == "1.2.3.4"
