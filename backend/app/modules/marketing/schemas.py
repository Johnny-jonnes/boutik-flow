import uuid
from datetime import datetime
from pydantic import BaseModel, Field
from app.modules.marketing.models import CampaignChannelEnum, CampaignStatusEnum

class CampaignCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    segment_id: uuid.UUID | None = None
    channel: CampaignChannelEnum = CampaignChannelEnum.whatsapp
    message: str = Field(..., min_length=1)
    status: CampaignStatusEnum = CampaignStatusEnum.brouillon
    scheduled_at: datetime | None = None

class CampaignUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=255)
    segment_id: uuid.UUID | None = None
    channel: CampaignChannelEnum | None = None
    message: str | None = None
    status: CampaignStatusEnum | None = None
    scheduled_at: datetime | None = None

class CampaignResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    segment_id: uuid.UUID | None
    channel: CampaignChannelEnum
    message: str
    status: CampaignStatusEnum
    scheduled_at: datetime | None
    sent_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class CampaignListResponse(BaseModel):
    items: list[CampaignResponse]
    total: int
    page: int
    per_page: int
