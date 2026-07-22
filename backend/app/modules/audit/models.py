"""
Modèle de base de données — Journal d'Audit
Enregistre toutes les actions clés effectuées dans la boutique.
"""
import uuid
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class AuditLog(Base):
    """
    Journal d'audit de la boutique.
    Contient l'utilisateur, l'action, l'entité concernée et la date.
    """
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    user_email = Column(String(255), nullable=True)
    action = Column(String(100), nullable=False)  # ex: "login", "create_sale", "return_product", "update_stock"
    target_entity = Column(String(100), nullable=True)  # ex: "order", "product", "client", "user"
    target_id = Column(String(255), nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
