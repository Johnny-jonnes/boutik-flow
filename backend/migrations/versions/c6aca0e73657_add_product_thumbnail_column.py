"""add product thumbnail column

Revision ID: c6aca0e73657
Revises: a546853c47ae
Create Date: 2026-07-31 02:59:01.887949

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c6aca0e73657'
down_revision: Union[str, None] = 'a546853c47ae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("products", sa.Column("thumbnail", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "thumbnail")
