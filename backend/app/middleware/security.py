"""
Security middleware for MT Admin.
- Rate limiting (in-memory, per-IP)
- Request body size limits
- Security headers
- Date parameter validation
"""

import time
import re
from collections import defaultdict
from datetime import datetime, timedelta
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


# ══════════════════════════════════════════════════════════════════
# 1. RATE LIMITER
# ══════════════════════════════════════════════════════════════════

class RateLimitStore:
    """Simple in-memory sliding window rate limiter."""

    def __init__(self):
        self._hits: dict[str, list[float]] = defaultdict(list)

    def is_limited(self, key: str, max_hits: int, window_seconds: int) -> bool:
        now = time.time()
        cutoff = now - window_seconds
        # Clean old entries
        self._hits[key] = [t for t in self._hits[key] if t > cutoff]
        if len(self._hits[key]) >= max_hits:
            return True
        self._hits[key].append(now)
        return False

    def remaining(self, key: str, max_hits: int, window_seconds: int) -> int:
        now = time.time()
        cutoff = now - window_seconds
        recent = [t for t in self._hits[key] if t > cutoff]
        return max(0, max_hits - len(recent))


_store = RateLimitStore()

# Rate limit configs: path_prefix → (max_requests, window_seconds)
RATE_LIMITS = {
    "/cron/":       (5,  15 * 60),   # 5 per 15 min — cron/auth-like
    "/api/email/":  (10, 15 * 60),   # 10 per 15 min — email sends
    "/api/":        (60, 60),        # 60 per minute — general API
    "/health":      (30, 60),        # 30 per minute — health checks
}


def _get_client_ip(request: Request) -> str:
    """Extract client IP, respecting Vercel's forwarded header."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _get_rate_limit(path: str) -> tuple[int, int] | None:
    """Find the matching rate limit for a path."""
    for prefix, limits in RATE_LIMITS.items():
        if path.startswith(prefix):
            return limits
    return None


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        limits = _get_rate_limit(path)

        if limits:
            max_hits, window = limits
            ip = _get_client_ip(request)
            key = f"{ip}:{path.split('/')[1]}"  # group by IP + first path segment

            if _store.is_limited(key, max_hits, window):
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Please try again later."},
                    headers={"Retry-After": str(window)},
                )

        return await call_next(request)


# ══════════════════════════════════════════════════════════════════
# 2. REQUEST BODY SIZE LIMIT
# ══════════════════════════════════════════════════════════════════

MAX_BODY_BYTES = 1 * 1024 * 1024  # 1 MB


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_BODY_BYTES:
            return JSONResponse(
                status_code=413,
                content={"detail": "Request body too large. Maximum size is 1 MB."},
            )
        return await call_next(request)


# ══════════════════════════════════════════════════════════════════
# 3. SECURITY HEADERS
# ══════════════════════════════════════════════════════════════════

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response


# ══════════════════════════════════════════════════════════════════
# 4. DATE PARAMETER VALIDATOR (use as a dependency)
# ══════════════════════════════════════════════════════════════════

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def validate_date(date: str) -> str:
    """
    Validates a YYYY-MM-DD date string.
    Use as: date: str = Query(...), then call validate_date(date) at the top of routes.
    """
    if not _DATE_RE.match(date):
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    try:
        parsed = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date. Check month/day values.")

    # Reject dates more than 1 year in the past or future
    now = datetime.now()
    if parsed < now - timedelta(days=365):
        raise HTTPException(status_code=400, detail="Date too far in the past (max 1 year).")
    if parsed > now + timedelta(days=7):
        raise HTTPException(status_code=400, detail="Date cannot be more than 7 days in the future.")

    return date


def validate_date_range_30d(date: str) -> str:
    """Stricter validator for email sends — max 30 days in the past."""
    date = validate_date(date)
    parsed = datetime.strptime(date, "%Y-%m-%d")
    if parsed < datetime.now() - timedelta(days=30):
        raise HTTPException(status_code=400, detail="Email reports limited to the last 30 days.")
    return date


# ══════════════════════════════════════════════════════════════════
# 5. SAFE ERROR HANDLER (strips internal details)
# ══════════════════════════════════════════════════════════════════

def safe_error(e: Exception) -> HTTPException:
    """
    Log the real error, return a sanitized message to the client.
    Usage: except Exception as e: raise safe_error(e)
    """
    import logging
    logging.getLogger("mt_admin").exception("Internal error")
    return HTTPException(
        status_code=500,
        detail="An internal error occurred. Please try again or contact support.",
    )