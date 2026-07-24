"""
Modèle de dette client (Crédit boutique / Achat à crédit).
"""
import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Enum, ForeignKey, DateTime, Numeric, func, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class DebtStatusEnum(str, enum.Enum):
    pending = "pending"      # Solde dû en attente
    partial = "partial"      # Partiellement réglé
    paid = "paid"            # Totalement réglé


class ClientDebt(Base):
    """Dette d'un client envers la boutique."""
    __tablename__ = "client_debts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False, index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=True)  # Commande liée

    original_amount = Column(Numeric(12, 2), nullable=False)  # Montant total initial
    paid_amount = Column(Numeric(12, 2), default=0, nullable=False)  # Montant déjà payé
    remaining_amount = Column(Numeric(12, 2), nullable=False)  # Reste à payer
    
    status = Column(Enum(DebtStatusEnum), default=DebtStatusEnum.pending, nullable=False)
    description = Column(Text, nullable=True)  # Note sur la dette
    due_date = Column(DateTime(timezone=True), nullable=True)  # Date échéance optionnelle

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relations
    client = relationship("Client", backref="debts")
    payments = relationship("DebtPayment", back_populates="debt", cascade="all, delete-orphan")


class DebtPayment(Base):
    """Versement (paiement partiel ou total) sur une dette."""
    __tablename__ = "debt_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    debt_id = Column(UUID(as_uuid=True), ForeignKey("client_debts.id"), nullable=False, index=True)

    amount = Column(Numeric(12, 2), nullable=False)  # Montant du versement
    payment_method = Column(String(50), default="cash", nullable=False)
    notes = Column(Text, nullable=True)
    paid_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relations
    debt = relationship("ClientDebt", back_populates="payments")
