import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.routers import attendance, eod, inspector, schedule, email as email_router
from app.middleware.auth import verify_token, security

# ── Scheduler ─────────────────────────────────────────────────────
scheduler = BackgroundScheduler()

def run_morning_report():
    from app.routers.email import send_morning_report
    try:
        result = send_morning_report()
        print(f"[Scheduler] Morning report sent: {result}")
    except Exception as e:
        print(f"[Scheduler] Morning report failed: {e}")

scheduler.add_job(
    run_morning_report,
    CronTrigger(hour=13, minute=0, timezone="UTC"),  # 8:00 AM EST
    id="morning_eod_report",
    replace_existing=True,
)

# ── App lifecycle ─────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    print("[Scheduler] Started — morning report at 8:00 AM EST")
    yield
    scheduler.shutdown()

# ── App ───────────────────────────────────────────────────────────
app = FastAPI(title="MT Admin API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        os.getenv("FRONTEND_URL", "https://your-project.web.app"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# All routes require a valid Firebase token except /health
PROTECTED = {"dependencies": [Depends(security), Depends(verify_token)]}

app.include_router(attendance.router,   prefix="/api/attendance", tags=["Attendance"], **PROTECTED)
app.include_router(eod.router,          prefix="/api/eod",        tags=["EOD"],        **PROTECTED)
app.include_router(inspector.router,    prefix="/api/inspector",  tags=["Inspector"],  **PROTECTED)
app.include_router(schedule.router,     prefix="/api/schedule",   tags=["Schedule"],   **PROTECTED)
app.include_router(email_router.router, prefix="/api/email",      tags=["Email"],      **PROTECTED)

@app.get("/health")
def health():
    return {"status": "ok", "scheduler": scheduler.running}