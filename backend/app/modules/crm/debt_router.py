"""
Router des dettes clients — CRUD + paiements.
"""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.core.database import get_db
from app.core.deps import CurrentUser
from app.core.idempotency import IdempotencyHeader, get_cached_response, store_response
from app.core.permissions import require_permission
from app.modules.crm.debt_models import ClientDebt, DebtPayment, DebtStatusEnum
from app.modules.crm.models import Client
from app.modules.products.models import Order, OrderStatusEnum
from app.modules.finance.models import FinancialTransaction, TransactionTypeEnum, TransactionCategoryEnum
from app.modules.audit.router import log_action
from pydantic import BaseModel, Field
from datetime import datetime
from decimal import Decimal

router = APIRouter(prefix="/crm/debts", tags=["Debts"])


def create_client_debt(
    db: Session,
    tenant_id: uuid.UUID,
    client_id: uuid.UUID,
    order_id: Optional[uuid.UUID],
    original_amount: Decimal,
    description: Optional[str] = None,
    due_date: Optional[datetime] = None,
) -> ClientDebt:
    """Construit (sans commit — l'appelant décide de la transaction) une
    dette client. Partagée par create_debt ci-dessous (dette manuelle,
    sans vente liée, depuis le CRM) et create_order (dette créée dans la
    même transaction que la vente à crédit qui l'origine) — une seule
    construction, jamais dupliquée."""
    debt = ClientDebt(
        tenant_id=tenant_id,
        client_id=client_id,
        order_id=order_id,
        original_amount=original_amount,
        remaining_amount=original_amount,
        description=description,
        due_date=due_date,
    )
    db.add(debt)
    return debt


class DebtCreateRequest(BaseModel):
    client_id: uuid.UUID
    order_id: Optional[uuid.UUID] = None
    original_amount: Decimal = Field(..., gt=0)
    description: Optional[str] = None
    due_date: Optional[datetime] = None


class DebtPaymentRequest(BaseModel):
    amount: Decimal = Field(..., gt=0)
    payment_method: str = "cash"
    notes: Optional[str] = None


class DebtResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    client_name: str
    order_id: Optional[uuid.UUID]
    original_amount: float
    paid_amount: float
    remaining_amount: float
    status: str
    description: Optional[str]
    due_date: Optional[datetime]
    created_at: datetime
    payments: list

    class Config:
        from_attributes = True


@router.post("", status_code=201)
def create_debt(
    payload: DebtCreateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("debts", "create")),
    idempotency_key: IdempotencyHeader = None,
) -> dict:
    """Créer une nouvelle dette manuelle pour un client (sans vente liée —
    pour une vente à crédit, voir create_order qui crée la dette
    directement, dans la même transaction que la commande)."""
    cached = get_cached_response(db, current_user.tenant_id, "debts.create", idempotency_key)
    if cached:
        return cached[1]

    client = db.query(Client).filter(
        Client.id == payload.client_id,
        Client.tenant_id == current_user.tenant_id,
        Client.deleted_at.is_(None)
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")

    debt = create_client_debt(
        db, current_user.tenant_id, payload.client_id, payload.order_id,
        payload.original_amount, payload.description, payload.due_date,
    )
    db.commit()
    db.refresh(debt)
    result = {
        "id": str(debt.id),
        "message": "Dette enregistrée",
        "remaining_amount": float(debt.remaining_amount),
    }
    store_response(db, current_user.tenant_id, "debts.create", idempotency_key, 201, result)
    return result


@router.get("")
def list_debts(
    client_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("debts", "view")),
) -> list:
    """Lister les dettes de la boutique."""
    q = db.query(ClientDebt).filter(ClientDebt.tenant_id == current_user.tenant_id)
    if client_id:
        q = q.filter(ClientDebt.client_id == client_id)
    if status_filter:
        q = q.filter(ClientDebt.status == status_filter)
    debts = q.order_by(ClientDebt.created_at.desc()).all()
    result = []
    for d in debts:
        result.append({
            "id": str(d.id),
            "client_id": str(d.client_id),
            "client_name": d.client.name if d.client else "—",
            "order_id": str(d.order_id) if d.order_id else None,
            "original_amount": float(d.original_amount),
            "paid_amount": float(d.paid_amount),
            "remaining_amount": float(d.remaining_amount),
            "status": d.status,
            "description": d.description,
            "due_date": d.due_date.isoformat() if d.due_date else None,
            "created_at": d.created_at.isoformat(),
        })
    return result


