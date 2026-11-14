"""Spending insights engine — pure functions over the user's own transactions."""

from __future__ import annotations

import calendar
import re
import statistics
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import date, datetime

CAT_NAMES = {
    "food": "Food & Coffee",
    "grocery": "Quick Commerce",
    "shopping": "Shopping",
    "subs": "Subscriptions",
    "travel": "Travel & Fuel",
    "bills": "Bills & Rent",
    "health": "Health",
    "fun": "Entertainment",
    "upi": "Random UPI",
    "other": "Other",
}


@dataclass
class Insight:
    id: str
    kind: str  # leak | subscription | spike | trend | tip | win
    title: str
    body: str
    emoji: str
    amount: float | None = None
    priority: int = 50


def inr(n: float) -> str:
    n = round(abs(n))
    s = str(n)
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        head = re.sub(r"(\d)(?=(\d{2})+$)", r"\1,", head)
        s = f"{head},{tail}"
    return f"₹{s}"


def _norm_merchant(m: str) -> str:
    return re.sub(r"[^a-z]", "", (m or "").lower())[:20]


def monthly_spendable(p: dict) -> float:
    inc, fx = float(p.get("monthly_income") or 0), float(p.get("fixed_costs") or 0)
    return max(0.0, inc - fx) if p.get("budget_mode") == "after_fixed" else inc


