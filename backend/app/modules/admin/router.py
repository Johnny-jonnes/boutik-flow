"""
Router Admin — Module d'administration globale BoutikFlow
─────────────────────────────────────────────────────────
Toutes les routes sont protégées par `require_admin` (role = "admin").
Permet à l'équipe BoutikFlow de :
  - Consulter les statistiques globales
  - Lister / valider / bloquer / rejeter les boutiques
  - Changer le plan d'abonnement
  - Supprimer (soft delete) une boutique
  - Gérer les notifications d'inscription
  - Créer des comptes administrateurs
"""
import uuid
import math
import logging
from typing import Annotated, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, or_

from app.core.database import get_db
from app.core.security import hash_password
from app.core.deps import require_admin, CurrentUser
from app.core.mailer import (
    send_account_approved_email,
    send_account_rejected_email,
    send_account_blocked_email,
    send_account_unblocked_email,
)
from app.modules.auth.models import (
    Tenant, User, AdminNotification,
    PlanEnum, RoleEnum, TenantStatusEnum,
)
from app.modules.admin.schemas import (
    AdminStats,
    TenantListItem,
    TenantDetail,
    TenantOwnerInfo,
    TenantStatusUpdate,
    TenantPlanUpdate,
    AdminNotificationResponse,
    CreateAdminUserRequest,
    AdminUserResponse,
    PaginatedTenants,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Administration"])

AdminUser = Annotated[CurrentUser, Depends(require_admin)]
DB = Annotated[Session, Depends(get_db)]


# ─── Helpers ────────────────────────────────────────────────────────────────

def _get_tenant_or_404(tenant_id: uuid.UUID, db: Session) -> Tenant:
    tenant = db.query(Tenant).filter(
        and_(Tenant.id == tenant_id, Tenant.deleted_at.is_(None))
    ).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Boutique introuvable",
        )
    return tenant


def _get_tenant_owner(tenant: Tenant, db: Session) -> Optional[User]:
    return db.query(User).filter(
        and_(
            User.tenant_id == tenant.id,
            User.role == RoleEnum.owner,
            User.deleted_at.is_(None),
        )
    ).first()


def _build_tenant_list_item(tenant: Tenant, db: Session) -> TenantListItem:
    owner = _get_tenant_owner(tenant, db)
    return TenantListItem(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        plan=tenant.plan.value if hasattr(tenant.plan, "value") else tenant.plan,
        status=tenant.status.value if hasattr(tenant.status, "value") else tenant.status,
        is_active=tenant.is_active,
        created_at=tenant.created_at,
        owner_email=owner.email if owner else None,
        owner_name=owner.full_name if owner else None,
    )


# ─── GET /admin/stats ────────────────────────────────────────────────────────

@router.get(
    "/stats",
    response_model=AdminStats,
    summary="KPIs globaux de la plateforme",
)
def get_admin_stats(
    _: AdminUser,
    db: DB,
) -> AdminStats:
    """Retourne les statistiques globales : boutiques, utilisateurs, notifications."""
    total_tenants = db.query(func.count(Tenant.id)).filter(Tenant.deleted_at.is_(None)).scalar() or 0
    pending = db.query(func.count(Tenant.id)).filter(
        and_(Tenant.deleted_at.is_(None), Tenant.status == TenantStatusEnum.pending)
    ).scalar() or 0
    active = db.query(func.count(Tenant.id)).filter(
        and_(Tenant.deleted_at.is_(None), Tenant.status == TenantStatusEnum.active)
    ).scalar() or 0
    blocked = db.query(func.count(Tenant.id)).filter(
        and_(Tenant.deleted_at.is_(None), Tenant.status == TenantStatusEnum.blocked)
    ).scalar() or 0
    rejected = db.query(func.count(Tenant.id)).filter(
        and_(Tenant.deleted_at.is_(None), Tenant.status == TenantStatusEnum.rejected)
    ).scalar() or 0
    total_users = db.query(func.count(User.id)).filter(User.deleted_at.is_(None)).scalar() or 0
    unread_notifs = db.query(func.count(AdminNotification.id)).filter(
        AdminNotification.is_read.is_(False)
    ).scalar() or 0

    return AdminStats(
        total_tenants=total_tenants,
        pending_tenants=pending,
        active_tenants=active,
        blocked_tenants=blocked,
        rejected_tenants=rejected,
        total_users=total_users,
        unread_notifications=unread_notifs,
    )


# ─── GET /admin/tenants ───────────────────────────────────────────────────────

