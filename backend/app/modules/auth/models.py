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


class TenantStatusEnum(str, enum.Enum):
    """
    Statut de validation d'une boutique.
    Le paiement des forfaits n'étant pas intégré via API, chaque nouvelle
    inscription passe par une validation manuelle de l'équipe BoutikFlow.
    """
    pending = "pending"    # En attente de validation admin (inscription reçue)
    active = "active"      # Validée, boutique opérationnelle
    blocked = "blocked"    # Bloquée par l'admin (ex: non-paiement, abus)
    rejected = "rejected"  # Demande refusée par l'admin


class AdminNotificationTypeEnum(str, enum.Enum):
    new_registration = "new_registration"


class RoleEnum(str, enum.Enum):
    owner = "owner"               # Propriétaire boutique
    manager = "manager"           # Gérant boutique
    cashier = "cashier"           # Vendeur / Caissier
    stock_manager = "stock_manager" # Gestionnaire de stock
    staff = "staff"               # Employé polyvalent
    admin = "admin"               # Admin BoutikFlow (super-admin)


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
    status = Column(Enum(TenantStatusEnum), default=TenantStatusEnum.pending, nullable=False)
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


class AdminNotification(Base):
    """
    Notification pour l'équipe d'administration BoutikFlow.
    Sert notamment à signaler les nouvelles demandes d'inscription
    en attente de validation manuelle.
    """
    __tablename__ = "admin_notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type = Column(Enum(AdminNotificationTypeEnum), default=AdminNotificationTypeEnum.new_registration, nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(String(2000), nullable=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    tenant = relationship("Tenant")
