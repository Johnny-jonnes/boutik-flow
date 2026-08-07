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
    # Prix d'achat — facultatif (produit déjà existant, ajout rapide sans
    # cette info...). Sert au calcul de la marge réelle quand il est connu ;
    # jamais estimé quand il ne l'est pas (voir app.core.metrics.product_margin).
    cost_price = Column(Numeric(15, 2), nullable=True)
    stock = Column(Integer, default=0, nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)
    images = Column(ARRAY(String), default=[], nullable=False)
    # Miniature compressée (petit data-URI JPEG, ~5-10 Ko) dérivée de
    # images[0] côté serveur — voir app.core.thumbnails. Sert à afficher un
    # aperçu dans les listes/grilles (catalogue, POS) sans jamais y
    # transporter les images pleine résolution : un catalogue avec des
    # photos sur la plupart des produits rendait la liste tout simplement
    # injoignable (dizaines de Mo, la page ne chargeait plus du tout).
    thumbnail = Column(Text, nullable=True)
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
    # Vendeur ayant réalisé la vente (utilisateur du tenant) — pas de FK dure
    # vers users, même convention que changed_by/user_id ailleurs (log
    # d'inventaire, transactions) : un utilisateur supprimé ne doit jamais
    # faire échouer une contrainte sur l'historique des ventes.
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    # Mode de paiement structuré — NULL pour les commandes antérieures à
    # cette colonne (jamais rétro-deviné) ; le texte libre historique dans
    # `notes` (voir lib/saleNotes.ts) reste le repli de lecture pour elles.
    payment_method = Column(String(50), nullable=True)
    # Cumul remboursé sur cette commande (voir return_order_items) — jamais
    # soustrait de `total` lui-même, pour garder le reçu/l'historique
    # intacts ; sales_metrics/product_margin le déduisent au moment de
    # l'agrégation.
    returned_amount = Column(Numeric(15, 2), nullable=False, default=0, server_default="0")
    # Vente à crédit uniquement : montant réellement encaissé à la vente
    # (0 = différé total). NULL pour une vente comptant classique — le
    # total est alors considéré intégralement encaissé.
    amount_paid_now = Column(Numeric(15, 2), nullable=True)

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
    unit_price = Column(Numeric(15, 2), nullable=False)  # Prix de vente au moment de la commande
    # Prix d'achat au moment de la commande (copié depuis Product.cost_price
    # à la création de la ligne) — NULL si le produit n'en avait pas.
    # Fige la marge de cette vente même si le prix d'achat du produit change
    # ensuite : un historique de marge ne doit pas bouger rétroactivement.
    cost_price = Column(Numeric(15, 2), nullable=True)

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
