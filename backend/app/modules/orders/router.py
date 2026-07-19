"""
Router Commandes — Gestion des commandes
Règles appliquées :
- Multi-tenant : filtrage par tenant_id
- Sécurité : le prix des articles est pris depuis la base de données (pas depuis la requête)
- Gestion de stock : diminution du stock lors de la création de commande
- Historisation : Création automatique de OrderLog à chaque changement de statut
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import and_

from app.core.database import get_db
from app.core.deps import get_current_user, CurrentUser
from app.modules.products.models import Order, OrderItem, OrderLog, OrderStatusEnum, Product, InventoryLog
from app.modules.crm.models import Client
from app.modules.orders.schemas import (
    OrderCreate,
    OrderUpdateStatus,
    OrderResponse,
    OrderListResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/orders", tags=["Commandes"])


def _create_order_log(
    db: Session,
    tenant_id: uuid.UUID,
    order_id: uuid.UUID,
    old_status: str | None,
    new_status: str,
    changed_by: uuid.UUID,
    note: str | None = None,
):
    """Enregistre un changement de statut dans l'historique."""
    log = OrderLog(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        order_id=order_id,
        old_status=old_status,
        new_status=new_status,
        changed_by=changed_by,
        note=note,
    )
    db.add(log)


# ──────────────────────────── GET /orders ────────────────────────────

@router.get(
    "",
    response_model=OrderListResponse,
    summary="Lister les commandes de la boutique",
)
def list_orders(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(1, ge=1, description="Numéro de page"),
    per_page: int = Query(20, ge=1, le=100, description="Résultats par page"),
    status_filter: str | None = Query(None, alias="status", description="Filtrer par statut"),
    client_id: uuid.UUID | None = Query(None, description="Filtrer par client"),
) -> OrderListResponse:
    """
    Liste paginée des commandes, filtrée par tenant_id.
    Supporte le filtrage par statut et par client.
    """
    query = db.query(Order).options(selectinload(Order.items)).filter(
        and_(
            Order.tenant_id == current_user.tenant_id,
            Order.deleted_at.is_(None),
        )
    )

    if status_filter:
        query = query.filter(Order.status == status_filter)

    if client_id:
        query = query.filter(Order.client_id == client_id)

    total = query.count()
    items = (
        query
        .order_by(Order.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return OrderListResponse(
        items=[OrderResponse.model_validate(o) for o in items],
        total=total,
        page=page,
        per_page=per_page,
    )


# ──────────────────────────── GET /orders/{id} ────────────────────────────

@router.get(
    "/{order_id}",
    response_model=OrderResponse,
    summary="Détails d'une commande",
)
def get_order(
    order_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> OrderResponse:
    order = db.query(Order).filter(
        and_(
            Order.id == order_id,
            Order.tenant_id == current_user.tenant_id,
            Order.deleted_at.is_(None),
        )
    ).first()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Commande introuvable",
        )

    return OrderResponse.model_validate(order)


# ──────────────────────────── POST /orders ────────────────────────────

@router.post(
    "",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer une commande",
)
def create_order(
    payload: OrderCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> OrderResponse:
    """
    Crée une commande.
    1. Vérifie le client.
    2. Vérifie les produits et les stocks.
    3. Calcule le total (côté serveur).
    4. Décrémente les stocks et logue les changements.
    """
    # Vérifier client
    client = db.query(Client).filter(
        and_(
            Client.id == payload.client_id,
            Client.tenant_id == current_user.tenant_id,
            Client.deleted_at.is_(None),
        )
    ).first()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client introuvable")

    # Créer l'entité Order de base
    order = Order(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        client_id=payload.client_id,
        status=OrderStatusEnum.pending,
        total=0,
        notes=payload.notes,
    )
    db.add(order)

    # Gérer les lignes et le stock
    total_amount = 0
    for item in payload.items:
        product = db.query(Product).filter(
            and_(
                Product.id == item.product_id,
                Product.tenant_id == current_user.tenant_id,
                Product.deleted_at.is_(None),
                Product.is_available.is_(True),
            )
        ).first()

        if not product:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Produit {item.product_id} introuvable ou indisponible.",
            )

        if product.stock < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stock insuffisant pour {product.name} (Reste: {product.stock}).",
            )

        # Créer OrderItem
        order_item = OrderItem(
            id=uuid.uuid4(),
            order_id=order.id,
            product_id=product.id,
            quantity=item.quantity,
            unit_price=product.price,
        )
        db.add(order_item)

        # Mettre à jour et logger le stock
        old_stock = product.stock
        product.stock -= item.quantity
        
        inventory_log = InventoryLog(
            id=uuid.uuid4(),
            tenant_id=current_user.tenant_id,
            product_id=product.id,
            change_type="stock_change_order",
            old_value=str(old_stock),
            new_value=str(product.stock),
            changed_by=current_user.user_id,
        )
        db.add(inventory_log)

        total_amount += (product.price * item.quantity)

    # Mise à jour du total
    order.total = total_amount

    # Premier OrderLog
    db.flush()
    _create_order_log(
        db=db,
        tenant_id=current_user.tenant_id,
        order_id=order.id,
        old_status=None,
        new_status=OrderStatusEnum.pending.value,
        changed_by=current_user.user_id,
        note="Commande créée",
    )

    # Mettre à jour last_activity_at du client
    client.last_activity_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(order)
    
    logger.info("Commande créée : %s (Total=%s)", order.id, order.total)
    return OrderResponse.model_validate(order)


# ──────────────────────────── PATCH /orders/{id}/status ────────────────────────────

@router.patch(
    "/{order_id}/status",
    response_model=OrderResponse,
    summary="Mettre à jour le statut d'une commande",
)
def update_order_status(
    order_id: uuid.UUID,
    payload: OrderUpdateStatus,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> OrderResponse:
    """Modifie le statut de la commande et historise l'action."""
    order = db.query(Order).filter(
        and_(
            Order.id == order_id,
            Order.tenant_id == current_user.tenant_id,
            Order.deleted_at.is_(None),
        )
    ).first()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Commande introuvable",
        )

    old_status = order.status
    new_status_enum = OrderStatusEnum(payload.status)

    if old_status == new_status_enum:
        return OrderResponse.model_validate(order)

    # Si annulée, on pourrait restituer le stock (à implémenter selon besoin métier)
    # Dans ce MVP, on se concentre sur l'historisation
    
    order.status = new_status_enum
    
    _create_order_log(
        db=db,
        tenant_id=current_user.tenant_id,
        order_id=order.id,
        old_status=old_status.value if hasattr(old_status, 'value') else old_status,
        new_status=new_status_enum.value,
        changed_by=current_user.user_id,
        note=payload.note,
    )

    db.commit()
    db.refresh(order)
    
    logger.info("Statut commande mis à jour : %s (%s -> %s)", order.id, old_status, new_status_enum)
    return OrderResponse.model_validate(order)
