"""Identity: email-or-username password login (proxied so emails are never exposed), profile + auto username."""
from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ... import domain
from ...core.errors import AppError, Conflict, Unauthorized
from ...core.security import Identity, current_identity, rate_limit
from ..deps import audit, http, pool, rec, settings

router = APIRouter(prefix="/v1", tags=["auth"])


class LoginIn(BaseModel):
    identifier: str = Field(min_length=3, max_length=254, description="email or username")
    password: str = Field(min_length=6, max_length=128)


class ProfilePatch(BaseModel):
    display_name: str | None = Field(default=None, max_length=80)
    username: str | None = Field(default=None, max_length=24)
    locale: str | None = Field(default=None, max_length=10)


BAD_CREDENTIALS = "Incorrect email/username or password."


@router.post("/auth/login", dependencies=[rate_limit("login", 10, 300)])
async def login(body: LoginIn, db=Depends(pool), cfg=Depends(settings), client=Depends(http)):
    ident = body.identifier.strip()
    if "@" in ident:
        email = ident.lower()
    else:
        email = await db.fetchval("select email from paisa.profiles where username = $1", ident.lower())
        if not email:
            raise Unauthorized(BAD_CREDENTIALS)
    res = await client.post(f"{cfg.supabase_url}/auth/v1/token?grant_type=password",
                            headers={"apikey": cfg.supabase_anon_key, "content-type": "application/json"},
                            json={"email": email, "password": body.password})
    if res.status_code == 400 or res.status_code == 401:
        data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
        if "confirm" in str(data.get("msg") or data.get("error_description") or data.get("message") or "").lower():
            raise AppError("Please confirm your email first — check your inbox.", code="email_not_confirmed", status=403)
        raise Unauthorized(BAD_CREDENTIALS)
    if res.status_code == 429:
        raise AppError("Too many attempts. Please wait a minute.", code="rate_limited", status=429)
    if res.status_code != 200:
        raise AppError("Sign-in is temporarily unavailable.", code="auth_unavailable", status=503)
    s = res.json()
    return {k: s.get(k) for k in ("access_token", "refresh_token", "expires_in", "expires_at", "token_type")}


async def ensure_profile(db: asyncpg.Pool, ident: Identity) -> asyncpg.Record:
    row = await db.fetchrow("select * from paisa.profiles where user_id = $1::uuid", ident.user_id)
    if row:
        if ident.email and row["email"] != ident.email.lower():
            row = await db.fetchrow("update paisa.profiles set email = $2 where user_id = $1::uuid returning *",
                                    ident.user_id, ident.email.lower())
        return row
    for candidate in domain.username_candidates(ident.name, ident.email, n=12):
        row = await db.fetchrow(
            """insert into paisa.profiles(user_id, username, email, display_name)
               values ($1::uuid, $2, $3, $4) on conflict do nothing returning *""",
            ident.user_id, candidate, (ident.email or "").lower() or None, (ident.name or "")[:80])
        if row:
            await audit(db, ident.user_id, "profile.created", "profile", ident.user_id, {"username": candidate})
            return row
        existing = await db.fetchrow("select * from paisa.profiles where user_id = $1::uuid", ident.user_id)
        if existing:  # concurrent first request won the race
            return existing
    raise AppError("Could not create your profile. Please retry.", status=503)


def _public_profile(row, is_admin: bool) -> dict:
    d = rec(row)
    return {"user_id": d["user_id"], "username": d["username"], "email": d["email"], "display_name": d["display_name"],
            "locale": d["locale"], "deletion_requested_at": d["deletion_requested_at"], "is_admin": is_admin}


@router.get("/me")
async def me(ident: Identity = Depends(current_identity), db=Depends(pool)):
    row = await ensure_profile(db, ident)
    is_admin = bool(await db.fetchval("select 1 from paisa.user_roles where user_id=$1::uuid and role='admin'", ident.user_id))
    return _public_profile(row, is_admin)


@router.patch("/me")
async def update_me(body: ProfilePatch, ident: Identity = Depends(current_identity), db=Depends(pool)):
    await ensure_profile(db, ident)
    sets, args = [], [ident.user_id]
    if body.username is not None:
        try:
            uname = domain.normalize_username(body.username)
        except ValueError as e:
            raise AppError(str(e), code="invalid_username", status=422) from None
        args.append(uname)
        sets.append(f"username = ${len(args)}")
    if body.display_name is not None:
        args.append(body.display_name.strip())
        sets.append(f"display_name = ${len(args)}")
    if body.locale is not None:
        args.append(body.locale)
        sets.append(f"locale = ${len(args)}")
    if not sets:
        row = await db.fetchrow("select * from paisa.profiles where user_id=$1::uuid", ident.user_id)
    else:
        try:
            row = await db.fetchrow(f"update paisa.profiles set {', '.join(sets)} where user_id=$1::uuid returning *", *args)
        except asyncpg.UniqueViolationError:
            raise Conflict("That username is taken.") from None
    is_admin = bool(await db.fetchval("select 1 from paisa.user_roles where user_id=$1::uuid and role='admin'", ident.user_id))
    return _public_profile(row, is_admin)


@router.get("/auth/username-available", dependencies=[rate_limit("uname", 30, 60)])
async def username_available(u: str, db=Depends(pool)):
    try:
        uname = domain.normalize_username(u)
    except ValueError as e:
        return {"available": False, "reason": str(e)}
    taken = await db.fetchval("select 1 from paisa.profiles where username=$1", uname)
    return {"available": not taken, "username": uname}


@router.post("/me/deletion-request")
async def deletion_request(ident: Identity = Depends(current_identity), db=Depends(pool)):
    await ensure_profile(db, ident)
    await db.execute("update paisa.profiles set deletion_requested_at = coalesce(deletion_requested_at, now()) where user_id=$1::uuid", ident.user_id)
    await db.execute("update paisa.registries set status='archived' where owner_id=$1::uuid", ident.user_id)
    await audit(db, ident.user_id, "account.deletion_requested", "profile", ident.user_id)
    return {"ok": True, "message": "Deletion requested. Your registries are hidden now and your data will be erased within 30 days."}
