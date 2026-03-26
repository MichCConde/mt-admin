import os
import json
import firebase_admin
from firebase_admin import credentials, firestore, auth as firebase_auth
from app.config import settings


def _init():
    if firebase_admin._apps:
        return
    if settings.firebase_service_account_json:
        try:
            sa_dict = json.loads(settings.firebase_service_account_json)
            cred = credentials.Certificate(sa_dict)
        except json.JSONDecodeError as e:
            raise RuntimeError(f"FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: {e}")
    else:
        base_dir  = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        full_path = os.path.join(base_dir, settings.firebase_service_account_path)
        if not os.path.exists(full_path):
            raise RuntimeError(f"Firebase service account not found at: {full_path}")
        cred = credentials.Certificate(full_path)
    firebase_admin.initialize_app(cred)


def get_db():
    _init()
    return firestore.client()


def verify_id_token(token: str) -> dict:
    _init()
    return firebase_auth.verify_id_token(token)