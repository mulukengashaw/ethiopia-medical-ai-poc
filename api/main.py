from fastapi import FastAPI, HTTPException, Request, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
import base64
import hashlib
import hmac
import io
import json
import logging
import os
import random
import secrets
import time
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Literal
from urllib.parse import urlencode

from dotenv import load_dotenv
import google.auth.transport.requests
import google.oauth2.id_token
import numpy as np
import requests
import bcrypt
import pymysql
import torch
from PIL import Image, ImageOps, UnidentifiedImageError
from fastapi.responses import FileResponse
from xray_model import ChestXrayScreeningModel

load_dotenv(Path(__file__).with_name(".env"), override=True)

app = FastAPI(title="Ethiopia Medical AI API")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI",
    "http://localhost:8000/api/auth/google/callback",
)
GOOGLE_SESSION_SECRET = os.getenv("GOOGLE_SESSION_SECRET")
GOOGLE_STATE_COOKIE = "ethio_google_state"
GOOGLE_SESSION_COOKIE = "ethio_session"
GOOGLE_SESSION_MAX_AGE = 7 * 24 * 60 * 60
PROJECT_ROOT = Path(__file__).resolve().parent.parent
XRAY_MODEL_PATH = Path(os.getenv(
    "XRAY_MODEL_PATH",
    str(PROJECT_ROOT / "models" / "tb_screening.pt"),
))
XRAY_IMAGE_ROOT = PROJECT_ROOT / "data" / "private" / "xrays"
XRAY_UPLOAD_MAX_BYTES = 10 * 1024 * 1024
XRAY_MODEL = None
XRAY_MODEL_METADATA = None

if XRAY_MODEL_PATH.is_file():
    try:
        checkpoint = torch.load(XRAY_MODEL_PATH, map_location="cpu", weights_only=True)
        if checkpoint.get("format_version") != 1:
            raise ValueError("Unsupported X-ray model artifact format")
        loaded_model = ChestXrayScreeningModel()
        loaded_model.load_state_dict(checkpoint["model_state_dict"])
        loaded_model.eval()
        XRAY_MODEL = loaded_model
        XRAY_MODEL_METADATA = {
            key: checkpoint[key]
            for key in (
                "threshold",
                "held_out_test_metrics",
                "limitations",
                "created_at_utc",
                "input_size",
                "architecture",
                "dataset_class_counts",
            )
        }
        logging.info("Loaded local research X-ray model from %s", XRAY_MODEL_PATH)
    except Exception:
        logging.exception("Local X-ray model could not be loaded; screening is unavailable")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/stats")
async def get_stats():
    return {
        "totalScans": 4203 + random.randint(1, 10),
        "aiAccuracy": 94.7,
        "voicesAnalyzed": 1739 + random.randint(1, 5),
        "activeModels": 3
    }

@app.get("/api/recent-diagnoses")
async def get_recent_diagnoses():
    return [
        {
            "id": 1,
            "patient_id": "Patient #6420",
            "type": "Chest X-ray",
            "result": "Tuberculosis Detected",
            "confidence": 92.7,
            "time_ago": "2 min ago",
            "status": "Positive"
        },
        {
            "id": 2,
            "patient_id": "Patient #6419",
            "type": "Voice Triage",
            "result": "Symptoms: Cough, Fever",
            "confidence": 96.4,
            "time_ago": "18 min ago",
            "status": "Review"
        },
        {
            "id": 3,
            "patient_id": "Patient #6418",
            "type": "Chest X-ray",
            "result": "Normal",
            "confidence": 98.1,
            "time_ago": "1 hour ago",
            "status": "Normal"
        }
    ]

@app.post("/api/analyze-xray")
async def analyze_xray(file: UploadFile = File(...)):
    raise HTTPException(
        status_code=501,
        detail=(
            "Automated X-ray image interpretation is not configured. "
            "Have a qualified reader interpret the image and enter their report."
        ),
    )


@app.get("/api/xray-screening/status")
def get_xray_screening_status():
    if XRAY_MODEL is None or XRAY_MODEL_METADATA is None:
        return {
            "available": False,
            "message": (
                "No trained model is loaded. Run api/train_xray_model.py if needed, "
                "then restart the API."
            ),
        }
    return {
        "available": True,
        "mode": "research-only",
        "metrics": XRAY_MODEL_METADATA["held_out_test_metrics"],
        "limitations": XRAY_MODEL_METADATA["limitations"],
        "datasetClassCounts": XRAY_MODEL_METADATA["dataset_class_counts"],
        "modelCreatedAt": XRAY_MODEL_METADATA["created_at_utc"],
    }


