"""add_last_login_at

Revision ID: b2d4f8a91c67
Revises: 7e91c2a4f1d3
Create Date: 2026-08-22 00:00:00.000000

Purement additif — colonne nullable, aucune donnée existante touchée.
Base du module de monitoring Super Admin : renseignée à chaque connexion
réussie (voir POST /auth/login), NULL pour tout compte jamais reconnecté
depuis cet ajout.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2d4f8a91c67'
down_revision: Union[str, None] = '7e91c2a4f1d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True))
    # Filtre courant du module de monitoring admin (boutiques par
    # dernière activité récente) — sans index, un tri/filtre sur cette
    # colonne scanne toute la table users à chaque appel.
    op.create_index('ix_users_last_login_at', 'users', ['last_login_at'])


def downgrade() -> None:
    op.drop_index('ix_users_last_login_at', table_name='users')
    op.drop_column('users', 'last_login_at')
