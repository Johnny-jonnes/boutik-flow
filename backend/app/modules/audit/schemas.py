"""
Schémas Pydantic — Module Audit
"""
import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class AuditLogCreate(BaseModel):
    action: str = Field(..., max_length=100)
    target_entity: str | None = None
    target_id: str | None = None
    details: str | None = None


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    user_id: uuid.UUID | None
    user_email: str | None
    action: str
    target_entity: str | None
    target_id: str | None
    details: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int
    page: int
    per_page: int