@app.post("/api/patients/{patient_id}/xray-screenings", status_code=201)
async def screen_patient_xray(patient_id: int, request: Request, image: UploadFile = File(...)):
    user = require_signed_in_user(request)
    if XRAY_MODEL is None or XRAY_MODEL_METADATA is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "No trained model is loaded. Run api/train_xray_model.py if needed, "
                "then restart the API."
            ),
        )
    if image.content_type not in {"image/png", "image/jpeg"}:
        raise HTTPException(status_code=415, detail="Upload a PNG or JPEG chest X-ray.")

    image_bytes = await image.read(XRAY_UPLOAD_MAX_BYTES + 1)
    if not image_bytes:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")
    if len(image_bytes) > XRAY_UPLOAD_MAX_BYTES:
        raise HTTPException(status_code=413, detail="X-ray image must be 10 MB or smaller.")

    try:
        with Image.open(io.BytesIO(image_bytes)) as source:
            if source.format not in {"PNG", "JPEG"}:
                raise HTTPException(status_code=415, detail="Upload a valid PNG or JPEG image.")
            source.verify()
        with Image.open(io.BytesIO(image_bytes)) as source:
            if source.width < 128 or source.height < 128 or source.width * source.height > 16_000_000:
                raise HTTPException(
                    status_code=400,
                    detail="Image dimensions must be at least 128×128 and no more than 16 megapixels.",
                )
            safe_image = ImageOps.exif_transpose(source).convert("RGB")
            grayscale = safe_image.convert("L").resize(
                (XRAY_MODEL_METADATA["input_size"], XRAY_MODEL_METADATA["input_size"]),
                Image.Resampling.BILINEAR,
            )
            pixels = np.asarray(grayscale, dtype=np.float32) / 255.0
            tensor = torch.from_numpy(pixels).unsqueeze(0).unsqueeze(0)
            tensor = (tensor - 0.5) / 0.25
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid PNG or JPEG image.",
        )

    connection = None
    stored_path = None
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id FROM patients WHERE id = %s AND user_id = %s",
                (patient_id, user["id"]),
            )
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Patient record not found")

        with torch.inference_mode():
            score = float(torch.sigmoid(XRAY_MODEL(tensor)).item())
        threshold = float(XRAY_MODEL_METADATA["threshold"])
        flagged = score >= threshold

        safe_image_bytes = io.BytesIO()
        safe_image.save(safe_image_bytes, format="PNG", optimize=True)
        stored_bytes = safe_image_bytes.getvalue()
        image_digest = hashlib.sha256(stored_bytes).hexdigest()
        stored_path = (
            XRAY_IMAGE_ROOT / str(user["id"]) / str(patient_id) / f"{uuid.uuid4().hex}.png"
        )
        stored_path.parent.mkdir(parents=True, exist_ok=True)
        stored_path.write_bytes(stored_bytes)
        relative_path = stored_path.relative_to(PROJECT_ROOT).as_posix()

        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO xray_screenings
                    (user_id, patient_id, stored_image_path, image_sha256,
                     model_score, review_threshold, review_flagged, model_version,
                     held_out_test_metrics)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    user["id"],
                    patient_id,
                    relative_path,
                    image_digest,
                    score,
                    threshold,
                    flagged,
                    XRAY_MODEL_METADATA["created_at_utc"],
                    json.dumps(XRAY_MODEL_METADATA["held_out_test_metrics"]),
                ),
            )
            screening_id = cursor.lastrowid
        connection.commit()
    except HTTPException:
        if stored_path:
            stored_path.unlink(missing_ok=True)
        raise
    except Exception:
        if stored_path:
            stored_path.unlink(missing_ok=True)
        logging.exception("Failed to save patient X-ray screening")
        raise HTTPException(status_code=500, detail="Could not save X-ray screening to the patient")
    finally:
        if connection and connection.open:
            connection.close()

    return {
        "id": screening_id,
        "patientId": patient_id,
        "imageSha256": image_digest,
        "modelScore": round(score, 4),
        "reviewThreshold": round(threshold, 4),
        "reviewFlagged": flagged,
        "label": (
            "Research model flagged for clinician review"
            if flagged
            else "Below research review threshold; clinician review is still required"
        ),
        "modelVersion": XRAY_MODEL_METADATA["created_at_utc"],
        "heldOutTestMetrics": XRAY_MODEL_METADATA["held_out_test_metrics"],
        "limitations": XRAY_MODEL_METADATA["limitations"],
        "createdAt": datetime.now().isoformat(timespec="seconds"),
    }


@app.get("/api/patients/{patient_id}/xray-screenings")
def list_patient_xray_screenings(patient_id: int, request: Request):
    user = require_signed_in_user(request)
    connection = None
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, image_sha256, model_score, review_threshold, review_flagged,
                       model_version, held_out_test_metrics, created_at
                FROM xray_screenings
                WHERE user_id = %s AND patient_id = %s
                ORDER BY created_at DESC, id DESC
                """,
                (user["id"], patient_id),
            )
            rows = cursor.fetchall()
        return [
            {
                "id": row["id"],
                "imageSha256": row["image_sha256"],
                "modelScore": round(float(row["model_score"]), 4),
                "reviewThreshold": round(float(row["review_threshold"]), 4),
                "reviewFlagged": bool(row["review_flagged"]),
                "modelVersion": row["model_version"],
                "heldOutTestMetrics": decode_json_column(row["held_out_test_metrics"]),
                "createdAt": row["created_at"].isoformat(timespec="seconds"),
            }
            for row in rows
        ]
    except Exception:
        logging.exception("Failed to load patient X-ray screenings")
        raise HTTPException(status_code=500, detail="Could not load X-ray screenings")
    finally:
        if connection and connection.open:
            connection.close()


@app.get("/api/patients/{patient_id}/xray-screenings/{screening_id}/image")
def get_patient_xray_image(patient_id: int, screening_id: int, request: Request):
    user = require_signed_in_user(request)
    connection = None
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT stored_image_path
                FROM xray_screenings
                WHERE id = %s AND patient_id = %s AND user_id = %s
                """,
                (screening_id, patient_id, user["id"]),
            )
            row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="X-ray image not found")
    except HTTPException:
        raise
    except Exception:
        logging.exception("Failed to look up patient X-ray image")
        raise HTTPException(status_code=500, detail="Could not load X-ray image")
    finally:
        if connection and connection.open:
            connection.close()

    image_path = (PROJECT_ROOT / row["stored_image_path"]).resolve()
    if not image_path.is_relative_to(XRAY_IMAGE_ROOT.resolve()) or not image_path.is_file():
        raise HTTPException(status_code=404, detail="X-ray image file not found")
    return FileResponse(
        image_path,
        media_type="image/png",
        filename=f"patient-xray-{screening_id}.png",
        content_disposition_type="inline",
        headers={"Cache-Control": "no-store"},
    )


