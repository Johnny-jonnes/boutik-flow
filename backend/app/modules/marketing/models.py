import uuid
import enum
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Enum, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base

class CampaignChannelEnum(str, enum.Enum):
    whatsapp = "whatsapp"
    sms = "sms"
    email = "email"

class CampaignStatusEnum(str, enum.Enum):
    brouillon = "brouillon"
    programmee = "programmee"
    envoyee = "envoyee"
    echouee = "echouee"

class Campaign(Base):
    """Campagne marketing ciblée."""
    __tablename__ = "campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    segment_id = Column(UUID(as_uuid=True), ForeignKey("segments.id"), nullable=True)
    channel = Column(Enum(CampaignChannelEnum), default=CampaignChannelEnum.whatsapp, nullable=False)
    message = Column(Text, nullable=False)
    status = Column(Enum(CampaignStatusEnum), default=CampaignStatusEnum.brouillon, nullable=False)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    segment = relationship("Segment")
