"""Bounded upstream retry policy; never changes providers or follows redirects."""

import logging
import math
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime

import httpx

from spherex.errors import ArchiveError

ATTEMPTS = 3
RETRYABLE = {408, 429, 500, 502, 503, 504}
logger = logging.getLogger(__name__)


def retry_after(response: httpx.Response) -> int | None:
    raw = response.headers.get("Retry-After", "")
    try:
        seconds = float(raw)
    except ValueError:
        try:
            seconds = (parsedate_to_datetime(raw) - datetime.now(UTC)).total_seconds()
        except (ValueError, TypeError, OverflowError):
            return None
    if not math.isfinite(seconds):
        return None
    return max(0, math.ceil(seconds))


def retry_delay(exc: httpx.HTTPError, attempt: int) -> float | None:
    if isinstance(exc, httpx.HTTPStatusError):
        if exc.response.status_code not in RETRYABLE:
            return None
        delay = retry_after(exc.response)
        if delay is not None:
            # A long wait is reported to the caller, never shortened and retried early.
            return delay if delay <= 30 else None
    elif not isinstance(exc, httpx.TransportError):
        return None
    return min(2**attempt, 8)


def archive_failure(exc: httpx.HTTPError, operation: str, archive="IRSA") -> ArchiveError:
    delay = None
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        delay = retry_after(exc.response)
        if status == 429:
            message, code = "Rate limit (HTTP 429). Wait before retrying.", "archive_rate_limited"
        elif status == 404:
            message, code = (
                "Product not found (HTTP 404). Repeat the search or choose another observation.",
                "archive_not_found",
            )
        elif status in (400, 422):
            message, code = (
                f"Request rejected (HTTP {status}). Check the sky position and field size; "
                "the position may be outside this image.",
                "archive_rejected",
            )
        elif status in (401, 403):
            message, code = f"Access denied (HTTP {status}).", "archive_denied"
        else:
            message, code = f"Archive returned HTTP {status}. Retry later.", "archive_http_error"
    elif isinstance(exc, httpx.TimeoutException):
        message, code = (
            "Request timed out. Retry, or use a smaller field/fewer frames.",
            "archive_timeout",
        )
    else:
        message, code = (
            "Connection failed. Check the network, DNS, proxy and TLS connection, then retry.",
            "archive_connection_error",
        )
    text = f"{archive} {operation}: {message}"
    logger.warning("%s (%s)", text, type(exc).__name__)
    return ArchiveError(text, code=code, retry_after=delay)
