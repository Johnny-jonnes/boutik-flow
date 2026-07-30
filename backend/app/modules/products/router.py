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
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from app.core.database import get_db
from app.core.deps import get_current_user, CurrentUser
from app.core.idempotency import IdempotencyHeader, get_cached_response, store_response
from app.modules.products.models import Product, InventoryLog, Category
from app.modules.products.schemas import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductListResponse,
    ProductBulkCreate,
    ProductBulkCreateResponse,
    ProductBulkCreateError,
    StockBulkIn,
    StockBulkInResponse,
    StockBulkInError,
    ProductStatsResponse,
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
    db.query(Product).filter(
        and_(Product.category_id == category_id, Product.tenant_id == current_user.tenant_id)
    ).update({"category_id": None})
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


# ──────────────────────── GET /products/stats ────────────────────────
# Doit être déclaré AVANT /{product_id} : sinon "stats" est capturé comme
# un product_id (UUID invalide → 422) par la route paramétrée ci-dessous.

@router.get(
    "/stats",
    response_model=ProductStatsResponse,
    summary="Statistiques agrégées du catalogue (toute la boutique)",
)
def get_product_stats(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ProductStatsResponse:
    """
    Calculées en base via SUM/COUNT sur l'ensemble du catalogue — jamais en
    ramenant les lignes côté client puis en les additionnant, ce qui serait
    faux dès que la boutique dépasse la taille d'une page (la valeur totale
    du stock ne refléterait alors qu'un sous-ensemble des produits).
    """
    row = db.query(
        func.count(Product.id),
        func.coalesce(func.sum(Product.price * Product.stock), 0),
        func.coalesce(func.sum(Product.stock), 0),
    ).filter(
        and_(
            Product.tenant_id == current_user.tenant_id,
            Product.deleted_at.is_(None),
        )
    ).first()

    return ProductStatsResponse(
        total_products=row[0] or 0,
        total_stock_value=row[1] or 0,
        total_stock_units=int(row[2] or 0),
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
    idempotency_key: IdempotencyHeader = None,
) -> ProductResponse:
    cached = get_cached_response(db, current_user.tenant_id, "products.create", idempotency_key)
    if cached:
        return cached[1]

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
        cost_price=payload.cost_price,
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
    response = ProductResponse.model_validate(product)
    store_response(db, current_user.tenant_id, "products.create", idempotency_key, status.HTTP_201_CREATED, jsonable_encoder(response))
    return response


# ──────────────────────────── POST /products/bulk ────────────────────────────

@router.post(
    "/bulk",
    response_model=ProductBulkCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer plusieurs produits en une seule fois",
)
def create_products_bulk(
    payload: ProductBulkCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    idempotency_key: IdempotencyHeader = None,
) -> ProductBulkCreateResponse:
    """
    Ajoute jusqu'à 200 produits en un seul envoi, au lieu de répéter le
    formulaire un par un. Chaque produit est traité dans son propre
    savepoint : une erreur sur un article (code-barres en doublon dans le
    lot, par exemple) n'empêche pas les autres d'être créés.
    """
    cached = get_cached_response(db, current_user.tenant_id, "products.bulk_create", idempotency_key)
    if cached:
        return cached[1]

    created: list[ProductResponse] = []
    errors: list[ProductBulkCreateError] = []
    # Codes-barres déjà vus DANS ce lot (le doublon en base est vérifié par
    # item, mais deux lignes du même envoi avec le même code-barres doivent
    # aussi être détectées avant d'atteindre la base).
    seen_barcodes: set[str] = set()
    seen_skus: set[str] = set()

    for index, item in enumerate(payload.products):
        savepoint = db.begin_nested()
        try:
            if item.barcode:
                if item.barcode in seen_barcodes:
                    raise ValueError("Code-barres en double dans ce lot.")
                existing_barcode = db.query(Product).filter(
                    and_(
                        Product.tenant_id == current_user.tenant_id,
                        Product.barcode == item.barcode,
                        Product.deleted_at.is_(None),
                    )
                ).first()
                if existing_barcode:
                    raise ValueError("Ce code-barres est déjà utilisé pour un autre produit.")

            sku_val = item.sku
            if sku_val:
                if sku_val in seen_skus:
                    raise ValueError("SKU en double dans ce lot.")
                existing_sku = db.query(Product).filter(
                    and_(
                        Product.tenant_id == current_user.tenant_id,
                        Product.sku == sku_val,
                        Product.deleted_at.is_(None),
                    )
                ).first()
                if existing_sku:
                    raise ValueError("Ce SKU est déjà utilisé pour un autre produit.")
            else:
                for _ in range(5):
                    generated = _generate_sku(item.name)
                    conflict = (
                        generated in seen_skus
                        or db.query(Product).filter(
                            and_(
                                Product.tenant_id == current_user.tenant_id,
                                Product.sku == generated,
                                Product.deleted_at.is_(None),
                            )
                        ).first()
                    )
                    if not conflict:
                        sku_val = generated
                        break
                else:
                    sku_val = f"SKU-{uuid.uuid4().hex[:8].upper()}"

            product = Product(
                id=uuid.uuid4(),
                tenant_id=current_user.tenant_id,
                name=item.name,
                description=item.description,
                price=item.price,
                cost_price=item.cost_price,
                stock=item.stock,
                category_id=item.category_id,
                images=item.images,
                is_available=item.is_available,
                sku=sku_val,
                barcode=item.barcode,
            )
            db.add(product)
            db.flush()
            _create_inventory_log(
                db, current_user.tenant_id, product.id, current_user.user_id,
                "creation", "None", f"stock:{item.stock}, price:{item.price}"
            )
            savepoint.commit()
            seen_barcodes.add(item.barcode) if item.barcode else None
            seen_skus.add(sku_val)
            created.append(ProductResponse.model_validate(product))
        except Exception as e:
            savepoint.rollback()
            errors.append(ProductBulkCreateError(index=index, name=item.name, error=str(e)))

    db.commit()
    logger.info(
        "Création groupée : %d créés, %d erreurs (tenant=%s)",
        len(created), len(errors), current_user.tenant_id,
    )
    response = ProductBulkCreateResponse(created=created, errors=errors)
    store_response(db, current_user.tenant_id, "products.bulk_create", idempotency_key, status.HTTP_201_CREATED, jsonable_encoder(response))
    return response


# ──────────────────────────── POST /products/stock/bulk-in ─────────────────

@router.post(
    "/stock/bulk-in",
    response_model=StockBulkInResponse,
    summary="Entrée de stock groupée (réception fournisseur, inventaire...)",
)
def bulk_stock_in(
    payload: StockBulkIn,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    idempotency_key: IdempotencyHeader = None,
) -> StockBulkInResponse:
    """
    Ajoute une quantité au stock EXISTANT de plusieurs produits en une
    seule opération, typiquement après une livraison fournisseur — plutôt
    que d'ouvrir chaque produit un par un pour modifier son stock. Chaque
    ligne est traitée dans son propre savepoint : un produit introuvable
    n'empêche pas les autres d'être mis à jour.
    """
    cached = get_cached_response(db, current_user.tenant_id, "products.stock_bulk_in", idempotency_key)
    if cached:
        return cached[1]

    updated: list[ProductResponse] = []
    errors: list[StockBulkInError] = []

    for index, item in enumerate(payload.items):
        savepoint = db.begin_nested()
        try:
            product = db.query(Product).filter(
                and_(
                    Product.id == item.product_id,
                    Product.tenant_id == current_user.tenant_id,
                    Product.deleted_at.is_(None),
                )
            ).first()
            if not product:
                raise ValueError("Produit introuvable.")

            old_stock = product.stock
            product.stock = old_stock + item.quantity
            db.flush()
            _create_inventory_log(
                db, current_user.tenant_id, product.id, current_user.user_id,
                "stock_in_bulk", str(old_stock), str(product.stock),
            )
            savepoint.commit()
            updated.append(ProductResponse.model_validate(product))
        except Exception as e:
            savepoint.rollback()
            errors.append(StockBulkInError(index=index, product_id=str(item.product_id), error=str(e)))

    db.commit()
    logger.info(
        "Entrée de stock groupée : %d mis à jour, %d erreurs (tenant=%s)",
        len(updated), len(errors), current_user.tenant_id,
    )
    response = StockBulkInResponse(updated=updated, errors=errors)
    store_response(db, current_user.tenant_id, "products.stock_bulk_in", idempotency_key, status.HTTP_200_OK, jsonable_encoder(response))
    return response


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
