"""Firebase App Check verification (Play Integrity attested Android app). Pure JWT check, no Firebase SDK."""
from __future__ import annotations

import asyncio
import logging

import jwt

from .settings import Settings

log = logging.getLogger("paisa.appcheck")
JWKS_URL = "https://firebaseappcheck.googleapis.com/v1/jwks"


class AppCheckVerifier:
    def __init__(self, settings: Settings) -> None:
        self._jwks = jwt.PyJWKClient(JWKS_URL, cache_keys=True, lifespan=3600)
        self._project = settings.firebase_project_number

    async def verify(self, token: str) -> bool:
        try:
            key = await asyncio.to_thread(self._jwks.get_signing_key_from_jwt, token)
            claims = jwt.decode(token, key.key, algorithms=["RS256"], audience=f"projects/{self._project}",
                                issuer=f"https://firebaseappcheck.googleapis.com/{self._project}",
                                options={"require": ["exp", "iat", "sub"]})
            return bool(claims.get("sub"))
        except Exception as e:  # noqa: BLE001 - any failure means "not attested"
            log.info("app check rejected: %s", type(e).__name__)
            return False
