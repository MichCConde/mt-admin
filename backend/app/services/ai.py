# import httpx
# from app.config import settings

# async def generate_completion(system: str, prompt: str, max_tokens: int = 4096) -> str:
#     async with httpx.AsyncClient() as client:
#         resp = await client.post(
#             "https://api.anthropic.com/v1/messages",
#             headers={
#                 "x-api-key": settings.anthropic_api_key,
#                 "anthropic-version": "2023-06-01",
#                 "content-type": "application/json",
#             },
#             json={
#                 "model": "claude-sonnet-4-20250514",
#                 "max_tokens": max_tokens,
#                 "system": system,
#                 "messages": [{"role": "user", "content": prompt}],
#             },
#             timeout=60.0,
#         )
#         resp.raise_for_status()
#         data = resp.json()
#         return "".join(b["text"] for b in data["content"] if b["type"] == "text")