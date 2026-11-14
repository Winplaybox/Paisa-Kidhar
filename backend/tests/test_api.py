import pytest
from fastapi.testclient import TestClient

from app import auth
from app.main import app

client = TestClient(app)


@pytest.fixture
def authed(monkeypatch):
    async def fake_user():
        return auth.User(id="00000000-0000-0000-0000-000000000001", email="t@example.com", token="x" * 40)

    app.dependency_overrides[auth.current_user] = fake_user
    yield
    app.dependency_overrides.clear()


def test_health():
    assert client.get("/health").json()["ok"] is True


def test_requires_auth():
    r = client.post("/v1/statements/parse", files={"file": ("s.csv", b"a,b", "text/csv")})
    assert r.status_code == 401


def test_parse_csv_upload(authed):
    csv = b"Date,Narration,Withdrawal Amt.,Deposit Amt.\n01/11/26,UPI-ZEPTO-zepto@ybl-1-UPI,400.00,\n"
    r = client.post("/v1/statements/parse", files={"file": ("s.csv", csv, "text/csv")})
    assert r.status_code == 200
    assert r.json()["items"][0]["merchant"] == "Zepto" and r.json()["items"][0]["category"] == "grocery"


def test_rejects_bad_type(authed):
    r = client.post("/v1/statements/parse", files={"file": ("s.exe", b"MZ", "application/octet-stream")})
    assert r.status_code == 415


def test_unparseable_is_422(authed):
    r = client.post("/v1/statements/parse", files={"file": ("s.csv", b"foo,bar\n1,2", "text/csv")})
    assert r.status_code == 422


def test_insights_month_validation(authed):
    assert client.get("/v1/insights?month=2026-13").status_code == 422
    assert client.get("/v1/insights?month=nope").status_code == 422


def test_insights_happy_path(authed, monkeypatch):
    from app import main

    async def prof(_):
        return {"monthly_income": 90000, "fixed_costs": 0, "budget_mode": "full", "created_at": "2026-01-01T00:00:00Z"}

    async def txns(_, s, e):
        return [
            {"amount": "600", "category": "grocery", "merchant": "Blinkit", "occurred_at": f"2026-11-{d:02d}T08:00:00+00:00"}
            for d in range(1, 8)
        ]

    monkeypatch.setattr(main, "fetch_profile", prof)
    monkeypatch.setattr(main, "fetch_txns", txns)
    r = client.get("/v1/insights?month=2026-11&tz=Asia/Kolkata")
    assert r.status_code == 200 and r.json()["month"] == "2026-11"
