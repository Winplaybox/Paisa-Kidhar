"""Couple dashboard KPIs + chart series. Totals are derived from confirmed contributions only."""
from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, Query

from ... import domain
from ...core.security import Identity, current_identity
from ..deps import owned_registry, pool

router = APIRouter(prefix="/v1", tags=["insights"])


@router.get("/registries/{registry_id}/insights")
async def insights(registry_id: str, date_from: dt.date | None = Query(None, alias="from"),
                   date_to: dt.date | None = Query(None, alias="to"), goal_id: str | None = None,
                   ident: Identity = Depends(current_identity), db=Depends(pool)):
    r = await owned_registry(db, registry_id, ident.user_id)
    today = dt.date.today()
    date_to = date_to or today
    date_from = date_from or (date_to - dt.timedelta(days=29))
    args = [r["id"], date_from, date_to]
    goal_clause = ""
    if goal_id:
        args.append(goal_id)
        goal_clause = " and c.goal_id = $4::uuid"
    base = f"from paisa.contributions c where c.registry_id=$1 and c.created_at >= $2::date and c.created_at < ($3::date + 1){goal_clause}"

    kpi = await db.fetchrow(f"""select
        coalesce(sum(amount_paise) filter (where status='confirmed'),0)::bigint raised_paise,
        count(*) filter (where status='confirmed')::int confirmed_count,
        count(*) filter (where status in ('pledged','guest_marked_paid'))::int pending_count,
        coalesce(sum(amount_paise) filter (where status in ('pledged','guest_marked_paid')),0)::bigint pending_paise,
        coalesce(avg(amount_paise) filter (where status='confirmed'),0)::bigint avg_paise {base}""", *args)

    daily = await db.fetch(f"""select d::date as day, coalesce(sum(c.amount_paise),0)::bigint paise
        from generate_series($2::date, $3::date, interval '1 day') d
        left join paisa.contributions c on c.registry_id=$1 and c.status='confirmed' and c.created_at::date = d::date{goal_clause}
        group by d order by d""", *args)

    by_goal = await db.fetch("""select g.id, g.title, g.target_paise, g.status,
        coalesce(sum(c.amount_paise) filter (where c.status='confirmed'),0)::bigint raised_paise
        from paisa.goals g left join paisa.contributions c on c.goal_id=g.id
        where g.registry_id=$1 and g.status<>'archived' group by g.id order by g.position""", r["id"])

    amounts = await db.fetch(f"select amount_paise {base} and status='confirmed'", *args)
    buckets = {b: 0 for b in domain.AMOUNT_BUCKETS}
    for a in amounts:
        buckets[domain.amount_bucket(a["amount_paise"])] += 1

    states = await db.fetch(f"select status, count(*)::int n {base} group by status", *args)

    monthly = await db.fetch("""select to_char(date_trunc('month', created_at),'YYYY-MM') as month, sum(amount_paise)::bigint as paise
        from paisa.contributions where registry_id=$1 and status='confirmed' and created_at > now() - interval '12 months'
        group by 1 order by 1""", r["id"])

    goals = [{"id": str(g["id"]), "title": g["title"], "target_paise": g["target_paise"], "raised_paise": g["raised_paise"],
              "status": g["status"], "progress": min(1.0, g["raised_paise"] / g["target_paise"]) if g["target_paise"] else 0}
             for g in by_goal]
    active = [g for g in goals if g["status"] in ("active", "completed")]
    return {
        "range": {"from": date_from.isoformat(), "to": date_to.isoformat()},
        "kpis": {**dict(kpi), "active_goals": sum(1 for g in goals if g["status"] == "active"),
                 "completed_goals": sum(1 for g in goals if g["status"] == "completed" or g["progress"] >= 1),
                 "overall_progress": (sum(g["raised_paise"] for g in active) / sum(g["target_paise"] for g in active)) if active else 0},
        "daily": [{"day": d["day"].isoformat(), "paise": d["paise"]} for d in daily],
        "by_goal": goals,
        "distribution": [{"bucket": k, "count": v} for k, v in buckets.items()],
        "status_mix": [dict(s) for s in states],
        "monthly": [dict(m) for m in monthly],
    }
