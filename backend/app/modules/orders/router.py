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

from fastapi.encoders import jsonable_encoder

from app.core.database import get_db
from app.core.deps import CurrentUser
from app.core.idempotency import IdempotencyHeader, get_cached_response, store_response
from app.core.permissions import require_permission, has_permission
from app.modules.products.models import Order, OrderItem, OrderLog, OrderStatusEnum, Product, InventoryLog
from app.modules.crm.models import Client
from app.modules.auth.models import User
from app.modules.orders.schemas import (
    OrderCreate,
    OrderUpdateStatus,
    OrderResponse,
    OrderItemResponse,
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


def _user_names_for_orders(db: Session, orders: list[Order]) -> dict:
    """Résout en une seule requête le nom affichable (nom complet ou email)
    de chaque vendeur présent dans un lot de commandes — évite une requête
    utilisateur par commande lors du listing de l'historique des ventes."""
    ids = {o.created_by for o in orders if o.created_by}
    if not ids:
        return {}
    users = db.query(User).filter(User.id.in_(ids)).all()
    return {u.id: (u.full_name or u.email) for u in users}


def _build_order_response(order: Order, user_names: dict) -> OrderResponse:
    """Construit la réponse en résolvant explicitement les noms (client,
    vendeur, produit) depuis les relations chargées — plutôt qu'un
    model_validate() aveugle qui ne verrait que les colonnes brutes."""
    items = [
        OrderItemResponse(
            id=item.id,
            product_id=item.product_id,
            product_name=item.product.name if item.product else None,
            quantity=item.quantity,
            unit_price=item.unit_price,
        )
        for item in order.items
    ]
    status_value = order.status.value if hasattr(order.status, "value") else order.status
    return OrderResponse(
        id=order.id,
        tenant_id=order.tenant_id,
        client_id=order.client_id,
        client_name=order.client.name if order.client else None,
        created_by=order.created_by,
        created_by_name=user_names.get(order.created_by) if order.created_by else None,
        status=status_value,
        total=order.total,
        notes=order.notes,
        created_at=order.created_at,
        updated_at=order.updated_at,
        deleted_at=order.deleted_at,
        items=items,
    )


def _restock_order_items(db: Session, order: Order, current_user: CurrentUser, reason: str):
    """Remet en stock les articles d'une commande et trace chaque mouvement."""
    for item in order.items:
        product = db.query(Product).filter(
            and_(Product.id == item.product_id, Product.tenant_id == current_user.tenant_id)
        ).first()
        if not product:
            continue

        old_stock = product.stock
        product.stock += item.quantity
        db.add(
            InventoryLog(
                id=uuid.uuid4(),
                tenant_id=current_user.tenant_id,
                product_id=product.id,
                change_type=reason,
                old_value=str(old_stock),
                new_value=str(product.stock),
                changed_by=current_user.user_id,
            )
        )


def _consume_order_items(db: Session, order: Order, current_user: CurrentUser):
    """
    Redébite le stock d'une commande réactivée après annulation.

    Le stock est d'abord vérifié en totalité : on refuse la réactivation
    plutôt que de laisser un stock négatif s'installer en base.
    """
    products = {}
    for item in order.items:
        product = db.query(Product).filter(
            and_(Product.id == item.product_id, Product.tenant_id == current_user.tenant_id)
        ).first()
        if not product:
            continue
        if product.stock < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stock insuffisant pour réactiver la commande : {product.name} (Reste: {product.stock}).",
            )
        products[item.product_id] = product

    for item in order.items:
        product = products.get(item.product_id)
        if not product:
            continue

        old_stock = product.stock
        product.stock -= item.quantity
        db.add(
            InventoryLog(
                id=uuid.uuid4(),
                tenant_id=current_user.tenant_id,
                product_id=product.id,
                change_type="order_reactivated",
                old_value=str(old_stock),
                new_value=str(product.stock),
                changed_by=current_user.user_id,
            )
        )