@app.post("/api/analyze-voice")
async def analyze_voice(file: UploadFile = File(None)):
    # Simulate processing
    time.sleep(2)
    return {
        "transcript_am": "ታካሚው ሳል፣ ትኩሳት እና የደረት ህመም አለው።",
        "transcript_en": "The patient has a cough, fever, and chest pain.",
        "symptoms": ["Cough (ሳል)", "Fever (ትኩሳት)", "Chest Pain (የደረት ህመም)"]
    }

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import re
from pydantic import BaseModel, EmailStr, Field

# ---- Database Setup (XAMPP MySQL) ----
def get_db_connection():
    return pymysql.connect(
        host='localhost',
        user='root',
        password='',
        database='ethiomed_db',
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )

class UserSignup(BaseModel):
    fullName: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str


class PatientCreate(BaseModel):
    fullName: str = Field(min_length=1, max_length=150)
    phone: str | None = Field(default=None, max_length=40)
    dateOfBirth: date | None = None
    gender: str | None = Field(default=None, max_length=30)
    notes: str | None = Field(default=None, max_length=5000)


class PatientUpdate(BaseModel):
    fullName: str | None = Field(default=None, min_length=1, max_length=150)
    phone: str | None = Field(default=None, max_length=40)
    dateOfBirth: date | None = None
    gender: str | None = Field(default=None, max_length=30)
    notes: str | None = Field(default=None, max_length=5000)


class AppointmentCreate(BaseModel):
    patientId: int = Field(gt=0)
    scheduledAt: datetime
    reason: str = Field(min_length=1, max_length=200)
    location: str | None = Field(default=None, max_length=150)


class AppointmentUpdate(BaseModel):
    scheduledAt: datetime | None = None
    reason: str | None = Field(default=None, min_length=1, max_length=200)
    location: str | None = Field(default=None, max_length=150)
    status: Literal["scheduled", "completed", "cancelled"] | None = None


class ClinicalAssessmentCreate(BaseModel):
    patientId: int = Field(gt=0)
    radiologyReport: str = Field(min_length=1, max_length=10000)


class MedicationPlanCreate(BaseModel):
    medicationName: str = Field(min_length=1, max_length=200)
    dose: str = Field(min_length=1, max_length=150)
    route: str = Field(min_length=1, max_length=100)
    frequency: str = Field(min_length=1, max_length=150)
    duration: str = Field(min_length=1, max_length=150)
    timing: str = Field(min_length=1, max_length=250)
    instructions: str | None = Field(default=None, max_length=2000)
    guidelinePages: list[int] = Field(default_factory=list, max_length=10)
    clinicianConfirmed: Literal[True]


def google_auth_ready():
    missing = [
        name
        for name, value in (
            ("GOOGLE_CLIENT_ID", GOOGLE_CLIENT_ID),
            ("GOOGLE_CLIENT_SECRET", GOOGLE_CLIENT_SECRET),
            ("GOOGLE_SESSION_SECRET", GOOGLE_SESSION_SECRET),
        )
        if not value
    ]
    if missing:
        logging.warning(
            "Google OAuth is not configured; missing environment variables: %s",
            ", ".join(missing),
        )
        return False
    return True


def google_auth_redirect(result):
    return RedirectResponse(
        f"{FRONTEND_URL}/?google_auth={result}",
        status_code=303,
    )


def clear_google_state_cookie(response):
    response.delete_cookie(
        GOOGLE_STATE_COOKIE,
        path="/",
        secure=GOOGLE_REDIRECT_URI.startswith("https://"),
        httponly=True,
        samesite="lax",
    )
    return response


def create_auth_session(user):
    payload = {
        "id": user["id"],
        "fullName": user["full_name"],
        "email": user["email"],
        "exp": int(time.time()) + GOOGLE_SESSION_MAX_AGE,
    }
    encoded_payload = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    ).rstrip(b"=").decode("ascii")
    signature = hmac.new(
        GOOGLE_SESSION_SECRET.encode("utf-8"),
        encoded_payload.encode("ascii"),
        hashlib.sha256,
    ).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).rstrip(b"=").decode("ascii")
    return f"{encoded_payload}.{encoded_signature}"


def read_auth_session(session_cookie):
    if not session_cookie or not GOOGLE_SESSION_SECRET:
        return None

    try:
        encoded_payload, encoded_signature = session_cookie.split(".", 1)
        expected_signature = hmac.new(
            GOOGLE_SESSION_SECRET.encode("utf-8"),
            encoded_payload.encode("ascii"),
            hashlib.sha256,
        ).digest()
        signature = base64.urlsafe_b64decode(
            encoded_signature + "=" * (-len(encoded_signature) % 4)
        )
        if not hmac.compare_digest(signature, expected_signature):
            return None

        payload = base64.urlsafe_b64decode(
            encoded_payload + "=" * (-len(encoded_payload) % 4)
        )
        session = json.loads(payload)
        if session.get("exp", 0) <= int(time.time()):
            return None
        return session
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


def require_signed_in_user(request: Request):
    user = read_auth_session(request.cookies.get(GOOGLE_SESSION_COOKIE))
    if not user:
        raise HTTPException(status_code=401, detail="Please sign in to access this data")
    return user


@app.get("/api/auth/google")
def start_google_sign_in():
    if not google_auth_ready():
        return google_auth_redirect("not_configured")

    state = secrets.token_urlsafe(32)
    query = urlencode({
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    })
    response = RedirectResponse(
        f"https://accounts.google.com/o/oauth2/v2/auth?{query}",
        status_code=302,
    )
    response.set_cookie(
        GOOGLE_STATE_COOKIE,
        state,
        max_age=600,
        httponly=True,
        secure=GOOGLE_REDIRECT_URI.startswith("https://"),
        samesite="lax",
        path="/",
    )
    return response


