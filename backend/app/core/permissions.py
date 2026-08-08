"""
Permissions par rôle — source unique de vérité sur ce que chaque rôle
peut faire dans chaque module.

Mirroré côté frontend (frontend/src/lib/permissions.ts) pour l'affichage
(menus, boutons), mais SEULE cette version fait autorité : le frontend ne
reflète que ce qui est de toute façon appliqué ici. Un utilisateur qui
contournerait l'interface (appel direct à l'API) reste bloqué par ces
dépendances FastAPI, jamais par le frontend seul.

Complète (ne remplace pas) app.core.deps.require_owner_or_manager, déjà
utilisé par Équipe/Audit/la création de transactions Finance — ces
modules restent inchangés, déjà corrects.
"""
from typing import Annotated, Callable
from fastapi import Depends, HTTPException, status

from app.core.deps import get_current_user, CurrentUser

Module = str
Action = str

# module -> action -> rôles autorisés (RoleEnum.value, voir
# app.modules.auth.models.RoleEnum — "staff" = Employé).
PERMISSIONS: dict[Module, dict[Action, set[str]]] = {
    "dashboard": {
        "view": {"owner", "manager"},
    },
    "products": {
        "view": {"owner", "manager", "stock_manager", "cashier", "staff"},
        "write": {"owner", "manager", "stock_manager"},
        "delete": {"owner", "manager", "stock_manager"},
    },
    "categories": {
        "view": {"owner", "manager", "stock_manager", "cashier", "staff"},
        "write": {"owner", "manager", "stock_manager"},
        "delete": {"owner", "manager", "stock_manager"},
    },
    "stock": {
        "write": {"owner", "manager", "stock_manager"},
    },
    "orders": {
        "view": {"owner", "manager", "stock_manager", "cashier", "staff"},
        "create": {"owner", "manager", "cashier", "staff"},
        "cancel": {"owner", "manager"},
    },
    "returns": {
        "create": {"owner", "manager", "stock_manager", "cashier"},
    },
    # Reprend exactement les rôles déjà utilisés aujourd'hui via
    # require_permission("orders", ...) dans debt_router.py — isolation
    # propre du module Dettes Clients, aucun changement d'accès pour
    # personne au moment de cette migration.
    "debts": {
        "view": {"owner", "manager", "stock_manager", "cashier", "staff"},
        "create": {"owner", "manager", "cashier", "staff"},
        "pay": {"owner", "manager", "cashier", "staff"},
    },
    "clients": {
        "view": {"owner", "manager", "stock_manager", "cashier", "staff"},
        "create": {"owner", "manager", "stock_manager", "cashier", "staff"},
        "edit": {"owner", "manager", "cashier"},
        "delete": {"owner", "manager"},
    },
    "suppliers": {
        "view": {"owner", "manager", "stock_manager"},
        "write": {"owner", "manager", "stock_manager"},
        "delete": {"owner", "manager", "stock_manager"},
    },
    "finance": {
        "view": {"owner", "manager"},
        "create": {"owner", "manager"},
    },
    "team": {
        "view": {"owner", "manager"},
        "write": {"owner", "manager"},
        "delete": {"owner", "manager"},
    },
    "audit": {
        "view": {"owner", "manager"},
    },
    "settings": {
        "view": {"owner", "manager"},
        "write": {"owner"},
    },
}


def has_permission(role: str | None, module: Module, action: Action) -> bool:
    role_key = (role or "").strip().lower()
    allowed = PERMISSIONS.get(module, {}).get(action, set())
    return role_key in allowed


def require_permission(module: Module, action: Action) -> Callable[..., CurrentUser]:
    """Fabrique une dépendance FastAPI exigeant la permission (module,
    action) pour le rôle courant — usage identique à
    app.core.deps.require_owner_or_manager, généralisé à toute la matrice.

    Exemple : DB = Annotated[Session, Depends(get_db)]
              User = Annotated[CurrentUser, Depends(require_permission("products", "write"))]
    """
    async def _check(
        current_user: Annotated[CurrentUser, Depends(get_current_user)],
    ) -> CurrentUser:
        if not has_permission(current_user.role, module, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Votre rôle ne permet pas cette action.",
            )
        return current_user
    return _check
