"""
Router Produits — Gestion du catalogue
Règles appliquées :
- Multi-tenant : filtrage par tenant_id
- Soft delete : deleted_at au lieu de suppression physique
- Historisation : Création automatique d'InventoryLog en cas de modification stock/prix
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.core.database import get_db
from app.core.deps import get_current_user, CurrentUser
from app.modules.products.models import Product, InventoryLog, Category
from app.modules.products.schemas import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductListResponse,
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
    CategoryListResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/products", tags=["Catalogue - Produits"])


def _create_inventory_log(
    db: Session,
    tenant_id: uuid.UUID,
    product_id: uuid.UUID,
    user_id: uuid.UUID,
    change_type: str,
    old_value: str,
    new_value: str,
):
    """Enregistre une modification dans l'historique."""
    log = InventoryLog(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        product_id=product_id,
        change_type=change_type,
        old_value=str(old_value),
        new_value=str(new_value),
        changed_by=user_id,
    )
    db.add(log)


import re
import secrets

def _generate_sku(name: str) -> str:
    """Génère un SKU propre et unique à partir du nom du produit."""
    clean_name = re.sub(r'[^a-zA-Z0-9]', '', name).upper()[:6]
    if not clean_name:
        clean_name = "PROD"
    rand_suffix = secrets.token_hex(3).upper()  # 6 caractères hexadécimaux
    return f"SKU-{clean_name}-{rand_suffix}"


# ──────────────────────────── Catégories ────────────────────────────

@router.get(
    "/categories",
    response_model=CategoryListResponse,
    summary="Lister les catégories",
)
def list_categories(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
) -> CategoryListResponse:
    query = db.query(Category).filter(Category.tenant_id == current_user.tenant_id)
    total = query.count()
    items = query.order_by(Category.name.asc()).offset((page - 1) * per_page).limit(per_page).all()
    return CategoryListResponse(
        items=[CategoryResponse.model_validate(c) for c in items],
        total=total,
        page=page,
        per_page=per_page,
    )

@router.post(
    "/categories",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer une catégorie",
)
def create_category(
    payload: CategoryCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> CategoryResponse:
    category = Category(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        name=payload.name,
        description=payload.description,
        image_url=payload.image_url,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return CategoryResponse.model_validate(category)

@router.put(
    "/categories/{category_id}",
    response_model=CategoryResponse,
    summary="Mettre à jour une catégorie",
)
def update_category(
    category_id: uuid.UUID,
    payload: CategoryUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> CategoryResponse:
    category = db.query(Category).filter(
        and_(Category.id == category_id, Category.tenant_id == current_user.tenant_id)
    ).first()
    if not category:
        raise HTTPException(status_code=404, detail="Catégorie introuvable")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)
    db.commit()
    db.refresh(category)
    return CategoryResponse.model_validate(category)

@router.delete(
    "/categories/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer une catégorie",
)
def delete_category(
    category_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    category = db.query(Category).filter(
        and_(Category.id == category_id, Category.tenant_id == current_user.tenant_id)
    ).first()
    if not category:
        raise HTTPException(status_code=404, detail="Catégorie introuvable")
    
    # Remove category from products
    db.query(Product).filter(Product.category_id == category_id).update({"category_id": None})
    db.delete(category)
    db.commit()


# ──────────────────────────── GET /products ────────────────────────────

@router.get(
    "",
    response_model=ProductListResponse,
    summary="Lister les produits de la boutique",
)
def list_products(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(1, ge=1, description="Numéro de page"),
    per_page: int = Query(20, ge=1, le=100, description="Résultats par page"),
    search: str | None = Query(None, description="Recherche par nom"),
    category_id: uuid.UUID | None = Query(None, description="Filtrer par catégorie"),
    in_stock: bool | None = Query(None, description="Uniquement en stock"),
) -> ProductListResponse:
    """
    Liste paginée des produits, filtrée par tenant_id.
    """
    query = db.query(Product).filter(
        and_(
            Product.tenant_id == current_user.tenant_id,
            Product.deleted_at.is_(None),
        )
    )

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Product.name.ilike(search_term),
                Product.sku.ilike(search_term),
                Product.barcode == search
            )
        )

    if category_id:
        query = query.filter(Product.category_id == category_id)

    if in_stock:
        query = query.filter(Product.stock > 0)

    total = query.count()
    items = (
        query
        .order_by(Product.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return ProductListResponse(
        items=[ProductResponse.model_validate(p) for p in items],
        total=total,
        page=page,
        per_page=per_page,
    )


# ──────────────────────────── GET /products/{id} ────────────────────────────

@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Détails d'un produit",
)
def get_product(
    product_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ProductResponse:
    product = db.query(Product).filter(
        and_(
            Product.id == product_id,
            Product.tenant_id == current_user.tenant_id,
            Product.deleted_at.is_(None),
        )
    ).first()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produit introuvable",
        )

    return ProductResponse.model_validate(product)


# ──────────────────────────── POST /products ────────────────────────────

@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un produit",
)
def create_product(
    payload: ProductCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ProductResponse:
    # Validation d'unicité du code-barres
    if payload.barcode:
        existing_barcode = db.query(Product).filter(
            and_(
                Product.tenant_id == current_user.tenant_id,
                Product.barcode == payload.barcode,
                Product.deleted_at.is_(None)
            )
        ).first()
        if existing_barcode:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ce code-barres est déjà utilisé pour un autre produit."
            )

    # Validation d'unicité ou génération de SKU
    sku_val = payload.sku
    if sku_val:
        existing_sku = db.query(Product).filter(
            and_(
                Product.tenant_id == current_user.tenant_id,
                Product.sku == sku_val,
                Product.deleted_at.is_(None)
            )
        ).first()
        if existing_sku:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ce SKU est déjà utilisé pour un autre produit."
            )
    else:
        # Essayer de générer un SKU unique
        for _ in range(5):
            generated = _generate_sku(payload.name)
            conflict = db.query(Product).filter(
                and_(
                    Product.tenant_id == current_user.tenant_id,
                    Product.sku == generated,
                    Product.deleted_at.is_(None)
                )
            ).first()
            if not conflict:
                sku_val = generated
                break
        else:
            sku_val = f"SKU-{uuid.uuid4().hex[:8].upper()}"

    product = Product(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        name=payload.name,
        description=payload.description,
        price=payload.price,
        stock=payload.stock,
        category_id=payload.category_id,
        images=payload.images,
        is_available=payload.is_available,
        sku=sku_val,
        barcode=payload.barcode,
    )
    db.add(product)
    
    # Premier log (création)
    db.flush()
    _create_inventory_log(
        db, current_user.tenant_id, product.id, current_user.user_id,
        "creation", "None", f"stock:{payload.stock}, price:{payload.price}"
    )

    db.commit()
    db.refresh(product)
    
    logger.info("Produit créé : %s (tenant=%s)", product.name, current_user.tenant_id)
    return ProductResponse.model_validate(product)


