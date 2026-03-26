from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.middleware.auth import verify_token

from app.routers.va.attendance import router as attendance_router
from app.routers.va.eod        import router as eod_router
from app.routers.va.inspector  import router as inspector_router
from app.routers.va.schedule   import router as schedule_router
from app.routers.internal.dashboard import router as dashboard_router
from app.routers.internal.eow       import router as eow_router
from app.routers.internal.activity  import router as activity_router
from app.routers.email.daily        import router as email_router

app = FastAPI(title="MT Admin API", redirect_slashes=False)

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

PROTECTED = {"dependencies": [Depends(verify_token)]}

app.include_router(attendance_router, prefix="/api/attendance", tags=["Attendance"], **PROTECTED)
app.include_router(eod_router,        prefix="/api/eod",        tags=["EOD"],        **PROTECTED)
app.include_router(eow_router,        prefix="/api/eow",        tags=["EOW"],        **PROTECTED)
app.include_router(inspector_router,  prefix="/api/inspector",  tags=["Inspector"],  **PROTECTED)
app.include_router(schedule_router,   prefix="/api/schedule",   tags=["Schedule"],   **PROTECTED)
app.include_router(email_router,      prefix="/api/email",      tags=["Email"],      **PROTECTED)
app.include_router(dashboard_router,  prefix="/api/dashboard",  tags=["Dashboard"],  **PROTECTED)
app.include_router(activity_router,   prefix="/api/activity",   tags=["Activity"],   **PROTECTED)


@app.get("/")
def root():
    return {"name": "MT Admin API", "status": "ok"}


@app.get("/health")
@app.head("/health")
def health():
    return {"status": "ok"}


@app.post("/cron/morning-report")
def cron_morning_report(x_cron_secret: str = None):
    from fastapi import HTTPException
    if not settings.cron_secret or x_cron_secret != settings.cron_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")
    from app.routers.email.daily import send_morning_report
    try:
        return send_morning_report()
    except Exception as e:
        return {"status": "error", "detail": str(e)}