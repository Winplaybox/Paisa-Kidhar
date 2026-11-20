"""Privacy-minimized product analytics: allowlisted event names, scalar props only, no PII."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ...core.errors import AppError
from ...core.security import rate_limit
from ..deps import pool

router = APIRouter(prefix="/v1", tags=["events"])

ALLOWED = {"app_open", "signup_completed", "registry_created", "registry_published", "goal_created", "share_tapped",
           "public_view", "pledge_started", "pledge_marked_paid", "premium_viewed", "premium_checkout"}


class EventIn(BaseModel):
    name: str = Field(max_length=40)
    props: dict[str, str | int | bool] = Field(default_factory=dict, max_length=8)


@router.post("/events", status_code=202, dependencies=[rate_limit("events", 120, 60)])
async def track(body: EventIn, request: Request, db=Depends(pool)):
    if body.name not in ALLOWED:
        raise AppError("unknown event", code="unknown_event", status=422)
    props = {k[:30]: (v[:60] if isinstance(v, str) else v) for k, v in body.props.items()}
    user_id = None
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        try:
            user_id = (await request.app.state.jwt.verify(auth[7:])).user_id
        except Exception:
            user_id = None
    await db.execute("insert into paisa.app_events(user_id, name, props) values ($1::uuid,$2,$3::jsonb)",
                     user_id, body.name, json.dumps(props))
    return {"ok": True}
