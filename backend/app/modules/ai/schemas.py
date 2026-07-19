from pydantic import BaseModel
from typing import List

class AIMessage(BaseModel):
    text: str
    sender: str

class AISuggestReplyRequest(BaseModel):
    messages: List[AIMessage]

class AISuggestReplyResponse(BaseModel):
    suggestion: str
