"""extend roleenum with manager cashier stock_manager

Revision ID: 62c2decdbf92
Revises: c6aca0e73657
Create Date: 2026-07-31 20:27:54.387416

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '62c2decdbf92'
down_revision: Union[str, None] = 'c6aca0e73657'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE ne peut pas s'exécuter dans la même
    # transaction qu'une autre commande DDL/DML sur ce type (contrainte
    # Postgres) — autocommit_block() sort chaque ALTER de la transaction
    # englobante d'Alembic le temps de son exécution.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE roleenum ADD VALUE IF NOT EXISTS 'manager'")
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE roleenum ADD VALUE IF NOT EXISTS 'cashier'")
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE roleenum ADD VALUE IF NOT EXISTS 'stock_manager'")


def downgrade() -> None:
    # Postgres ne permet pas de retirer une valeur d'enum sans reconstruire
    # entierement le type (creer un nouveau type, migrer chaque colonne qui
    # l'utilise, supprimer l'ancien) - risque et sans reel benefice ici :
    # ajouter des valeurs d'enum est sans danger a laisser en place meme en
    # cas de rollback d'une migration ulterieure.
    pass
