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
    price: Decimal = Field(..., ge=0, description="Prix de vente du produit")
    cost_price: Decimal | None = Field(
        None, ge=0, description="Prix d'achat (facultatif) — sert au calcul de la marge réelle"
    )
    stock: int = Field(0, ge=0, description="Quantité en stock")
    category_id: uuid.UUID | None = None
    images: list[str] = Field(default_factory=list, description="URLs des images")
    is_available: bool = True
    sku: str | None = Field(None, max_length=100, description="Code SKU unique")
    barcode: str | None = Field(None, max_length=100, description="Code-barres optionnel")


class ProductUpdate(BaseModel):
    """Mise à jour partielle d'un produit."""
    name: str | None = Field(None, min_length=2, max_length=255)
    description: str | None = Field(None, max_length=2000)
    price: Decimal | None = Field(None, ge=0)
    cost_price: Decimal | None = Field(None, ge=0)
    stock: int | None = Field(None, ge=0)
    category_id: uuid.UUID | None = None
    images: list[str] | None = None
    is_available: bool | None = None
    sku: str | None = Field(None, max_length=100)
    barcode: str | None = Field(None, max_length=100)


class ProductResponse(BaseModel):
    """Produit retourné par l'API."""
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    description: str | None
    price: Decimal
    cost_price: Decimal | None = None
    stock: int
    category_id: uuid.UUID | None
    category_rel: CategoryResponse | None = None
    images: list[str]
    # Miniature compressée dérivée de images[0] (voir app.core.thumbnails) —
    # seule image renvoyée dans une liste de produits, jamais images[] en
    # pleine résolution (voir list_products). Absente/vide tant qu'un
    # produit existant avec photo n'a pas encore été rétro-rempli.
    thumbnail: str | None = None
    is_available: bool
    sku: str | None
    barcode: str | None
    created_at: datetime
    updated_at: datetime
    # Présent uniquement pour une synchronisation incrémentale (voir
    # updated_since sur GET /products) : signale au client qu'il doit
    # retirer ce produit de son cache local plutôt que le mettre à jour.
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}


class ProductListResponse(BaseModel):
    """Liste paginée de produits."""
    items: list[ProductResponse]
    total: int
    page: int
    per_page: int


class ProductStatsResponse(BaseModel):
    """Statistiques agrégées du catalogue — calculées en base sur
    l'ensemble des produits (pas seulement la page courante), pour rester
    exactes quel que soit le nombre de produits de la boutique."""
    total_products: int
    total_stock_value: Decimal
    total_stock_units: int


class ProductBulkCreate(BaseModel):
    """Création groupée — jusqu'à 200 produits en un seul envoi."""
    products: list[ProductCreate] = Field(..., min_length=1, max_length=200)


class ProductBulkCreateError(BaseModel):
    index: int
    name: str
    error: str


class ProductBulkCreateResponse(BaseModel):
    created: list[ProductResponse]
    errors: list[ProductBulkCreateError]


class StockBulkInItem(BaseModel):
    """Une ligne d'entrée de stock groupée — quantité AJOUTÉE au stock
    existant (pas une valeur de remplacement), pour éviter d'écraser un
    stock qui aurait changé entre l'ouverture du formulaire et l'envoi."""
    product_id: uuid.UUID
    quantity: int = Field(..., gt=0, description="Quantité ajoutée au stock existant")


class StockBulkIn(BaseModel):
    items: list[StockBulkInItem] = Field(..., min_length=1, max_length=200)
    reason: str | None = Field(None, max_length=255, description="Ex: réception fournisseur, inventaire...")


class StockBulkInError(BaseModel):
    index: int
    product_id: str
    error: str


class StockBulkInResponse(BaseModel):
    updated: list[ProductResponse]
    errors: list[StockBulkInError]
