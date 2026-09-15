"""seller_stock_manager role and financial visibility masking

Revision ID: f635e58b6c3c
Revises: b2d4f8a91c67
Create Date: 2026-09-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f635e58b6c3c'
down_revision: Union[str, None] = 'b2d4f8a91c67'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE ne peut pas s'exécuter dans la même
    # transaction qu'une autre commande DDL/DML sur ce type (contrainte
    # Postgres) — même pattern que 62c2decdbf92.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE roleenum ADD VALUE IF NOT EXISTS 'seller_stock_manager'")

    # Rôles pour lesquels le propriétaire a choisi de masquer les chiffres
    # financiers (marge, prix d'achat, CA, module Finance) — vide par défaut :
    # aucun changement de comportement pour les boutiques existantes tant
    # que le propriétaire n'active rien explicitement (voir
    # PUT /auth/tenant/financial-visibility).
    op.add_column(
        'tenants',
        sa.Column(
            'hidden_financial_roles',
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default='{}',
        ),
    )


def downgrade() -> None:
    op.drop_column('tenants', 'hidden_financial_roles')
    # Retirer une valeur d'enum Postgres nécessite de reconstruire le type
    # entier — pas fait ici, même raisonnement que 62c2decdbf92 (ajouter une
    # valeur d'enum est sans danger à laisser en place même après rollback).
