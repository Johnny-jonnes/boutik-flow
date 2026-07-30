"""structural_rls_policies

Revision ID: a546853c47ae
Revises: 370338bc3558
Create Date: 2026-07-30 23:30:00.000000

Isolation multi-tenant en profondeur, au niveau base de données — jusqu'ici
l'isolation reposait à 100% sur le filtrage applicatif (vérifié correct
module par module, cf. audit), sans filet de sécurité si une requête
oubliait un jour le filtre tenant_id. RLS était activée sur certaines
tables depuis une migration antérieure mais SANS AUCUNE POLITIQUE — un
"ENABLE ROW LEVEL SECURITY" sans policy ne protège rien, et le rôle de
connexion applicatif (postgres) la contourne de toute façon (rolbypassrls).

Cette migration :
1. Crée un rôle applicatif restreint (boutikflow_app), sans le contournement
   dont bénéficie le rôle actuel.
2. Active RLS + FORCE ROW LEVEL SECURITY sur toutes les tables multi-tenant
   (FORCE : s'applique même à un rôle qui posséderait la table).
3. Écrit une politique par table : seules les lignes dont tenant_id
   correspond à current_setting('app.tenant_id') sont visibles/modifiables.

IMPORTANT — ceci est purement additif et n'a AUCUN effet tant que
l'application continue de se connecter avec le rôle actuel (postgres, qui
contourne RLS) : rien ne change en production tant que DATABASE_URL n'est
pas explicitement basculé vers boutikflow_app. Le branchement de
l'application elle-même (SET LOCAL app.tenant_id par requête, chemin de
contournement pour les endpoints publics d'auth et le panneau admin) est un
chantier séparé, volontairement pas fait dans cette migration.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a546853c47ae'
down_revision: Union[str, None] = '370338bc3558'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Tables isolées par tenant_id directement.
TENANT_TABLES = [
    "admin_notifications", "ai_logs", "audit_logs", "campaigns", "categories",
    "client_debts", "clients", "debt_payments", "financial_transactions",
    "idempotency_keys", "inventory_logs", "order_logs", "orders", "products",
    "segments", "subscriptions", "suppliers", "users", "whatsapp_messages",
]

APP_ROLE = "boutikflow_app"
# Mot de passe généré une fois pour cette migration — à faire tourner
# (ALTER ROLE ... PASSWORD) si jamais exposé ailleurs qu'ici et dans la
# variable d'environnement Render correspondante.
APP_ROLE_PASSWORD = "JHVE_93QNoYmyO-v6sUf9iXHA1TBHsEtjX6OLTVadPI"


def upgrade() -> None:
    # ── 1. Rôle applicatif restreint ─────────────────────────────────
    op.execute(f"""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '{APP_ROLE}') THEN
                CREATE ROLE {APP_ROLE} WITH LOGIN PASSWORD '{APP_ROLE_PASSWORD}'
                    NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
            END IF;
        END
        $$;
    """)
    op.execute(f"GRANT USAGE ON SCHEMA public TO {APP_ROLE};")
    op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {APP_ROLE};")
    op.execute(f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {APP_ROLE};")
    op.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {APP_ROLE};")

    # ── 2. RLS + politique par table isolée par tenant_id ────────────
    # NULLIF(..., '') : current_setting('app.tenant_id', true) renvoie une
    # chaîne vide (pas NULL) sur une connexion où la variable n'a jamais été
    # posée dans cette session — un cast direct ::uuid lève alors une
    # erreur SQL dure (InvalidTextRepresentation) au lieu de refuser
    # proprement l'accès. Découvert en testant AVANT toute mise en
    # production (voir la session de validation qui accompagne cette
    # migration) : sans ce garde-fou, la moindre requête pré-authentification
    # aurait fait planter la connexion au lieu de renvoyer un résultat vide.
    for table in TENANT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table};")
        op.execute(f"""
            CREATE POLICY tenant_isolation ON {table}
            USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
            WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
        """)

    # ── 3. order_items : pas de tenant_id direct, isolé via orders ───
    op.execute("ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE order_items FORCE ROW LEVEL SECURITY;")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON order_items;")
    op.execute("""
        CREATE POLICY tenant_isolation ON order_items
        USING (order_id IN (
            SELECT id FROM orders WHERE tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        ))
        WITH CHECK (order_id IN (
            SELECT id FROM orders WHERE tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        ));
    """)

    # ── 4. tenants : la table EST le tenant, isolée par son propre id ─
    # Note : bloque de facto toute lecture pré-authentification (login,
    # register cherchent un tenant par slug avant qu'un contexte n'existe)
    # pour une connexion utilisant ce rôle — c'est justement pourquoi ces
    # endpoints publics doivent continuer à utiliser le rôle de contournement
    # tant que ce chantier n'est pas terminé (voir docstring du module).
    op.execute("ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE tenants FORCE ROW LEVEL SECURITY;")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON tenants;")
    op.execute("""
        CREATE POLICY tenant_isolation ON tenants
        USING (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
        WITH CHECK (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON tenants;")
    op.execute("ALTER TABLE tenants NO FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;")

    op.execute("DROP POLICY IF EXISTS tenant_isolation ON order_items;")
    op.execute("ALTER TABLE order_items NO FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;")

    for table in TENANT_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table};")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")

    op.execute(f"DROP OWNED BY {APP_ROLE};")
    op.execute(f"DROP ROLE IF EXISTS {APP_ROLE};")
