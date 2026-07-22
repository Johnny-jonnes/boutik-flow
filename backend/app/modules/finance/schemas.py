"""
Schémas Pydantic v2 — Module Finance
"""
import uuid
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional


class TransactionCreate(BaseModel):
    type: str = Field(..., description="income | expense")
    category: str = Field(..., description="sale | supplier_purchase | salary | rent | utilities | refund | other_income | other_expense")
    amount: Decimal = Field(..., gt=0)
    description: str = Field(..., min_length=1, max_length=500)
    payment_method: str = Field("cash", max_length=50)
    reference: str | None = Field(None, max_length=255)


class TransactionResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    type: str
    category: str
    amount: Decimal
    description: str
    payment_method: str
    reference: str | None
    user_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FinanceSummary(BaseModel):
    total_income: Decimal
    total_expense: Decimal
    net_balance: Decimal
    transactions_count: int


class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
    page: int
    per_page: int
    summary: FinanceSummary
