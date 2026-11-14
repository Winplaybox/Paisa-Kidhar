from datetime import date

from app.insights import build, inr

PROFILE = {"monthly_income": 100000, "fixed_costs": 0, "budget_mode": "full", "created_at": "2026-08-01T00:00:00Z"}


def tx(d, amt, cat, m):
    return {"day": d, "amount": amt, "category": cat, "merchant": m}


def test_inr_grouping():
    assert inr(100000) == "₹1,00,000" and inr(3333.4) == "₹3,333" and inr(250) == "₹250"


def test_insights_cover_leak_subs_pace():
    rows = []
    for mth in (9, 10, 11):
        rows.append(tx(date(2026, mth, 5), 649, "subs", "Netflix"))
    for d in range(1, 15):
        rows.append(tx(date(2026, 11, d), 250, "food", "Starbucks"))
        rows.append(tx(date(2026, 11, d), 600, "grocery", "Blinkit"))
    rows.append(tx(date(2026, 11, 8), 30000, "shopping", "Amazon"))
    out = build(rows, PROFILE, date(2026, 11, 1), date(2026, 11, 15))
    kinds = {i["id"] for i in out["insights"]}
    assert "leak-qc" in kinds and "subs" in kinds and "spike" in kinds
    assert any(s["merchant"] == "Netflix" for s in out["subscriptions"])
    assert out["projected_month_total"] > 0
    assert len(out["insights"]) <= 7


def test_empty_month_is_safe():
    out = build([], PROFILE, date(2026, 11, 1), date(2026, 11, 15))
    assert out["insights"] == [] and out["subscriptions"] == []
