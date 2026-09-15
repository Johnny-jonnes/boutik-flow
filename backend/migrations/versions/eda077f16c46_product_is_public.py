"""product is_public flag for storefront

Revision ID: eda077f16c46
Revises: 2027fabd500c
Create Date: 2026-09-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'eda077f16c46'
down_revision: Union[str, None] = '2027fabd500c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Opt-in explicite : par défaut False, donc AUCUN produit existant ne
    # devient visible sur une vitrine publique par accident lors du
    # déploiement de cette colonne — voir BOUTIKFLOW_AUDIT_2.0.md.
    op.add_column(
        'products',
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column('products', 'is_public')
