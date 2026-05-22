"""
Thin Anthropic API wrapper.

The API key is read from the ANTHROPIC_API_KEY environment variable and
NEVER exposed to the frontend. All AI calls go through this module.

Prompt caching is enabled on the system block — the static template +
tone rules get cached for 5 min, so generating multiple reports in
quick succession only pays full input cost on the first one.
"""
import os
from anthropic import Anthropic

# Default model — Sonnet is the right tier for HR-quality content.
# Bump to a newer Sonnet build when one is released.
DEFAULT_MODEL = "claude-sonnet-4-5-20250929"

_client: Anthropic | None = None


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY environment variable is not set. "
                "Add it in Vercel → Settings → Environment Variables."
            )
        _client = Anthropic(api_key=api_key)
    return _client


def generate_with_cache(
    system: str,
    user: str,
    max_tokens: int = 4000,
    model: str = DEFAULT_MODEL,
) -> str:
    """
    Generate a completion with prompt caching enabled on the system block.

    Returns the assistant's text response as a string (concatenated across
    any text content blocks). Raises on API errors.
    """
    client = _get_client()
    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=[
            {
                "type": "text",
                "text": system,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[
            {"role": "user", "content": user},
        ],
    )

    parts: list[str] = []
    for block in response.content:
        # The SDK returns objects with a .type attribute, but some
        # deployments return dicts. Handle both shapes defensively.
        block_type = getattr(block, "type", None) or (
            block.get("type") if isinstance(block, dict) else None
        )
        if block_type == "text":
            text = getattr(block, "text", None) or (
                block.get("text") if isinstance(block, dict) else None
            )
            if text:
                parts.append(text)
    return "\n".join(parts).strip()