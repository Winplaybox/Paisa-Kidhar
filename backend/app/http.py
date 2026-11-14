"""Shared async HTTP client (connection pooling keeps Supabase round-trips fast)."""

from __future__ import annotations

import httpx

_client: httpx.AsyncClient | None = None


def client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(15.0, connect=5.0), http2=False, limits=httpx.Limits(max_connections=50, max_keepalive_connections=20)
        )
    return _client


async def close() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
