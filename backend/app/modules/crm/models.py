"""
Modèles de base de données — Module CRM
Gestion des clients d'une boutique
"""
import uuid
import enum
from sqlalchemy import Column, String, Text, Enum, ForeignKey, DateTime, Boolean, func, ARRAY, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class ClientStatusEnum(str, enum.Enum):
    nouveau = "nouveau"
    actif = "actif"
    vip = "vip"
    inactif = "inactif"


class Client(Base):
    """
    Client d'une boutique.
    CRITIQUE : tenant_id garantit l'isolation multi-tenant.
    Soft delete : jamais de suppression physique.
    """
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=False, index=True)
    email = Column(String(255), nullable=True)
    status = Column(Enum(ClientStatusEnum), default=ClientStatusEnum.nouveau, nullable=False)
    tags = Column(ARRAY(String), default=[], nullable=False)
    notes = Column(Text, nullable=True)
    # Date de naissance (pour messages anniversaire)
    birthday = Column(DateTime(timezone=True), nullable=True)
    # Dernière activité (pour détecter clients inactifs)
    last_activity_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relations
    orders = relationship("Order", back_populates="client", lazy="dynamic")
    whatsapp_messages = relationship("WhatsAppMessage", back_populates="client", lazy="dynamic")


class Segment(Base):
    """
    Segment dynamique de clients.
    Exemple de filtres JSON: {"status": "vip", "min_orders": 3, "tags": ["Bazin"]}
    """
    __tablename__ = "segments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    filters = Column(JSON, nullable=False, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