@app.get("/api/auth/google/callback")
def finish_google_sign_in(
    request: Request,
    code: str = None,
    state: str = None,
    error: str = None,
):
    if (
        error
        or not code
        or not state
        or not google_auth_ready()
        or not secrets.compare_digest(state, request.cookies.get(GOOGLE_STATE_COOKIE, ""))
    ):
        return clear_google_state_cookie(google_auth_redirect("error"))

    try:
        token_response = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
            timeout=10,
        )
        if not token_response.ok:
            try:
                oauth_error = token_response.json().get("error")
            except (ValueError, AttributeError):
                oauth_error = None

            if oauth_error == "invalid_client":
                logging.error(
                    "Google rejected the OAuth client credentials. Verify that "
                    "the client ID and secret belong to the same active web client."
                )
                return clear_google_state_cookie(
                    google_auth_redirect("client_config")
                )
            if oauth_error == "invalid_grant":
                logging.error(
                    "Google rejected the OAuth authorization code. Verify the "
                    "registered redirect URI and retry with a fresh sign-in."
                )
                return clear_google_state_cookie(
                    google_auth_redirect("authorization")
                )

        token_response.raise_for_status()
        id_token = token_response.json().get("id_token")
        if not id_token:
            raise ValueError("Google did not return an ID token")

        claims = google.oauth2.id_token.verify_oauth2_token(
            id_token,
            google.auth.transport.requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except (requests.RequestException, ValueError, google.auth.exceptions.GoogleAuthError):
        logging.exception("Google OAuth token verification failed")
        return clear_google_state_cookie(google_auth_redirect("error"))

    google_id = claims.get("sub")
    email = claims.get("email")
    if not google_id or not email or claims.get("email_verified") is not True:
        logging.warning("Google OAuth returned an unverified or incomplete profile")
        return clear_google_state_cookie(google_auth_redirect("error"))

    full_name = claims.get("name") or email.split("@", 1)[0]
    connection = None
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id, full_name, email, google_id FROM users WHERE google_id = %s",
                (google_id,),
            )
            user = cursor.fetchone()

            if not user:
                cursor.execute(
                    "SELECT id, full_name, email, google_id FROM users WHERE email = %s",
                    (email,),
                )
                user = cursor.fetchone()

                if user and user["google_id"] not in (None, google_id):
                    logging.warning("Google sign-in email is linked to another Google account")
                    return clear_google_state_cookie(google_auth_redirect("error"))

                if user:
                    cursor.execute(
                        "UPDATE users SET google_id = %s WHERE id = %s",
                        (google_id, user["id"]),
                    )
                else:
                    random_password_hash = bcrypt.hashpw(
                        secrets.token_bytes(32),
                        bcrypt.gensalt(),
                    ).decode("utf-8")
                    cursor.execute(
                        "INSERT INTO users (full_name, email, password_hash, google_id) "
                        "VALUES (%s, %s, %s, %s)",
                        (full_name, email, random_password_hash, google_id),
                    )
                    user = {
                        "id": cursor.lastrowid,
                        "full_name": full_name,
                        "email": email,
                    }

        connection.commit()
    except Exception:
        logging.exception("Google OAuth account lookup or creation failed")
        return clear_google_state_cookie(google_auth_redirect("error"))
    finally:
        if connection and connection.open:
            connection.close()

    response = clear_google_state_cookie(google_auth_redirect("success"))
    response.set_cookie(
        GOOGLE_SESSION_COOKIE,
        create_auth_session(user),
        max_age=GOOGLE_SESSION_MAX_AGE,
        httponly=True,
        secure=GOOGLE_REDIRECT_URI.startswith("https://"),
        samesite="lax",
        path="/",
    )
    return response


@app.get("/api/auth/session")
def get_auth_session(request: Request):
    session = read_auth_session(request.cookies.get(GOOGLE_SESSION_COOKIE))
    if not session:
        raise HTTPException(status_code=401, detail="No active Google session")
    return {
        "success": True,
        "user": {
            "id": session["id"],
            "fullName": session["fullName"],
            "email": session["email"],
        },
    }


@app.post("/api/auth/logout")
def logout_google_session():
    response = Response(status_code=204)
    response.delete_cookie(
        GOOGLE_SESSION_COOKIE,
        path="/",
        secure=GOOGLE_REDIRECT_URI.startswith("https://"),
        httponly=True,
        samesite="lax",
    )
    return response



# ---- Gmail SMTP Config ----
GMAIL_SENDER = os.getenv("GMAIL_SENDER", "muluken19943@gmail.com")
GMAIL_APP_PWD = os.getenv("GMAIL_APP_PASSWORD")

