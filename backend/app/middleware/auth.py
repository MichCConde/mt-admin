import os
import json
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from fastapi import Depends, Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# ── Initialize Firebase Admin SDK once ───────────────────────────
# Supports two modes:
#   1. FIREBASE_SERVICE_ACCOUNT_JSON env var (recommended for Render/prod)
#      Set this to the full JSON content of your service account key.
#   2. FIREBASE_SERVICE_ACCOUNT_PATH file path (local dev fallback)
#      Defaults to backend/serviceAccountKey.json

if not firebase_admin._apps:
    sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")

    if sa_json:
        # Production: load from env var (Render secret)
        try:
            sa_dict = json.loads(sa_json)
            cred = credentials.Certificate(sa_dict)
        except json.JSONDecodeError as e:
            raise RuntimeError(
                f"FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: {e}\n"
                "Make sure you pasted the full service account key JSON as the env var value."
            )
    else:
        # Local dev: load from file
        sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "serviceAccountKey.json")
        base_dir = os.path.dirname(
            os.path.dirname(
                os.path.dirname(os.path.abspath(__file__))
            )
        )
        full_path = os.path.join(base_dir, sa_path)

        if not os.path.exists(full_path):
            raise RuntimeError(
                f"Firebase service account not found.\n"
                "For local dev: copy your service account JSON to backend/serviceAccountKey.json\n"
                "For production: set the FIREBASE_SERVICE_ACCOUNT_JSON environment variable\n"
                "  (Go to Firebase Console → Project Settings → Service Accounts → Generate new private key)"
            )
        cred = credentials.Certificate(full_path)

    firebase_admin.initialize_app(cred)

# ── Bearer token extractor ────────────────────────────────────────
security = HTTPBearer(auto_error=False)


async def verify_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
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