# Extra profile features: phone/country/university/bio, profile picture, delete account.
# Stored in a NEW table (user_profiles), so your existing tables are not changed.
import re
import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import Column, Integer, String, Text, delete
from sqlalchemy.orm import Session

from backend.db import Analysis, Base, User, engine, get_db
from backend.main import get_current_user, verify_password

AVATAR_DIR = Path(__file__).resolve().parent.parent / "data" / "avatars"
AVATAR_DIR.mkdir(parents=True, exist_ok=True)
MAX_AVATAR_BYTES = 2 * 1024 * 1024
AVATAR_NAME = re.compile(r"^[a-f0-9]{32}\.(png|jpg|webp)$")


class UserProfile(Base):
    __tablename__ = "user_profiles"
    user_id = Column(Integer, primary_key=True)
    phone = Column(String(40), default="")
    country = Column(String(80), default="")
    university = Column(String(120), default="")
    bio = Column(Text, default="")
    avatar = Column(String(80), default="")


Base.metadata.create_all(bind=engine)

router = APIRouter()


class ProfileIn(BaseModel):
    phone: str = Field(default="", max_length=40)
    country: str = Field(default="", max_length=80)
    university: str = Field(default="", max_length=120)
    bio: str = Field(default="", max_length=500)


class DeleteAccountIn(BaseModel):
    current_password: str


def get_profile_row(db: Session, user: User) -> UserProfile:
    row = db.get(UserProfile, user.id)
    if row is None:
        row = UserProfile(user_id=user.id, phone="", country="", university="", bio="", avatar="")
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def profile_dict(row: UserProfile) -> dict:
    return {
        "phone": row.phone or "",
        "country": row.country or "",
        "university": row.university or "",
        "bio": row.bio or "",
        "avatar_url": ("/api/avatars/" + row.avatar) if row.avatar else None,
    }


def remove_avatar_file(name: str) -> None:
    if name and AVATAR_NAME.match(name):
        try:
            (AVATAR_DIR / name).unlink()
        except FileNotFoundError:
            pass


@router.get("/api/profile")
def read_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return profile_dict(get_profile_row(db, user))


@router.put("/api/profile")
def update_profile(data: ProfileIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = get_profile_row(db, user)
    row.phone = data.phone.strip()
    row.country = data.country.strip()
    row.university = data.university.strip()
    row.bio = data.bio.strip()
    db.commit()
    db.refresh(row)
    return profile_dict(row)


@router.post("/api/profile/avatar")
async def upload_avatar(file: UploadFile = File(...), user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    content = await file.read(MAX_AVATAR_BYTES + 1)
    if len(content) > MAX_AVATAR_BYTES:
        raise HTTPException(400, "The picture is too large (maximum 2 MB).")
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        ext = "png"
    elif content.startswith(b"\xff\xd8\xff"):
        ext = "jpg"
    elif content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        ext = "webp"
    else:
        raise HTTPException(400, "Please upload a PNG, JPG or WEBP picture.")
    name = secrets.token_hex(16) + "." + ext
    (AVATAR_DIR / name).write_bytes(content)
    row = get_profile_row(db, user)
    remove_avatar_file(row.avatar)
    row.avatar = name
    db.commit()
    db.refresh(row)
    return profile_dict(row)


@router.delete("/api/profile/avatar")
def delete_avatar(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = get_profile_row(db, user)
    remove_avatar_file(row.avatar)
    row.avatar = ""
    db.commit()
    db.refresh(row)
    return profile_dict(row)


@router.get("/api/avatars/{name}")
def get_avatar(name: str):
    if not AVATAR_NAME.match(name):
        raise HTTPException(404, "Not found")
    path = AVATAR_DIR / name
    if not path.is_file():
        raise HTTPException(404, "Not found")
    return FileResponse(path)


@router.post("/api/account/delete")
def delete_account(data: DeleteAccountIn, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    user_id = user.id
    row = db.get(UserProfile, user_id)
    if row is not None:
        remove_avatar_file(row.avatar)
        db.delete(row)
    db.execute(delete(Analysis).where(Analysis.user_id == user_id))
    db.commit()
    db.expire_all()
    account = db.get(User, user_id)
    if account is not None:
        db.delete(account)
    db.commit()
    return {"deleted": True}
