from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from ..deps import pool

router = APIRouter(tags=["health"])


@router.get("/healthz")
async def healthz():
    return {"ok": True}


@router.get("/readyz")
async def readyz(db=Depends(pool)):
    try:
        await db.fetchval("select 1 from paisa.registries limit 1")
    except Exception:
        return JSONResponse({"ok": False}, status_code=503)
    return {"ok": True}
