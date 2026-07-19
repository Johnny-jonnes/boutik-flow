"""
Router Dashboard — Indicateurs clés de la boutique
Règles appliquées :
- Multi-tenant : filtrage strict par tenant_id sur toutes les requêtes
- Soft delete : exclusion des éléments supprimés (deleted_at IS NULL)
"""
import logging
from typing import Annotated
from decimal import Decimal
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.core.database import get_db
from app.core.deps import get_current_user, CurrentUser
from app.modules.products.models import Order, OrderStatusEnum, OrderItem, Product
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


@router.get(
    "/kpis",
    response_model=DashboardKPIs,
    summary="Indicateurs clés (KPIs)",
)
def get_kpis(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> DashboardKPIs:
    """Retourne les KPIs globaux de la boutique (Tableau de bord d'accueil)."""
    
    # Total des revenus (commandes livrées ou confirmées, selon les règles métier,
    # on exclut les commandes annulées)
    revenue_query = db.query(func.sum(Order.total)).filter(
        and_(
            Order.tenant_id == current_user.tenant_id,
            Order.status != OrderStatusEnum.cancelled,
            Order.deleted_at.is_(None)
        )
    ).scalar()
    total_revenue = revenue_query or Decimal("0.00")

    # Nombre total de commandes (non annulées)
    total_orders = db.query(Order).filter(
        and_(
            Order.tenant_id == current_user.tenant_id,
            Order.status != OrderStatusEnum.cancelled,
            Order.deleted_at.is_(None)
        )
    ).count()

    # Commandes en attente
    pending_orders = db.query(Order).filter(
        and_(
            Order.tenant_id == current_user.tenant_id,
            Order.status == OrderStatusEnum.pending,
            Order.deleted_at.is_(None)
        )
    ).count()

    # Base query for clients
    base_client_query = db.query(Client).filter(
        and_(
            Client.tenant_id == current_user.tenant_id,
            Client.deleted_at.is_(None)
        )
    )

    total_clients = base_client_query.count()
    active_clients = base_client_query.filter(Client.status == ClientStatusEnum.actif).count()
    vip_clients = base_client_query.filter(Client.status == ClientStatusEnum.vip).count()

    return DashboardKPIs(
        total_revenue=total_revenue,
        total_orders=total_orders,
        total_clients=total_clients,
        active_clients=active_clients,
        vip_clients=vip_clients,
        pending_orders=pending_orders,
    )


@router.get(
    "/analytics",
    response_model=AnalyticsData,
    summary="Indicateurs et graphiques d'analyse par période",
)
def get_analytics(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    period: str = Query("7j", regex="^(24h|7j|30j|90j)$")
) -> AnalyticsData:
    """Retourne les analyses complètes filtrées par la période demandée."""
    
    now = datetime.now(timezone.utc)
    
    # Détermination des dates de début
    if period == "24h":
        start_date = now - timedelta(hours=24)
        prev_start_date = now - timedelta(hours=48)
    elif period == "7j":
        start_date = now - timedelta(days=7)
        prev_start_date = now - timedelta(days=14)
    elif period == "30j":
        start_date = now - timedelta(days=30)
        prev_start_date = now - timedelta(days=60)
    else:  # 90j
        start_date = now - timedelta(days=90)
        prev_start_date = now - timedelta(days=180)

    # Récupération des commandes
    orders_curr = db.query(Order).filter(
        and_(
            Order.tenant_id == current_user.tenant_id,
            Order.deleted_at.is_(None),
            Order.created_at >= start_date,
            Order.created_at <= now
        )
    ).all()

    orders_prev = db.query(Order).filter(
        and_(
            Order.tenant_id == current_user.tenant_id,
            Order.deleted_at.is_(None),
            Order.created_at >= prev_start_date,
            Order.created_at < start_date
        )
    ).all()

    # Calcul des KPIs actuels
    curr_total_revenue = sum((o.total for o in orders_curr if o.status != OrderStatusEnum.cancelled), Decimal("0.00"))
    curr_total_orders = sum(1 for o in orders_curr if o.status != OrderStatusEnum.cancelled)
    curr_delivered_orders = sum(1 for o in orders_curr if o.status == OrderStatusEnum.delivered)
    curr_aov = curr_total_revenue / curr_total_orders if curr_total_orders > 0 else Decimal("0.00")
    curr_conversion = (curr_delivered_orders / curr_total_orders * 100) if curr_total_orders > 0 else 0.0

    # Calcul des KPIs précédents
    prev_total_revenue = sum((o.total for o in orders_prev if o.status != OrderStatusEnum.cancelled), Decimal("0.00"))
    prev_total_orders = sum(1 for o in orders_prev if o.status != OrderStatusEnum.cancelled)
    prev_delivered_orders = sum(1 for o in orders_prev if o.status == OrderStatusEnum.delivered)
    prev_aov = prev_total_revenue / prev_total_orders if prev_total_orders > 0 else Decimal("0.00")
    prev_conversion = (prev_delivered_orders / prev_total_orders * 100) if prev_total_orders > 0 else 0.0

    # Formatage des variations (%)
    def format_change(curr, prev):
        if prev == 0:
            return "+0.0%" if curr == 0 else "+100.0%"
        diff = float(curr - prev)
        pct = (diff / float(prev)) * 100
        sign = "+" if pct >= 0 else ""
        return f"{sign}{pct:.1f}%"

    revenue_change = format_change(curr_total_revenue, prev_total_revenue)
    orders_change = format_change(curr_total_orders, prev_total_orders)
    aov_change = format_change(curr_aov, prev_aov)
    conversion_change = format_change(curr_conversion, prev_conversion)

    # ─── Graphiques ───
    revenue_points = []
    order_points = []

    if period == "24h":
        for i in range(24):
            dt = now - timedelta(hours=i)
            name = dt.strftime("%Hh")
            hour_orders = [o for o in orders_curr if o.created_at.astimezone(dt.tzinfo).hour == dt.hour and o.created_at.astimezone(dt.tzinfo).date() == dt.date()]
            
            h_rev = sum((o.total for o in hour_orders if o.status != OrderStatusEnum.cancelled), Decimal("0.00"))
            h_orders = sum(1 for o in hour_orders if o.status != OrderStatusEnum.cancelled)
            h_deliv = sum(1 for o in hour_orders if o.status == OrderStatusEnum.delivered)
            
            revenue_points.append(RevenueChartPoint(name=name, value=h_rev))
            order_points.append(OrderChartPoint(name=name, commandes=h_orders, livrees=h_deliv))
            
    elif period == "7j":
        DAY_MAP = {"Mon": "Lun", "Tue": "Mar", "Wed": "Mer", "Thu": "Jeu", "Fri": "Ven", "Sat": "Sam", "Sun": "Dim"}
        for i in range(7):
            dt = now - timedelta(days=i)
            day_name_en = dt.strftime("%a")
            name = DAY_MAP.get(day_name_en, day_name_en)
            day_orders = [o for o in orders_curr if o.created_at.date() == dt.date()]
            
            d_rev = sum((o.total for o in day_orders if o.status != OrderStatusEnum.cancelled), Decimal("0.00"))
            d_orders = sum(1 for o in day_orders if o.status != OrderStatusEnum.cancelled)
            d_deliv = sum(1 for o in day_orders if o.status == OrderStatusEnum.delivered)
            
            revenue_points.append(RevenueChartPoint(name=name, value=d_rev))
            order_points.append(OrderChartPoint(name=name, commandes=d_orders, livrees=d_deliv))

    elif period == "30j":
        for i in range(30):
            dt = now - timedelta(days=i)
            name = dt.strftime("%d/%m")
            day_orders = [o for o in orders_curr if o.created_at.date() == dt.date()]
            
            d_rev = sum((o.total for o in day_orders if o.status != OrderStatusEnum.cancelled), Decimal("0.00"))
            d_orders = sum(1 for o in day_orders if o.status != OrderStatusEnum.cancelled)
            d_deliv = sum(1 for o in day_orders if o.status == OrderStatusEnum.delivered)
            
            revenue_points.append(RevenueChartPoint(name=name, value=d_rev))
            order_points.append(OrderChartPoint(name=name, commandes=d_orders, livrees=d_deliv))

    else:  # 90j
        # Groupement par bloc de 5 jours pour ne pas surcharger le graphique
        for i in range(18):  # 18 blocs de 5 jours = 90 jours
            block_start = start_date + timedelta(days=i*5)
            block_end = start_date + timedelta(days=(i+1)*5)
            name = block_start.strftime("%d/%m")
            block_orders = [o for o in orders_curr if o.created_at >= block_start and o.created_at < block_end]
            
            b_rev = sum((o.total for o in block_orders if o.status != OrderStatusEnum.cancelled), Decimal("0.00"))
            b_orders = sum(1 for o in block_orders if o.status != OrderStatusEnum.cancelled)
            b_deliv = sum(1 for o in block_orders if o.status == OrderStatusEnum.delivered)
            
            revenue_points.append(RevenueChartPoint(name=name, value=b_rev))
            order_points.append(OrderChartPoint(name=name, commandes=b_orders, livrees=b_deliv))

    if period != "90j":
        revenue_points.reverse()
        order_points.reverse()

    # ─── Top 5 Produits ───
    top_products_query = db.query(
        Product.name,
        func.sum(OrderItem.quantity).label("ventes"),
        func.sum(OrderItem.quantity * OrderItem.unit_price).label("revenue")
    ).join(
        OrderItem, Product.id == OrderItem.product_id
    ).join(
        Order, Order.id == OrderItem.order_id
    ).filter(
        and_(
            Order.tenant_id == current_user.tenant_id,
            Order.deleted_at.is_(None),
            Order.created_at >= start_date,
            Order.status != OrderStatusEnum.cancelled
        )
    ).group_by(
        Product.name
    ).order_by(
        func.sum(OrderItem.quantity).desc()
    ).limit(5).all()

    top_products = [
        TopProductPoint(name=item[0], ventes=int(item[1]), revenue=item[2] or Decimal("0.00"))
        for item in top_products_query
    ]

    # Si pas de ventes, on met des produits de démo vides ou liste vide
    # (la liste vide est préférable pour être conforme à la réalité)

    # ─── Répartition Clients ───
    clients = db.query(Client).filter(
        and_(
            Client.tenant_id == current_user.tenant_id,
            Client.deleted_at.is_(None)
        )
    ).all()
    
    total_c = len(clients)
    vip_c = sum(1 for c in clients if c.status == ClientStatusEnum.vip)
    actif_c = sum(1 for c in clients if c.status == ClientStatusEnum.actif)
    nouveau_c = sum(1 for c in clients if c.status == ClientStatusEnum.nouveau)
    inact_c = sum(1 for c in clients if c.status == ClientStatusEnum.inact) if hasattr(ClientStatusEnum, 'inact') else sum(1 for c in clients if c.status == ClientStatusEnum.inactif)

    def get_pct(cnt, tot):
        return round((cnt / tot * 100), 1) if tot > 0 else 0.0

    client_segments = [
        ClientSegmentPoint(name="VIP", value=get_pct(vip_c, total_c), color="#10b981"),
        ClientSegmentPoint(name="Actifs", value=get_pct(actif_c, total_c), color="#3b82f6"),
        ClientSegmentPoint(name="Nouveaux", value=get_pct(nouveau_c, total_c), color="#8b5cf6"),
        ClientSegmentPoint(name="Inactifs", value=get_pct(inact_c, total_c), color="#6b7280"),
    ]

    kpis = AnalyticsKPIs(
        total_revenue=curr_total_revenue,
        total_orders=curr_total_orders,
        average_order_value=curr_aov,
        conversion_rate=curr_conversion,
        revenue_change=revenue_change,
        orders_change=orders_change,
        aov_change=aov_change,
        conversion_change=conversion_change,
    )

    return AnalyticsData(
        kpis=kpis,
        revenue_data=revenue_points,
        orders_data=order_points,
        top_products=top_products,
        client_segments=client_segments,
    )

