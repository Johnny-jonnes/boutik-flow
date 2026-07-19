from pydantic import BaseModel
from typing import Optional

class WhatsAppMessage(BaseModel):
    id: str
    text: str
    sender: str
    time: str

class WhatsAppChat(BaseModel):
    id: str
    client: str
    lastMessage: str
    time: str
    unread: int
    aiSuggestion: Optional[str] = None

class WhatsAppSendRequest(BaseModel):
    chat_id: str
    text: str
