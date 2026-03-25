from fastapi import APIRouter, Depends, HTTPException
from app.middleware.auth import verify_token
from app.firebase import get_db
from app.notion import get_active_vas
import logging

router = APIRouter(prefix="/api/va/inspector", tags=["va-inspector"])
log    = logging.getLogger(__name__)


def _get_vas_from_mirror() -> list[dict]:
    """Read VA list from Firestore mirror. Falls back to Notion if empty."""
    db   = get_db()
    docs = list(db.collection("va_mirror").stream())
    if docs:
        return [d.to_dict() for d in docs]
    # Firestore mirror empty — seed it from Notion
    vas = get_active_vas()
    _seed_mirror(vas)
    return vas


def _seed_mirror(vas: list[dict]):
    db    = get_db()
    batch = db.batch()
    for va in vas:
        ref = db.collection("va_mirror").document(va["id"])
        batch.set(ref, va)
    batch.commit()


@router.get("")
async def list_vas(user=Depends(verify_token)):
    try:
        vas = _get_vas_from_mirror()
        return {"total": len(vas), "vas": vas}
    except Exception as e:
        log.exception("Error fetching VA list")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{va_id}")
async def get_va(va_id: str, user=Depends(verify_token)):
    try:
        db  = get_db()
        doc = db.collection("va_mirror").document(va_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="VA not found")
        return doc.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        log.exception("Error fetching VA %s", va_id)
        raise HTTPException(status_code=500, detail=str(e))