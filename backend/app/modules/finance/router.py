"""
Routeur FastAPI — Module Finance & Trésorerie
Gestion des entrées, dépenses et calcul du Solde Net.
"""
from typing import Annotated
import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_owner_or_manager, CurrentUser
from app.core.period import resolve_period
from app.core.metrics import financial_totals, product_margin
from app.modules.finance.models import FinancialTransaction
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
    period: str | None = Query("30j"),  # 7j, 30j, 90j, all, custom
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
) -> TransactionListResponse:
    # Fenêtre de dates résolue par la fonction partagée avec le Tableau de bord :
    # une même sélection y produit donc rigoureusement les mêmes bornes.
    start, end = resolve_period(period, start_date, end_date)

    query = db.query(FinancialTransaction).filter(FinancialTransaction.tenant_id == current_user.tenant_id)

    if type:
        query = query.filter(FinancialTransaction.type == type)
    if category:
        query = query.filter(FinancialTransaction.category == category)
    if start is not None:
        query = query.filter(FinancialTransaction.created_at >= start)
    if end is not None:
        query = query.filter(FinancialTransaction.created_at < end)

    total = query.count()
    items = (
        query
        .order_by(FinancialTransaction.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    # Totaux calculés par le service partagé (agrégation SQL) : plus de
    # chargement de toutes les lignes en mémoire pour faire une somme.
    totals = financial_totals(
        db,
        current_user.tenant_id,
        start,
        end,
        type_filter=type,
        category_filter=category,
    )

    # Marge produits sur la même fenêtre de dates — indépendante du filtre
    # type/catégorie de la liste, qui ne concerne que les transactions
    # affichées, pas les ventes de produits sous-jacentes.
    margin = product_margin(db, current_user.tenant_id, start, end)

    summary = FinanceSummary(
        total_income=totals.total_income,
        total_expense=totals.total_expense,
        net_balance=totals.net_balance,
        transactions_count=totals.transactions_count,
        product_margin=margin.gross_margin,
        product_margin_coverage=margin.coverage_pct,
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
