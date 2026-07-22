"""
Dépendances FastAPI partagées.
Gère l'injection du contexte utilisateur et tenant dans chaque route.
"""
import uuid
from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.middleware.tenant import set_current_tenant_id

security = HTTPBearer()


class CurrentUser:
    """Contexte utilisateur courant extrait du JWT."""
    def __init__(
        self,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID,
        email: str,
        role: str,
    ):
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.email = email
        self.role = role


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> CurrentUser:
    """
    Dépendance qui valide le JWT et retourne l'utilisateur courant.
    Injecte automatiquement le tenant_id dans le contexte.
    """
    payload = decode_token(credentials.credentials)

    user_id = payload.get("sub")
    tenant_id = payload.get("tenant_id")
    email = payload.get("email")
    role = payload.get("role", "owner")

    if not user_id or not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide : champs manquants",
        )

    tenant_uuid = uuid.UUID(tenant_id)
    # Injecter le tenant dans le contexte pour l'isolation des données
    set_current_tenant_id(tenant_uuid)

    return CurrentUser(
        user_id=uuid.UUID(user_id),
        tenant_id=tenant_uuid,
        email=email,
        role=role,
    )


async def require_admin(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> CurrentUser:
    """Exige le rôle admin (dashboard administration globale)."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs",
        )
    return current_user


async def require_owner_or_manager(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> CurrentUser:
    """Exige le rôle owner ou manager (gestion d'équipe)."""
    if current_user.role not in ("owner", "manager", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux propriétaires et gérants",
        )
    return current_user
