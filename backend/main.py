import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

import bcrypt
import joblib
import jwt
from fastapi import Depends, FastAPI, File, HTTPException, Query, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from backend.db import Analysis, Base, User, engine, get_db

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me-in-production")
TOKEN_MINUTES = 60 * 24
MAX_CHARS = 100_000
MAX_UPLOAD_BYTES = 2_000_000

MODEL_PATH = Path(__file__).resolve().parent.parent / "ml" / "baseline_model.joblib"
bundle = joblib.load(MODEL_PATH)
vectorizer, model = bundle["vectorizer"], bundle["model"]

Base.metadata.create_all(engine)

app = FastAPI(title="AI Content Inspector")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ---------- helpers ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode()[:72], hashed.encode())


def create_token(user_id: int) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_MINUTES)
    return jwt.encode({"sub": str(user_id), "exp": expires}, SECRET_KEY, algorithm="HS256")


def get_current_user(token: str = Depends(oauth2), db: Session = Depends(get_db)) -> User:
    error = HTTPException(401, "Invalid or expired token",
                          headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise error
    user = db.get(User, user_id)
    if user is None:
        raise error
    return user


def run_model(text: str) -> dict:
    words = len(text.split())
    p_ai = float(model.predict_proba(vectorizer.transform([text]))[0][1])
    label = "AI" if p_ai >= 0.5 else "Human"
    return {
        "label": label,
        "confidence": round(p_ai if label == "AI" else 1 - p_ai, 4),
        "ai_probability": round(p_ai, 4),
        "word_count": words,
        "warning": "Text is short; result may be unreliable." if words < 50 else None,
    }


def iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def analysis_dict(a: Analysis, preview: bool = False) -> dict:
    d = {
        "id": a.id,
        "label": a.label,
        "confidence": a.confidence,
        "ai_probability": a.ai_probability,
        "word_count": a.word_count,
        "source_filename": a.source_filename,
        "created_at": iso(a.created_at),
    }
    if preview:
        d["text_preview"] = a.text[:200]
    else:
        d["text"] = a.text
    return d


def save_analysis(db: Session, user: User, text: str, filename: str | None = None) -> dict:
    result = run_model(text)
    row = Analysis(
        user_id=user.id, text=text, label=result["label"],
        confidence=result["confidence"], ai_probability=result["ai_probability"],
        word_count=result["word_count"], source_filename=filename,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    out = analysis_dict(row)
    out["warning"] = result["warning"]
    return out


# ---------- schemas ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(default="", max_length=120)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    full_name: str
    created_at: datetime


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=120)
    current_password: str | None = None
    new_password: str | None = Field(default=None, min_length=8, max_length=72)


class TextIn(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_CHARS)


# ---------- auth routes ----------
@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/register", response_model=UserOut, status_code=201)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    email = data.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "This email is already registered")
    user = User(email=email, full_name=data.full_name.strip(),
                password_hash=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/api/auth/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == form.username.lower()))
    if user is None or not verify_password(form.password, user.password_hash):
        raise HTTPException(401, "Wrong email or password")
    return {"access_token": create_token(user.id), "token_type": "bearer"}


@app.get("/api/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@app.put("/api/auth/me", response_model=UserOut)
def update_me(data: ProfileUpdate, user: User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    if data.full_name is not None:
        user.full_name = data.full_name.strip()
    if data.new_password:
        if not data.current_password or not verify_password(data.current_password, user.password_hash):
            raise HTTPException(400, "Current password is incorrect")
        user.password_hash = hash_password(data.new_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ---------- prediction routes ----------
@app.post("/api/predict")
def predict(data: TextIn):
    """Public quick test: predicts but does not save anything."""
    return run_model(data.text)


@app.post("/api/analyses", status_code=201)
def create_analysis(data: TextIn, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    return save_analysis(db, user, data.text.strip())


@app.post("/api/analyses/upload", status_code=201)
async def upload_analysis(file: UploadFile = File(...), user: User = Depends(get_current_user),
                          db: Session = Depends(get_db)):
    name = file.filename or "upload.txt"
    if not name.lower().endswith(".txt"):
        raise HTTPException(400, "Only .txt files are supported")
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File is too large (max 2 MB)")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    text = text.strip()[:MAX_CHARS]
    if not text:
        raise HTTPException(400, "The file is empty")
    return save_analysis(db, user, text, filename=name)


# ---------- history routes ----------
@app.get("/api/analyses")
def list_analyses(
    search: str | None = None,
    label: Literal["Human", "AI"] | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = select(Analysis).where(Analysis.user_id == user.id)
    if label:
        query = query.where(Analysis.label == label)
    if search:
        like = f"%{search.strip()}%"
        query = query.where(or_(Analysis.text.ilike(like), Analysis.source_filename.ilike(like)))

    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(
        query.order_by(Analysis.created_at.desc(), Analysis.id.desc())
        .offset((page - 1) * page_size).limit(page_size)
    ).all()
    return {
        "items": [analysis_dict(r, preview=True) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def get_own_analysis(db: Session, user: User, analysis_id: int) -> Analysis:
    row = db.get(Analysis, analysis_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(404, "Analysis not found")
    return row


@app.get("/api/analyses/{analysis_id}")
def get_analysis(analysis_id: int, user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    return analysis_dict(get_own_analysis(db, user, analysis_id))


@app.delete("/api/analyses/{analysis_id}", status_code=204)
def delete_analysis(analysis_id: int, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    row = get_own_analysis(db, user, analysis_id)
    db.delete(row)
    db.commit()
    return Response(status_code=204)


# ---------- dashboard statistics ----------
@app.get("/api/stats")
def stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(Analysis.created_at, Analysis.label, Analysis.confidence)
        .where(Analysis.user_id == user.id)
    ).all()

    total = len(rows)
    human = sum(1 for r in rows if r.label == "Human")
    ai = total - human

    today = datetime.now(timezone.utc).date()
    days = [today - timedelta(days=i) for i in range(13, -1, -1)]
    per_day = {d.isoformat(): 0 for d in days}
    buckets = [0] * 5
    for created_at, _label, conf in rows:
        key = created_at.date().isoformat()
        if key in per_day:
            per_day[key] += 1
        buckets[max(0, min(int((conf - 0.5) / 0.1), 4))] += 1

    recent = db.scalars(
        select(Analysis).where(Analysis.user_id == user.id)
        .order_by(Analysis.created_at.desc(), Analysis.id.desc()).limit(5)
    ).all()

    most_frequent = None
    if total:
        most_frequent = "Human" if human >= ai else "AI"

    return {
        "total_analyses": total,
        "human_count": human,
        "ai_count": ai,
        "human_percent": round(100 * human / total, 1) if total else 0,
        "ai_percent": round(100 * ai / total, 1) if total else 0,
        "most_frequent_class": most_frequent,
        "last_7_days": sum(list(per_day.values())[-7:]),
        "daily": [{"date": d, "count": c} for d, c in per_day.items()],
        "confidence_distribution": [
            {"range": r, "count": c}
            for r, c in zip(["50-60%", "60-70%", "70-80%", "80-90%", "90-100%"], buckets)
        ],
        "recent": [analysis_dict(r, preview=True) for r in recent],
        "system": {
            "users": db.scalar(select(func.count(User.id))),
            "analyses": db.scalar(select(func.count(Analysis.id))),
        },
    }


# ---------- extra profile routes (Step 10f) ----------
from backend.profile_extra import router as profile_router  # noqa: E402

app.include_router(profile_router)
