"""
Routeur FastAPI — Vitrine publique (/storefront/{tenant_slug}/...).

RÈGLE ABSOLUE de ce module : aucune route ici n'est authentifiée (un
visiteur n'a pas de compte BoutikFlow), donc le tenant_id ne peut JAMAIS
venir d'un paramètre fourni par le client — il est toujours résolu
côté serveur à partir du slug, avant tout accès à une ressource. Chaque
requête produit revérifie explicitement tenant_id ET is_public ET
is_available : un identifiant produit de la boutique B, tenté via l'URL
de la boutique A, doit renvoyer 404 exactement comme s'il n'existait
pas (voir TEST B / TEST D du cahier des charges).
"""
import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session, selectinload, defer
from sqlalchemy import and_, func

from app.core.database import get_bypass_db
from app.core.rate_limit import limiter
from app.core.thumbnails import decode_data_uri
from app.modules.auth.models import Tenant, TenantStatusEnum
from app.modules.products.models import Product, Category, Order, OrderStatusEnum
from app.modules.storefront.schemas import (
    PublicStoreResponse,
    PublicProductResponse,
    PublicProductListResponse,
    PublicCategoryResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/storefront", tags=["Vitrine publique"])


def _resolve_public_tenant(db: Session, tenant_slug: str) -> Tenant:
    """Résout un tenant par slug pour un visiteur public — une boutique en
    attente de validation, bloquée ou désactivée n'a pas de vitrine
    publique, exactement comme elle n'a pas d'accès interne fonctionnel."""
    tenant = db.query(Tenant).filter(
        and_(
            Tenant.slug == tenant_slug,
            Tenant.status == TenantStatusEnum.active,
            Tenant.is_active.is_(True),
            Tenant.deleted_at.is_(None),
        )
    ).first()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Boutique introuvable")
    return tenant


def _to_public_product(product: Product) -> PublicProductResponse:
    return PublicProductResponse(
        id=product.id,
        name=product.name,
        description=product.description,
        price=product.price,
        category_name=product.category_rel.name if product.category_rel else None,
        is_available=product.is_available,
        has_image=bool(product.images),
    )


@router.get(
    "/{tenant_slug}",
    response_model=PublicStoreResponse,
    summary="Informations publiques d'une boutique",
)
@limiter.limit("60/minute")
def get_public_store(
    tenant_slug: str,
    request: Request,
    db: Annotated[Session, Depends(get_bypass_db)],
) -> PublicStoreResponse:
    tenant = _resolve_public_tenant(db, tenant_slug)

    orders_count = db.query(func.count(Order.id)).filter(
        and_(
            Order.tenant_id == tenant.id,
            Order.status != OrderStatusEnum.cancelled,
            Order.deleted_at.is_(None),
        )
    ).scalar() or 0

    return PublicStoreResponse(
        name=tenant.name,
        slug=tenant.slug,
        description=tenant.description,
        theme_color=tenant.theme_color,
        has_logo=bool(tenant.logo),
        public_whatsapp=tenant.public_whatsapp,
        about=tenant.about,
        opening_hours=tenant.opening_hours,
        delivery_info=tenant.delivery_info,
        payment_methods=tenant.payment_methods or [],
        orders_count=orders_count,
    )


@router.get(
    "/{tenant_slug}/categories",
    response_model=list[PublicCategoryResponse],
    summary="Catégories ayant au moins un produit public",
)
@limiter.limit("60/minute")
def list_public_categories(
    tenant_slug: str,
    request: Request,
    db: Annotated[Session, Depends(get_bypass_db)],
) -> list[PublicCategoryResponse]:
    tenant = _resolve_public_tenant(db, tenant_slug)

    rows = (
        db.query(Category.id, Category.name, func.count(Product.id))
        .join(Product, Product.category_id == Category.id)
        .filter(
            and_(
                Category.tenant_id == tenant.id,
                Product.tenant_id == tenant.id,
                Product.is_public.is_(True),
                Product.is_available.is_(True),
                Product.deleted_at.is_(None),
            )
        )
        .group_by(Category.id, Category.name)
        .order_by(Category.name.asc())
        .all()
    )
    return [PublicCategoryResponse(id=r[0], name=r[1], count=r[2]) for r in rows]


@router.get(
    "/{tenant_slug}/logo",
    summary="Logo d'une boutique (servi comme une vraie ressource HTTP)",
)
@limiter.limit("120/minute")
def get_public_store_logo(
    tenant_slug: str,
    request: Request,
    db: Annotated[Session, Depends(get_bypass_db)],
):
    tenant = _resolve_public_tenant(db, tenant_slug)
    decoded = decode_data_uri(tenant.logo)
    if not decoded:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Logo introuvable")
    raw_bytes, content_type = decoded
    return Response(content=raw_bytes, media_type=content_type)


@router.get(
    "/{tenant_slug}/products",
    response_model=PublicProductListResponse,
    summary="Liste des produits publics d'une boutique",
)
@limiter.limit("60/minute")
def list_public_products(
    tenant_slug: str,
    request: Request,
    db: Annotated[Session, Depends(get_bypass_db)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, max_length=100, description="Recherche par nom de produit"),
    category_id: uuid.UUID | None = Query(None, description="Filtrer par catégorie"),
) -> PublicProductListResponse:
    tenant = _resolve_public_tenant(db, tenant_slug)

    query = db.query(Product).options(selectinload(Product.category_rel), defer(Product.images)).filter(
        and_(
            Product.tenant_id == tenant.id,
            Product.is_public.is_(True),
            Product.is_available.is_(True),
            Product.deleted_at.is_(None),
        )
    )
    if q and q.strip():
        query = query.filter(Product.name.ilike(f"%{q.strip()}%"))
    if category_id:
        query = query.filter(Product.category_id == category_id)
    total = query.count()
    items = (
        query.order_by(Product.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return PublicProductListResponse(
        items=[_to_public_product(p) for p in items],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get(
    "/{tenant_slug}/products/{product_id}",
    response_model=PublicProductResponse,
    summary="Détail d'un produit public",
)
@limiter.limit("60/minute")
def get_public_product(
    tenant_slug: str,
    product_id: uuid.UUID,
    request: Request,
    db: Annotated[Session, Depends(get_bypass_db)],
) -> PublicProductResponse:
    tenant = _resolve_public_tenant(db, tenant_slug)

    product = db.query(Product).options(selectinload(Product.category_rel)).filter(
        and_(
            Product.id == product_id,
            Product.tenant_id == tenant.id,
            Product.is_public.is_(True),
            Product.is_available.is_(True),
            Product.deleted_at.is_(None),
        )
    ).first()
    # 404 générique, jamais "produit privé" vs "introuvable" — distinguer
    # les deux confirmerait à un visiteur qu'un ID donné existe bel et bien
    # côté serveur, même s'il n'y a jamais accès.
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produit introuvable")

    return _to_public_product(product)


@router.get(
    "/{tenant_slug}/products/{product_id}/image",
    summary="Image d'un produit public (servie comme une vraie ressource HTTP)",
)
@limiter.limit("120/minute")
def get_public_product_image(
    tenant_slug: str,
    product_id: uuid.UUID,
    request: Request,
    db: Annotated[Session, Depends(get_bypass_db)],
):
    tenant = _resolve_public_tenant(db, tenant_slug)

    product = db.query(Product).filter(
        and_(
            Product.id == product_id,
            Product.tenant_id == tenant.id,
            Product.is_public.is_(True),
            Product.is_available.is_(True),
            Product.deleted_at.is_(None),
        )
    ).first()
    if not product or not product.images:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image introuvable")

    decoded = decode_data_uri(product.images[0])
    if not decoded:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image introuvable")

    raw_bytes, content_type = decoded
    return Response(content=raw_bytes, media_type=content_type)