def _remove_sale_transaction(db: Session, order: Order):
    """Supprime la recette générée par une vente qui vient d'être annulée."""
    db.query(FinancialTransaction).filter(
        and_(
            FinancialTransaction.tenant_id == order.tenant_id,
            FinancialTransaction.reference == str(order.id),
            FinancialTransaction.type == TransactionTypeEnum.income,
            FinancialTransaction.category == TransactionCategoryEnum.sale,
        )
    ).delete(synchronize_session=False)


def _restore_sale_transaction(db: Session, order: Order, current_user: CurrentUser):
    """Recrée la recette d'une commande réactivée, sans jamais la dupliquer."""
    existing = db.query(FinancialTransaction).filter(
        and_(
            FinancialTransaction.tenant_id == order.tenant_id,
            FinancialTransaction.reference == str(order.id),
            FinancialTransaction.type == TransactionTypeEnum.income,
            FinancialTransaction.category == TransactionCategoryEnum.sale,
        )
    ).first()
    if existing:
        return

    db.add(
        FinancialTransaction(
            id=uuid.uuid4(),
            tenant_id=order.tenant_id,
            type=TransactionTypeEnum.income,
            category=TransactionCategoryEnum.sale,
            amount=order.total,
            description=f"Vente Magasin N°{str(order.id)[:8]} (commande réactivée)",
            payment_method="cash",
            reference=str(order.id),
            user_id=current_user.user_id,
        )
    )


# ──────────────────────────── GET /orders ────────────────────────────

