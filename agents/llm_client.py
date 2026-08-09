"""Thin async Groq wrapper used by specialist agents."""

import asyncio
import os
import re

from dotenv import load_dotenv
from groq import AsyncGroq, RateLimitError

load_dotenv()

RETRY_WAIT_RE = re.compile(
    r"try again in ([\d.]+)\s*(ms|s|m)",
    re.IGNORECASE,
)
MAX_RATE_LIMIT_ATTEMPTS = 6


class GroqClientError(RuntimeError):
    """Raised when Groq cannot return a usable completion."""


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
        # Concurrent gather often exceeds 6k TPM; Groq's suggested wait is
        # usually too optimistic, so floor to a growing backoff.
        return max(suggested, 2.0 * attempt)
    return 2.0 * attempt


async def call_groq(
    system_prompt: str,
    user_message: str,
    model: str = "llama-3.1-8b-instant",
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
    for attempt in range(1, MAX_RATE_LIMIT_ATTEMPTS + 1):
        try:
            completion = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
            )
            break
        except RateLimitError as exc:
            last_error = exc
            if attempt == MAX_RATE_LIMIT_ATTEMPTS:
                raise GroqClientError(f"Groq request failed: {exc}") from exc
            await asyncio.sleep(_rate_limit_wait_seconds(exc, attempt))
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