def send_welcome_email(to_email: str, full_name: str):
    """Send a styled welcome email after successful signup."""
    if not GMAIL_SENDER or not GMAIL_APP_PWD:
        logging.warning("Welcome email skipped because Gmail SMTP is not configured")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "✅ Welcome to EthioMed AI — Account Created"
        msg["From"]    = f"EthioMed AI <{GMAIL_SENDER}>"
        msg["To"]      = to_email

        html = f"""
        <html><body style="font-family:Inter,sans-serif;background:#f9f9f9;padding:0;margin:0;">
          <div style="max-width:520px;margin:30px auto;background:#fff;border-radius:16px;
                      overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.08);">
            <!-- Header -->
            <div style="background:linear-gradient(135deg,#f97316,#ea580c);padding:32px;text-align:center;">
              <h1 style="color:#fff;margin:0;font-size:26px;">EthioMed AI 🏥</h1>
              <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:13px;">Medical Diagnostics Platform</p>
            </div>
            <!-- Body -->
            <div style="padding:32px;">
              <h2 style="color:#1a1a2e;margin:0 0 12px;">Welcome, {full_name}! 👋</h2>
              <p style="color:#555;line-height:1.7;font-size:14px;">
                Your account has been successfully created on <strong>EthioMed AI</strong>.<br/>
                You can now log in and access:
              </p>
              <ul style="color:#555;font-size:14px;line-height:1.9;padding-left:20px;">
                <li>🫁 <strong>TB Chest X-Ray Analysis</strong> — AI-powered diagnostics</li>
                <li>🎤 <strong>Amharic Voice Assistant</strong> — NLP symptom extraction</li>
                <li>📋 <strong>Clinical Guidelines</strong> — Ethiopian STG database</li>
                <li>👥 <strong>Patient Management</strong> — Track patient history</li>
              </ul>
              <div style="text-align:center;margin-top:28px;">
                <a href="http://localhost:5173" style="display:inline-block;padding:13px 32px;
                   background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;border-radius:8px;
                   text-decoration:none;font-weight:700;font-size:15px;">
                  Go to Dashboard →
                </a>
              </div>
            </div>
            <!-- Footer -->
            <div style="background:#fafafa;padding:16px;text-align:center;
                        border-top:1px solid #f0f0f0;font-size:12px;color:#aaa;">
              🇪🇹 EthioMed AI Research Platform &mdash; For Research Use Only
            </div>
          </div>
        </body></html>
        """
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(GMAIL_SENDER, GMAIL_APP_PWD)
            server.sendmail(GMAIL_SENDER, to_email, msg.as_string())
        print(f"✅ Welcome email sent to {to_email}")
    except Exception:
        print(f"⚠️  Email sending failed (non-critical): {e}")

@app.post("/api/signup")
def signup_user(user: UserSignup):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Check if user exists
            cursor.execute("SELECT * FROM users WHERE email = %s", (user.email,))
            if cursor.fetchone():
                return {"success": False, "message": "Email already registered"}
            
            # Hash password
            hashed = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            # Insert user
            cursor.execute(
                "INSERT INTO users (full_name, email, password_hash) VALUES (%s, %s, %s)",
                (user.fullName, user.email, hashed)
            )
        conn.commit()

        # Send welcome email (non-blocking — if it fails, signup still works)
        send_welcome_email(user.email, user.fullName)

        return {"success": True, "message": "User registered successfully!"}
    except Exception as e:
        return {"success": False, "message": f"Server error: {str(e)}"}
    finally:
        if conn and conn.open:
            conn.close()


@app.post("/api/login")
def login_user(user: UserLogin):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, full_name, password_hash FROM users WHERE email = %s", (user.email,))
            db_user = cursor.fetchone()
            
            if not db_user:
                return {"success": False, "message": "Invalid email or password"}
                
            # Verify password
            if bcrypt.checkpw(user.password.encode('utf-8'), db_user['password_hash'].encode('utf-8')):
                response = Response(
                    content=json.dumps({
                        "success": True,
                        "message": "Login successful",
                        "user": {
                            "id": db_user['id'],
                            "fullName": db_user['full_name'],
                            "email": user.email,
                        },
                    }),
                    media_type="application/json",
                )
                response.set_cookie(
                    GOOGLE_SESSION_COOKIE,
                    create_auth_session({
                        "id": db_user["id"],
                        "full_name": db_user["full_name"],
                        "email": user.email,
                    }),
                    max_age=GOOGLE_SESSION_MAX_AGE,
                    httponly=True,
                    secure=GOOGLE_REDIRECT_URI.startswith("https://"),
                    samesite="lax",
                    path="/",
                )
                return response
            else:
                return {"success": False, "message": "Invalid email or password"}
    except Exception as e:
        return {"success": False, "message": f"Server error: {str(e)}"}
    finally:
        if conn and conn.open:
            conn.close()


