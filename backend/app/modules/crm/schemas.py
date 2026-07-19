"""
Schémas Pydantic v2 — Module CRM
Validation stricte des clients.
"""
import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class ClientCreate(BaseModel):
    """Création d'un client."""
    name: str = Field(..., min_length=1, max_length=255, description="Nom du client")
    phone: str = Field(..., min_length=5, max_length=20, description="Numéro de téléphone")
    email: str | None = Field(None, max_length=255)
    status: str = Field("nouveau", description="nouveau | actif | vip | inactif")
    tags: list[str] = Field(default_factory=list, description="Tags de catégorisation")
    notes: str | None = Field(None, max_length=2000)
    birthday: datetime | None = None


class ClientUpdate(BaseModel):
    """Mise à jour partielle d'un client."""
    name: str | None = Field(None, min_length=1, max_length=255)
    phone: str | None = Field(None, min_length=5, max_length=20)
    email: str | None = Field(None, max_length=255)
    status: str | None = None
    tags: list[str] | None = None
    notes: str | None = Field(None, max_length=2000)
    birthday: datetime | None = None


class ClientResponse(BaseModel):
    """Client retourné par l'API."""
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    phone: str
    email: str | None
    status: str
    tags: list[str]
    notes: str | None
    birthday: datetime | None
    last_activity_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ClientListResponse(BaseModel):
    """Liste paginée de clients."""
    items: list[ClientResponse]
    total: int
    page: int
    per_page: int


class SegmentCreate(BaseModel):
    """Création d'un segment."""
    name: str = Field(..., min_length=2, max_length=255)
    description: str | None = Field(None, max_length=2000)
    filters: dict = Field(default_factory=dict)


class SegmentUpdate(BaseModel):
    """Mise à jour d'un segment."""
    name: str | None = Field(None, min_length=2, max_length=255)
    description: str | None = Field(None, max_length=2000)
    filters: dict | None = None


class SegmentResponse(BaseModel):
    """Segment retourné par l'API."""
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    description: str | None
    filters: dict
    client_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SegmentListResponse(BaseModel):
    items: list[SegmentResponse]
    total: int
    page: int
    per_page: int
