"""add_created_by_to_order

Revision ID: d72c6bbf13d3
Revises: a26eb1f7534e
Create Date: 2026-07-29 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd72c6bbf13d3'
down_revision: Union[str, None] = 'a26eb1f7534e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('orders', sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True))


def downgrade() -> None:
    op.drop_column('orders', 'created_by')
