"""tenant branding fields

Revision ID: be187413fa55
Revises: eda077f16c46
Create Date: 2026-09-15 18:26:36.220201

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'be187413fa55'
down_revision: Union[str, None] = 'eda077f16c46'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tenants', sa.Column('logo', sa.Text(), nullable=True))
    op.add_column('tenants', sa.Column('description', sa.String(length=300), nullable=True))
    op.add_column('tenants', sa.Column('theme_color', sa.String(length=7), nullable=True))


def downgrade() -> None:
    op.drop_column('tenants', 'theme_color')
    op.drop_column('tenants', 'description')
    op.drop_column('tenants', 'logo')
