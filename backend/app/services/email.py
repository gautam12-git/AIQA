"""OTP email sender — Brevo HTTP API (same provider as smart-expense).

Sends a 6-digit verification code. Keeps setup simple (HTTP, no SMTP).
"""

from __future__ import annotations

import random
import re
from datetime import datetime, timedelta, timezone

import httpx

from app.config import get_settings

_OTP_TTL_MINUTES = 10


def generate_otp() -> str:
    """A random 6-digit code."""
    return str(random.randint(100000, 999999))


def otp_expiry() -> datetime:
    """Expiry timestamp, 10 minutes from now (UTC, naive to match DB column)."""
    return (datetime.now(timezone.utc) + timedelta(minutes=_OTP_TTL_MINUTES)).replace(tzinfo=None)


def _parse_sender(frm: str) -> dict:
    m = re.match(r"^(.+?)\s*<(.+)>$", frm)
    if m:
        return {"name": m.group(1).strip(), "email": m.group(2).strip()}
    return {"name": "AIQA", "email": frm.strip()}


def _template(otp: str, name: str, purpose: str) -> str:
    heading = "Verify your AIQA account" if purpose == "signup" else "Reset your AIQA password"
    return f"""
<div style="font-family:Arial,sans-serif;line-height:1.6;color:#333;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <h2 style="color:#1f4e79;">{heading}, {name}!</h2>
    <p>Your verification code is:</p>
    <div style="background:#f0f0f0;padding:20px;border-radius:6px;text-align:center;margin:20px 0;">
      <h1 style="color:#1f4e79;letter-spacing:6px;margin:0;">{otp}</h1>
    </div>
    <p><strong>This code expires in {_OTP_TTL_MINUTES} minutes.</strong></p>
    <p style="color:#666;font-size:14px;">If you didn't request this, you can ignore this email.</p>
    <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;" />
    <p style="color:#999;font-size:12px;">© AIQA — Autonomous AI QA Engineer</p>
  </div>
</div>""".strip()


async def send_otp_email(email: str, otp: str, name: str, purpose: str = "signup") -> None:
    """Send the OTP via Brevo. Raises with a diagnosable message on failure."""
    settings = get_settings()
    if not settings.brevo_api_key:
        raise RuntimeError("Brevo API key not configured (set BREVO_API_KEY)")

    sender = _parse_sender(settings.brevo_from)
    subject = "Your AIQA verification code" if purpose == "signup" else "Your AIQA password-reset code"

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"Content-Type": "application/json", "api-key": settings.brevo_api_key},
            json={
                "sender": sender,
                "to": [{"email": email, "name": name}],
                "subject": subject,
                "htmlContent": _template(otp, name, purpose),
            },
        )
    if resp.status_code >= 300:
        body = (resp.text or "")[:200]
        raise RuntimeError(f"Brevo {resp.status_code}: {body or 'send failed'}")
