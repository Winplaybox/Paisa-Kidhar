from __future__ import annotations

import logging

import asyncpg
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

log = logging.getLogger("paisa.errors")


class AppError(Exception):
    status = 400
    code = "bad_request"

    def __init__(self, message: str, *, code: str | None = None, status: int | None = None):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        if status:
            self.status = status


class NotFound(AppError):
    status, code = 404, "not_found"


class Forbidden(AppError):
    status, code = 403, "forbidden"


class Unauthorized(AppError):
    status, code = 401, "unauthorized"


class Conflict(AppError):
    status, code = 409, "conflict"


class RateLimited(AppError):
    status, code = 429, "rate_limited"


def _body(request: Request, code: str, message: str, details=None) -> dict:
    out = {"error": {"code": code, "message": message, "request_id": getattr(request.state, "request_id", None)}}
    if details is not None:
        out["error"]["details"] = details
    return out


def install(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError):
        return JSONResponse(_body(request, exc.code, exc.message), status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        details = [{"loc": list(e.get("loc", [])), "msg": e.get("msg")} for e in exc.errors()]
        return JSONResponse(_body(request, "validation_error", "Please check the highlighted fields.", details), status_code=422)

    @app.exception_handler(asyncpg.DataError)
    async def _bad_data(request: Request, exc: asyncpg.DataError):
        log.info("data error: %s", exc)
        return JSONResponse(_body(request, "not_found", "Not found."), status_code=404)

    @app.exception_handler(asyncpg.CheckViolationError)
    async def _check(request: Request, exc: asyncpg.CheckViolationError):
        return JSONResponse(_body(request, "validation_error", "Some values are not allowed."), status_code=422)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        log.exception("unhandled error", extra={"request_id": getattr(request.state, "request_id", None)})
        return JSONResponse(_body(request, "internal_error", "Something went wrong. Please try again."), status_code=500)