@app.get("/api/patients")
def list_patients(request: Request):
    user = require_signed_in_user(request)
    connection = None
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT p.id, p.full_name, p.phone, p.date_of_birth, p.gender, p.notes,
                       DATE_FORMAT(
                           MAX(CASE WHEN a.status = 'completed' THEN a.scheduled_at END),
                           '%%Y-%%m-%%d'
                       ) AS last_visit
                FROM patients p
                LEFT JOIN appointments a
                    ON a.patient_id = p.id AND a.user_id = p.user_id
                WHERE p.user_id = %s
                GROUP BY p.id, p.full_name, p.phone, p.date_of_birth, p.gender, p.notes
                ORDER BY p.full_name, p.id
                """,
                (user["id"],),
            )
            rows = cursor.fetchall()
        return [
            {
                "id": row["id"],
                "fullName": row["full_name"],
                "phone": row["phone"],
                "dateOfBirth": row["date_of_birth"],
                "gender": row["gender"],
                "notes": row["notes"],
                "lastVisit": row["last_visit"],
            }
            for row in rows
        ]
    except Exception:
        logging.exception("Failed to load patient records")
        raise HTTPException(status_code=500, detail="Could not load patient records")
    finally:
        if connection and connection.open:
            connection.close()


@app.post("/api/patients", status_code=201)
def create_patient(patient: PatientCreate, request: Request):
    user = require_signed_in_user(request)
    full_name = patient.fullName.strip()
    if not full_name:
        raise HTTPException(status_code=422, detail="Patient name cannot be blank")

    connection = None
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO patients (user_id, full_name, phone, date_of_birth, gender, notes)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    user["id"],
                    full_name,
                    patient.phone,
                    patient.dateOfBirth,
                    patient.gender,
                    patient.notes,
                ),
            )
            patient_id = cursor.lastrowid
        connection.commit()
        return {"id": patient_id, "fullName": full_name}
    except Exception:
        logging.exception("Failed to create patient record")
        raise HTTPException(status_code=500, detail="Could not save patient record")
    finally:
        if connection and connection.open:
            connection.close()


@app.patch("/api/patients/{patient_id}")
def update_patient(patient_id: int, patient: PatientUpdate, request: Request):
    user = require_signed_in_user(request)
    updates = patient.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No patient fields were provided")
    if "fullName" in updates:
        if updates["fullName"] is None:
            raise HTTPException(status_code=422, detail="Patient name cannot be blank")
        updates["fullName"] = updates["fullName"].strip()
        if not updates["fullName"]:
            raise HTTPException(status_code=422, detail="Patient name cannot be blank")

    column_names = {
        "fullName": "full_name",
        "phone": "phone",
        "dateOfBirth": "date_of_birth",
        "gender": "gender",
        "notes": "notes",
    }
    assignments = ", ".join(
        f"{column_names[field]} = %s" for field in updates
    )
    connection = None
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute(
                f"UPDATE patients SET {assignments} WHERE id = %s AND user_id = %s",
                (*updates.values(), patient_id, user["id"]),
            )
            if cursor.rowcount == 0:
                cursor.execute(
                    "SELECT id FROM patients WHERE id = %s AND user_id = %s",
                    (patient_id, user["id"]),
                )
                if not cursor.fetchone():
                    raise HTTPException(status_code=404, detail="Patient record not found")
        connection.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception:
        logging.exception("Failed to update patient record")
        raise HTTPException(status_code=500, detail="Could not update patient record")
    finally:
        if connection and connection.open:
            connection.close()


@app.get("/api/appointments")
def list_appointments(request: Request):
    user = require_signed_in_user(request)
    connection = None
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT a.id, a.patient_id, p.full_name AS patient_name, a.scheduled_at,
                       a.reason, a.location, a.status
                FROM appointments a
                INNER JOIN patients p
                    ON p.id = a.patient_id AND p.user_id = a.user_id
                WHERE a.user_id = %s
                ORDER BY a.scheduled_at ASC, a.id ASC
                """,
                (user["id"],),
            )
            rows = cursor.fetchall()
        return [
            {
                "id": row["id"],
                "patientId": row["patient_id"],
                "patientName": row["patient_name"],
                "scheduledAt": row["scheduled_at"].isoformat(timespec="minutes"),
                "reason": row["reason"],
                "location": row["location"],
                "status": row["status"],
            }
            for row in rows
        ]
    except Exception:
        logging.exception("Failed to load appointments")
        raise HTTPException(status_code=500, detail="Could not load appointments")
    finally:
        if connection and connection.open:
            connection.close()


@app.post("/api/appointments", status_code=201)
def create_appointment(appointment: AppointmentCreate, request: Request):
    user = require_signed_in_user(request)
    reason = appointment.reason.strip()
    if not reason:
        raise HTTPException(status_code=422, detail="Appointment reason cannot be blank")
    connection = None
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id FROM patients WHERE id = %s AND user_id = %s",
                (appointment.patientId, user["id"]),
            )
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Patient record not found")
            cursor.execute(
                """
                INSERT INTO appointments
                    (user_id, patient_id, scheduled_at, reason, location, status)
                VALUES (%s, %s, %s, %s, %s, 'scheduled')
                """,
                (
                    user["id"],
                    appointment.patientId,
                    appointment.scheduledAt,
                    reason,
                    appointment.location,
                ),
            )
            appointment_id = cursor.lastrowid
        connection.commit()
        return {"id": appointment_id, "success": True}
    except HTTPException:
        raise
    except Exception:
        logging.exception("Failed to create appointment")
        raise HTTPException(status_code=500, detail="Could not save appointment")
    finally:
        if connection and connection.open:
            connection.close()


@app.patch("/api/appointments/{appointment_id}")
def update_appointment(
    appointment_id: int,
    appointment: AppointmentUpdate,
    request: Request,
):
    user = require_signed_in_user(request)
    updates = appointment.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No appointment fields were provided")
    for field in ("scheduledAt", "reason", "status"):
        if field in updates and updates[field] is None:
            raise HTTPException(status_code=422, detail=f"{field} cannot be blank")
    if "reason" in updates:
        updates["reason"] = updates["reason"].strip()
        if not updates["reason"]:
            raise HTTPException(status_code=422, detail="Appointment reason cannot be blank")

    column_names = {
        "scheduledAt": "scheduled_at",
        "reason": "reason",
        "location": "location",
        "status": "status",
    }
    assignments = ", ".join(
        f"{column_names[field]} = %s" for field in updates
    )
    connection = None
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute(
                f"UPDATE appointments SET {assignments} WHERE id = %s AND user_id = %s",
                (*updates.values(), appointment_id, user["id"]),
            )
            if cursor.rowcount == 0:
                cursor.execute(
                    "SELECT id FROM appointments WHERE id = %s AND user_id = %s",
                    (appointment_id, user["id"]),
                )
                if not cursor.fetchone():
                    raise HTTPException(status_code=404, detail="Appointment not found")
        connection.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception:
        logging.exception("Failed to update appointment")
        raise HTTPException(status_code=500, detail="Could not update appointment")
    finally:
        if connection and connection.open:
            connection.close()


