import os
from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import attendance, eod, inspector, schedule, email as email_router, dashboard, eow, eom, staff
from app.middleware.auth import verify_token
from app.middleware.security import (
    RateLimitMiddleware,
    BodySizeLimitMiddleware,
    SecurityHeadersMiddleware,
)

# ── App ───────────────────────────────────────────────────────────
IS_PRODUCTION = os.getenv("VERCEL_ENV") == "production" or bool(settings.frontend_url)

app = FastAPI(
    title="MT Admin API",
    redirect_slashes=False,
    docs_url=None if IS_PRODUCTION else "/docs",       
    redoc_url=None if IS_PRODUCTION else "/redoc",     
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(filter(None, [
        "http://localhost:5173",
        settings.frontend_url,
    ])),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["Authorization", "Content-Type"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(BodySizeLimitMiddleware)
app.add_middleware(RateLimitMiddleware)

PROTECTED = {"dependencies": [Depends(verify_token)]}

app.include_router(attendance.router,   prefix="/api/attendance", tags=["Attendance"], **PROTECTED)
app.include_router(eod.router,          prefix="/api/eod",        tags=["EOD"],        **PROTECTED)
app.include_router(eow.router,          prefix="/api/eow",        tags=["EOW"],        **PROTECTED)
app.include_router(inspector.router,    prefix="/api/inspector",  tags=["Inspector"],  **PROTECTED)
app.include_router(schedule.router,     prefix="/api/schedule",   tags=["Schedule"],   **PROTECTED)
app.include_router(email_router.router, prefix="/api/email",      tags=["Email"],      **PROTECTED)
app.include_router(dashboard.router,    prefix="/api/dashboard",  tags=["Dashboard"],  **PROTECTED)
app.include_router(eom.router,          prefix="/api/eom",        tags=["EOM"],        **PROTECTED)
app.include_router(staff.router,        prefix="/api/staff",      tags=["Staff"],                 )    

@app.get("/")
def root():
    return {"name": "MT Admin API", "status": "ok"}

@app.get("/health")
@app.head("/health")
def health():
    return {"status": "ok"}

@app.post("/cron/morning-report")
def cron_morning_report(request: Request):
    cron_secret = request.headers.get("x-cron-secret", "")

    if not settings.cron_secret or cron_secret != settings.cron_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")

    from app.routers.email import send_morning_report
    try:
        result = send_morning_report()
        return {"status": "sent", "result": result}
    except Exception as e:
        import logging
        logging.getLogger("mt_admin").exception("Cron morning report failed")
        return {"status": "error", "detail": "Report generation failed. Check server logs."}