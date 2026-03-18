import os
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from fastapi import Depends, Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# ── Initialize Firebase Admin SDK once ───────────────────────────
if not firebase_admin._apps:
    sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "serviceAccountKey.json")

    base_dir = os.path.dirname(
        os.path.dirname(
            os.path.dirname(os.path.abspath(__file__))
        )
    )
    full_path = os.path.join(base_dir, sa_path)

    if not os.path.exists(full_path):
        raise RuntimeError(
            f"Firebase service account file not found at: {full_path}\n"
            "Steps to fix:\n"
            "  1. Go to Firebase Console → Project Settings → Service Accounts\n"
            "  2. Click 'Generate new private key' — saves a .json file\n"
            "  3. Copy that file to: backend/service_account.json\n"
            "  4. Make sure FIREBASE_SERVICE_ACCOUNT_PATH=service_account.json in backend/.env"
        )

    cred = credentials.Certificate(full_path)
    firebase_admin.initialize_app(cred)

# ── Bearer token extractor ────────────────────────────────────────
security = HTTPBearer(auto_error=False)


async def verify_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),  # ← wired correctly
) -> dict:
    """
    FastAPI dependency — verifies the Firebase ID token sent in the
    Authorization: Bearer <token> header on every protected request.
    """
    if request.url.path == "/health":
        return {}

    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=401,
            detail="Authorization header missing. Please sign in.",
        )

    try:
        decoded = firebase_auth.verify_id_token(credentials.credentials)
        return decoded
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid token. Please sign in again.")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")