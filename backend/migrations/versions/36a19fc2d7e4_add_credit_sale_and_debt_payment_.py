"""add credit sale and debt payment tracking columns

Revision ID: 36a19fc2d7e4
Revises: 62c2decdbf92
Create Date: 2026-08-07 23:21:54.364402

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '36a19fc2d7e4'
down_revision: Union[str, None] = '62c2decdbf92'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # orders : additif uniquement, colonnes nullable ou par défaut inoffensif
    # — les commandes existantes ne sont jamais rétro-devinées.
    op.add_column("orders", sa.Column("payment_method", sa.String(length=50), nullable=True))
    op.add_column("orders", sa.Column("returned_amount", sa.Numeric(15, 2), nullable=False, server_default="0"))
    op.add_column("orders", sa.Column("amount_paid_now", sa.Numeric(15, 2), nullable=True))

    # debt_payments : trace d'audit (qui, solde avant/après) — nullable,
    # aucun paiement existant n'a besoin d'être rétro-rempli.
    op.add_column("debt_payments", sa.Column("paid_by", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("debt_payments", sa.Column("balance_before", sa.Numeric(12, 2), nullable=True))
    op.add_column("debt_payments", sa.Column("balance_after", sa.Numeric(12, 2), nullable=True))

    # Nouvelles catégories de transaction financière — distinguent vente à
    # crédit (partiellement encaissée) et remboursement de dette de la
    # simple vente comptant. ALTER TYPE ... ADD VALUE ne peut pas
    # s'exécuter dans la transaction Alembic englobante (contrainte
    # Postgres) — même pattern que 62c2decdbf92_extend_roleenum.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE transactioncategoryenum ADD VALUE IF NOT EXISTS 'credit_sale'")
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE transactioncategoryenum ADD VALUE IF NOT EXISTS 'debt_repayment'")


def downgrade() -> None:
    op.drop_column("debt_payments", "balance_after")
    op.drop_column("debt_payments", "balance_before")
    op.drop_column("debt_payments", "paid_by")
    op.drop_column("orders", "amount_paid_now")
    op.drop_column("orders", "returned_amount")
    op.drop_column("orders", "payment_method")
    # Retirer une valeur d'enum Postgres exige de reconstruire tout le type
    # (comme documenté dans 62c2decdbf92) — sans réel bénéfice ici, laissé
    # en place même en cas de rollback.
