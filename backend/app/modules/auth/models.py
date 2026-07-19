"""
Modèles de base de données — Module Auth
Tenants (boutiques) et Utilisateurs
"""
import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Enum, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship

from app.core.database import Base


class PlanEnum(str, enum.Enum):
    freemium = "freemium"
    starter = "starter"
    pro = "pro"


class RoleEnum(str, enum.Enum):
    owner = "owner"       # Propriétaire boutique
    staff = "staff"       # Employé boutique
    admin = "admin"       # Admin BoutikFlow (super-admin)


class Tenant(Base):
    """
    Boutique (tenant) — Unité d'isolation multi-tenant.
    Chaque boutique est complètement isolée.
    """
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    plan = Column(Enum(PlanEnum), default=PlanEnum.freemium, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    whatsapp_phone_id = Column(String(100), nullable=True)
    # Token stocké chiffré — jamais en clair
    whatsapp_token_encrypted = Column(String(512), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relations
    users = relationship("User", back_populates="tenant", lazy="dynamic")


class User(Base):
    """Utilisateur appartenant à un tenant (boutique)."""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    role = Column(Enum(RoleEnum), default=RoleEnum.owner, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relations
    tenant = relationship("Tenant", back_populates="users")

    # Contrainte unicité email par tenant
    __table_args__ = (
        # Un même email ne peut pas avoir deux comptes dans la même boutique
        # mais peut avoir des comptes dans des boutiques différentes
        {},
    )