@router.get(
    "",
    response_model=OrderListResponse,
    summary="Lister les commandes de la boutique",
)
def list_orders(
    current_user: Annotated[CurrentUser, Depends(require_permission("orders", "view"))],
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(1, ge=1, description="Numéro de page"),
    per_page: int = Query(20, ge=1, le=500, description="Résultats par page"),
    status_filter: str | None = Query(None, alias="status", description="Filtrer par statut"),
    client_id: uuid.UUID | None = Query(None, description="Filtrer par client"),
    updated_since: datetime | None = Query(
        None, description="Synchronisation incrémentale : ne renvoie que les commandes créées/modifiées/supprimées après cette date."
    ),
) -> OrderListResponse:
    """
    Liste paginée des commandes, filtrée par tenant_id.
    Supporte le filtrage par statut et par client.

    Avec `updated_since`, inclut aussi les commandes annulées/supprimées
    depuis cette date pour que le client synchronise ces changements de
    statut, pas seulement les nouvelles commandes.
    """
    query = db.query(Order).options(
        selectinload(Order.items).selectinload(OrderItem.product),
        selectinload(Order.client),
    ).filter(Order.tenant_id == current_user.tenant_id)
    if updated_since is not None:
        query = query.filter(Order.updated_at > updated_since)
    else:
        query = query.filter(Order.deleted_at.is_(None))

    if status_filter:
        query = query.filter(Order.status == status_filter)

    if client_id:
        query = query.filter(Order.client_id == client_id)

    total = query.count()
    # Ordre chronologique croissant en incrémental (voir la même remarque
    # dans products/router.py::list_products).
    order = Order.updated_at.asc() if updated_since is not None else Order.created_at.desc()
    items = (
        query
        .order_by(order)
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    user_names = _user_names_for_orders(db, items)
    return OrderListResponse(
        items=[_build_order_response(o, user_names) for o in items],
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
    current_user: Annotated[CurrentUser, Depends(require_permission("orders", "view"))],
    db: Annotated[Session, Depends(get_db)],
) -> OrderResponse:
    order = db.query(Order).options(
        selectinload(Order.items).selectinload(OrderItem.product),
        selectinload(Order.client),
    ).filter(
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

    return _build_order_response(order, _user_names_for_orders(db, [order]))


# ──────────────────────────── POST /orders ────────────────────────────

@router.post(
    "",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer une commande",
)
def create_order(
    payload: OrderCreate,
    current_user: Annotated[CurrentUser, Depends(require_permission("orders", "create"))],
    db: Annotated[Session, Depends(get_db)],
    idempotency_key: IdempotencyHeader = None,
) -> OrderResponse:
    """
    Crée une commande.
    1. Vérifie le client.
    2. Vérifie les produits et les stocks.
    3. Calcule le total (côté serveur).
    4. Décrémente les stocks et logue les changements.
    """
    # Une requête déjà traitée avec succès (réponse perdue à cause d'une
    # connexion instable, puis retentée) ne doit jamais recréer la vente.
    cached = get_cached_response(db, current_user.tenant_id, "orders.create", idempotency_key)
    if cached:
        return cached[1]

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
        # Trouver ou créer le client générique 'Passant' pour les ventes de caisse anonymes
        counter_client = db.query(Client).filter(
            and_(
                Client.tenant_id == current_user.tenant_id,
                Client.name.in_(["Passant", "Client Comptoir"]),
                Client.deleted_at.is_(None),
            )
        ).first()

        if not counter_client:
            counter_client = Client(
                id=uuid.uuid4(),
                tenant_id=current_user.tenant_id,
                name="Passant",
                phone="+22400000000",
                notes="Client automatique pour les ventes anonymes de caisse",
            )
            db.add(counter_client)
            db.flush()

        client = counter_client
        target_client_id = counter_client.id

    initial_status = OrderStatusEnum.delivered
    if payload.status:
        try:
            initial_status = OrderStatusEnum[payload.status]
        except KeyError:
            initial_status = OrderStatusEnum.delivered

    # Créer l'entité Order de base
    order = Order(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        client_id=target_client_id,
        created_by=current_user.user_id,
        status=initial_status,
        total=0,
        notes=payload.notes,
    )
    db.add(order)

    # Gérer les lignes et le stock
    total_amount = 0
    stock_shortages: list[str] = []
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

        is_shortage = product.stock < item.quantity
        if is_shortage:
            if not payload.allow_stock_shortage:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Stock insuffisant pour {product.name} (Reste: {product.stock}).",
                )
            # Rejeu d'une vente déjà annoncée au client pendant une coupure :
            # on ne la rejette plus, le stock est autorisé à passer négatif
            # et l'écart est tracé pour une régularisation manuelle ultérieure.
            stock_shortages.append(f"{product.name} (manquant: {item.quantity - product.stock})")

        # Créer OrderItem — cost_price est figé au prix d'achat actuel du
        # produit (souvent NULL, le prix d'achat étant facultatif) : la
        # marge de cette vente ne doit pas changer si le prix d'achat du
        # produit est modifié plus tard.
        order_item = OrderItem(
            id=uuid.uuid4(),
            order_id=order.id,
            product_id=product.id,
            quantity=item.quantity,
            unit_price=product.price,
            cost_price=product.cost_price,
        )
        db.add(order_item)

        # Mettre à jour et logger le stock
        old_stock = product.stock
        product.stock -= item.quantity
        
        inventory_log = InventoryLog(
            id=uuid.uuid4(),
            tenant_id=current_user.tenant_id,
            product_id=product.id,
            change_type="stock_change_order_shortage" if is_shortage else "stock_change_order",
            old_value=str(old_stock),
            new_value=str(product.stock),
            changed_by=current_user.user_id,
        )
        db.add(inventory_log)

        total_amount += (product.price * item.quantity)

    # Remise globale : déduite du total réellement dû et de la transaction
    # financière ci-dessous, mais jamais des lignes de commande — le prix
    # catalogue de chaque article reste la référence pour la marge produit
    # (voir app.core.metrics.product_margin), la remise est un rabais sur
    # la vente dans son ensemble, pas une renégociation prix par prix.
    net_amount = max(Decimal("0"), total_amount - payload.discount)

    # Mise à jour du total
    order.total = net_amount

    # Trace visible dans l'historique des ventes (fiche détail) — le
    # commerçant doit pouvoir repérer et régulariser un stock devenu négatif
    # suite au rejeu d'une vente hors-ligne, sans avoir à fouiller les logs.
    if stock_shortages:
        shortage_note = "⚠️ Stock négatif (vente hors-ligne) : " + ", ".join(stock_shortages)
        order.notes = f"{order.notes}\n{shortage_note}" if order.notes else shortage_note

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
            amount=net_amount,
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
        details=f"Vente validée N°{str(order.id)[:8]} ({client.name}) pour {net_amount} GNF",
    )

    db.commit()
    db.refresh(order)

    logger.info("Commande créée : %s (Total=%s)", order.id, order.total)
    response = _build_order_response(order, _user_names_for_orders(db, [order]))
    store_response(
        db, current_user.tenant_id, "orders.create", idempotency_key,
        status.HTTP_201_CREATED, jsonable_encoder(response),
    )
    return response


