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

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
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
from app.core.deps import get_current_user, CurrentUser, require_owner_or_manager
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
    InviteUserRequest,
    UpdateUserRoleRequest,
    UpdateUserStatusRequest,
    TeamMemberResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentification"])


def _build_token_response(user: User) -> TokenResponse:
    """Construit la réponse JWT standardisée (access + refresh)."""
    token_data = {
        "sub": str(user.id),
        "tenant_id": str(user.tenant_id),
        "tenant_name": user.tenant.name if user.tenant else "Ma Boutique",
        "tenant_plan": user.tenant.plan.value if user.tenant and hasattr(user.tenant.plan, "value") else (user.tenant.plan if user.tenant else "freemium"),
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
    background_tasks: BackgroundTasks,
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
    """
    
    # Vérifier unicité du slug
    existing_tenant = db.query(Tenant).filter(
        and_(Tenant.slug == payload.boutique_slug, Tenant.deleted_at.is_(None))
    ).first()
    if existing_tenant:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ce nom de boutique est déjà pris. Choose another ID.",
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
 
    # Créer le tenant en attente de validation
    tenant = Tenant(
        id=uuid.uuid4(),
        name=payload.boutique_name,
        slug=payload.boutique_slug,
        plan=PlanEnum.freemium,
        status=TenantStatusEnum.pending,
        is_active=False,
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
 
    # Créer une notification pour l'espace d'administration
    admin_notif = AdminNotification(
        id=uuid.uuid4(),
        type=AdminNotificationTypeEnum.new_registration,
        message=f"Nouvelle inscription : boutique '{tenant.name}' ({tenant.slug}) par {user.full_name or user.email}",
        tenant_id=tenant.id,
        is_read=False,
    )
    db.add(admin_notif)
 
    db.commit()
    db.refresh(user)
 
    # Tenter l'envoi de l'email de notification à l'équipe admin en arrière-plan (évite le blocage HTTP)
    try:
        background_tasks.add_task(
            send_admin_new_registration_notification,
            tenant.name,
            tenant.slug,
            user.email,
            user.full_name
        )
    except Exception as e:
        logger.warning("Erreur lors de l'enregistrement de la tâche d'email: %s", str(e))
 
    logger.info(
        "Nouvelle demande de boutique enregistrée : %s (slug=%s, owner=%s)",
        tenant.name, tenant.slug, user.email,
    )
 
    return RegisterResponse(
        message="Votre demande de création de boutique a bien été envoyée et est en cours de validation par notre équipe d'administration.",
        boutique_slug=tenant.slug,
        status="pending",
    )


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

    if tenant.status == TenantStatusEnum.pending or not tenant.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Votre demande de création de boutique est en attente de validation par l'administration. Vous recevrez l'accès dès son activation.",
        )

    if tenant.status == TenantStatusEnum.blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cette boutique a été suspendue par l'administration. Contactez le support.",
        )

    if tenant.status == TenantStatusEnum.rejected:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Votre demande de création de boutique n'a pas été retenue par l'administration.",
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
            # Si Supabase est configuré, on utilise Supabase Auth pour envoyer un vrai e-mail gratuitement
            if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY:
                try:
                    from supabase import create_client
                    import secrets
                    supabase_admin = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
                    
                    # Garantir que l'utilisateur existe dans Supabase Auth
                    try:
                        supabase_admin.auth.admin.create_user({
                            "email": user.email,
                            "password": secrets.token_urlsafe(16),
                            "email_confirm": True
                        })
                    except Exception:
                        pass # Ignore s'il existe déjà
                    
                    # Demander la réinitialisation d'e-mail via Supabase Auth
                    supabase_admin.auth.reset_password_for_email(
                        user.email,
                        options={"redirect_to": f"{settings.FRONTEND_URL}/reset-password"}
                    )
                    logger.info("Lien de réinitialisation envoyé par Supabase pour %s", user.email)
                except Exception as e:
                    logger.error("Échec de l'envoi via Supabase, repli sur le SMTP local: %s", str(e))
                    token = create_password_reset_token(str(user.id))
                    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
                    send_password_reset_email(user.email, reset_link, tenant.name)
            else:
                # Utiliser le SMTP classique configuré
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
    """Valide le token de réinitialisation (interne ou Supabase) et met à jour le mot de passe."""
    user_email = None

    # 1. Tenter de décoder comme un token JWT interne de réinitialisation
    try:
        token_payload = decode_token(payload.token)
        if token_payload.get("type") == "password_reset":
            user_id = token_payload.get("sub")
            user = db.query(User).filter(
                and_(User.id == uuid.UUID(user_id), User.deleted_at.is_(None))
            ).first()
            if user:
                user_email = user.email
    except Exception:
        pass

    # 2. Si non valide, tenter de vérifier comme un token d'accès Supabase
    if not user_email and settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY:
        try:
            from supabase import create_client
            # Utiliser la clé anonyme pour valider l'access_token de l'utilisateur
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
            auth_resp = supabase.auth.get_user(payload.token)
            if auth_resp and auth_resp.user:
                user_email = auth_resp.user.email
        except Exception as e:
            logger.error("Échec de la validation du token Supabase : %s", str(e))

    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lien de réinitialisation invalide ou expiré",
        )

    # Récupérer l'utilisateur correspondant dans notre base locale
    user = db.query(User).filter(
        and_(User.email == user_email, User.deleted_at.is_(None))
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


# ──────────────────────────── Team Management ────────────────────────────

@router.get(
    "/team",
    response_model=list[TeamMemberResponse],
    summary="Lister les membres de l'équipe",
)
def list_team(
    current_user: Annotated[CurrentUser, Depends(require_owner_or_manager)],
    db: Annotated[Session, Depends(get_db)],
) -> list[TeamMemberResponse]:
    users = db.query(User).filter(
        and_(User.tenant_id == current_user.tenant_id, User.deleted_at.is_(None))
    ).all()
    return [
        TeamMemberResponse(
            id=u.id,
            tenant_id=u.tenant_id,
            email=u.email,
            full_name=u.full_name,
            phone=u.phone,
            role=u.role.value if hasattr(u.role, "value") else str(u.role),
            is_active=u.is_active,
            created_at=u.created_at,
        )
        for u in users
    ]


@router.post(
    "/team/invite",
    response_model=TeamMemberResponse,
    summary="Inviter un nouveau membre (création directe)",
)
def invite_team_member(
    payload: InviteUserRequest,
    current_user: Annotated[CurrentUser, Depends(require_owner_or_manager)],
    db: Annotated[Session, Depends(get_db)],
) -> TeamMemberResponse:
    # check email unique in tenant
    existing_user = db.query(User).filter(
        and_(User.email == payload.email, User.tenant_id == current_user.tenant_id, User.deleted_at.is_(None))
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cet email est déjà utilisé pour cette boutique",
        )
    
    new_user = User(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role=payload.role,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.put(
    "/team/{user_id}/role",
    response_model=TeamMemberResponse,
    summary="Mettre à jour le rôle d'un membre",
)
def update_team_member_role(
    user_id: uuid.UUID,
    payload: UpdateUserRoleRequest,
    current_user: Annotated[CurrentUser, Depends(require_owner_or_manager)],
    db: Annotated[Session, Depends(get_db)],
) -> TeamMemberResponse:
    user = db.query(User).filter(
        and_(User.id == user_id, User.tenant_id == current_user.tenant_id, User.deleted_at.is_(None))
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    
    if current_user.role != "owner" and user.role == "owner":
        raise HTTPException(status_code=403, detail="Un manager ne peut pas modifier un owner")

    user.role = payload.role
    db.commit()
    db.refresh(user)
    return user


@router.put(
    "/team/{user_id}/status",
    response_model=TeamMemberResponse,
    summary="Activer ou désactiver un membre",
)
def update_team_member_status(
    user_id: uuid.UUID,
    payload: UpdateUserStatusRequest,
    current_user: Annotated[CurrentUser, Depends(require_owner_or_manager)],
    db: Annotated[Session, Depends(get_db)],
) -> TeamMemberResponse:
    user = db.query(User).filter(
        and_(User.id == user_id, User.tenant_id == current_user.tenant_id, User.deleted_at.is_(None))
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    if str(user.id) == str(current_user.user_id):
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas modifier votre propre statut")

    if current_user.role != "owner" and user.role == "owner":
        raise HTTPException(status_code=403, detail="Un manager ne peut pas modifier le statut d'un owner")

    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return user


@router.delete(
    "/team/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer un membre de l'équipe",
)
def delete_team_member(
    user_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(require_owner_or_manager)],
    db: Annotated[Session, Depends(get_db)],
):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Seul le owner peut supprimer des utilisateurs")

    if str(user_id) == str(current_user.user_id):
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous supprimer vous-même")

    user = db.query(User).filter(
        and_(User.id == user_id, User.tenant_id == current_user.tenant_id, User.deleted_at.is_(None))
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    
    user.deleted_at = datetime.now(timezone.utc)
    db.commit()
