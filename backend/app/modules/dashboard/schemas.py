"""
Schémas Pydantic v2 — Module Dashboard
"""
from pydantic import BaseModel
from decimal import Decimal


class DashboardKPIs(BaseModel):
    """Indicateurs clés de performance de la boutique."""
    total_revenue: Decimal
    total_orders: int
    total_clients: int
    active_clients: int
    vip_clients: int
    pending_orders: int


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
    total_revenue: Decimal
    total_orders: int
    average_order_value: Decimal
    conversion_rate: float
    revenue_change: str
    orders_change: str
    aov_change: str
    conversion_change: str


class AnalyticsData(BaseModel):
    kpis: AnalyticsKPIs
    revenue_data: list[RevenueChartPoint]
    orders_data: list[OrderChartPoint]
    top_products: list[TopProductPoint]
    client_segments: list[ClientSegmentPoint]

