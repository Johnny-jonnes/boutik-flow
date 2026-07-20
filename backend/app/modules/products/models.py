"""
Modèles de base de données — Produits + Commandes + WhatsApp + IA
"""
import uuid
import enum
from sqlalchemy import Column, String, Text, Numeric, Integer, Enum, ForeignKey, DateTime, Boolean, func, JSON
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship

from app.core.database import Base


# ─── Produits ───────────────────────────────────────────────────────────────

class Category(Base):
    """Catégorie de produit."""
    __tablename__ = "categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    image_url = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    products = relationship("Product", back_populates="category_rel", lazy="dynamic")


class Product(Base):
    """Produit du catalogue d'une boutique."""
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Numeric(15, 2), nullable=False)
    stock = Column(Integer, default=0, nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)
    images = Column(ARRAY(String), default=[], nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    sku = Column(String(100), nullable=True, index=True)
    barcode = Column(String(100), nullable=True, index=True)

    # Relations
    inventory_logs = relationship("InventoryLog", back_populates="product", lazy="dynamic")
    order_items = relationship("OrderItem", back_populates="product", lazy="dynamic")
    category_rel = relationship("Category", back_populates="products")


class InventoryLog(Base):
    """
    Historique des modifications de stock/prix.
    Toute modification doit être tracée.
    """
    __tablename__ = "inventory_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    change_type = Column(String(50), nullable=False)  # price_change, stock_change, availability_change
    old_value = Column(String(255), nullable=True)
    new_value = Column(String(255), nullable=True)
    changed_by = Column(UUID(as_uuid=True), nullable=True)  # user_id
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    product = relationship("Product", back_populates="inventory_logs")


# ─── Commandes ──────────────────────────────────────────────────────────────

class OrderStatusEnum(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    delivered = "delivered"
    cancelled = "cancelled"


class Order(Base):
    """Commande d'un client. Toutes modifications tracées dans order_logs."""
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    status = Column(Enum(OrderStatusEnum), default=OrderStatusEnum.pending, nullable=False)
    total = Column(Numeric(15, 2), nullable=False, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    client = relationship("Client", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", lazy="joined")
    logs = relationship("OrderLog", back_populates="order", lazy="dynamic")


class OrderItem(Base):
    """Ligne d'une commande."""
    __tablename__ = "order_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Numeric(15, 2), nullable=False)  # Prix au moment de la commande

    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")


class OrderLog(Base):
    """Journal de toutes les modifications de statut d'une commande."""
    __tablename__ = "order_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    old_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=False)
    changed_by = Column(UUID(as_uuid=True), nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    order = relationship("Order", back_populates="logs")


# ─── WhatsApp ───────────────────────────────────────────────────────────────

class MessageDirectionEnum(str, enum.Enum):
    inbound = "inbound"
    outbound = "outbound"


class WhatsAppMessage(Base):
    """Messages WhatsApp échangés avec les clients."""
    __tablename__ = "whatsapp_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True)
    direction = Column(Enum(MessageDirectionEnum), nullable=False)
    content = Column(Text, nullable=False)
    message_type = Column(String(50), default="text")  # text, image, audio, template
    whatsapp_message_id = Column(String(255), nullable=True, index=True)
    status = Column(String(50), default="sent")  # sent, delivered, read, failed
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    client = relationship("Client", back_populates="whatsapp_messages")


# ─── Logs IA ────────────────────────────────────────────────────────────────

class AILog(Base):
    """Journal des appels IA Groq (coût + monitoring)."""
    __tablename__ = "ai_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    prompt_type = Column(String(100), nullable=False)  # reply_suggestion, summary, marketing_message...
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    response_cached = Column(Boolean, default=False)
    latency_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# ─── Abonnements ────────────────────────────────────────────────────────────

class SubscriptionStatusEnum(str, enum.Enum):
    active = "active"
    expired = "expired"
    cancelled = "cancelled"
    pending = "pending"


class Subscription(Base):
    """Abonnement d'une boutique."""
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    plan = Column(String(50), nullable=False)
    status = Column(Enum(SubscriptionStatusEnum), default=SubscriptionStatusEnum.pending, nullable=False)
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    # Paiement Orange Money
    orange_money_tx_id = Column(String(255), nullable=True)
    amount = Column(Numeric(15, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
