"""unique counter client (Passant) per tenant

Revision ID: 2027fabd500c
Revises: f635e58b6c3c
Create Date: 2026-09-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '2027fabd500c'
down_revision: Union[str, None] = 'f635e58b6c3c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Index unique PARTIEL : ne contraint QUE le numéro magique utilisé par
    # le client comptoir auto-créé pour les ventes anonymes (voir
    # orders/router.py::create_order) — n'affecte jamais le numéro d'un
    # vrai client. Sans lui, plusieurs ventes "passant" concurrentes sur
    # une boutique qui n'en a encore jamais eu créaient chacune leur propre
    # client "Passant" (find-or-create sans protection), fragmentant
    # l'historique des ventes anonymes en plusieurs fiches identiques.
    # Vérifié avant cette migration : aucun doublon existant en production.
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_counter_client_per_tenant
        ON clients (tenant_id)
        WHERE phone = '+22400000000' AND deleted_at IS NULL
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_clients_counter_client_per_tenant")
