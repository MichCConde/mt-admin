from fastapi import Depends, Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.firebase import verify_id_token

security = HTTPBearer(auto_error=False)


async def verify_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    if request.url.path in ("/health", "/"):
        return {}
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Authorization header missing. Please sign in.")
    try:
        decoded = verify_id_token(credentials.credentials)
        return decoded
    except Exception as e:
        msg = str(e)
        if "expired" in msg.lower():
            raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
        raise HTTPException(status_code=401, detail="Invalid token. Please sign in again.")