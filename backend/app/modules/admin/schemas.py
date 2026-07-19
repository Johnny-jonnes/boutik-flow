"""
Schémas Pydantic v2 — Module Admin BoutikFlow
Gestion globale des boutiques (tenants) par l'équipe d'administration.
"""
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ─── Stats globales ──────────────────────────────────────────────────────────

class AdminStats(BaseModel):
    """KPIs globaux visibles sur le dashboard admin."""
    total_tenants: int
    pending_tenants: int
    active_tenants: int
    blocked_tenants: int
    rejected_tenants: int
    total_users: int
    unread_notifications: int


# ─── Tenant (boutique) ───────────────────────────────────────────────────────

class TenantOwnerInfo(BaseModel):
    """Informations du propriétaire d'une boutique."""
    id: uuid.UUID
    email: str
    full_name: Optional[str]
    phone: Optional[str]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TenantListItem(BaseModel):
    """Résumé d'une boutique pour la liste admin."""
    id: uuid.UUID
    name: str
    slug: str
    plan: str
    status: str
    is_active: bool
    created_at: datetime
    owner_email: Optional[str] = None
    owner_name: Optional[str] = None

    model_config = {"from_attributes": True}


class TenantDetail(BaseModel):
    """Détail complet d'une boutique + owner pour la fiche admin."""
    id: uuid.UUID
    name: str
    slug: str
    plan: str
    status: str
    is_active: bool
    whatsapp_phone_id: Optional[str]
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime]
    owner: Optional[TenantOwnerInfo] = None

    model_config = {"from_attributes": True}


class TenantStatusUpdate(BaseModel):
    """Payload pour changer le statut d'une boutique."""
    status: str = Field(..., description="pending | active | blocked | rejected")
    note: Optional[str] = Field(None, max_length=500, description="Note interne facultative")


class TenantPlanUpdate(BaseModel):
    """Payload pour changer le plan d'abonnement d'une boutique."""
    plan: str = Field(..., description="freemium | starter | pro")


# ─── Notifications admin ─────────────────────────────────────────────────────

class AdminNotificationResponse(BaseModel):
    """Notification admin (ex : nouvelle inscription)."""
    id: uuid.UUID
    type: str
    title: str
    message: Optional[str]
    tenant_id: Optional[uuid.UUID]
    tenant_name: Optional[str] = None
    tenant_slug: Optional[str] = None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Création compte admin ───────────────────────────────────────────────────

class CreateAdminUserRequest(BaseModel):
    """Création d'un compte administrateur BoutikFlow (sans boutique)."""
    email: str = Field(..., description="Email du compte admin")
    password: str = Field(..., min_length=8, max_length=128)
    full_name: Optional[str] = Field(None, max_length=255)


class AdminUserResponse(BaseModel):
    """Réponse après création d'un compte admin."""
    id: uuid.UUID
    email: str
    full_name: Optional[str]
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Réponse paginée ─────────────────────────────────────────────────────────

class PaginatedTenants(BaseModel):
    """Réponse paginée pour la liste des boutiques."""
    items: list[TenantListItem]
    total: int
    page: int
    per_page: int
    pages: int
