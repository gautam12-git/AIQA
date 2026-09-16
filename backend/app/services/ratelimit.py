"""Lightweight in-memory rate limiter (sliding window).

Guards auth/OTP endpoints against brute force and email-bombing. Per-process
and thread-safe — fine for a single instance; swap for Redis if you scale out
to multiple workers.
"""

from __future__ import annotations

import threading
import time

from fastapi import HTTPException

_hits: dict[str, list[float]] = {}
_lock = threading.Lock()
_last_prune = 0.0


def _prune(now: float) -> None:
    """Occasionally drop stale keys so the dict doesn't grow unbounded."""
    global _last_prune
    if now - _last_prune < 300:
        return
    _last_prune = now
    for k in [k for k, v in _hits.items() if not v or now - v[-1] > 3600]:
        _hits.pop(k, None)


def allow(key: str, limit: int, window: float) -> bool:
    """True if `key` is under `limit` events within the last `window` seconds."""
    now = time.time()
    with _lock:
        _prune(now)
        arr = [t for t in _hits.get(key, []) if now - t < window]
        if len(arr) >= limit:
            _hits[key] = arr
            return False
        arr.append(now)
        _hits[key] = arr
        return True


def enforce(key: str, limit: int, window: float, message: str) -> None:
    """Raise a friendly 429 when the limit is exceeded."""
    if not allow(key, limit, window):
        raise HTTPException(status_code=429, detail={"code": "rate_limited", "message": message})
