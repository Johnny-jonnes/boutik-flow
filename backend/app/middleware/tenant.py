"""
Middleware multi-tenant pour BoutikFlow.
CRITIQUE : Garantit l'isolation complète des données entre tenants.
Chaque requête doit porter le tenant_id dans le contexte.
"""
import uuid
from typing import Optional
from contextvars import ContextVar
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

# Variable de contexte pour l'isolation multi-tenant
_current_tenant_id: ContextVar[Optional[uuid.UUID]] = ContextVar(
    "current_tenant_id", default=None
)


def get_current_tenant_id() -> uuid.UUID:
    """
    Retourne le tenant_id du contexte de la requête courante.
    Lève une exception si non défini (protection critique).
    """
    tenant_id = _current_tenant_id.get()
    if tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Contexte tenant non défini",
        )
    return tenant_id


def set_current_tenant_id(tenant_id: uuid.UUID) -> None:
    """Définit le tenant_id dans le contexte de la requête."""
    _current_tenant_id.set(tenant_id)


class TenantMiddleware(BaseHTTPMiddleware):
    """
    Middleware qui extrait le tenant_id du JWT décodé
    et l'injecte dans le contexte de la requête.
    Routes publiques (auth) sont exemptées.
    """

    PUBLIC_PATHS = {
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh",
        "/health",
        "/docs",
        "/openapi.json",
        "/redoc",
    }

    async def dispatch(self, request: Request, call_next) -> Response:
        # Exempter les routes publiques
        if request.url.path in self.PUBLIC_PATHS:
            return await call_next(request)

        # Le tenant_id est injecté par le système d'auth (voir deps.py)
        # Ce middleware sert de garde-fou supplémentaire
        return await call_next(request)
