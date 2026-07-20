from pydantic import BaseModel
from typing import List

class AIMessage(BaseModel):
    text: str
    sender: str

class AISuggestReplyRequest(BaseModel):
    messages: List[AIMessage]

class AISuggestReplyResponse(BaseModel):
    suggestion: str

class AIAnalyzeProductImageRequest(BaseModel):
    image_data: str  # URL ou Base64 (data:image/jpeg;base64,...)

class AIAnalyzeProductImageResponse(BaseModel):
    name: str | None = None
    category: str | None = None
    description: str | None = None
    brand: str | None = None
    attributes: dict | None = None
