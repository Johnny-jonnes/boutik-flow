"""add_idempotency_keys_table

Revision ID: a26eb1f7534e
Revises: d13364bb4305
Create Date: 2026-07-28 13:15:56.217549

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a26eb1f7534e'
down_revision: Union[str, None] = 'd13364bb4305'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'idempotency_keys',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('endpoint', sa.String(length=100), nullable=False),
        sa.Column('key', sa.String(length=200), nullable=False),
        sa.Column('status_code', sa.String(length=10), nullable=False),
        sa.Column('response_body', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'endpoint', 'key', name='uq_idempotency_tenant_endpoint_key'),
    )
    op.create_index(op.f('ix_idempotency_keys_tenant_id'), 'idempotency_keys', ['tenant_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_idempotency_keys_tenant_id'), table_name='idempotency_keys')
    op.drop_table('idempotency_keys')
