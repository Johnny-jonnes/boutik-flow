"""tenant practical info about hours delivery payment

Revision ID: 3feabd3daafe
Revises: 6eef74ea710c
Create Date: 2026-09-16 00:46:46.070625

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3feabd3daafe'
down_revision: Union[str, None] = '6eef74ea710c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tenants', sa.Column('about', sa.Text(), nullable=True))
    op.add_column('tenants', sa.Column('opening_hours', sa.String(length=200), nullable=True))
    op.add_column('tenants', sa.Column('delivery_info', sa.String(length=300), nullable=True))
    op.add_column(
        'tenants',
        sa.Column('payment_methods', sa.ARRAY(sa.String()), nullable=False, server_default='{}'),
    )


def downgrade() -> None:
    op.drop_column('tenants', 'payment_methods')
    op.drop_column('tenants', 'delivery_info')
    op.drop_column('tenants', 'opening_hours')
    op.drop_column('tenants', 'about')
