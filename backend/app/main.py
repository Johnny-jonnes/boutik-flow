"""
Point d'entrée principal — FastAPI BoutikFlow
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.core.config import settings
from app.middleware.tenant import TenantMiddleware

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


# ─── Health Check ───────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
async def health_check():
    """Endpoint de santé pour monitoring."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/version", tags=["Health"])
async def version_check():
    """Retourne la version du backend déployé et les routes disponibles."""
    return {
        "commit": "2012445",
        "build_date": "2026-07-23",
        "routes": {
            "finance": "/api/v1/finance",
            "audit": "/api/v1/audit",
            "suppliers": "/api/v1/suppliers",
            "team": "/api/v1/auth/team",
            "orders": "/api/v1/orders",
        }
    }


# ─── Auto-création des tables au démarrage ──────────────────────────────────

@app.on_event("startup")
def on_startup():
    """Crée les tables manquantes au démarrage."""
    from app.core.database import engine, Base
    # Import ALL models so they are registered with Base.metadata
    from app.modules.auth.models import Tenant, User, AdminNotification  # noqa: F401
    from app.modules.crm.models import Client  # noqa: F401
    from app.modules.products.models import Product, InventoryLog, Order, OrderItem, OrderLog, WhatsAppMessage, AILog, Subscription  # noqa: F401
    from app.modules.marketing.models import Campaign  # noqa: F401
    from app.modules.suppliers.models import Supplier  # noqa: F401
    from app.modules.audit.models import AuditLog  # noqa: F401
    from app.modules.finance.models import FinancialTransaction  # noqa: F401
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