@router.post("/{debt_id}/pay")
def record_payment(
    debt_id: uuid.UUID,
    payload: DebtPaymentRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("debts", "pay")),
    idempotency_key: IdempotencyHeader = None,
) -> dict:
    """Enregistrer un versement sur une dette."""
    cached = get_cached_response(db, current_user.tenant_id, "debts.pay", idempotency_key)
    if cached:
        return cached[1]

    debt = db.query(ClientDebt).filter(
        ClientDebt.id == debt_id,
        ClientDebt.tenant_id == current_user.tenant_id,
    ).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Dette introuvable")
    if debt.status == DebtStatusEnum.paid:
        raise HTTPException(status_code=400, detail="Cette dette est déjà totalement réglée")
    if payload.amount > debt.remaining_amount:
        raise HTTPException(status_code=400, detail=f"Le montant dépasse le solde restant ({float(debt.remaining_amount)} GNF)")

    balance_before = Decimal(str(debt.remaining_amount))

    payment = DebtPayment(
        tenant_id=current_user.tenant_id,
        debt_id=debt.id,
        amount=payload.amount,
        payment_method=payload.payment_method,
        notes=payload.notes,
        paid_by=current_user.user_id,
        balance_before=balance_before,
    )
    db.add(payment)

    debt.paid_amount = Decimal(str(debt.paid_amount)) + payload.amount
    debt.remaining_amount = balance_before - payload.amount
    if debt.remaining_amount <= 0:
        debt.remaining_amount = Decimal('0')
        debt.status = DebtStatusEnum.paid
    else:
        debt.status = DebtStatusEnum.partial
    payment.balance_after = debt.remaining_amount

    # Le remboursement rejoint les Finances comme un mouvement distinct
    # d'une vente comptant (demande 9) — jamais catégorie "sale", pour
    # pouvoir toujours distinguer encaissement immédiat et recouvrement
    # d'une créance plus tard dans le temps.
    fin_trans = FinancialTransaction(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        type=TransactionTypeEnum.income,
        category=TransactionCategoryEnum.debt_repayment,
        amount=payload.amount,
        description=f"Remboursement dette {str(debt.id)[:8]}" + (f" — {payload.notes}" if payload.notes else ""),
        payment_method=payload.payment_method,
        reference=str(debt.id),
        user_id=current_user.user_id,
    )
    db.add(fin_trans)

    # Une dette liée à une vente reste "pending" tant qu'elle n'est pas
    # soldée — invisible de l'historique des Ventes jusque-là (filtré sur
    # "delivered"). Une fois le solde à zéro, la vente est enfin réalisée
    # dans son intégralité : on la fait apparaître comme telle. Affectation
    # directe (pas via update_order_status) : ne doit jamais redéclencher
    # la logique d'annulation/réactivation de stock, sans rapport ici.
    linked_order = None
    if debt.order_id and debt.remaining_amount <= 0:
        linked_order = db.query(Order).filter(
            and_(Order.id == debt.order_id, Order.tenant_id == current_user.tenant_id)
        ).first()
        if linked_order and linked_order.status == OrderStatusEnum.pending:
            linked_order.status = OrderStatusEnum.delivered

    log_action(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.user_id,
        user_email=current_user.email,
        action="record_debt_payment",
        target_entity="debt",
        target_id=str(debt.id),
        details=(
            f"Versement de {payload.amount} GNF sur la dette {str(debt.id)[:8]} "
            f"(solde {balance_before} -> {debt.remaining_amount} GNF, statut: {debt.status.value})"
        ),
    )

    db.commit()
    result = {
        "message": "Versement enregistré",
        "remaining_amount": float(debt.remaining_amount),
        "status": debt.status,
        "order_marked_delivered": bool(linked_order and linked_order.status == OrderStatusEnum.delivered),
    }
    store_response(db, current_user.tenant_id, "debts.pay", idempotency_key, 200, result)
    return result
