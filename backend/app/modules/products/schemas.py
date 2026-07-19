"""
Schémas Pydantic v2 — Module Produits
Validation stricte des produits du catalogue.
"""
import uuid
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    """Création d'une catégorie."""
    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = Field(None, max_length=2000)
    image_url: str | None = None


class CategoryUpdate(BaseModel):
    """Mise à jour d'une catégorie."""
    name: str | None = Field(None, min_length=2, max_length=100)
    description: str | None = Field(None, max_length=2000)
    image_url: str | None = None


class CategoryResponse(BaseModel):
    """Catégorie retournée par l'API."""
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    description: str | None
    image_url: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CategoryListResponse(BaseModel):
    items: list[CategoryResponse]
    total: int
    page: int
    per_page: int


class ProductCreate(BaseModel):
    """Création d'un produit."""
    name: str = Field(..., min_length=2, max_length=255, description="Nom du produit")
    description: str | None = Field(None, max_length=2000)
    price: Decimal = Field(..., ge=0, description="Prix du produit")
    stock: int = Field(0, ge=0, description="Quantité en stock")
    category_id: uuid.UUID | None = None
    images: list[str] = Field(default_factory=list, description="URLs des images")
    is_available: bool = True


class ProductUpdate(BaseModel):
    """Mise à jour partielle d'un produit."""
    name: str | None = Field(None, min_length=2, max_length=255)
    description: str | None = Field(None, max_length=2000)
    price: Decimal | None = Field(None, ge=0)
    stock: int | None = Field(None, ge=0)
    category_id: uuid.UUID | None = None
    images: list[str] | None = None
    is_available: bool | None = None


class ProductResponse(BaseModel):
    """Produit retourné par l'API."""
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    description: str | None
    price: Decimal
    stock: int
    category_id: uuid.UUID | None
    category_rel: CategoryResponse | None = None
    images: list[str]
    is_available: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductListResponse(BaseModel):
    """Liste paginée de produits."""
    items: list[ProductResponse]
    total: int
    page: int
    per_page: int