def build(txns: list[dict], profile: dict | None, month: date, today: date) -> dict:
    """txns: rows with amount, category, merchant, local `day` (date) — covering ~4 months up to `month`."""
    dim = calendar.monthrange(month.year, month.month)[1]
    is_cur = (month.year, month.month) == (today.year, today.month)
    passed = today.day if is_cur else dim
    created = None
    if profile and profile.get("created_at"):
        created = datetime.fromisoformat(str(profile["created_at"]).replace("Z", "+00:00")).date()
    start_day = created.day if created and (created.year, created.month) == (month.year, month.month) else 1
    active = max(1, passed - start_day + 1)

    cur = [t for t in txns if (t["day"].year, t["day"].month) == (month.year, month.month)]
    prev_m = date(month.year - (month.month == 1), 12 if month.month == 1 else month.month - 1, 1)
    prev = [t for t in txns if (t["day"].year, t["day"].month) == (prev_m.year, prev_m.month)]

    total = sum(t["amount"] for t in cur)
    spendable = monthly_spendable(profile) if profile else 0.0
    base = spendable / dim if spendable else 0.0
    avg = total / active
    projected = total + avg * (dim - passed) if is_cur else total
    out: list[Insight] = []

    # --- Small-spend leak ---
    small = [t for t in cur if t["amount"] <= 300]
    small_sum = sum(t["amount"] for t in small)
    if len(small) >= 6 and total and small_sum / total >= 0.08:
        out.append(
            Insight(
                "leak-small",
                "leak",
                f"Chhote kharche, bada asar: {inr(small_sum)}",
                f"{len(small)} baar ₹300 se kam kharch kiya — total ka {round(small_sum / total * 100)}%. "
                f"Saal bhar mein ~{inr(small_sum / active * 365)}.",
                "🪙",
                small_sum,
                80,
            )
        )

    # --- Quick commerce ---
    qc = sum(t["amount"] for t in cur if t["category"] == "grocery")
    qc_n = sum(1 for t in cur if t["category"] == "grocery")
    if qc_n >= 4:
        out.append(
            Insight(
                "leak-qc",
                "leak",
                f"Blinkit/Zepto pe {qc_n} orders = {inr(qc)}",
                f"Is speed se saal bhar mein {inr(qc / active * 365)}. Hafte mein ek bada order plan karo.",
                "🛒",
                qc,
                75,
            )
        )

    # --- Subscriptions / recurring ---
    by_merchant: dict[str, list[dict]] = defaultdict(list)
    for t in txns:
        by_merchant[_norm_merchant(t["merchant"])].append(t)
    subs = []
    for key, rows in by_merchant.items():
        if not key:
            continue
        months = {(r["day"].year, r["day"].month) for r in rows}
        amounts = [r["amount"] for r in rows]
        med = statistics.median(amounts)
        stable = all(abs(a - med) <= max(15, med * 0.1) for a in amounts)
        if (len(months) >= 2 and stable and len(rows) <= len(months) + 1) or (rows[0]["category"] == "subs"):
            subs.append({"merchant": rows[-1]["merchant"], "amount": round(med, 2), "months": len(months)})
    subs.sort(key=lambda s: -s["amount"])
    if subs:
        monthly = sum(s["amount"] for s in subs)
        out.append(
            Insight(
                "subs",
                "subscription",
                f"{len(subs)} recurring kharche · {inr(monthly)}/mahina",
                ", ".join(s["merchant"] for s in subs[:4])
                + (" …" if len(subs) > 4 else "")
                + f". Saal ka {inr(monthly * 12)} — jo use nahi karte, cancel karo.",
                "🔁",
                monthly,
                70,
            )
        )

    # --- Spike days ---
    per_day: dict[int, float] = defaultdict(float)
    for t in cur:
        per_day[t["day"].day] += t["amount"]
    nonzero = [v for v in per_day.values() if v > 0]
    if len(nonzero) >= 5:
        med = statistics.median(nonzero)
        spikes = sorted(((d, v) for d, v in per_day.items() if v > max(2.5 * med, base * 1.5)), key=lambda x: -x[1])
        if spikes:
            d, v = spikes[0]
            out.append(
                Insight(
                    "spike",
                    "spike",
                    f"{d} tareekh ko {inr(v)} ud gaye",
                    f"Normal din ka median {inr(med)} hai. {len(spikes)} aise heavy din is mahine.",
                    "📈",
                    v,
                    60,
                )
            )

    # --- Category trend vs last month (same elapsed days) ---
    if prev:
        cmp_days = passed if is_cur else 31
        cur_c: dict[str, float] = defaultdict(float)
        prev_c: dict[str, float] = defaultdict(float)
        for t in cur:
            cur_c[t["category"]] += t["amount"]
        for t in prev:
            if t["day"].day <= cmp_days:
                prev_c[t["category"]] += t["amount"]
        changes = [(c, cur_c[c], prev_c.get(c, 0)) for c in cur_c if prev_c.get(c, 0) > 0]
        ups = sorted(((c, a, b) for c, a, b in changes if a - b >= 1000 and a / b >= 1.3), key=lambda x: -(x[1] - x[2]))
        downs = sorted(((c, a, b) for c, a, b in changes if b - a >= 1000 and a / b <= 0.75), key=lambda x: x[1] - x[2])
        if ups:
            c, a, b = ups[0]
            out.append(
                Insight(
                    f"up-{c}",
                    "trend",
                    f"{CAT_NAMES.get(c, c)} {round((a / b - 1) * 100)}% upar",
                    f"Pichle mahine isi time tak {inr(b)} tha, ab {inr(a)}.",
                    "⚠️",
                    a - b,
                    65,
                )
            )
        if downs:
            c, a, b = downs[0]
            out.append(
                Insight(
                    f"down-{c}",
                    "win",
                    f"{CAT_NAMES.get(c, c)} pe {inr(b - a)} bachaye 👏",
                    f"Pichle mahine isi time tak {inr(b)}, ab sirf {inr(a)}. Aise hi chalo!",
                    "🏆",
                    b - a,
                    55,
                )
            )

    # --- Weekend vs weekday ---
    wk: dict[bool, list[float]] = {True: [], False: []}
    for d in range(start_day, passed + 1):
        try:
            dd = date(month.year, month.month, d)
        except ValueError:
            continue
        wk[dd.weekday() >= 5].append(per_day.get(d, 0.0))
    if len(wk[True]) >= 2 and len(wk[False]) >= 4:
        we, wd = statistics.mean(wk[True]), statistics.mean(wk[False])
        if wd > 0 and we / wd >= 1.6:
            out.append(
                Insight(
                    "weekend",
                    "trend",
                    f"Weekend pe {we / wd:.1f}x kharcha",
                    f"Weekend avg {inr(we)}/din vs weekday {inr(wd)}/din. Weekend ka budget alag socho.",
                    "🎉",
                    we - wd,
                    45,
                )
            )

    # --- Pace verdict ---
    if spendable and is_cur and total > 0:
        if projected > spendable:
            out.append(
                Insight(
                    "pace-bad",
                    "tip",
                    f"Month end tak {inr(projected - spendable)} short padoge",
                    f"Bache {dim - passed} din mein roz max {inr(max(0, spendable - total) / max(1, dim - passed))} kharch karo to bach jaoge.",
                    "🧯",
                    projected - spendable,
                    90,
                )
            )
        else:
            out.append(
                Insight(
                    "pace-good",
                    "win",
                    f"Is pace pe {inr(spendable - projected)} bachenge",
                    "Budget control mein hai. Bacha hua SIP ya emergency fund mein daalo.",
                    "💰",
                    spendable - projected,
                    40,
                )
            )

    # --- Biggest category tip ---
    if cur:
        by_cat: dict[str, float] = defaultdict(float)
        for t in cur:
            by_cat[t["category"]] += t["amount"]
        c, v = max(by_cat.items(), key=lambda x: x[1])
        if total and v / total >= 0.35 and c not in ("bills",):
            out.append(
                Insight(
                    f"top-{c}",
                    "tip",
                    f"{CAT_NAMES.get(c, c)} = {round(v / total * 100)}% kharcha",
                    f"Isme 20% kaatne se mahine ke {inr(v * 0.2)} bachenge.",
                    "🎯",
                    v * 0.2,
                    50,
                )
            )

    out.sort(key=lambda i: -i.priority)
    return {
        "month": f"{month.year}-{month.month:02d}",
        "insights": [{k: v for k, v in asdict(i).items() if k != "priority"} for i in out[:7]],
        "subscriptions": subs[:10],
        "projected_month_total": round(projected, 2) if is_cur else None,
    }