def search_guideline_passages(query: str, limit: int = 5):
    if not knowledge_base or tfidf_matrix is None:
        return []

    query_vector = vectorizer.transform([query])
    scores = cosine_similarity(query_vector, tfidf_matrix).flatten()
    ranked = scores.argsort()[::-1]
    matches = []
    for index in ranked:
        score = float(scores[index])
        if score < 0.04 or len(matches) >= limit:
            break
        matches.append({
            "page": knowledge_pages[index],
            "text": knowledge_base[index],
            "relevance": round(score, 3),
        })
    return matches


def decode_json_column(value):
    if isinstance(value, str):
        return json.loads(value)
    return value


@app.post("/api/clinical-assessments", status_code=201)
def create_clinical_assessment(assessment: ClinicalAssessmentCreate, request: Request):
    user = require_signed_in_user(request)
    report = assessment.radiologyReport.strip()
    if not report:
        raise HTTPException(status_code=422, detail="Radiology report cannot be blank")
    matches = search_guideline_passages(report)

    connection = None
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id FROM patients WHERE id = %s AND user_id = %s",
                (assessment.patientId, user["id"]),
            )
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Patient record not found")
            cursor.execute(
                """
                INSERT INTO clinical_assessments
                    (user_id, patient_id, radiology_report, guideline_matches)
                VALUES (%s, %s, %s, %s)
                """,
                (
                    user["id"],
                    assessment.patientId,
                    report,
                    json.dumps(matches),
                ),
            )
            assessment_id = cursor.lastrowid
        connection.commit()
        return {
            "id": assessment_id,
            "patientId": assessment.patientId,
            "radiologyReport": report,
            "guidelineMatches": matches,
            "createdAt": datetime.now().isoformat(timespec="seconds"),
        }
    except HTTPException:
        raise
    except Exception:
        logging.exception("Failed to save radiology report")
        raise HTTPException(status_code=500, detail="Could not save radiology report")
    finally:
        if connection and connection.open:
            connection.close()


@app.get("/api/patients/{patient_id}/clinical-assessments")
def list_clinical_assessments(patient_id: int, request: Request):
    user = require_signed_in_user(request)
    connection = None
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, radiology_report, guideline_matches, created_at
                FROM clinical_assessments
                WHERE patient_id = %s AND user_id = %s
                ORDER BY created_at DESC, id DESC
                """,
                (patient_id, user["id"]),
            )
            rows = cursor.fetchall()

            assessment_ids = [row["id"] for row in rows]
            medication_plans = {}
            if assessment_ids:
                placeholders = ", ".join(["%s"] * len(assessment_ids))
                cursor.execute(
                    f"""
                    SELECT id, assessment_id, medication_name, dose, route, frequency,
                           duration, timing, instructions, guideline_pages, created_at
                    FROM medication_plans
                    WHERE user_id = %s AND patient_id = %s
                      AND assessment_id IN ({placeholders})
                    ORDER BY created_at, id
                    """,
                    (user["id"], patient_id, *assessment_ids),
                )
                for medication in cursor.fetchall():
                    medication_plans.setdefault(medication["assessment_id"], []).append({
                        "id": medication["id"],
                        "medicationName": medication["medication_name"],
                        "dose": medication["dose"],
                        "route": medication["route"],
                        "frequency": medication["frequency"],
                        "duration": medication["duration"],
                        "timing": medication["timing"],
                        "instructions": medication["instructions"],
                        "guidelinePages": decode_json_column(medication["guideline_pages"]),
                        "createdAt": medication["created_at"].isoformat(timespec="seconds"),
                    })

        return [
            {
                "id": row["id"],
                "radiologyReport": row["radiology_report"],
                "guidelineMatches": decode_json_column(row["guideline_matches"]),
                "medicationPlans": medication_plans.get(row["id"], []),
                "createdAt": row["created_at"].isoformat(timespec="seconds"),
            }
            for row in rows
        ]
    except Exception:
        logging.exception("Failed to load patient clinical reports")
        raise HTTPException(status_code=500, detail="Could not load clinical reports")
    finally:
        if connection and connection.open:
            connection.close()


@app.post("/api/clinical-assessments/{assessment_id}/medication-plans", status_code=201)
def add_medication_plan(
    assessment_id: int,
    medication: MedicationPlanCreate,
    request: Request,
):
    user = require_signed_in_user(request)
    normalized = medication.model_dump(exclude={"clinicianConfirmed"})
    for field in ("medicationName", "dose", "route", "frequency", "duration", "timing"):
        normalized[field] = normalized[field].strip()
        if not normalized[field]:
            raise HTTPException(status_code=422, detail=f"{field} cannot be blank")
    if normalized["instructions"] is not None:
        normalized["instructions"] = normalized["instructions"].strip() or None

    connection = None
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, patient_id, guideline_matches
                FROM clinical_assessments
                WHERE id = %s AND user_id = %s
                """,
                (assessment_id, user["id"]),
            )
            assessment = cursor.fetchone()
            if not assessment:
                raise HTTPException(status_code=404, detail="Clinical report not found")

            available_pages = {
                match["page"]
                for match in decode_json_column(assessment["guideline_matches"])
            }
            if not set(normalized["guidelinePages"]).issubset(available_pages):
                raise HTTPException(
                    status_code=422,
                    detail="Selected guideline page was not retrieved for this report",
                )

            cursor.execute(
                """
                INSERT INTO medication_plans
                    (user_id, patient_id, assessment_id, medication_name, dose, route,
                     frequency, duration, timing, instructions, guideline_pages,
                     clinician_confirmed)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE)
                """,
                (
                    user["id"],
                    assessment["patient_id"],
                    assessment_id,
                    normalized["medicationName"],
                    normalized["dose"],
                    normalized["route"],
                    normalized["frequency"],
                    normalized["duration"],
                    normalized["timing"],
                    normalized["instructions"],
                    json.dumps(normalized["guidelinePages"]),
                ),
            )
            medication_id = cursor.lastrowid
        connection.commit()
        return {"id": medication_id, "success": True}
    except HTTPException:
        raise
    except Exception:
        logging.exception("Failed to save clinician-reviewed medication plan")
        raise HTTPException(status_code=500, detail="Could not save medication plan")
    finally:
        if connection and connection.open:
            connection.close()


