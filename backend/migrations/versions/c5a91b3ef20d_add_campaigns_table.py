"""add campaigns table

Revision ID: c5a91b3ef20d
Revises: 13a14ee8148b
Create Date: 2026-07-10 17:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c5a91b3ef20d'
down_revision = '13a14ee8148b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'campaigns',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('segment_id', sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey('segments.id'), nullable=True),
        sa.Column('channel', sa.Enum('whatsapp', 'sms', 'email', name='campaignchannelenum'), nullable=False, server_default='whatsapp'),
        sa.Column('message', sa.Text, nullable=False),
        sa.Column('status', sa.Enum('brouillon', 'programmee', 'envoyee', 'echouee', name='campaignstatusenum'), nullable=False, server_default='brouillon'),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )
    # Enable RLS
    op.execute("ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_table('campaigns')
    op.execute("DROP TYPE IF EXISTS campaignchannelenum")
    op.execute("DROP TYPE IF EXISTS campaignstatusenum")
