"""scalability_indexes

Revision ID: 7e91c2a4f1d3
Revises: 36a19fc2d7e4
Create Date: 2026-08-08 00:00:00.000000

Purement additif — aucune donnée touchée. Audit de montée en charge :
colonnes filtrées/jointes fréquemment qui n'avaient encore aucun index,
identifiées en comparant les migrations existantes (370338bc3558 posait
déjà ce même type d'index pour orders/products/clients/financial_
transactions/inventory_logs) aux requêtes réellement écrites dans les
routers pour les tables restées sans cet index : client_debts, orders
(vendeur), admin_notifications, audit_logs, suppliers, clients (tags).

Ce fichier ne fait QUE créer des index — aucune table, colonne, contrainte
ou donnée n'est modifiée ; downgrade() est le miroir exact de upgrade().
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '7e91c2a4f1d3'
down_revision: Union[str, None] = '36a19fc2d7e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # client_debts : order_id résolu à chaque retour de vente à crédit
    # (return_order_items cherche la dette liée à la commande) ; status
    # filtré par le module Dettes Clients (page /dettes) et par les
    # compteurs de dashboard — composite avec tenant_id, seul motif réel.
    op.create_index('ix_client_debts_order_id', 'client_debts', ['order_id'])
    op.create_index('ix_client_debts_tenant_status', 'client_debts', ['tenant_id', 'status'])
    op.create_index('ix_client_debts_tenant_created', 'client_debts', ['tenant_id', 'created_at'])

    # orders.created_by : filtre "vendeur" de list_orders (page Ventes) et
    # de list_debts (filtre seller_id, sous-requête sur orders.created_by).
    op.create_index('ix_orders_created_by', 'orders', ['created_by'])

    # admin_notifications : jamais indexée. Filtrée par is_read (compteur
    # non-lues + filtre unread_only) et triée par created_at à chaque appel
    # du panneau admin — pas de filtre tenant_id ici (notifications
    # plateforme, volontairement cross-tenant, voir admin/router.py).
    op.create_index('ix_admin_notifications_is_read_created', 'admin_notifications', ['is_read', 'created_at'])

    # audit_logs : tenant_id déjà indexé seul, mais jamais combiné à
    # created_at (tri systématique) ni à action (filtre le plus courant
    # de la page Audit) — deux composites couvrant les deux motifs réels.
    op.create_index('ix_audit_logs_tenant_created', 'audit_logs', ['tenant_id', 'created_at'])
    op.create_index('ix_audit_logs_tenant_action', 'audit_logs', ['tenant_id', 'action'])

    # suppliers : tenant_id déjà indexé seul ; list_suppliers trie
    # systématiquement par name — composite couvrant tri + isolation tenant.
    # La recherche ilike('%...%') reste un scan (nécessiterait pg_trgm,
    # hors scope pragmatique pour une table par tenant de taille modeste —
    # voir feuille de route).
    op.create_index('ix_suppliers_tenant_name', 'suppliers', ['tenant_id', 'name'])

    # clients.tags (ARRAY) : _count_segment_members (crm/router.py) fait
    # Client.tags.any(tag) par tag de segment — sans index GIN, chaque
    # comptage de segment scanne tous les clients du tenant.
    op.create_index(
        'ix_clients_tags_gin', 'clients', ['tags'],
        postgresql_using='gin',
    )


def downgrade() -> None:
    op.drop_index('ix_clients_tags_gin', table_name='clients')
    op.drop_index('ix_suppliers_tenant_name', table_name='suppliers')
    op.drop_index('ix_audit_logs_tenant_action', table_name='audit_logs')
    op.drop_index('ix_audit_logs_tenant_created', table_name='audit_logs')
    op.drop_index('ix_admin_notifications_is_read_created', table_name='admin_notifications')
    op.drop_index('ix_orders_created_by', table_name='orders')
    op.drop_index('ix_client_debts_tenant_created', table_name='client_debts')
    op.drop_index('ix_client_debts_tenant_status', table_name='client_debts')
    op.drop_index('ix_client_debts_order_id', table_name='client_debts')
