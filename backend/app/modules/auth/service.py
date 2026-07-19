"""
Service Auth — Logique métier pour l'authentification.
Gère : inscription, connexion, refresh token.
"""
import uuid
from datetime import timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_
from fastapi import HTTPException, status

from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token
from app.core.config import settings
from app.modules.auth.models import Tenant, User, RoleEnum, PlanEnum
from app.modules.auth.schemas import RegisterRequest, LoginRequest, TokenResponse


def _build_token_response(user: User, tenant: Tenant) -> TokenResponse:
    """Construit la réponse avec access + refresh tokens."""
    payload = {
        "sub": str(user.id),
        "tenant_id": str(tenant.id),
        "email": user.email,
        "role": user.role.value,
    }
    access_token = create_access_token(payload)
    refresh_token = create_refresh_token(payload)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


def register(db: Session, data: RegisterRequest) -> TokenResponse:
    """
    Inscription : crée un tenant + utilisateur owner.
    Vérifie que le slug est disponible.
    """
    # Vérifier disponibilité du slug
    existing_tenant = db.query(Tenant).filter(
        Tenant.slug == data.boutique_slug,
        Tenant.deleted_at.is_(None),
    ).first()
    if existing_tenant:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ce nom de boutique est déjà pris. Choisissez un autre slug.",
        )

    # Créer le tenant (boutique)
    tenant = Tenant(
        name=data.boutique_name,
        slug=data.boutique_slug,
        plan=PlanEnum.freemium,
        is_active=True,
    )
    db.add(tenant)
    db.flush()  # Obtenir l'ID avant commit

    # Créer l'utilisateur owner
    user = User(
        tenant_id=tenant.id,
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        phone=data.phone,
        role=RoleEnum.owner,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.refresh(tenant)

    return _build_token_response(user, tenant)


def login(db: Session, data: LoginRequest) -> TokenResponse:
    """
    Connexion : vérifie email + mot de passe dans le bon tenant.
    CRITIQUE : vérifier le slug du tenant pour ne pas mélanger les données.
    """
    # Récupérer le tenant par slug
    tenant = db.query(Tenant).filter(
        Tenant.slug == data.boutique_slug,
        Tenant.is_active == True,
        Tenant.deleted_at.is_(None),
    ).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Boutique introuvable",
        )

    # Récupérer l'utilisateur dans ce tenant spécifique
    user = db.query(User).filter(
        and_(
            User.email == data.email,
            User.tenant_id == tenant.id,
            User.is_active == True,
            User.deleted_at.is_(None),
        )
    ).first()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )

    return _build_token_response(user, tenant)


def refresh_access_token(db: Session, refresh_token: str) -> TokenResponse:
    """
    Renouvelle l'access token avec un refresh token valide.
    """
    from app.core.security import decode_token
    payload = decode_token(refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de rafraîchissement invalide",
        )

    user_id = uuid.UUID(payload.get("sub"))
    tenant_id = uuid.UUID(payload.get("tenant_id"))

    user = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == tenant_id,
        User.is_active == True,
        User.deleted_at.is_(None),
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur introuvable ou désactivé",
        )

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    return _build_token_response(user, tenant)
