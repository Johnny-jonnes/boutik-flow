from pydantic import BaseModel
from typing import Optional

class SubscriptionResponse(BaseModel):
    plan: str
    status: str
    expires_at: Optional[str] = None

class CheckoutRequest(BaseModel):
    plan_id: str
    phone_number: str

class CheckoutResponse(BaseModel):
    transaction_id: str
    status: str
    message: str
