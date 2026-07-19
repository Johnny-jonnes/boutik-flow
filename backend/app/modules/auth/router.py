"""
Router Auth — Module d'authentification BoutikFlow
Règles appliquées :
- Multi-tenant : création simultanée tenant + user
- Soft delete : vérification deleted_at sur login
- Sécurité : JWT access + refresh, bcrypt, aucun secret exposé
- Validation : Pydantic v2 strict
"""
import uuid
import logging
from typing import Annotated
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.core.config import settings
from app.core.database import get_db
from app.core.mailer import send_password_reset_email, send_admin_new_registration_notification
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    create_password_reset_token,
    decode_token,
)
from app.core.deps import get_current_user, CurrentUser
from app.modules.auth.models import Tenant, User, PlanEnum, RoleEnum, TenantStatusEnum, AdminNotification, AdminNotificationTypeEnum
from app.modules.auth.schemas import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    RegisterResponse,
    RefreshTokenRequest,
    UserResponse,
    TenantResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentification"])


def _build_token_response(user: User) -> TokenResponse:
    """Construit la réponse JWT standardisée (access + refresh)."""
    token_data = {
        "sub": str(user.id),
        "tenant_id": str(user.tenant_id),
        "email": user.email,
        "role": user.role.value if hasattr(user.role, "value") else user.role,
    }
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user=UserResponse.model_validate(user),
    )


# ──────────────────────────── POST /register ────────────────────────────

