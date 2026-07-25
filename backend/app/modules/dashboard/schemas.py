"""
Schémas Pydantic v2 — Module Dashboard
"""
from datetime import datetime
from pydantic import BaseModel
from decimal import Decimal


class DashboardKPIs(BaseModel):
    """
    Indicateurs clés de performance de la boutique sur la période demandée.

    `total_revenue`, `total_expenses` et `net_balance` proviennent du même
    calcul que le module Finance (`app.core.metrics.financial_totals`) :
    les deux écrans affichent donc toujours les mêmes montants.
    """
    total_revenue: Decimal
    total_orders: int
    total_clients: int
    active_clients: int
    vip_clients: int
    pending_orders: int
    total_expenses: Decimal = Decimal("0.00")
    net_balance: Decimal = Decimal("0.00")
    # Nombre d'articles effectivement vendus sur la période.
    items_sold: int = 0
    # Clients créés pendant la période (les autres compteurs clients sont des
    # totaux cumulés : ils décrivent le fichier client, pas l'activité).
    new_clients: int = 0
    # Bornes réellement appliquées, pour que le frontend puisse les afficher
    # et vérifier qu'il regarde bien la période qu'il a demandée.
    period_start: datetime | None = None
    period_end: datetime | None = None


class RevenueChartPoint(BaseModel):
    name: str
    value: Decimal


class OrderChartPoint(BaseModel):
    name: str
    commandes: int
    livrees: int


class TopProductPoint(BaseModel):
    name: str
    ventes: int
    revenue: Decimal


class ClientSegmentPoint(BaseModel):
    name: str
    value: float
    color: str


class AnalyticsKPIs(BaseModel):
    """
    Mêmes montants que `DashboardKPIs` et que le module Finance : ces trois
    écrans partagent le calcul défini dans `app.core.metrics`.
    """
    total_revenue: Decimal
    total_orders: int
    average_order_value: Decimal
    conversion_rate: float
    revenue_change: str
    orders_change: str
    aov_change: str
    conversion_change: str
    total_expenses: Decimal = Decimal("0.00")
    net_balance: Decimal = Decimal("0.00")
    items_sold: int = 0


class AnalyticsData(BaseModel):
    kpis: AnalyticsKPIs
    revenue_data: list[RevenueChartPoint]
    orders_data: list[OrderChartPoint]
    top_products: list[TopProductPoint]
    client_segments: list[ClientSegmentPoint]
    # Bornes réellement appliquées (identiques à celles de /dashboard/kpis
    # et de /finance pour une même sélection).
    period_start: datetime | None = None
    period_end: datetime | None = None

