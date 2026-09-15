"""tenant public whatsapp contact

Revision ID: 6eef74ea710c
Revises: be187413fa55
Create Date: 2026-09-15 18:29:09.174578

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6eef74ea710c'
down_revision: Union[str, None] = 'be187413fa55'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tenants', sa.Column('public_whatsapp', sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column('tenants', 'public_whatsapp')
