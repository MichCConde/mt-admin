"""
Staff management — admin only.
CRUD for Firebase Auth users + Firestore staff documents.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from firebase_admin import auth as firebase_auth, firestore

router = APIRouter()
security = HTTPBearer(auto_error=False)

VALID_ROLES = {"admin", "recruitment", "sme"}


def _get_db():
    return firestore.client()


# ── Admin-only dependency ─────────────────────────────────────────

async def require_admin(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Verifies Firebase token AND checks the caller is an admin.
    Used as a route-level dependency on all staff management endpoints.
    """
    from app.middleware.auth import verify_token
    token = await verify_token(request, credentials)

    uid = token.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    db = _get_db()
    docs = db.collection("staff").where("uid", "==", uid).limit(1).get()
    if not docs:
        raise HTTPException(status_code=403, detail="Staff record not found.")

    role = docs[0].to_dict().get("role", "")
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")

    return token


# ── Models ────────────────────────────────────────────────────────

class StaffCreate(BaseModel):
    email: str
    name: str
    role: str = "sme"
    password: str

class StaffUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    disabled: bool | None = None

class PasswordReset(BaseModel):
    email: str


# ── Routes ────────────────────────────────────────────────────────

@router.get("")
async def list_staff(token: dict = Depends(require_admin)):
    """List all staff members."""
    db = _get_db()
    docs = db.collection("staff").get()

    # Collect all UIDs for a single batch lookup
    staff_data = []
    identifiers = []
    for doc in docs:
        data = doc.to_dict()
        staff_data.append({"doc_id": doc.id, **data})
        if data.get("uid"):
            identifiers.append(firebase_auth.UidIdentifier(data["uid"]))

    # One batch call instead of N individual calls
    auth_lookup = {}
    if identifiers:
        try:
            result = firebase_auth.get_users(identifiers)
            for fb_user in result.users:
                auth_lookup[fb_user.uid] = {
                    "disabled": fb_user.disabled,
                    "last_sign_in": fb_user.user_metadata.last_sign_in_timestamp,
                }
        except Exception:
            pass  # Graceful fallback — just won't have auth status

    staff_list = []
    for s in staff_data:
        auth_info = auth_lookup.get(s.get("uid"), {})
        staff_list.append({
            "doc_id":       s["doc_id"],
            "uid":          s.get("uid", ""),
            "name":         s.get("name", ""),
            "email":        s.get("email", ""),
            "role":         s.get("role", "sme"),
            "disabled":     auth_info.get("disabled"),
            "last_sign_in": auth_info.get("last_sign_in"),
        })

    staff_list.sort(key=lambda s: s["name"].lower())
    return {"staff": staff_list}


@router.post("")
async def create_staff(body: StaffCreate, token: dict = Depends(require_admin)):
    """Create a new staff member (Firebase Auth user + Firestore doc)."""
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")

    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    # Create Firebase Auth user
    try:
        fb_user = firebase_auth.create_user(
            email=body.email.strip(),
            password=body.password,
            display_name=body.name.strip(),
        )
    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(status_code=409, detail="A user with this email already exists.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create auth user: {str(e)}")

    # Create Firestore staff document
    db = _get_db()
    doc_ref = db.collection("staff").document()
    doc_ref.set({
        "uid":   fb_user.uid,
        "name":  body.name.strip(),
        "email": body.email.strip().lower(),
        "role":  body.role,
    })

    return {
        "created": True,
        "uid":     fb_user.uid,
        "doc_id":  doc_ref.id,
        "name":    body.name.strip(),
        "email":   body.email.strip().lower(),
        "role":    body.role,
    }


@router.put("/{doc_id}")
async def update_staff(doc_id: str, body: StaffUpdate, token: dict = Depends(require_admin)):
    """Update a staff member's name or role."""
    if body.role and body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")

    db = _get_db()
    doc_ref = db.collection("staff").document(doc_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Staff member not found.")

    data = doc.to_dict()

    # Prevent demoting yourself from admin
    caller_uid = token.get("uid")
    if data.get("uid") == caller_uid and body.role and body.role != "admin":
        raise HTTPException(status_code=400, detail="You cannot change your own admin role.")

    updates = {}
    if body.name is not None:
        updates["name"] = body.name.strip()
    if body.role is not None:
        updates["role"] = body.role

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update.")

    doc_ref.update(updates)

    # Also update Firebase Auth display name if name changed
    if body.disabled is not None and data.get("uid"):
        try:
            firebase_auth.update_user(data["uid"], disabled=body.disabled)
        except Exception:
            pass

    return {"updated": True, "doc_id": doc_id, **updates}


@router.delete("/{doc_id}")
async def delete_staff(doc_id: str, token: dict = Depends(require_admin)):
    """Delete a staff member (disables Firebase Auth + deletes Firestore doc)."""
    db = _get_db()
    doc_ref = db.collection("staff").document(doc_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Staff member not found.")

    data = doc.to_dict()

    # Prevent deleting yourself
    caller_uid = token.get("uid")
    if data.get("uid") == caller_uid:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")

    # Disable Firebase Auth user (safer than hard delete — can be recovered)
    if data.get("uid"):
        try:
            firebase_auth.update_user(data["uid"], disabled=True)
        except Exception:
            pass  # Continue even if auth update fails

    # Delete Firestore doc
    doc_ref.delete()

    return {"deleted": True, "doc_id": doc_id, "email": data.get("email")}


@router.post("/reset-password")
async def send_password_reset(body: PasswordReset, token: dict = Depends(require_admin)):
    """Send a password reset email to a staff member."""
    try:
        link = firebase_auth.generate_password_reset_link(body.email.strip())
        return {"sent": True, "email": body.email.strip(), "link": link}
    except firebase_auth.UserNotFoundError:
        raise HTTPException(status_code=404, detail="No user found with this email.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate reset link: {str(e)}")