# ──────────────────────────── PATCH /orders/{id}/status ────────────────────────────

@router.patch(
    "/{order_id}/status",
    response_model=OrderResponse,
    summary="Mettre à jour le statut d'une commande",
)
def update_order_status(
    order_id: uuid.UUID,
    payload: OrderUpdateStatus,
    current_user: Annotated[CurrentUser, Depends(require_permission("orders", "create"))],
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
        return _build_order_response(order, _user_names_for_orders(db, [order]))

    was_cancelled = old_status == OrderStatusEnum.cancelled
    is_cancelled = new_status_enum == OrderStatusEnum.cancelled

    # L'annulation (et sa réactivation) modifie stock et finances — réservée
    # à owner/manager, contrairement aux autres transitions de statut
    # (confirmer, livrer...) ouvertes aux rôles pouvant créer une commande.
    if (is_cancelled or was_cancelled) and not has_permission(current_user.role, "orders", "cancel"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les propriétaires et gérants peuvent annuler une commande.",
        )

    # ── Annulation : la vente n'a pas eu lieu ──
    # Sans ce traitement, la recette restait comptée dans le chiffre d'affaires
    # et le stock restait débité : le Tableau de bord et Finance affichaient
    # alors une vente qui n'existe plus.
    if is_cancelled:
        _restock_order_items(db, order, current_user, "order_cancelled")
        _remove_sale_transaction(db, order)

    # ── Réactivation d'une commande annulée : on rejoue la vente ──
    elif was_cancelled:
        _consume_order_items(db, order, current_user)
        _restore_sale_transaction(db, order, current_user)

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
    return _build_order_response(order, _user_names_for_orders(db, [order]))


# ──────────────────────────── POST /orders/{id}/return ────────────────────────────

@router.post(
    "/{order_id}/return",
    response_model=dict,
    summary="Enregistrer un retour produit / remboursement",
)
def return_order_items(
    order_id: uuid.UUID,
    payload: OrderReturnRequest,
    current_user: Annotated[CurrentUser, Depends(require_permission("returns", "create"))],
    db: Annotated[Session, Depends(get_db)],
    idempotency_key: IdempotencyHeader = None,
):
    # Sans cette protection, une réponse perdue sur une connexion instable
    # (le retour a bien été traité côté serveur, mais le client ne l'a
    # jamais su et le rejoue) créait un second remboursement et un second
    # restockage pour le même retour physique.
    cached = get_cached_response(db, current_user.tenant_id, "orders.return", idempotency_key)
    if cached:
        return cached[1]

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

        product = db.query(Product).filter(
            and_(Product.id == item.product_id, Product.tenant_id == current_user.tenant_id)
        ).first()
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

    response = {
        "message": "Retour enregistré avec succès",
        "order_id": str(order.id),
        "refund_amount": float(refund_amount),
        "restocked": payload.restock_inventory,
        "details": ", ".join(returned_details),
    }
    store_response(db, current_user.tenant_id, "orders.return", idempotency_key, status.HTTP_200_OK, response)
    return response
