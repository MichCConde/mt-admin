from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import attendance, eod, inspector, schedule, email as email_router, dashboard, eow, eom
from app.middleware.auth import verify_token

# ── App ───────────────────────────────────────────────────────────
app = FastAPI(
    title="MT Admin API",
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(filter(None, [
        "http://localhost:5173",
        settings.frontend_url,
    ])),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Protected routes ──────────────────────────────────────────────
PROTECTED = {"dependencies": [Depends(verify_token)]}

app.include_router(attendance.router,   prefix="/api/attendance", tags=["Attendance"], **PROTECTED)
app.include_router(eod.router,          prefix="/api/eod",        tags=["EOD"],        **PROTECTED)
app.include_router(eow.router,          prefix="/api/eow",        tags=["EOW"],        **PROTECTED)
app.include_router(inspector.router,    prefix="/api/inspector",  tags=["Inspector"],  **PROTECTED)
app.include_router(schedule.router,     prefix="/api/schedule",   tags=["Schedule"],   **PROTECTED)
app.include_router(email_router.router, prefix="/api/email",      tags=["Email"],      **PROTECTED)
app.include_router(dashboard.router,    prefix="/api/dashboard",  tags=["Dashboard"],  **PROTECTED)
app.include_router(eom.router,          prefix="/api/eom",        tags=["EOM"],        **PROTECTED)
# app.include_router(ai.router,           prefix="/api/ai",         tags=["AI"],         **PROTECTED)

# ── Health check (no auth) ────────────────────────────────────────
@app.get("/")
def root():
    return {"name": "MT Admin API", "status": "ok", "docs": "/docs"}

@app.get("/health")
@app.head("/health")
def health():
    return {"status": "ok"}

# ── Cron endpoint for morning email report ────────────────────────
@app.post("/cron/morning-report")
def cron_morning_report(x_cron_secret: str = None):
    from fastapi import HTTPException
    if not settings.cron_secret or x_cron_secret != settings.cron_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")

    from app.routers.email import send_morning_report
    try:
        result = send_morning_report()
        return {"status": "sent", "result": result}
    except Exception as e:
        return {"status": "error", "detail": str(e)}