# ──────────────────────────── PUT /products/{id} ────────────────────────────

@router.put(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Mettre à jour un produit",
)
def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ProductResponse:
    product = db.query(Product).filter(
        and_(
            Product.id == product_id,
            Product.tenant_id == current_user.tenant_id,
            Product.deleted_at.is_(None),
        )
    ).first()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produit introuvable",
        )

    # Validation d'unicité du code-barres si modifié
    if payload.barcode is not None:
        existing_barcode = db.query(Product).filter(
            and_(
                Product.tenant_id == current_user.tenant_id,
                Product.barcode == payload.barcode,
                Product.id != product_id,
                Product.deleted_at.is_(None)
            )
        ).first()
        if existing_barcode:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ce code-barres est déjà utilisé pour un autre produit."
            )

    # Validation d'unicité du SKU si modifié
    if payload.sku is not None:
        existing_sku = db.query(Product).filter(
            and_(
                Product.tenant_id == current_user.tenant_id,
                Product.sku == payload.sku,
                Product.id != product_id,
                Product.deleted_at.is_(None)
            )
        ).first()
        if existing_sku:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ce SKU est déjà utilisé pour un autre produit."
            )

    # Suivi des modifications sensibles
    if payload.stock is not None and payload.stock != product.stock:
        _create_inventory_log(
            db, current_user.tenant_id, product.id, current_user.user_id,
            "stock_change", str(product.stock), str(payload.stock)
        )
    
    if payload.price is not None and payload.price != product.price:
        _create_inventory_log(
            db, current_user.tenant_id, product.id, current_user.user_id,
            "price_change", str(product.price), str(payload.price)
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return ProductResponse.model_validate(product)


# ──────────────────────────── DELETE /products/{id} ────────────────────────────

@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer un produit (soft delete)",
)
def delete_product(
    product_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    product = db.query(Product).filter(
        and_(
            Product.id == product_id,
            Product.tenant_id == current_user.tenant_id,
            Product.deleted_at.is_(None),
        )
    ).first()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produit introuvable",
        )

    product.deleted_at = datetime.now(timezone.utc)
    _create_inventory_log(
        db, current_user.tenant_id, product.id, current_user.user_id,
        "deletion", "active", "deleted"
    )
    
    db.commit()
    logger.info("Produit supprimé (soft) : %s", product_id)
