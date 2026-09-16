"""Product auth API — AIQA's own user login / signup / OTP verification.

Flow mirrors smart-expense: signup -> 6-digit OTP email -> verify -> auto
login (JWT httpOnly cookie) -> logout, plus forgot-password reset. Users are
stored in MySQL; email goes out via Brevo.
"""

from __future__ import annotations

import re

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

from app.config import get_settings
from app.services import email as email_svc
from app.services import ratelimit
from app.services import user_auth as ua

router = APIRouter(prefix="/auth", tags=["auth"])

_COOKIE = "aiqa_session"
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


_TOO_MANY = "Too many attempts. Please wait a few minutes and try again."


def _err(msg: str):
    return {"ok": False, "error": msg}


def _valid_email(e: str) -> bool:
    return bool(e and _EMAIL_RE.match(e))


def _set_session(response: Response, user_id: str, email: str) -> None:
    token = ua.create_token(user_id, email)
    response.set_cookie(
        key=_COOKIE, value=token, httponly=True, samesite="lax",
        secure=False, max_age=get_settings().jwt_expiry_hours * 3600, path="/",
    )


# ---- request bodies ----------------------------------------------------

class SignupBody(BaseModel):
    name: str
    email: str
    password: str


class VerifyBody(BaseModel):
    email: str
    otp: str


class LoginBody(BaseModel):
    email: str
    password: str


class ForgotBody(BaseModel):
    email: str


class ResetBody(BaseModel):
    email: str
    otp: str
    newPassword: str


# ---- signup + OTP verify ----------------------------------------------

@router.post("/signup")
async def signup(body: SignupBody, request: Request):
    # Guard against sign-up spam / email-bombing a specific address.
    ratelimit.enforce(f"signup:ip:{_ip(request)}", 6, 900, _TOO_MANY)
    ratelimit.enforce(f"otp-send:{body.email.lower()}", 4, 900,
                      "We've sent a few codes already. Please wait a few minutes before trying again.")
    if not body.name.strip():
        return _err("Name is required.")
    if not _valid_email(body.email):
        return _err("Please enter a valid email.")
    if len(body.password) < 6:
        return _err("Password must be at least 6 characters.")

    existing = await ua.get_user_by_email(body.email)
    if existing and existing.is_email_verified:
        return _err("An account with this email already exists.")

    otp = email_svc.generate_otp()
    exp = email_svc.otp_expiry()
    try:
        await email_svc.send_otp_email(body.email.lower(), otp, body.name.strip(), purpose="signup")
        await ua.create_or_reset_unverified(body.email, body.name.strip(), body.password, otp, exp)
    except Exception as exc:
        return _err(f"Failed to send code — {str(exc)[:160]}")
    return {"ok": True, "message": "Verification code sent to your email."}


@router.post("/verify-otp")
async def verify_otp(body: VerifyBody, response: Response, request: Request):
    ratelimit.enforce(f"otp-verify:{body.email.lower()}", 12, 600,
                      "Too many code attempts. Please request a new code.")
    row = await ua.get_user_by_email(body.email)
    if not row:
        return _err("No signup found for this email. Please sign up first.")
    ok, err = ua.otp_valid(row, body.otp.strip())
    if not ok:
        return _err(err)
    await ua.mark_verified(body.email)
    _set_session(response, row.id, row.email)
    return {"ok": True, "user": {"name": row.name, "email": row.email}}


# ---- login / logout / me ----------------------------------------------

@router.post("/login")
async def login(body: LoginBody, response: Response, request: Request):
    ratelimit.enforce(f"login:ip:{_ip(request)}", 10, 300,
                      "Too many sign-in attempts. Please wait a few minutes and try again.")
    ratelimit.enforce(f"login:{body.email.lower()}", 8, 300,
                      "Too many sign-in attempts for this account. Please wait a few minutes.")
    if not _valid_email(body.email):
        return _err("Please enter a valid email and password.")
    row = await ua.get_user_by_email(body.email)
    if not row or not ua.verify_password(body.password, row.password_hash):
        return _err("Invalid email or password.")
    if not row.is_email_verified:
        return _err("Please verify your email first.")
    _set_session(response, row.id, row.email)
    return {"ok": True, "user": {"name": row.name, "email": row.email}}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(_COOKIE, path="/")
    return {"ok": True}


@router.get("/me")
async def me(request: Request):
    token = request.cookies.get(_COOKIE)
    payload = ua.decode_token(token) if token else None
    if not payload:
        return {"ok": False, "user": None}
    row = await ua.get_user_by_email(payload.get("email", ""))
    if not row:
        return {"ok": False, "user": None}
    return {"ok": True, "user": {"name": row.name, "email": row.email}}


# ---- forgot / reset password ------------------------------------------

@router.post("/forgot-password")
async def forgot_password(body: ForgotBody, request: Request):
    ratelimit.enforce(f"forgot:ip:{_ip(request)}", 5, 900, _TOO_MANY)
    ratelimit.enforce(f"otp-send:{body.email.lower()}", 4, 900,
                      "We've sent a few codes already. Please wait a few minutes before trying again.")
    if not _valid_email(body.email):
        return _err("Please enter a valid email.")
    row = await ua.get_user_by_email(body.email)
    if not row:
        return _err("No account found with this email.")
    otp = email_svc.generate_otp()
    exp = email_svc.otp_expiry()
    try:
        await email_svc.send_otp_email(body.email.lower(), otp, row.name, purpose="reset")
        await ua.set_reset_otp(body.email, otp, exp)
    except Exception as exc:
        return _err(f"Failed to send code — {str(exc)[:160]}")
    return {"ok": True, "message": "Password-reset code sent to your email."}


@router.post("/verify-reset-otp")
async def verify_reset_otp(body: VerifyBody, request: Request):
    ratelimit.enforce(f"otp-verify:{body.email.lower()}", 12, 600,
                      "Too many code attempts. Please request a new code.")
    row = await ua.get_user_by_email(body.email)
    if not row:
        return _err("User not found.")
    ok, err = ua.otp_valid(row, body.otp.strip())
    if not ok:
        return _err(err)
    return {"ok": True}


@router.post("/reset-password")
async def reset_password(body: ResetBody):
    if len(body.newPassword) < 6:
        return _err("Password must be at least 6 characters.")
    row = await ua.get_user_by_email(body.email)
    if not row:
        return _err("User not found.")
    ok, err = ua.otp_valid(row, body.otp.strip())
    if not ok:
        return _err(err)
    await ua.update_password(body.email, body.newPassword)
    return {"ok": True}
