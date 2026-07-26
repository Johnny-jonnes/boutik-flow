"""
Router Dashboard — Indicateurs clés de la boutique

Règles appliquées :
- Multi-tenant : filtrage strict par tenant_id sur toutes les requêtes
- Soft delete : exclusion des éléments supprimés (deleted_at IS NULL)
- Filtrage par date : délégué à `app.core.period.resolve_period()`
- Calculs : délégués à `app.core.metrics`, partagés avec le module Finance.
  Le Tableau de bord ne calcule plus aucun montant lui-même : c'est ce qui
  garantit qu'il affiche exactement les mêmes chiffres que Finance pour une
  même période.
"""
import logging
from typing import Annotated
from decimal import Decimal
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.core.database import get_db
from app.core.deps import get_current_user, CurrentUser
from app.core.period import resolve_period, previous_period
from app.core.metrics import financial_totals, sales_metrics, product_margin, format_change
from app.modules.products.models import Order, OrderStatusEnum, OrderItem, Product
from app.modules.finance.models import FinancialTransaction, TransactionTypeEnum
from app.modules.crm.models import Client, ClientStatusEnum
from app.modules.dashboard.schemas import (
    DashboardKPIs,
    AnalyticsData,
    AnalyticsKPIs,
    RevenueChartPoint,
    OrderChartPoint,
    TopProductPoint,
    ClientSegmentPoint,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

# Libellés de période acceptés. "custom" est toléré car le frontend l'envoie
# en même temps que start_date/end_date ; les dates explicites priment.
PERIOD_QUERY = Query("30j", pattern="^(24h|7j|30j|90j|all|custom)$")

DAY_MAP = {
    "Mon": "Lun", "Tue": "Mar", "Wed": "Mer", "Thu": "Jeu",
    "Fri": "Ven", "Sat": "Sam", "Sun": "Dim",
}


@router.get(
    "/kpis",
    response_model=DashboardKPIs,
    summary="Indicateurs clés (KPIs) sur une période",
)
def get_kpis(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    period: str = PERIOD_QUERY,
    start_date: str | None = Query(None, description="Date de début (YYYY-MM-DD)"),
    end_date: str | None = Query(None, description="Date de fin incluse (YYYY-MM-DD)"),
) -> DashboardKPIs:
    """
    KPIs de la boutique sur la période demandée.

    Montants (CA, dépenses, bénéfice) : identiques au module Finance.
    Volumes (commandes, produits vendus) : calculés sur les commandes.
    Compteurs clients : totaux cumulés du fichier client — ce sont des
    stocks, pas des flux ; `new_clients` donne l'acquisition sur la période.
    """
    start, end = resolve_period(period, start_date, end_date)
    tenant_id = current_user.tenant_id

    money = financial_totals(db, tenant_id, start, end)
    sales = sales_metrics(db, tenant_id, start, end)
    margin = product_margin(db, tenant_id, start, end)

    base_client_query = db.query(Client).filter(
        and_(
            Client.tenant_id == tenant_id,
            Client.deleted_at.is_(None),
        )
    )

    total_clients = base_client_query.count()
    active_clients = base_client_query.filter(Client.status == ClientStatusEnum.actif).count()
    vip_clients = base_client_query.filter(Client.status == ClientStatusEnum.vip).count()

    new_clients_query = base_client_query
    if start is not None:
        new_clients_query = new_clients_query.filter(Client.created_at >= start)
    if end is not None:
        new_clients_query = new_clients_query.filter(Client.created_at < end)
    new_clients = new_clients_query.count()

    return DashboardKPIs(
        total_revenue=money.total_income,
        total_expenses=money.total_expense,
        net_balance=money.net_balance,
        total_orders=sales.total_orders,
        pending_orders=sales.pending_orders,
        items_sold=sales.items_sold,
        total_clients=total_clients,
        active_clients=active_clients,
        vip_clients=vip_clients,
        new_clients=new_clients,
        product_margin=margin.gross_margin,
        product_margin_coverage=margin.coverage_pct,
        period_start=start,
        period_end=end,
    )


def _build_buckets(
    start: datetime,
    end: datetime,
) -> list[tuple[str, datetime, datetime]]:
    """
    Découpe la fenêtre en intervalles de graphique `(libellé, début, fin)`.

    La granularité s'adapte à la durée réelle de la période sélectionnée,
    de façon à rester lisible aussi bien sur 24 h que sur un an.
    """
    span = end - start
    total_hours = max(span.total_seconds() / 3600, 1)

    # ── Moins de 48 h : découpage horaire ──
    if total_hours <= 48:
        buckets = []
        cursor = start.replace(minute=0, second=0, microsecond=0)
        while cursor < end:
            nxt = cursor + timedelta(hours=1)
            buckets.append((cursor.strftime("%Hh"), cursor, nxt))
            cursor = nxt
        return buckets

    total_days = max(int(span.days), 1)

    # ── Jusqu'à 31 jours : un point par jour ──
    if total_days <= 31:
        buckets = []
        cursor = start
        while cursor < end:
            nxt = cursor + timedelta(days=1)
            if total_days <= 7:
                label = DAY_MAP.get(cursor.strftime("%a"), cursor.strftime("%a"))
            else:
                label = cursor.strftime("%d/%m")
            buckets.append((label, cursor, nxt))
            cursor = nxt
        return buckets

    # ── Au-delà : regroupement pour rester sous ~20 points ──
    group_days = max(1, -(-total_days // 18))  # division entière par excès
    buckets = []
    cursor = start
    while cursor < end:
        nxt = min(cursor + timedelta(days=group_days), end)
        buckets.append((cursor.strftime("%d/%m"), cursor, nxt))
        cursor = nxt
    return buckets


@router.get(
    "/analytics",
    response_model=AnalyticsData,
    summary="Indicateurs et graphiques d'analyse par période",
)
def get_analytics(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    period: str = PERIOD_QUERY,
    start_date: str | None = Query(None, description="Date de début (YYYY-MM-DD)"),
    end_date: str | None = Query(None, description="Date de fin incluse (YYYY-MM-DD)"),
) -> AnalyticsData:
    """
    Analyses et graphiques sur la période demandée.

    Les points du graphique de chiffre d'affaires proviennent des mêmes
    transactions que le KPI « Chiffre d'affaires » : leur somme est donc
    toujours égale au KPI affiché au-dessus du graphique.
    """
    start, end = resolve_period(period, start_date, end_date)
    tenant_id = current_user.tenant_id

    money = financial_totals(db, tenant_id, start, end)
    sales = sales_metrics(db, tenant_id, start, end)
    margin = product_margin(db, tenant_id, start, end)

    # ── Comparaison avec la période précédente de même durée ──
    prev_start, prev_end = previous_period(start, end)
    if prev_start is not None:
        prev_money = financial_totals(db, tenant_id, prev_start, prev_end)
        prev_sales = sales_metrics(db, tenant_id, prev_start, prev_end)
        prev_revenue = prev_money.total_income
        prev_orders = prev_sales.total_orders
        prev_aov = prev_sales.average_order_value
        prev_conversion = (
            (prev_sales.delivered_orders / prev_sales.total_orders * 100)
            if prev_sales.total_orders else 0.0
        )
    else:
        prev_revenue, prev_orders = Decimal("0.00"), 0
        prev_aov, prev_conversion = Decimal("0.00"), 0.0

    conversion = (
        (sales.delivered_orders / sales.total_orders * 100)
        if sales.total_orders else 0.0
    )

    # ── Points de graphique ──
    # Sans période bornée ("all"), on cadre sur l'activité réellement présente
    # pour éviter un graphique vide ou démesuré.
    chart_start, chart_end = start, end
    if chart_start is None or chart_end is None:
        bounds = db.query(
            func.min(FinancialTransaction.created_at),
            func.max(FinancialTransaction.created_at),
        ).filter(FinancialTransaction.tenant_id == tenant_id).first()
        now = datetime.now(timezone.utc)
        chart_start = chart_start or (bounds[0] if bounds and bounds[0] else now - timedelta(days=30))
        chart_end = chart_end or (bounds[1] + timedelta(seconds=1) if bounds and bounds[1] else now)
        if chart_start >= chart_end:
            chart_start = chart_end - timedelta(days=1)

    buckets = _build_buckets(chart_start, chart_end)

    # Une seule lecture des mouvements et des commandes, puis répartition en
    # mémoire : le volume par boutique et par période reste faible, et cela
    # évite autant d'allers-retours SQL que de points de graphique.
    income_rows = (
        db.query(FinancialTransaction.created_at, FinancialTransaction.amount)
        .filter(
            FinancialTransaction.tenant_id == tenant_id,
            FinancialTransaction.type == TransactionTypeEnum.income,
            FinancialTransaction.created_at >= chart_start,
            FinancialTransaction.created_at < chart_end,
        )
        .all()
    )

    order_rows = (
        db.query(Order.created_at, Order.status)
        .filter(
            Order.tenant_id == tenant_id,
            Order.deleted_at.is_(None),
            Order.created_at >= chart_start,
            Order.created_at < chart_end,
        )
        .all()
    )

    revenue_points: list[RevenueChartPoint] = []
    order_points: list[OrderChartPoint] = []

    for label, b_start, b_end in buckets:
        bucket_revenue = sum(
            (Decimal(str(amount or 0)) for created_at, amount in income_rows
             if b_start <= created_at < b_end),
            Decimal("0.00"),
        )
        bucket_orders = [s for created_at, s in order_rows if b_start <= created_at < b_end]

        revenue_points.append(RevenueChartPoint(name=label, value=bucket_revenue))
        order_points.append(
            OrderChartPoint(
                name=label,
                commandes=sum(1 for s in bucket_orders if s != OrderStatusEnum.cancelled),
                livrees=sum(1 for s in bucket_orders if s == OrderStatusEnum.delivered),
            )
        )

    # ── Top 5 produits (bornes strictement identiques aux KPI) ──
    top_query = db.query(
        Product.name,
        func.sum(OrderItem.quantity).label("ventes"),
        func.sum(OrderItem.quantity * OrderItem.unit_price).label("revenue"),
    ).join(
        OrderItem, Product.id == OrderItem.product_id
    ).join(
        Order, Order.id == OrderItem.order_id
    ).filter(
        and_(
            Order.tenant_id == tenant_id,
            Order.deleted_at.is_(None),
            Order.status != OrderStatusEnum.cancelled,
        )
    )
    if start is not None:
        top_query = top_query.filter(Order.created_at >= start)
    if end is not None:
        top_query = top_query.filter(Order.created_at < end)

    top_products = [
        TopProductPoint(name=name, ventes=int(ventes or 0), revenue=revenue or Decimal("0.00"))
        for name, ventes, revenue in (
            top_query.group_by(Product.name)
            .order_by(func.sum(OrderItem.quantity).desc())
            .limit(5)
            .all()
        )
    ]

    # ── Répartition du fichier client (état courant, non borné à la période) ──
    clients = db.query(Client.status).filter(
        and_(
            Client.tenant_id == tenant_id,
            Client.deleted_at.is_(None),
        )
    ).all()

    total_c = len(clients)
    statuses = [row[0] for row in clients]

    def pct(status) -> float:
        if not total_c:
            return 0.0
        return round(sum(1 for s in statuses if s == status) / total_c * 100, 1)

    client_segments = [
        ClientSegmentPoint(name="VIP", value=pct(ClientStatusEnum.vip), color="#10b981"),
        ClientSegmentPoint(name="Actifs", value=pct(ClientStatusEnum.actif), color="#3b82f6"),
        ClientSegmentPoint(name="Nouveaux", value=pct(ClientStatusEnum.nouveau), color="#8b5cf6"),
        ClientSegmentPoint(name="Inactifs", value=pct(ClientStatusEnum.inactif), color="#6b7280"),
    ]

    kpis = AnalyticsKPIs(
        total_revenue=money.total_income,
        total_expenses=money.total_expense,
        net_balance=money.net_balance,
        total_orders=sales.total_orders,
        items_sold=sales.items_sold,
        average_order_value=sales.average_order_value,
        conversion_rate=conversion,
        revenue_change=format_change(money.total_income, prev_revenue),
        orders_change=format_change(sales.total_orders, prev_orders),
        aov_change=format_change(sales.average_order_value, prev_aov),
        conversion_change=format_change(conversion, prev_conversion),
        product_margin=margin.gross_margin,
        product_margin_coverage=margin.coverage_pct,
    )

    return AnalyticsData(
        kpis=kpis,
        revenue_data=revenue_points,
        orders_data=order_points,
        top_products=top_products,
        client_segments=client_segments,
        period_start=start,
        period_end=end,
    )
