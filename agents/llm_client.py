"""Thin async Groq wrapper used by specialist agents."""

import asyncio
import logging
import os
import re
import time

from dotenv import load_dotenv
from groq import AsyncGroq, RateLimitError

load_dotenv()

RETRY_WAIT_RE = re.compile(
    r"try again in ([\d.]+)\s*(ms|s|m)",
    re.IGNORECASE,
)
MAX_RATE_LIMIT_ATTEMPTS = 3
MAX_RETRY_SLEEP_SECONDS = 5.0
TOTAL_CALL_TIMEOUT_SECONDS = 25.0

logger = logging.getLogger(__name__)


class GroqClientError(RuntimeError):
    """Raised when Groq cannot return a usable completion."""


SUMMARY_LINE_RE = re.compile(r"^SUMMARY:\s*(.+)$", re.IGNORECASE | re.MULTILINE)
FINDING_LINE_RE = re.compile(r"^FINDING:\s*(.+)$", re.IGNORECASE | re.MULTILINE)


def parse_structured_narration(narration: str):
    """Return (summary, findings) from SUMMARY:/FINDING: lines; narration stays raw."""
    text = narration or ""
    summary_match = SUMMARY_LINE_RE.search(text)
    summary = summary_match.group(1).strip() if summary_match else None
    findings = [m.group(1).strip() for m in FINDING_LINE_RE.finditer(text)]
    return summary, findings


def _rate_limit_wait_seconds(exc: Exception, attempt: int) -> float:
    match = RETRY_WAIT_RE.search(str(exc))
    if match:
        value = float(match.group(1))
        unit = match.group(2).lower()
        if unit == "ms":
            suggested = value / 1000.0
        elif unit == "m":
            suggested = value * 60.0
        else:
            suggested = value
        # Keep retries bounded for UI latency; fail fast into graceful fallback.
        return min(MAX_RETRY_SLEEP_SECONDS, max(suggested, 1.5 * attempt))
    return min(MAX_RETRY_SLEEP_SECONDS, 1.5 * attempt)


async def call_groq(
    system_prompt: str,
    user_message: str,
    model: str = "openai/gpt-oss-20b",
    request_context: str = "unknown",
) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise GroqClientError(
            "GROQ_API_KEY is not set. Copy agents/.env.example to agents/.env "
            "and add your key."
        )

    client = AsyncGroq(api_key=api_key)
    completion = None
    last_error = None
    started = time.perf_counter()

    for attempt in range(1, MAX_RATE_LIMIT_ATTEMPTS + 1):
        elapsed = time.perf_counter() - started
        remaining = TOTAL_CALL_TIMEOUT_SECONDS - elapsed
        if remaining <= 0:
            raise GroqClientError(
                f"Groq request timed out after {TOTAL_CALL_TIMEOUT_SECONDS:.1f}s "
                f"(context={request_context})"
            )
        try:
            completion = await asyncio.wait_for(
                client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                ),
                timeout=remaining,
            )
            break
        except RateLimitError as exc:
            last_error = exc
            if attempt == MAX_RATE_LIMIT_ATTEMPTS:
                raise GroqClientError(f"Groq request failed: {exc}") from exc
            wait_s = min(_rate_limit_wait_seconds(exc, attempt), max(0.0, remaining - 0.1))
            logger.warning(
                "Groq rate-limit retry context=%s attempt=%d/%d wait=%.2fs remaining=%.2fs",
                request_context,
                attempt,
                MAX_RATE_LIMIT_ATTEMPTS,
                wait_s,
                remaining,
            )
            if wait_s <= 0:
                raise GroqClientError(
                    f"Groq request timed out before retry sleep (context={request_context})"
                ) from exc
            await asyncio.sleep(wait_s)
        except asyncio.TimeoutError as exc:
            raise GroqClientError(
                f"Groq request timed out after {TOTAL_CALL_TIMEOUT_SECONDS:.1f}s "
                f"(context={request_context})"
            ) from exc
        except Exception as exc:
            raise GroqClientError(f"Groq request failed: {exc}") from exc

    if completion is None:
        raise GroqClientError(f"Groq request failed: {last_error}") from last_error

    if not completion.choices:
        raise GroqClientError("Groq returned no choices.")

    text = (completion.choices[0].message.content or "").strip()
    if not text:
        raise GroqClientError("Groq returned an empty completion.")
    return text
