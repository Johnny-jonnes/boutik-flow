from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator
from app.core.config import settings

# Connexion privilégiée (contourne RLS) — utilisée pour les migrations, le
# DDL au démarrage (Base.metadata.create_all), ET comme connexion de
# contournement pour ce qui ne peut structurellement pas passer par la
# connexion applicative restreinte : les 3 endpoints d'auth publics
# (cherchent un tenant AVANT qu'un contexte n'existe) et le panneau admin
# (accès cross-tenant légitime). Ne JAMAIS l'utiliser pour une route
# tenant-scopée normale une fois APP_DATABASE_URL configurée.
## Répartition du pool — voir l'audit de montée en charge : engine/
## app_engine avaient chacun le même calibrage (10+20=30 connexions max)
## alors qu'engine ne sert que 3 routes d'auth publiques + le panneau
## admin (trafic faible) tandis qu'app_engine sert TOUTES les routes
## tenant-scopées (tout le trafic réel de l'application). Le plafond total
## (60) reste inchangé — c'est une réallocation, pas une augmentation,
## pour ne jamais risquer de dépasser la limite de connexions réelle de
## l'instance Postgres/Supabase configurée en production.
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=3,
    max_overflow=7,
    echo=settings.DEBUG,
)
BypassSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Connexion applicative restreinte (RLS) — utilisée par défaut pour toutes
# les routes tenant-scopées normales (get_db). Si APP_DATABASE_URL n'est
# pas configurée, retombe sur DATABASE_URL : l'app continue de fonctionner
# à l'identique, RLS n'a simplement aucun effet tant que ce rôle restreint
# n'est pas explicitement branché (voir migration a546853c47ae).
app_engine = create_engine(
    settings.APP_DATABASE_URL or settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=15,
    max_overflow=35,
    echo=settings.DEBUG,
)
AppSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=app_engine)


@event.listens_for(AppSessionLocal, "after_begin")
def _reapply_tenant_context(session: Session, transaction, connection) -> None:
    """SET LOCAL est borné à la transaction Postgres en cours : un
    db.commit() suivi d'un db.refresh(obj) (motif très répandu dans ce
    codebase) ouvre une NOUVELLE transaction où app.tenant_id n'est plus
    posé, ce qui fait échouer silencieusement le refresh sous RLS. Cet
    event se déclenche à CHAQUE nouvelle transaction (y compris la
    première, via l'autobegin) et repose la valeur stockée sur la session
    par get_current_user, pour qu'elle survive à tout le cycle de vie de
    la requête plutôt qu'à une seule transaction."""
    tenant_id = session.info.get("tenant_id")
    if tenant_id:
        connection.execute(text("SET LOCAL app.tenant_id = :tenant_id"), {"tenant_id": tenant_id})


Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Session par défaut pour les routes tenant-scopées — isolée par RLS
    dès qu'un utilisateur authentifié est résolu (voir
    app.core.deps.get_current_user, qui pose SET LOCAL app.tenant_id sur
    cette même session)."""
    db = AppSessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_bypass_db() -> Generator[Session, None, None]:
    """Session de contournement RLS — réservée aux 3 endpoints d'auth
    publics (register/login/refresh) et au panneau admin. Ne jamais
    l'utiliser pour une route tenant-scopée normale."""
    db = BypassSessionLocal()
    try:
        yield db
    finally:
        db.close()