@router.get(
    "/tenants",
    response_model=PaginatedTenants,
    summary="Liste paginée de toutes les boutiques",
)
def list_tenants(
    _: AdminUser,
    db: DB,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Recherche nom ou slug"),
    status_filter: Optional[str] = Query(None, alias="status", description="pending | active | blocked | rejected"),
    plan_filter: Optional[str] = Query(None, alias="plan", description="freemium | starter | pro"),
) -> PaginatedTenants:
    """Liste toutes les boutiques avec filtres et pagination."""
    query = db.query(Tenant).filter(Tenant.deleted_at.is_(None))

    if search:
        like = f"%{search}%"
        query = query.filter(or_(Tenant.name.ilike(like), Tenant.slug.ilike(like)))

    if status_filter:
        try:
            status_enum = TenantStatusEnum(status_filter)
            query = query.filter(Tenant.status == status_enum)
        except ValueError:
            pass

    if plan_filter:
        try:
            plan_enum = PlanEnum(plan_filter)
            query = query.filter(Tenant.plan == plan_enum)
        except ValueError:
            pass

    total = query.count()
    pages = math.ceil(total / per_page) if per_page > 0 else 0
    tenants = query.order_by(Tenant.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    items = [_build_tenant_list_item(t, db) for t in tenants]

    return PaginatedTenants(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


# ─── GET /admin/tenants/{id} ──────────────────────────────────────────────────

@router.get(
    "/tenants/{tenant_id}",
    response_model=TenantDetail,
    summary="Détail complet d'une boutique",
)
def get_tenant_detail(
    tenant_id: uuid.UUID,
    _: AdminUser,
    db: DB,
) -> TenantDetail:
    """Retourne le détail complet d'une boutique avec les infos du propriétaire."""
    tenant = _get_tenant_or_404(tenant_id, db)
    owner = _get_tenant_owner(tenant, db)

    owner_info = None
    if owner:
        owner_info = TenantOwnerInfo(
            id=owner.id,
            email=owner.email,
            full_name=owner.full_name,
            phone=owner.phone,
            is_active=owner.is_active,
            created_at=owner.created_at,
        )

    return TenantDetail(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        plan=tenant.plan.value if hasattr(tenant.plan, "value") else tenant.plan,
        status=tenant.status.value if hasattr(tenant.status, "value") else tenant.status,
        is_active=tenant.is_active,
        whatsapp_phone_id=tenant.whatsapp_phone_id,
        created_at=tenant.created_at,
        updated_at=tenant.updated_at,
        deleted_at=tenant.deleted_at,
        owner=owner_info,
    )


# ─── PATCH /admin/tenants/{id}/status ────────────────────────────────────────

@router.patch(
    "/tenants/{tenant_id}/status",
    response_model=TenantDetail,
    summary="Changer le statut d'une boutique (valider/bloquer/rejeter)",
)
def update_tenant_status(
    tenant_id: uuid.UUID,
    payload: TenantStatusUpdate,
    admin: AdminUser,
    db: DB,
) -> TenantDetail:
    """
    Change le statut d'une boutique :
    - `active`   → boutique validée, le propriétaire peut se connecter
    - `blocked`  → boutique suspendue (ex : non-paiement, abus)
    - `rejected` → demande refusée (boutique ne peut pas se connecter)
    - `pending`  → remet en attente de validation
    """
    try:
        new_status = TenantStatusEnum(payload.status)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Statut invalide : {payload.status}. Valeurs acceptées : pending, active, blocked, rejected",
        )

    tenant = _get_tenant_or_404(tenant_id, db)
    old_status = tenant.status.value if hasattr(tenant.status, "value") else tenant.status

    tenant.status = new_status
    # is_active reflète si la boutique peut opérer
    tenant.is_active = (new_status == TenantStatusEnum.active)

    db.commit()
    db.refresh(tenant)

    # Envoyer l'email de notification au propriétaire de la boutique
    owner = _get_tenant_owner(tenant, db)
    if owner and owner.email:
        try:
            if new_status == TenantStatusEnum.active:
                send_account_approved_email(owner.email, tenant.name)
            elif new_status == TenantStatusEnum.rejected:
                send_account_rejected_email(owner.email, tenant.name, payload.note)
            elif new_status == TenantStatusEnum.blocked:
                send_account_blocked_email(owner.email, tenant.name, payload.note)
        except Exception as e:
            logger.warning("Impossible d'envoyer l'email de notification statut à %s : %s", owner.email, str(e))

    logger.info(
        "Admin %s a changé le statut de %s : %s → %s. Note: %s",
        admin.email, tenant.slug, old_status, payload.status,
        payload.note or "(aucune)",
    )

    return get_tenant_detail(tenant_id, admin, db)


# ─── PATCH /admin/tenants/{id}/plan ──────────────────────────────────────────

@router.patch(
    "/tenants/{tenant_id}/plan",
    response_model=TenantDetail,
    summary="Changer le plan d'abonnement d'une boutique",
)
def update_tenant_plan(
    tenant_id: uuid.UUID,
    payload: TenantPlanUpdate,
    admin: AdminUser,
    db: DB,
) -> TenantDetail:
    """Change le plan d'abonnement d'une boutique (freemium/starter/pro)."""
    try:
        new_plan = PlanEnum(payload.plan)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Plan invalide : {payload.plan}. Valeurs acceptées : freemium, starter, pro",
        )

    tenant = _get_tenant_or_404(tenant_id, db)
    old_plan = tenant.plan.value if hasattr(tenant.plan, "value") else tenant.plan

    tenant.plan = new_plan
    db.commit()
    db.refresh(tenant)

    logger.info(
        "Admin %s a changé le plan de %s : %s → %s",
        admin.email, tenant.slug, old_plan, payload.plan,
    )

    return get_tenant_detail(tenant_id, admin, db)


