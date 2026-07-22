"""
Routeur FastAPI — Module Finance & Trésorerie
Gestion des entrées, dépenses et calcul du Solde Net.
"""
from typing import Annotated
import uuid
from decimal import Decimal
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from app.core.database import get_db
from app.core.deps import get_current_user, require_owner_or_manager, CurrentUser
from app.modules.finance.models import FinancialTransaction, TransactionTypeEnum, TransactionCategoryEnum
from app.modules.finance.schemas import (
    TransactionCreate,
    TransactionResponse,
    TransactionListResponse,
    FinanceSummary,
)
from app.modules.audit.router import log_action


router = APIRouter(prefix="/finance", tags=["Finance & Trésorerie"])


@router.get(
    "",
    response_model=TransactionListResponse,
    summary="Consulter les transactions financières et le solde net",
)
def list_transactions(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    type: str | None = Query(None),
    category: str | None = Query(None),
    period: str | None = Query("30j"),  # 7j, 30j, 90j, all
) -> TransactionListResponse:
    query = db.query(FinancialTransaction).filter(FinancialTransaction.tenant_id == current_user.tenant_id)

    if type:
        query = query.filter(FinancialTransaction.type == type)
    if category:
        query = query.filter(FinancialTransaction.category == category)

    if period and period != "all":
        days = 7 if period == "7j" else (90 if period == "90j" else 30)
        since = datetime.utcnow() - timedelta(days=days)
        query = query.filter(FinancialTransaction.created_at >= since)

    total = query.count()
    items = (
        query
        .order_by(FinancialTransaction.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    # Calcul des totaux pour le résumé
    all_trans = query.all()
    total_inc = Decimal(0)
    total_exp = Decimal(0)

    for t in all_trans:
        val = Decimal(str(t.amount))
        if t.type == TransactionTypeEnum.income or t.type == "income":
            total_inc += val
        else:
            total_exp += val

    summary = FinanceSummary(
        total_income=total_inc,
        total_expense=total_exp,
        net_balance=total_inc - total_exp,
        transactions_count=total,
    )

    return TransactionListResponse(
        items=[
            TransactionResponse(
                id=t.id,
                tenant_id=t.tenant_id,
                type=t.type.value if hasattr(t.type, "value") else str(t.type),
                category=t.category.value if hasattr(t.category, "value") else str(t.category),
                amount=t.amount,
                description=t.description,
                payment_method=t.payment_method,
                reference=t.reference,
                user_id=t.user_id,
                created_at=t.created_at,
            )
            for t in items
        ],
        total=total,
        page=page,
        per_page=per_page,
        summary=summary,
    )


@router.post(
    "",
    response_model=TransactionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Enregistrer une nouvelle entrée ou dépense (Propriétaire & Gérant)",
)
def create_transaction(
    payload: TransactionCreate,
    current_user: Annotated[CurrentUser, Depends(require_owner_or_manager)],
    db: Annotated[Session, Depends(get_db)],
) -> TransactionResponse:
    trans = FinancialTransaction(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        type=payload.type,
        category=payload.category,
        amount=payload.amount,
        description=payload.description,
        payment_method=payload.payment_method,
        reference=payload.reference,
        user_id=current_user.user_id,
    )
    db.add(trans)
    db.commit()
    db.refresh(trans)

    log_action(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.user_id,
        user_email=current_user.email,
        action="create_financial_transaction",
        target_entity="finance",
        target_id=str(trans.id),
        details=f"{payload.type.upper()}: {payload.amount} GNF - {payload.description}",
    )

    return TransactionResponse(
        id=trans.id,
        tenant_id=trans.tenant_id,
        type=trans.type.value if hasattr(trans.type, "value") else str(trans.type),
        category=trans.category.value if hasattr(trans.category, "value") else str(trans.category),
        amount=trans.amount,
        description=trans.description,
        payment_method=trans.payment_method,
        reference=trans.reference,
        user_id=trans.user_id,
        created_at=trans.created_at,
    )
