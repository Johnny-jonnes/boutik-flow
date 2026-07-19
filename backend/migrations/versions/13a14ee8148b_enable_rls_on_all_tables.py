"""Enable RLS on all tables

Revision ID: 13a14ee8148b
Revises: 93a2e56fd2df
Create Date: 2026-06-23 19:43:32.553268

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '13a14ee8148b'
down_revision: Union[str, None] = '93a2e56fd2df'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    tables = [
        "alembic_version", "ai_logs", "tenants", "clients", "products", 
        "subscriptions", "users", "inventory_logs", "orders", 
        "whatsapp_messages", "order_items", "order_logs", "categories", "segments"
    ]
    for table in tables:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")


def downgrade() -> None:
    tables = [
        "alembic_version", "ai_logs", "tenants", "clients", "products", 
        "subscriptions", "users", "inventory_logs", "orders", 
        "whatsapp_messages", "order_items", "order_logs", "categories", "segments"
    ]
    for table in tables:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
