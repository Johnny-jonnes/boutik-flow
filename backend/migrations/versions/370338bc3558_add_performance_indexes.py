"""add_performance_indexes

Revision ID: 370338bc3558
Revises: d72c6bbf13d3
Create Date: 2026-07-30 22:30:00.000000

Purement additif — aucune donnée touchée. Chaque table multi-tenant n'avait
qu'un index nu sur tenant_id ; les requêtes réelles filtrent en plus par
deleted_at IS NULL et trient par created_at (ou filtrent par une plage de
dates), ce qui forçait un tri/scan supplémentaire à chaque appel. order_items
n'avait STRICTEMENT AUCUN index au-delà de sa clé primaire, alors qu'il est
joint sur order_id et product_id à chaque commande listée ou détaillée.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '370338bc3558'
down_revision: Union[str, None] = 'd72c6bbf13d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # order_items : aucun index existant hors PK, alors que product_id et
    # order_id sont les colonnes de jointure utilisées à chaque commande.
    op.create_index('ix_order_items_order_id', 'order_items', ['order_id'])
    op.create_index('ix_order_items_product_id', 'order_items', ['product_id'])

    # orders : filtré par client_id (historique client) et status (filtres
    # de liste), jamais indexés jusqu'ici ; index composite couvrant le motif
    # réel de list_orders (tenant + non-supprimé, trié par date).
    op.create_index('ix_orders_client_id', 'orders', ['client_id'])
    op.create_index('ix_orders_status', 'orders', ['status'])
    op.create_index(
        'ix_orders_tenant_created',
        'orders', ['tenant_id', 'created_at'],
        postgresql_where=sa.text('deleted_at IS NULL'),
    )

    # products : filtré par catégorie (jamais indexé) ; composite couvrant
    # le motif de list_products (tenant + non-supprimé, trié par date).
    op.create_index('ix_products_category_id', 'products', ['category_id'])
    op.create_index(
        'ix_products_tenant_created',
        'products', ['tenant_id', 'created_at'],
        postgresql_where=sa.text('deleted_at IS NULL'),
    )

    # clients : filtré par statut (compteurs KPI actifs/VIP) ; composite
    # couvrant le motif de list_clients.
    op.create_index('ix_clients_status', 'clients', ['status'])
    op.create_index(
        'ix_clients_tenant_created',
        'clients', ['tenant_id', 'created_at'],
        postgresql_where=sa.text('deleted_at IS NULL'),
    )

    # financial_transactions : chemin le plus chaud (Dashboard, Finance,
    # Analytics filtrent TOUS par tenant + plage de dates) ; reference est
    # utilisé pour retrouver la transaction d'une commande précise à
    # l'annulation/réactivation (recherche ponctuelle, jamais indexée).
    op.create_index(
        'ix_financial_transactions_tenant_created',
        'financial_transactions', ['tenant_id', 'created_at'],
    )
    op.create_index('ix_financial_transactions_reference', 'financial_transactions', ['reference'])

    # inventory_logs : jointure par produit (fiche produit / traçabilité),
    # jamais indexée.
    op.create_index('ix_inventory_logs_product_id', 'inventory_logs', ['product_id'])


def downgrade() -> None:
    op.drop_index('ix_inventory_logs_product_id', table_name='inventory_logs')
    op.drop_index('ix_financial_transactions_reference', table_name='financial_transactions')
    op.drop_index('ix_financial_transactions_tenant_created', table_name='financial_transactions')
    op.drop_index('ix_clients_tenant_created', table_name='clients')
    op.drop_index('ix_clients_status', table_name='clients')
    op.drop_index('ix_products_tenant_created', table_name='products')
    op.drop_index('ix_products_category_id', table_name='products')
    op.drop_index('ix_orders_tenant_created', table_name='orders')
    op.drop_index('ix_orders_status', table_name='orders')
    op.drop_index('ix_orders_client_id', table_name='orders')
    op.drop_index('ix_order_items_product_id', table_name='order_items')
    op.drop_index('ix_order_items_order_id', table_name='order_items')
