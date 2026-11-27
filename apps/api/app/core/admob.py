from __future__ import annotations

import asyncio
import base64
import binascii
import re
import time
from urllib.parse import parse_qsl

import httpx
from cryptography.exceptions import InvalidSignature, UnsupportedAlgorithm
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec

KEYS_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json"
SIGNATURE = re.compile(rb"&signature=([A-Za-z0-9_-]+={0,2})&key_id=([0-9]{1,20})\Z")


class AdMobVerifier:
    def __init__(self) -> None:
        self._keys: dict[str, ec.EllipticCurvePublicKey] = {}
        self._loaded_at = float("-inf")
        self._lock = asyncio.Lock()

    async def _key(self, key_id: str, client: httpx.AsyncClient) -> ec.EllipticCurvePublicKey | None:
        async with self._lock:
            age = time.monotonic() - self._loaded_at
            if age >= 6 * 60 * 60 or (key_id not in self._keys and age >= 60):
                response = await client.get(KEYS_URL)
                response.raise_for_status()
                keys = {}
                for entry in response.json()["keys"]:
                    key = serialization.load_pem_public_key(entry["pem"].encode("ascii"))
                    if isinstance(key, ec.EllipticCurvePublicKey) and isinstance(key.curve, ec.SECP256R1):
                        keys[str(entry["keyId"])] = key
                if not keys:
                    raise ValueError("AdMob keyset is empty")
                self._keys, self._loaded_at = keys, time.monotonic()
            return self._keys.get(key_id)

    async def verify(self, query: bytes, client: httpx.AsyncClient) -> tuple[bytes, dict[str, str]] | None:
        sig = SIGNATURE.search(query) if len(query) <= 8192 else None
        if sig is None:
            return None
        message = query[:sig.start()]
        try:
            signature = base64.b64decode(sig[1] + b"=" * (-len(sig[1]) % 4), altchars=b"-_", validate=True)
            fields = parse_qsl(message.decode("ascii"), strict_parsing=True, errors="strict", max_num_fields=20)
        except (ValueError, binascii.Error):
            return None
        params = dict(fields)
        if len(params) != len(fields) or "signature" in params or "key_id" in params:
            return None
        key = await self._key(sig[2].decode("ascii"), client)
        if key is None:
            return None
        try:
            key.verify(signature, message, ec.ECDSA(hashes.SHA256()))
        except InvalidSignature:
            return None
        return message, params


KEY_LOOKUP_ERRORS = (httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError, UnsupportedAlgorithm)
