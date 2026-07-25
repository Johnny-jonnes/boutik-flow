"""
Calcul des indicateurs chiffrés — SOURCE UNIQUE DE VÉRITÉ.

Le Tableau de bord et le module Finance appellent tous les deux ces
fonctions. Aucun module ne doit recalculer un chiffre d'affaires, un
total de dépenses ou un nombre de ventes « dans son coin » : c'est ainsi
qu'apparaissaient deux valeurs différentes pour une même période.

Deux familles d'indicateurs cohabitent, avec des rôles distincts :

- Les indicateurs **de trésorerie** (`financial_totals`) sont calculés sur
  la table `financial_transactions`. Ce sont eux qui font foi pour le
  chiffre d'affaires, les dépenses et le bénéfice net : toute vente crée
  automatiquement une transaction d'entrée, et une entrée manuelle
  (apport, autre revenu) doit également être comptabilisée.

- Les indicateurs **d'activité** (`sales_metrics`) sont calculés sur les
  commandes. Ils répondent à « combien de ventes / de produits vendus »,
  ce que la trésorerie seule ne peut pas dire.

Toutes les fonctions attendent une fenêtre `[start, end)` produite par
`app.core.period.resolve_period()`.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.finance.models import FinancialTransaction, TransactionTypeEnum
from app.modules.products.models import Order, OrderItem, OrderStatusEnum

ZERO = Decimal("0.00")


@dataclass(frozen=True)
class FinancialTotals:
    """Totaux de trésorerie sur une période."""

    total_income: Decimal
    total_expense: Decimal
    net_balance: Decimal
    transactions_count: int


@dataclass(frozen=True)
class SalesMetrics:
    """Volume d'activité commerciale sur une période."""

    total_orders: int
    delivered_orders: int
    pending_orders: int
    items_sold: int
    orders_total: Decimal
    average_order_value: Decimal


def _apply_window(query, column, start: datetime | None, end: datetime | None):
    """Applique la fenêtre `[start, end)` à une requête."""
    if start is not None:
        query = query.filter(column >= start)
    if end is not None:
        query = query.filter(column < end)
    return query


def financial_totals(
    db: Session,
    tenant_id: uuid.UUID,
    start: datetime | None = None,
    end: datetime | None = None,
    type_filter: str | None = None,
    category_filter: str | None = None,
) -> FinancialTotals:
    """
    Entrées, dépenses et solde net sur la période.

    `type_filter` / `category_filter` servent aux écrans qui affichent une
    liste filtrée (Finance) : le résumé reflète alors exactement les lignes
    affichées. Le Tableau de bord, lui, ne filtre jamais par type.
    """
    query = db.query(
        FinancialTransaction.type,
        func.coalesce(func.sum(FinancialTransaction.amount), 0).label("amount"),
        func.count(FinancialTransaction.id).label("count"),
    ).filter(FinancialTransaction.tenant_id == tenant_id)

    if type_filter:
        query = query.filter(FinancialTransaction.type == type_filter)
    if category_filter:
        query = query.filter(FinancialTransaction.category == category_filter)

    query = _apply_window(query, FinancialTransaction.created_at, start, end)

    income = ZERO
    expense = ZERO
    count = 0

    for row_type, amount, row_count in query.group_by(FinancialTransaction.type).all():
        value = Decimal(str(amount or 0))
        count += int(row_count or 0)
        # `row_type` est un enum côté SQLAlchemy, une chaîne côté SQLite/tests.
        is_income = row_type == TransactionTypeEnum.income or row_type == "income"
        if is_income:
            income += value
        else:
            expense += value

    return FinancialTotals(
        total_income=income,
        total_expense=expense,
        net_balance=income - expense,
        transactions_count=count,
    )


def sales_metrics(
    db: Session,
    tenant_id: uuid.UUID,
    start: datetime | None = None,
    end: datetime | None = None,
) -> SalesMetrics:
    """
    Volume de commandes et de produits vendus sur la période.

    Les commandes annulées et supprimées sont exclues de tous les totaux :
    une vente annulée n'est ni une vente, ni un produit sorti du stock.
    """
    base = db.query(Order).filter(
        Order.tenant_id == tenant_id,
        Order.deleted_at.is_(None),
    )
    base = _apply_window(base, Order.created_at, start, end)

    active = base.filter(Order.status != OrderStatusEnum.cancelled)

    total_orders = active.count()
    delivered_orders = base.filter(Order.status == OrderStatusEnum.delivered).count()
    pending_orders = base.filter(Order.status == OrderStatusEnum.pending).count()

    orders_total = Decimal(
        str(
            active.with_entities(func.coalesce(func.sum(Order.total), 0)).scalar() or 0
        )
    )

    items_query = (
        db.query(func.coalesce(func.sum(OrderItem.quantity), 0))
        .join(Order, Order.id == OrderItem.order_id)
        .filter(
            Order.tenant_id == tenant_id,
            Order.deleted_at.is_(None),
            Order.status != OrderStatusEnum.cancelled,
        )
    )
    items_query = _apply_window(items_query, Order.created_at, start, end)
    items_sold = int(items_query.scalar() or 0)

    average = (orders_total / total_orders) if total_orders else ZERO

    return SalesMetrics(
        total_orders=total_orders,
        delivered_orders=delivered_orders,
        pending_orders=pending_orders,
        items_sold=items_sold,
        orders_total=orders_total,
        average_order_value=average,
    )


def format_change(current: Decimal | float | int, previous: Decimal | float | int) -> str:
    """
    Variation en pourcentage entre deux périodes, prête à l'affichage.

    Une progression depuis zéro n'a pas de pourcentage défini : on affiche
    « +100 % » plutôt qu'une division par zéro, et « 0 % » si rien n'a bougé.
    """
    current_f = float(current or 0)
    previous_f = float(previous or 0)

    if previous_f == 0:
        if current_f == 0:
            return "0.0%"
        return "+100.0%"

    pct = ((current_f - previous_f) / abs(previous_f)) * 100
    sign = "+" if pct >= 0 else ""
    return f"{sign}{pct:.1f}%"
