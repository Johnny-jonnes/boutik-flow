"""
Modèles de base partagés par tous les modules.
Chaque table hérite de BaseModel pour garantir :
- tenant_id (isolation multi-tenant CRITIQUE)
- timestamps (created_at, updated_at)
- soft delete (deleted_at)
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class TimestampMixin:
    """Mixin pour les timestamps automatiques."""
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class SoftDeleteMixin:
    """Mixin pour le soft delete obligatoire (jamais de suppression physique)."""
    deleted_at = Column(DateTime(timezone=True), nullable=True, default=None)


class MultiTenantMixin:
    """
    Mixin multi-tenant CRITIQUE.
    Toutes les tables doivent avoir tenant_id.
    Aucune requête ne doit retourner des données d'un autre tenant.
    """
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)


class BoutikFlowBase(Base, TimestampMixin, SoftDeleteMixin, MultiTenantMixin):
    """
    Classe de base pour TOUS les modèles BoutikFlow.
    Garantit : tenant_id, created_at, updated_at, deleted_at
    """
    __abstract__ = True

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
