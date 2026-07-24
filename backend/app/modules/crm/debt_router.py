"""
Router des dettes clients — CRUD + paiements.
"""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.core.database import get_db
from app.core.deps import get_current_user, CurrentUser
from app.modules.crm.debt_models import ClientDebt, DebtPayment, DebtStatusEnum
from app.modules.crm.models import Client
from pydantic import BaseModel, Field
from datetime import datetime
from decimal import Decimal

router = APIRouter(prefix="/crm/debts", tags=["Debts"])


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
    current_user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Créer une nouvelle dette pour un client."""
    client = db.query(Client).filter(
        Client.id == payload.client_id,
        Client.tenant_id == current_user.tenant_id,
        Client.deleted_at.is_(None)
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")

    debt = ClientDebt(
        tenant_id=current_user.tenant_id,
        client_id=payload.client_id,
        order_id=payload.order_id,
        original_amount=payload.original_amount,
        remaining_amount=payload.original_amount,
        description=payload.description,
        due_date=payload.due_date,
    )
    db.add(debt)
    db.commit()
    db.refresh(debt)
    return {
        "id": str(debt.id),
        "message": "Dette enregistrée",
        "remaining_amount": float(debt.remaining_amount),
    }


@router.get("")
def list_debts(
    client_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
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
    current_user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Enregistrer un versement sur une dette."""
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

    payment = DebtPayment(
        tenant_id=current_user.tenant_id,
        debt_id=debt.id,
        amount=payload.amount,
        payment_method=payload.payment_method,
        notes=payload.notes,
    )
    db.add(payment)

    debt.paid_amount = Decimal(str(debt.paid_amount)) + payload.amount
    debt.remaining_amount = Decimal(str(debt.remaining_amount)) - payload.amount
    if debt.remaining_amount <= 0:
        debt.remaining_amount = Decimal('0')
        debt.status = DebtStatusEnum.paid
    else:
        debt.status = DebtStatusEnum.partial

    db.commit()
    return {
        "message": "Versement enregistré",
        "remaining_amount": float(debt.remaining_amount),
        "status": debt.status,
    }
