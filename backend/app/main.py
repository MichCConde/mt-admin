import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.routers import attendance, eod, inspector, schedule, email as email_router, dashboard
from app.middleware.auth import verify_token

# ── App ───────────────────────────────────────────────────────────
app = FastAPI(
    title="MT Admin API",
    redirect_slashes=False,
)

_frontend_url = os.getenv("FRONTEND_URL", "")
_allowed_origins = list(filter(None, [
    "http://localhost:5173",
    _frontend_url,
]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Protected routes ──────────────────────────────────────────────
PROTECTED = {"dependencies": [Depends(verify_token)]}

app.include_router(attendance.router,    prefix="/api/attendance", tags=["Attendance"], **PROTECTED)
app.include_router(eod.router,           prefix="/api/eod",        tags=["EOD"],        **PROTECTED)
app.include_router(inspector.router,     prefix="/api/inspector",  tags=["Inspector"],  **PROTECTED)
app.include_router(schedule.router,      prefix="/api/schedule",   tags=["Schedule"],   **PROTECTED)
app.include_router(email_router.router,  prefix="/api/email",      tags=["Email"],      **PROTECTED)
app.include_router(dashboard.router,     prefix="/api/dashboard",  tags=["Dashboard"],  **PROTECTED)

# ── Health check (no auth) ────────────────────────────────────────
@app.get("/")
def root():
    return {"name": "MT Admin API", "status": "ok", "docs": "/docs"}

@app.get("/health")
def health():
    return {"status": "ok"}

# ── Cron endpoint for morning email report ────────────────────────
# Vercel calls this automatically at 8:00 AM EST (13:00 UTC)
# Protected by a secret token so only Vercel can trigger it
@app.post("/cron/morning-report")
def cron_morning_report(x_cron_secret: str = None):
    cron_secret = os.getenv("CRON_SECRET")
    if not cron_secret or x_cron_secret != cron_secret:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Unauthorized")

    from app.routers.email import send_morning_report
    try:
        result = send_morning_report()
        return {"status": "sent", "result": result}
    except Exception as e:
        return {"status": "error", "detail": str(e)}