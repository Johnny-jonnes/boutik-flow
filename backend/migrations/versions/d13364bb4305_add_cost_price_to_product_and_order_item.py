"""add_cost_price_to_product_and_order_item

Revision ID: d13364bb4305
Revises: 4a821fd7401b
Create Date: 2026-07-25 22:49:34.653931

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd13364bb4305'
down_revision: Union[str, None] = '4a821fd7401b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Prix d'achat facultatif : sert au calcul de la marge réelle quand il
    # est renseigné, jamais estimé sinon (voir app.core.metrics.product_margin).
    op.add_column('products', sa.Column('cost_price', sa.Numeric(15, 2), nullable=True))
    # Copié depuis products.cost_price au moment de chaque vente, pour que
    # la marge d'une commande passée ne change pas si le prix d'achat du
    # produit est modifié plus tard.
    op.add_column('order_items', sa.Column('cost_price', sa.Numeric(15, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('order_items', 'cost_price')
    op.drop_column('products', 'cost_price')
