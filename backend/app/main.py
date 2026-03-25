import logging
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.notion.client import get_database_meta

# ── Routers ───────────────────────────────────────────────────────────────────
from app.routers.va.eod        import router as va_eod_router
from app.routers.va.attendance import router as va_att_router
from app.routers.va.inspector  import router as va_ins_router
from app.routers.va.schedule   import router as va_sched_router

from app.routers.internal.dashboard import router as dash_router
from app.routers.internal.eow       import router as eow_router
from app.routers.internal.activity  import router as activity_router
from app.routers.internal.sync      import router as sync_router

from app.routers.email.daily  import router as email_daily_router
from app.routers.email.eow    import router as email_eow_router
from app.routers.email.alerts import router as email_alerts_router

# ── App setup ─────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Monster Task API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten to your frontend domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers ──────────────────────────────────────────────────────────
app.include_router(va_eod_router)
app.include_router(va_att_router)
app.include_router(va_ins_router)
app.include_router(va_sched_router)

app.include_router(dash_router)
app.include_router(eow_router)
app.include_router(activity_router)
app.include_router(sync_router)

app.include_router(email_daily_router)
app.include_router(email_eow_router)
app.include_router(email_alerts_router)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    """Verifies Notion connectivity — used by UptimeRobot."""
    try:
        get_database_meta(settings.notion_va_db_id)
        return {"status": "ok", "notion": "reachable"}
    except Exception as e:
        return {"status": "degraded", "notion": str(e)}


# ── Cron endpoints ────────────────────────────────────────────────────────────
@app.post("/cron/sync")
async def cron_sync(x_cron_secret: str = Header(None)):
    from app.routers.internal.sync import cron_sync as _sync
    return await _sync(x_cron_secret=x_cron_secret)


@app.post("/cron/eow-email")
async def cron_eow(x_cron_secret: str = Header(None)):
    from app.routers.email.eow import cron_eow as _eow
    return await _eow(x_cron_secret=x_cron_secret)