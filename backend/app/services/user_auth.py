"""Product-user auth core — password hashing, JWT sessions, and user storage.

Users live in MySQL (the `users` table). Distinct from `services/auth.py`,
which logs AIQA INTO tested sites; this is AIQA's OWN login.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import bcrypt
import jwt
from sqlalchemy import select

from app.config import get_settings
from app.db import get_sessionmaker
from app.models import UserRow

_ALGO = "HS256"


# ---- passwords ---------------------------------------------------------

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except Exception:
        return False


# ---- JWT ---------------------------------------------------------------

def create_token(user_id: str, email: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int(now.timestamp()) + settings.jwt_expiry_hours * 3600,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGO)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, get_settings().jwt_secret, algorithms=[_ALGO])
    except Exception:
        return None


# ---- user storage (MySQL) ---------------------------------------------

async def get_user_by_email(email: str) -> UserRow | None:
    async with get_sessionmaker()() as s:
        return await s.scalar(select(UserRow).where(UserRow.email == email.lower()))


async def create_or_reset_unverified(email: str, name: str, password: str, otp: str, otp_exp) -> None:
    """Create a new unverified user, or refresh an existing unverified one."""
    async with get_sessionmaker()() as s:
        row = await s.scalar(select(UserRow).where(UserRow.email == email.lower()))
        if row is None:
            row = UserRow(
                id=f"usr_{uuid.uuid4().hex[:12]}", email=email.lower(), name=name,
                password_hash=hash_password(password), is_email_verified=False,
                otp=otp, otp_expiry=otp_exp,
                created_at=datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
            )
            s.add(row)
        else:
            row.name = name
            row.password_hash = hash_password(password)
            row.otp = otp
            row.otp_expiry = otp_exp
            row.is_email_verified = False
        await s.commit()


async def set_reset_otp(email: str, otp: str, otp_exp) -> bool:
    async with get_sessionmaker()() as s:
        row = await s.scalar(select(UserRow).where(UserRow.email == email.lower()))
        if row is None:
            return False
        row.otp = otp
        row.otp_expiry = otp_exp
        await s.commit()
        return True


async def mark_verified(email: str) -> None:
    async with get_sessionmaker()() as s:
        row = await s.scalar(select(UserRow).where(UserRow.email == email.lower()))
        if row:
            row.is_email_verified = True
            row.otp = None
            row.otp_expiry = None
            await s.commit()


async def update_password(email: str, password: str) -> None:
    async with get_sessionmaker()() as s:
        row = await s.scalar(select(UserRow).where(UserRow.email == email.lower()))
        if row:
            row.password_hash = hash_password(password)
            row.otp = None
            row.otp_expiry = None
            await s.commit()


def otp_valid(row: UserRow, otp: str) -> tuple[bool, str]:
    """(ok, error) — checks presence, expiry, and match."""
    if not row.otp or not row.otp_expiry:
        return False, "No code was requested. Please try again."
    if datetime.utcnow() > row.otp_expiry:
        return False, "Code has expired. Please request a new one."
    if row.otp != otp:
        return False, "Invalid code. Please try again."
    return True, ""
