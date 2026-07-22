"""
Schémas Pydantic v2 — Module Commandes
Validation des commandes et lignes de commande.
"""
import uuid
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, Field


class OrderItemCreate(BaseModel):
    """Ligne de commande à la création."""
    product_id: uuid.UUID
    quantity: int = Field(..., gt=0)
    # On ne demande pas le prix, il est récupéré depuis le produit côté serveur.


class OrderCreate(BaseModel):
    """Création d'une commande (client_id optionnel pour la caisse rapide)."""
    client_id: uuid.UUID | None = Field(None, description="ID du client (optionnel)")
    notes: str | None = Field(None, max_length=2000)
    items: list[OrderItemCreate] = Field(..., min_length=1, description="Au moins un produit requis")


class OrderUpdateStatus(BaseModel):
    """Mise à jour du statut d'une commande."""
    status: str = Field(..., description="pending | confirmed | delivered | cancelled")
    note: str | None = Field(None, description="Raison du changement de statut (optionnel)")


class OrderItemResponse(BaseModel):
    """Ligne de commande retournée."""
    id: uuid.UUID
    product_id: uuid.UUID
    quantity: int
    unit_price: Decimal

    model_config = {"from_attributes": True}


class OrderResponse(BaseModel):
    """Commande retournée par l'API."""
    id: uuid.UUID
    tenant_id: uuid.UUID
    client_id: uuid.UUID
    status: str
    total: Decimal
    notes: str | None
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemResponse]

    model_config = {"from_attributes": True}


class OrderListResponse(BaseModel):
    """Liste paginée de commandes."""
    items: list[OrderResponse]
    total: int
    page: int
    per_page: int