class ChatRequest(BaseModel):
    message: str
import PyPDF2
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

knowledge_base = []
knowledge_pages = []
vectorizer = TfidfVectorizer(stop_words='english')
tfidf_matrix = None

def load_pdf_knowledge():
    global knowledge_base, knowledge_pages, tfidf_matrix
    pdf_path = Path(__file__).resolve().parent.parent / "data" / "raw" / "STG-General-Hospital.pdf"
    
    if not os.path.exists(pdf_path):
        print(f"Warning: PDF not found at {pdf_path}")
        return

    print(f"Indexing Ethiopian treatment guidelines from {pdf_path.name}...")
    try:
        with open(pdf_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            knowledge_base = []
            knowledge_pages = []
            for page_number, page in enumerate(reader.pages, start=1):
                extracted = page.extract_text()
                if not extracted:
                    continue

                page_text = re.sub(r'\s+', ' ', extracted).strip()
                sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z0-9])', page_text)
                chunk = ""
                for sentence in sentences:
                    sentence = sentence.strip()
                    if not sentence:
                        continue
                    if chunk and len(chunk) + len(sentence) + 1 > 1200:
                        if len(chunk) >= 80:
                            knowledge_base.append(chunk)
                            knowledge_pages.append(page_number)
                        chunk = ""
                    chunk = f"{chunk} {sentence}".strip()
                if len(chunk) >= 80:
                    knowledge_base.append(chunk)
                    knowledge_pages.append(page_number)
        
        if knowledge_base:
            tfidf_matrix = vectorizer.fit_transform(knowledge_base)
            print(
                f"Indexed {len(knowledge_base)} passages from "
                f"{len(reader.pages)} guideline pages."
            )
    except Exception:
        knowledge_base = []
        knowledge_pages = []
        tfidf_matrix = None
        logging.exception("Failed to index Ethiopian treatment guidelines")

# Load the knowledge base when the module is imported/run
load_pdf_knowledge()

class ChatRequest(BaseModel):
    message: str

@app.post("/api/chat")
async def chat_with_guidelines(request: ChatRequest):
    time.sleep(1)
    query = request.message.lower().strip()
    
    # 1. Handle Normal Conversations (Greetings, Identity, etc.)
    greetings = ["hello", "hi", "hey", "ሰላም", "ጤና ይስጥልኝ"]
    identity_questions = ["who are you", "what are you", "ማነህ", "ምን ነህ"]
    how_are_you = ["how are you", "how are you doing", "እንዴት ነህ", "እንዴት ነዎት"]
    
    if any(query.startswith(g) or query == g for g in greetings):
        return {"reply": "Hello! ሰላም! I am the Ethiopia Medical AI Assistant. How can I help you today?", "sources": []}
    
    if any(q in query for q in identity_questions):
        return {"reply": "I am an AI assistant built to help answer questions based on the Ethiopian Standard Treatment Guidelines (STG).", "sources": []}
        
    if any(q in query for q in how_are_you):
        return {"reply": "I'm functioning perfectly, thank you for asking! What medical guidelines can I look up for you?", "sources": []}

    # 2. If not a normal conversation, check the PDF Guidelines
    if not knowledge_base or tfidf_matrix is None:
        return {
            "reply": "The STG PDF could not be loaded into the local NLP engine.",
            "sources": []
        }
    
    # Simple Local Dictionary for Amharic to English
    amharic_dict = {
        "የሳንባ ነቀርሳ": "tuberculosis",
        "ሳል": "cough",
        "ትኩሳት": "fever",
        "ወባ": "malaria",
        "ኤች አይ ቪ": "hiv",
        "የደረት ህመም": "chest pain",
        "ህፃናት": "pediatric",
        "እርግዝና": "pregnancy",
        "ስኳር": "diabetes",
        "ደም ግፊት": "hypertension",
        "መድሃኒት": "treatment medication"
    }
    
    search_query = query
    is_amharic = False
    for amh, eng in amharic_dict.items():
        if amh in query:
            search_query = search_query.replace(amh, eng)
            is_amharic = True
            
    # Clean up common conversational prefixes for better PDF matching
    prefixes_to_remove = ["what is ", "tell me about ", "how to treat ", "can you explain "]
    for prefix in prefixes_to_remove:
        if search_query.startswith(prefix):
            search_query = search_query.replace(prefix, "")
            
    matches = search_guideline_passages(search_query, limit=1)
    
    if matches:
        answer = matches[0]["text"]
        best_score = matches[0]["relevance"]
        page_number = matches[0]["page"]
        
        # Make the reply sound conversational
        reply_text = f"Based on the Standard Treatment Guidelines:\n\n{answer}"
        if is_amharic:
            reply_text = f"(ማሳሰቢያ፡ መፅሀፉ በእንግሊዘኛ ስለሆነ መልሱን በእንግሊዘኛ አምጥቼዋለሁ)\n\n" + reply_text
            
        return {
            "reply": reply_text,
            "sources": [
                f"STG-General-Hospital.pdf, page {page_number} "
                f"(Relevance: {best_score:.2f})"
            ]
        }
    else:
        return {
            "reply": "I couldn't find a direct match in the STG guidelines for that specific medical question. Could you provide more details or use different medical terms?",
            "sources": []
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
