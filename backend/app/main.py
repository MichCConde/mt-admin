from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import attendance, eod, inspector

app = FastAPI(title="MT Admin API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://your-project.web.app",  # Replace with your Firebase URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(attendance.router, prefix="/api/attendance", tags=["Attendance"])
app.include_router(eod.router,        prefix="/api/eod",        tags=["EOD"])
app.include_router(inspector.router,  prefix="/api/inspector",  tags=["Inspector"])

@app.get("/health")
def health():
    return {"status": "ok"}