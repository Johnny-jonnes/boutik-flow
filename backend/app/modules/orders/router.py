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
from decimal import Decimal
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
    OrderReturnRequest,
)
from app.modules.finance.models import FinancialTransaction, TransactionTypeEnum, TransactionCategoryEnum
from app.modules.audit.router import log_action

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
    # Vérifier ou créer automatiquement un client comptoir si non fourni
    target_client_id = payload.client_id

    if target_client_id:
        client = db.query(Client).filter(
            and_(
                Client.id == target_client_id,
                Client.tenant_id == current_user.tenant_id,
                Client.deleted_at.is_(None),
            )
        ).first()
        if not client:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client introuvable")
    else:
        # Trouver ou créer le 'Client Comptoir' par défaut pour les ventes rapides
        counter_client = db.query(Client).filter(
            and_(
                Client.tenant_id == current_user.tenant_id,
                Client.name == "Client Comptoir",
                Client.deleted_at.is_(None),
            )
        ).first()

        if not counter_client:
            counter_client = Client(
                id=uuid.uuid4(),
                tenant_id=current_user.tenant_id,
                name="Client Comptoir",
                phone="+22400000000",
                notes="Client automatique pour les ventes anonymes de caisse",
            )
            db.add(counter_client)
            db.flush()

        client = counter_client
        target_client_id = counter_client.id

    # Créer l'entité Order de base
    order = Order(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        client_id=target_client_id,
        status=OrderStatusEnum.confirmed,
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

    # Mettre à jour last_activity_at du client si présent
    try:
        if hasattr(client, "last_activity_at"):
            client.last_activity_at = datetime.now(timezone.utc)
    except Exception:
        pass

    # Enregistrer automatiquement la transaction financière d'entrée d'argent (Vente)
    try:
        fin_trans = FinancialTransaction(
            id=uuid.uuid4(),
            tenant_id=current_user.tenant_id,
            type=TransactionTypeEnum.income,
            category=TransactionCategoryEnum.sale,
            amount=total_amount,
            description=f"Vente Magasin N°{str(order.id)[:8]} ({client.name})",
            payment_method="cash",
            reference=str(order.id),
            user_id=current_user.user_id,
        )
        db.add(fin_trans)
    except Exception as e:
        logger.warning(f"Erreur d'enregistrement financier automatique : {e}")

    # Logger l'action d'audit de la vente
    log_action(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.user_id,
        user_email=current_user.email,
        action="create_sale",
        target_entity="order",
        target_id=str(order.id),
        details=f"Vente validée N°{str(order.id)[:8]} ({client.name}) pour {total_amount} GNF",
    )

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


# ──────────────────────────── POST /orders/{id}/return ────────────────────────────

@router.post(
    "/{order_id}/return",
    response_model=dict,
    summary="Enregistrer un retour produit / remboursement",
)
def return_order_items(
    order_id: uuid.UUID,
    payload: OrderReturnRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    order = db.query(Order).filter(
        and_(
            Order.id == order_id,
            Order.tenant_id == current_user.tenant_id,
            Order.deleted_at.is_(None),
        )
    ).first()

    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commande introuvable")

    refund_amount = Decimal(0)
    returned_details = []

    for item in payload.items:
        order_item = db.query(OrderItem).filter(
            and_(
                OrderItem.order_id == order.id,
                OrderItem.product_id == item.product_id,
            )
        ).first()

        if not order_item:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Produit {item.product_id} non trouvé dans cette commande")

        if item.quantity > order_item.quantity:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La quantité retournée dépasse la quantité achetée")

        product = db.query(Product).filter(Product.id == item.product_id).first()
        if product:
            item_refund = Decimal(str(order_item.unit_price)) * Decimal(item.quantity)
            refund_amount += item_refund
            returned_details.append(f"{item.quantity}x {product.name} ({item_refund} GNF)")

            if payload.restock_inventory:
                old_stock = product.stock
                product.stock += item.quantity
                inventory_log = InventoryLog(
                    id=uuid.uuid4(),
                    tenant_id=current_user.tenant_id,
                    product_id=product.id,
                    change_type="product_return",
                    old_value=str(old_stock),
                    new_value=str(product.stock),
                    changed_by=current_user.user_id,
                )
                db.add(inventory_log)

    # Créer la transaction financière de remboursement (dépense)
    if refund_amount > 0:
        fin_trans = FinancialTransaction(
            id=uuid.uuid4(),
            tenant_id=current_user.tenant_id,
            type=TransactionTypeEnum.expense,
            category=TransactionCategoryEnum.refund,
            amount=refund_amount,
            description=f"Remboursement Retour N°{str(order.id)[:8]} : {payload.reason}",
            payment_method="cash",
            reference=str(order.id),
            user_id=current_user.user_id,
        )
        db.add(fin_trans)

    # Logger l'action d'audit
    log_action(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.user_id,
        user_email=current_user.email,
        action="return_order_items",
        target_entity="order",
        target_id=str(order.id),
        details=f"Retour sur commande {str(order.id)[:8]}: {', '.join(returned_details)}. Motif: {payload.reason}. Remboursé: {refund_amount} GNF",
    )

    db.commit()

    return {
        "message": "Retour enregistré avec succès",
        "order_id": str(order.id),
        "refund_amount": float(refund_amount),
        "restocked": payload.restock_inventory,
        "details": ", ".join(returned_details),
    }
