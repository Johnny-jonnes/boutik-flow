"""
Point d'entrée principal — FastAPI BoutikFlow
"""
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import settings
from app.middleware.tenant import TenantMiddleware

logger = logging.getLogger(__name__)

# Import des routers
from app.modules.auth.router import router as auth_router
from app.modules.crm.router import router as crm_router
from app.modules.products.router import router as products_router
from app.modules.orders.router import router as orders_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.billing.router import router as billing_router
from app.modules.whatsapp.router import router as whatsapp_router
from app.modules.ai.router import router as ai_router
from app.modules.marketing.router import router as marketing_router
from app.modules.admin.router import router as admin_router
from app.modules.suppliers.router import router as suppliers_router
from app.modules.audit.router import router as audit_router
from app.modules.finance.router import router as finance_router
from app.modules.crm.debt_router import router as debt_router

app = FastAPI(
    title="BoutikFlow API",
    description="API Backend du CRM SaaS multi-tenant pour boutiques africaines",
    version=settings.APP_VERSION,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# ─── Middlewares ────────────────────────────────────────────────────────────

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Multi-tenant isolation
app.add_middleware(TenantMiddleware)


# ─── Gestion globale des erreurs ────────────────────────────────────────────
#
# Sans ce handler, une exception non interceptée dans une route atteint le
# ServerErrorMiddleware par défaut de Starlette : réponse 500 en texte brut
# (pas le format JSON {"detail": ...} utilisé partout ailleurs par l'API),
# et surtout AUCUNE trace exploitable dans les logs — juste une réponse
# cassée côté client, invisible côté serveur tant que personne ne regarde
# le flux stdout brut de Render en direct. Le detail générique côté client
# évite de renvoyer le texte interne de l'exception (which peut contenir
# des détails d'implémentation) ; le detail complet part dans les logs.
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    tenant_id = None
    try:
        from app.middleware.tenant import get_current_tenant_id
        tenant_id = get_current_tenant_id()
    except Exception:
        pass
    logger.error(
        "Erreur non gérée sur %s %s (tenant=%s): %s",
        request.method, request.url.path, tenant_id, exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Une erreur interne est survenue. Réessayez dans quelques instants."},
    )


# ─── Routes ─────────────────────────────────────────────────────────────────

API_PREFIX = "/api/v1"

app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(crm_router, prefix=API_PREFIX)
app.include_router(products_router, prefix=API_PREFIX)
app.include_router(orders_router, prefix=API_PREFIX)
app.include_router(dashboard_router, prefix=API_PREFIX)
app.include_router(billing_router, prefix=API_PREFIX)
app.include_router(whatsapp_router, prefix=API_PREFIX)
app.include_router(ai_router, prefix=API_PREFIX)
app.include_router(marketing_router, prefix=API_PREFIX)
app.include_router(admin_router, prefix=API_PREFIX)
app.include_router(suppliers_router, prefix=API_PREFIX)
app.include_router(audit_router, prefix=API_PREFIX)
app.include_router(finance_router, prefix=API_PREFIX)
app.include_router(debt_router, prefix=API_PREFIX)


# ─── Health Check ───────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
async def health_check() -> JSONResponse:
    """Endpoint de santé pour monitoring.

    Vérifie réellement la connexion DB (SELECT 1) — l'ancienne version
    renvoyait un 200 statique sans jamais toucher la base : une instance
    dont le pool de connexions était mort continuait d'être considérée
    "healthy" et de recevoir du trafic. 503 (pas 200 avec un champ
    "degraded" dans le corps) pour qu'un contrôle de santé qui ne regarde
    que le code HTTP détecte réellement le problème.
    """
    db_ok = True
    db_error: str | None = None
    try:
        from app.core.database import engine
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        db_ok = False
        db_error = str(e)
        logger.error("Health check : base de données injoignable : %s", e)

    body = {
        "status": "healthy" if db_ok else "unhealthy",
        "database": "ok" if db_ok else "unreachable",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }
    if not db_ok and settings.DEBUG:
        body["database_error"] = db_error
    return JSONResponse(status_code=200 if db_ok else 503, content=body)


@app.get("/version", tags=["Health"])
async def version_check():
    """Retourne la version du backend déployé et les routes disponibles."""
    return {
        "commit": "0168caa",
        "build_date": "2026-07-24",
        "routes": {
            "finance": "/api/v1/finance",
            "audit": "/api/v1/audit",
            "suppliers": "/api/v1/suppliers",
            "team": "/api/v1/auth/team",
            "orders": "/api/v1/orders",
            "debts": "/api/v1/crm/debts",
        }
    }


@app.post("/api/v1/migrate", tags=["Health"])
async def force_migrate():
    """Force la création de toutes les tables manquantes (idempotent)."""
    from app.core.database import engine, Base
    from app.modules.auth.models import Tenant, User, AdminNotification  # noqa
    from app.modules.crm.models import Client  # noqa
    from app.modules.crm.debt_models import ClientDebt, DebtPayment  # noqa
    from app.modules.products.models import Product, InventoryLog, Order, OrderItem, OrderLog, WhatsAppMessage, AILog, Subscription  # noqa
    from app.modules.marketing.models import Campaign  # noqa
    from app.modules.suppliers.models import Supplier  # noqa
    from app.modules.audit.models import AuditLog  # noqa
    from app.modules.finance.models import FinancialTransaction  # noqa
    from app.core.idempotency import IdempotencyKey  # noqa
    Base.metadata.create_all(bind=engine)
    tables = list(Base.metadata.tables.keys())
    return {"status": "ok", "tables_registered": tables}


# ─── Auto-création des tables au démarrage ──────────────────────────────────

@app.on_event("startup")
def on_startup():
    """Crée les tables manquantes au démarrage."""
    from app.core.database import engine, Base
    # Import ALL models so they are registered with Base.metadata
    from app.modules.auth.models import Tenant, User, AdminNotification  # noqa: F401
    from app.modules.crm.models import Client  # noqa: F401
    from app.modules.crm.debt_models import ClientDebt, DebtPayment  # noqa: F401
    from app.modules.products.models import Product, InventoryLog, Order, OrderItem, OrderLog, WhatsAppMessage, AILog, Subscription  # noqa: F401
    from app.modules.marketing.models import Campaign  # noqa: F401
    from app.modules.suppliers.models import Supplier  # noqa: F401
    from app.modules.audit.models import AuditLog  # noqa: F401
    from app.modules.finance.models import FinancialTransaction  # noqa: F401
    from app.core.idempotency import IdempotencyKey  # noqa: F401
    Base.metadata.create_all(bind=engine)


# ─── Démarrage ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )
