# from fastapi import APIRouter, HTTPException
# from pydantic import BaseModel
# from app.services.ai import generate_completion

# router = APIRouter()

# class GenerateRequest(BaseModel):
#     system: str = ""
#     prompt: str
#     max_tokens: int = 4096

# @router.post("/generate")
# async def generate(req: GenerateRequest):
#     try:
#         result = await generate_completion(req.system, req.prompt, req.max_tokens)
#         return {"text": result}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))