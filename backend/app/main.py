"""Paisa Kidhar API — statement parsing + insights. Stateless; user data stays in Supabase under RLS."""

from __future__ import annotations

import asyncio
import logging
import re
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from . import http
from .auth import User, current_user
from .config import get_settings
from .insights import build
from .parsing import parse_sms, parse_statement
from .supa import fetch_profile, fetch_txns

log = logging.getLogger("paisa")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    await http.close()


settings = get_settings()
app = FastAPI(
    title="Paisa Kidhar API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url=None,
)
app.add_middleware(GZipMiddleware, minimum_size=1024)


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    log.exception("unhandled error: %s", type(exc).__name__)
    return JSONResponse({"detail": "Server mein kuch gadbad hui — thodi der baad try karo"}, status_code=500)


@app.get("/health")
async def health():
    return {"ok": True, "service": "paisa-kidhar-api", "time": datetime.now(ZoneInfo("UTC")).isoformat()}


# ---------- statements ----------
ALLOWED_EXT = (".csv", ".txt", ".tsv", ".pdf", ".xlsx", ".xls")


@app.post("/v1/statements/parse")
async def parse_statement_file(
    file: UploadFile = File(...),
    password: str | None = Form(default=None, max_length=64),
    user: User = Depends(current_user),
):
    name = (file.filename or "statement").lower()
    if not name.endswith(ALLOWED_EXT):
        raise HTTPException(415, "Sirf CSV, Excel ya PDF statement chalega")
    data = await file.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(413, "File 8MB se badi hai")
    if not data:
        raise HTTPException(400, "File khaali hai")
    try:
        txns = await run_in_threadpool(parse_statement, name, data, None, password)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    log.info("parsed statement user=%s kind=%s rows=%d", user.id[:8], name.rsplit(".", 1)[-1], len(txns))
    # The file is never stored — parsed in memory and discarded.
    return {"items": [t.dict() for t in txns[:5000]], "count": len(txns)}


class SmsIn(BaseModel):
    text: str = Field(min_length=1, max_length=50_000)


@app.post("/v1/parse/sms")
async def parse_sms_text(body: SmsIn, _: User = Depends(current_user)):
    blocks = [b.strip() for b in re.split(r"\n\s*\n", body.text) if b.strip()][:500]
    return {"items": [parse_sms(b) for b in blocks]}


# ---------- insights ----------
@app.get("/v1/insights")
async def insights(
    month: str = Query(pattern=r"^\d{4}-\d{2}$"),
    tz: str = Query(default="Asia/Kolkata", max_length=64),
    user: User = Depends(current_user),
):
    try:
        zone = ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError):
        zone = ZoneInfo("Asia/Kolkata")
    y, m = map(int, month.split("-"))
    if not (1 <= m <= 12 and 2000 <= y <= 2100):
        raise HTTPException(422, "Invalid month")
    month_start = date(y, m, 1)
    # 3 months of history for subscriptions + month-over-month comparison
    hist = month_start
    for _ in range(3):
        hist = (hist - timedelta(days=1)).replace(day=1)
    next_month = (month_start + timedelta(days=32)).replace(day=1)

    start = datetime(hist.year, hist.month, 1, tzinfo=zone)
    end = datetime(next_month.year, next_month.month, 1, tzinfo=zone)
    profile, rows = await asyncio.gather(fetch_profile(user), fetch_txns(user, start, end))
    txns = [
        {
            "amount": float(r["amount"]),
            "category": r["category"],
            "merchant": r["merchant"],
            "day": datetime.fromisoformat(r["occurred_at"].replace("Z", "+00:00")).astimezone(zone).date(),
        }
        for r in rows
    ]
    today = datetime.now(zone).date()
    return build(txns, profile, month_start, today)