# ─── DELETE /admin/tenants/{id} ──────────────────────────────────────────────

@router.delete(
    "/tenants/{tenant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer (soft delete) une boutique",
)
def delete_tenant(
    tenant_id: uuid.UUID,
    admin: AdminUser,
    db: DB,
) -> None:
    """
    Soft delete d'une boutique (deleted_at = now).
    La boutique et ses utilisateurs ne peuvent plus se connecter.
    Les données sont conservées pour audit.
    """
    tenant = _get_tenant_or_404(tenant_id, db)

    tenant.deleted_at = datetime.now(timezone.utc)
    tenant.is_active = False
    db.commit()

    logger.info("Admin %s a supprimé la boutique %s (soft delete)", admin.email, tenant.slug)


# ─── GET /admin/notifications ─────────────────────────────────────────────────

@router.get(
    "/notifications",
    response_model=list[AdminNotificationResponse],
    summary="Notifications admin (inscriptions en attente, etc.)",
)
def get_admin_notifications(
    _: AdminUser,
    db: DB,
    unread_only: bool = Query(False, description="Uniquement les non lues"),
    limit: int = Query(50, ge=1, le=200),
) -> list[AdminNotificationResponse]:
    """Retourne les notifications de l'équipe admin (dernières inscriptions, etc.)."""
    query = db.query(AdminNotification)
    if unread_only:
        query = query.filter(AdminNotification.is_read.is_(False))

    notifications = query.order_by(AdminNotification.created_at.desc()).limit(limit).all()

    result = []
    for notif in notifications:
        tenant_name = None
        tenant_slug = None
        if notif.tenant_id:
            t = db.query(Tenant).filter(Tenant.id == notif.tenant_id).first()
            if t:
                tenant_name = t.name
                tenant_slug = t.slug
        result.append(AdminNotificationResponse(
            id=notif.id,
            type=notif.type.value if hasattr(notif.type, "value") else notif.type,
            title=notif.title,
            message=notif.message,
            tenant_id=notif.tenant_id,
            tenant_name=tenant_name,
            tenant_slug=tenant_slug,
            is_read=notif.is_read,
            created_at=notif.created_at,
        ))
    return result


# ─── PATCH /admin/notifications/{id}/read ─────────────────────────────────────

@router.patch(
    "/notifications/{notification_id}/read",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Marquer une notification comme lue",
)
def mark_notification_read(
    notification_id: uuid.UUID,
    _: AdminUser,
    db: DB,
) -> None:
    """Marque une notification admin comme lue."""
    notif = db.query(AdminNotification).filter(AdminNotification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification introuvable")
    notif.is_read = True
    db.commit()


# ─── POST /admin/users ────────────────────────────────────────────────────────

@router.post(
    "/users",
    response_model=AdminUserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un compte administrateur BoutikFlow",
)
def create_admin_user(
    payload: CreateAdminUserRequest,
    admin: AdminUser,
    db: DB,
) -> AdminUserResponse:
    """
    Crée un compte administrateur BoutikFlow.
    Le compte admin n'appartient à aucune boutique (tenant_id = uuid système).
    """
    # Vérifier unicité email parmi les admins
    existing = db.query(User).filter(
        and_(User.email == payload.email, User.role == RoleEnum.admin, User.deleted_at.is_(None))
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte admin avec cet email existe déjà",
        )

    # Tenant système pour les admins (créé à la volée si besoin)
    ADMIN_TENANT_SLUG = "boutikflow-admin"
    admin_tenant = db.query(Tenant).filter(Tenant.slug == ADMIN_TENANT_SLUG).first()
    if not admin_tenant:
        admin_tenant = Tenant(
            id=uuid.uuid4(),
            name="BoutikFlow Admin",
            slug=ADMIN_TENANT_SLUG,
            plan=PlanEnum.pro,
            status=TenantStatusEnum.active,
            is_active=True,
        )
        db.add(admin_tenant)
        db.flush()

    new_admin = User(
        id=uuid.uuid4(),
        tenant_id=admin_tenant.id,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=RoleEnum.admin,
        is_active=True,
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)

    logger.info("Admin %s a créé un nouveau compte admin : %s", admin.email, payload.email)

    return AdminUserResponse(
        id=new_admin.id,
        email=new_admin.email,
        full_name=new_admin.full_name,
        role=new_admin.role.value if hasattr(new_admin.role, "value") else new_admin.role,
        is_active=new_admin.is_active,
        created_at=new_admin.created_at,
    )
