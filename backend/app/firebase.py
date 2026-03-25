import firebase_admin
from firebase_admin import credentials, firestore, auth as firebase_auth
from app.config import settings

def init_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(settings.firebase_service_account)
        firebase_admin.initialize_app(cred)
        
def get_db():
    init_firebase()
    return firestore.client()

def verify_id_token(token: str) -> dict:
    init_firebase()
    return firebase_auth.verify_id_token(token)