"""JWT verifier during a Supabase project move: new + legacy issuers accepted, everything else rejected."""
import time

import jwt
import pytest

from app.core.errors import Unauthorized
from app.core.security import JwtVerifier
from app.core.settings import Settings

NEW, OLD = "https://new.supabase.co", "https://old.supabase.co"
NEW_SECRET, OLD_SECRET = "n" * 40, "o" * 40


def _settings(**over):
    base = dict(environment="test", supabase_url=NEW, supabase_anon_key="k", supabase_jwt_secret=NEW_SECRET,
                database_url="postgresql://x", pledge_token_secret="p" * 40, ip_hash_salt="s" * 20)
    base.update(over)
    return Settings(**base)


def _token(iss_base, secret, **over):
    now = int(time.time())
    claims = {"sub": "11111111-1111-1111-1111-111111111111", "email": "a@b.co", "role": "authenticated",
              "aud": "authenticated", "iss": f"{iss_base}/auth/v1", "iat": now, "exp": now + 600}
    claims.update(over)
    return jwt.encode(claims, secret, algorithm="HS256")


async def test_primary_issuer_accepted():
    v = JwtVerifier(_settings())
    assert (await v.verify(_token(NEW, NEW_SECRET))).user_id.endswith("1111")


async def test_legacy_issuer_accepted_only_when_configured():
    tok = _token(OLD, OLD_SECRET)
    with pytest.raises(Unauthorized):
        await JwtVerifier(_settings()).verify(tok)
    v = JwtVerifier(_settings(legacy_supabase_url=OLD, legacy_supabase_jwt_secret=OLD_SECRET))
    assert (await v.verify(tok)).email == "a@b.co"


async def test_unknown_issuer_rejected():
    v = JwtVerifier(_settings(legacy_supabase_url=OLD, legacy_supabase_jwt_secret=OLD_SECRET))
    with pytest.raises(Unauthorized):
        await v.verify(_token("https://evil.example", NEW_SECRET))


async def test_legacy_issuer_with_wrong_signature_rejected():
    v = JwtVerifier(_settings(legacy_supabase_url=OLD, legacy_supabase_jwt_secret=OLD_SECRET))
    with pytest.raises(Unauthorized):
        await v.verify(_token(OLD, NEW_SECRET))  # new project's secret must not validate old-issuer tokens


async def test_expired_and_wrong_role_rejected():
    v = JwtVerifier(_settings())
    with pytest.raises(Unauthorized):
        await v.verify(_token(NEW, NEW_SECRET, exp=int(time.time()) - 600))
    with pytest.raises(Unauthorized):
        await v.verify(_token(NEW, NEW_SECRET, role="anon"))
