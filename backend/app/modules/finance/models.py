"""
Modèle de base de données — Finance & Mouvements de Trésorerie
Gère toutes les entrées et sorties d'argent (ventes, achats fournisseurs, loyer, salaires, charges).
"""
import uuid
import enum
from sqlalchemy import Column, String, Numeric, Enum, ForeignKey, DateTime, Text, func
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class TransactionTypeEnum(str, enum.Enum):
    income = "income"     # Entrée d'argent (Vente, Apport, Autre revenu)
    expense = "expense"   # Sortie d'argent (Achat fournisseur, Salaire, Loyer, Charges, Remboursement)


class TransactionCategoryEnum(str, enum.Enum):
    sale = "sale"                 # Vente magasin / POS
    supplier_purchase = "supplier_purchase"  # Achat fournisseur
    salary = "salary"             # Salaire personnel / équipe
    rent = "rent"                 # Loyer boutique
    utilities = "utilities"       # Électricité / Eau / Internet
    refund = "refund"             # Remboursement client (retour)
    other_income = "other_income" # Autre revenu
    other_expense = "other_expense" # Autre dépense / charge


class FinancialTransaction(Base):
    """
    Transaction financière (Entrée ou Dépense).
    """
    __tablename__ = "financial_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    type = Column(Enum(TransactionTypeEnum), nullable=False)
    category = Column(Enum(TransactionCategoryEnum), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    description = Column(String(500), nullable=False)
    payment_method = Column(String(50), default="cash", nullable=False)  # cash, orange_money, card, transfer
    reference = Column(String(255), nullable=True)  # ex: N° commande, Facture fournisseur
    user_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