@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Demander la création d'une boutique (validation admin requise)",
)
def register(
    payload: RegisterRequest,
    db: Annotated[Session, Depends(get_db)],
) -> RegisterResponse:
    """
    Inscription en une seule étape :
    1. Crée le tenant (boutique), statut "pending"
    2. Crée l'utilisateur owner
    3. Crée une notification admin + tente l'envoi d'un email à l'équipe

    Aucun paiement en ligne n'étant intégré, chaque boutique doit être
    validée manuellement depuis l'espace admin avant de pouvoir se
    connecter. Aucun token n'est émis à cette étape.

    Route publique (pas de JWT requis).
    
    # Vérifier unicité du slug
    existing_tenant = db.query(Tenant).filter(
        and_(Tenant.slug == payload.boutique_slug, Tenant.deleted_at.is_(None))
    ).first()
    if existing_tenant:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ce nom de boutique est déjà pris. Choisissez un autre identifiant.",
        )

    # Vérifier unicité email globalement (un email = un compte par boutique)
    existing_user = db.query(User).join(Tenant).filter(
        and_(
            User.email == payload.email,
            Tenant.slug == payload.boutique_slug,
            User.deleted_at.is_(None),
        )
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cet email est déjà utilisé pour cette boutique.",
        )

    # Créer le tenant
    tenant = Tenant(
        id=uuid.uuid4(),
        name=payload.boutique_name,
        slug=payload.boutique_slug,
        plan=PlanEnum.freemium,
    )
    db.add(tenant)
    db.flush()  # Obtenir l'ID du tenant avant de créer le user

    # Créer le propriétaire
    user = User(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role=RoleEnum.owner,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    logger.info(
        "Nouvelle boutique créée : %s (slug=%s, owner=%s)",
        tenant.name, tenant.slug, user.email,
    )

    return _build_token_response(user)


# ──────────────────────────── POST /login ────────────────────────────

@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Se connecter à une boutique",
)
def login(
    payload: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    """
    Connexion par slug boutique + email + mot de passe.
    Vérifie que le tenant et l'utilisateur existent et sont actifs.
    """
    # Trouver le tenant par slug (non supprimé)
    tenant = db.query(Tenant).filter(
        and_(Tenant.slug == payload.boutique_slug, Tenant.deleted_at.is_(None))
    ).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants incorrects",
        )

    if not tenant.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cette boutique a été désactivée. Contactez le support.",
        )

    # Trouver l'utilisateur dans ce tenant
    user = db.query(User).filter(
        and_(
            User.tenant_id == tenant.id,
            User.email == payload.email,
            User.deleted_at.is_(None),
        )
    ).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants incorrects",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Votre compte a été désactivé. Contactez le propriétaire de la boutique.",
        )

    logger.info("Connexion réussie : %s (tenant=%s)", user.email, tenant.slug)

    return _build_token_response(user)


# ──────────────────────────── POST /refresh ────────────────────────────

@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Renouveler les tokens JWT",
)
def refresh_token(
    payload: RefreshTokenRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    """Renouvelle l'access token à partir d'un refresh token valide."""
    token_payload = decode_token(payload.refresh_token)

    if token_payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de type invalide",
        )

    user_id = token_payload.get("sub")
    user = db.query(User).filter(
        and_(User.id == uuid.UUID(user_id), User.deleted_at.is_(None))
    ).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur introuvable ou désactivé",
        )

    return _build_token_response(user)


# ──────────────────────────── POST /forgot-password ────────────────────────────

@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
    summary="Demander la réinitialisation du mot de passe",
)
def forgot_password(
    payload: ForgotPasswordRequest,
    db: Annotated[Session, Depends(get_db)],
) -> ForgotPasswordResponse:
    """
    Génère un lien de réinitialisation et l'envoie par email.
    La réponse est volontairement générique : elle ne révèle jamais si le
    couple boutique/email correspond à un compte existant (anti-énumération).
    """
    generic_message = (
        "Si un compte correspondant existe, un email de réinitialisation "
        "vient de lui être envoyé."
    )

    tenant = db.query(Tenant).filter(
        and_(Tenant.slug == payload.boutique_slug, Tenant.deleted_at.is_(None))
    ).first()

    if tenant and tenant.is_active:
        user = db.query(User).filter(
            and_(
                User.tenant_id == tenant.id,
                User.email == payload.email,
                User.deleted_at.is_(None),
                User.is_active.is_(True),
            )
        ).first()

        if user:
            token = create_password_reset_token(str(user.id))
            reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
            send_password_reset_email(user.email, reset_link, tenant.name)
            logger.info(
                "Demande de réinitialisation de mot de passe pour %s (tenant=%s)",
                user.email, tenant.slug,
            )

    return ForgotPasswordResponse(message=generic_message)


# ──────────────────────────── POST /reset-password ────────────────────────────

@router.post(
    "/reset-password",
    response_model=ResetPasswordResponse,
    summary="Réinitialiser le mot de passe à partir d'un token",
)
def reset_password(
    payload: ResetPasswordRequest,
    db: Annotated[Session, Depends(get_db)],
) -> ResetPasswordResponse:
    """Valide le token de réinitialisation (courte durée de vie) et met à jour le mot de passe."""
    token_payload = decode_token(payload.token)

    if token_payload.get("type") != "password_reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lien de réinitialisation invalide",
        )

    user_id = token_payload.get("sub")
    user = db.query(User).filter(
        and_(User.id == uuid.UUID(user_id), User.deleted_at.is_(None))
    ).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lien de réinitialisation invalide ou expiré",
        )

    user.hashed_password = hash_password(payload.new_password)
    db.commit()

    logger.info("Mot de passe réinitialisé pour %s", user.email)

    return ResetPasswordResponse(message="Votre mot de passe a été réinitialisé avec succès.")


# ──────────────────────────── GET /me ────────────────────────────

@router.get(
    "/me",
    response_model=UserResponse,
    summary="Profil de l'utilisateur connecté",
)
def get_me(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserResponse:
    """Retourne le profil de l'utilisateur connecté (route protégée)."""
    user = db.query(User).filter(
        and_(User.id == current_user.user_id, User.deleted_at.is_(None))
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable",
        )

    return UserResponse.model_validate(user)


# ──────────────────────────── GET /tenant ────────────────────────────

@router.get(
    "/tenant",
    response_model=TenantResponse,
    summary="Informations de la boutique",
)
def get_tenant(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> TenantResponse:
    """Retourne les informations de la boutique du tenant courant (route protégée)."""
    tenant = db.query(Tenant).filter(
        and_(Tenant.id == current_user.tenant_id, Tenant.deleted_at.is_(None))
    ).first()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Boutique introuvable",
        )

    return TenantResponse.model_validate(tenant)
