from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.firebase import verify_id_token, get_db

bearer = HTTPBearer()


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    try:
        decoded = verify_id_token(credentials.credentials)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    staff = _get_staff_by_uid(decoded["uid"])
    if not staff:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorised")

    # Attach role to the decoded token so routes can use it
    decoded["role"] = staff.get("role", "viewer")
    return decoded


def _get_staff_by_uid(uid: str) -> dict | None:
    """
    Query the staff collection for a document where the `uid` field
    matches — works regardless of what the document ID is.
    """
    db = get_db()
    docs = db.collection("staff").where("uid", "==", uid).limit(1).stream()
    for doc in docs:
        return doc.to_dict()
    return None