"""Thin async Groq wrapper used by specialist agents."""

import os

from dotenv import load_dotenv
from groq import AsyncGroq

load_dotenv()


class GroqClientError(RuntimeError):
    """Raised when Groq cannot return a usable completion."""


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
    try:
        completion = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        )
    except Exception as exc:
        raise GroqClientError(f"Groq request failed: {exc}") from exc

    if not completion.choices:
        raise GroqClientError("Groq returned no choices.")

    text = (completion.choices[0].message.content or "").strip()
    if not text:
        raise GroqClientError("Groq returned an empty completion.")
    return text
