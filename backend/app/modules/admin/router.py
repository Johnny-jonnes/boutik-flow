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

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, or_, text

from app.core.database import get_bypass_db
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
DB = Annotated[Session, Depends(get_bypass_db)]


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


def _owners_by_tenant_id(tenants: list[Tenant], db: Session) -> dict[uuid.UUID, User]:
    """Résout en une seule requête le propriétaire de chaque boutique d'un
    lot — évite une requête User par boutique lors du listing admin (voir
    la même remarque déjà appliquée à _user_names_for_orders dans
    orders/router.py). Une boutique peut avoir plusieurs comptes 'owner'
    historiques (transfert de propriété) : on garde le plus ancien, comme
    le faisait déjà _get_tenant_owner via .first() sur un tri par défaut."""
    tenant_ids = [t.id for t in tenants]
    if not tenant_ids:
        return {}
    owners = db.query(User).filter(
        and_(
            User.tenant_id.in_(tenant_ids),
            User.role == RoleEnum.owner,
            User.deleted_at.is_(None),
        )
    ).order_by(User.created_at.asc()).all()
    result: dict[uuid.UUID, User] = {}
    for owner in owners:
        result.setdefault(owner.tenant_id, owner)
    return result


def _last_activity_by_tenant_id(tenants: list[Tenant], db: Session) -> dict[uuid.UUID, "datetime"]:
    """Résout en une seule requête groupée la dernière action journalisée
    (audit_logs) de chaque boutique d'un lot — même précaution anti-N+1
    que _owners_by_tenant_id ci-dessus, plutôt qu'une requête MAX() par
    boutique affichée dans la liste admin."""
    from app.modules.audit.models import AuditLog
    tenant_ids = [t.id for t in tenants]
    if not tenant_ids:
        return {}
    rows = (
        db.query(AuditLog.tenant_id, func.max(AuditLog.created_at))
        .filter(AuditLog.tenant_id.in_(tenant_ids))
        .group_by(AuditLog.tenant_id)
        .all()
    )
    return {tenant_id: last_at for tenant_id, last_at in rows}


def _build_tenant_list_item(tenant: Tenant, owner: Optional[User], last_activity_at=None) -> TenantListItem:
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
        last_activity_at=last_activity_at,
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
    activity_period: Optional[str] = Query(None, description="24h, 7j, 30j, all, custom — filtre monitoring : boutiques ayant eu au moins une activité (audit_logs) sur la période"),
    activity_start_date: Optional[str] = Query(None),
    activity_end_date: Optional[str] = Query(None),
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

    if activity_period or activity_start_date or activity_end_date:
        from app.core.period import resolve_period
        from app.modules.audit.models import AuditLog
        act_start, act_end = resolve_period(activity_period, activity_start_date, activity_end_date)
        activity_q = db.query(AuditLog.tenant_id)
        if act_start:
            activity_q = activity_q.filter(AuditLog.created_at >= act_start)
        if act_end:
            activity_q = activity_q.filter(AuditLog.created_at < act_end)
        query = query.filter(Tenant.id.in_(activity_q))

    total = query.count()
    pages = math.ceil(total / per_page) if per_page > 0 else 0
    tenants = query.order_by(Tenant.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    owners_by_tenant = _owners_by_tenant_id(tenants, db)
    activity_by_tenant = _last_activity_by_tenant_id(tenants, db)
    items = [_build_tenant_list_item(t, owners_by_tenant.get(t.id), activity_by_tenant.get(t.id)) for t in tenants]

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


# ─── GET /admin/tenants/{id}/activity ─────────────────────────────────────────
# Module de monitoring Super Admin (demandes 18-25) : à quelle fréquence une
# boutique utilise BoutikFlow, quand elle s'est connectée, quels modules elle
# utilise, et son historique d'activité récent — réservé exclusivement au
# rôle admin (AdminUser = require_admin), jamais visible ni accessible aux
# comptes d'une boutique cliente.
#
# Construit uniquement à partir de ce qui est déjà réellement journalisé
# (voir log_action dans orders/router.py, crm/debt_router.py,
# finance/router.py, et désormais /auth/login) — jamais un module qui
# n'existe plus ou n'a jamais pu écrire d'entrée d'audit n'apparaît ici.
# Ne collecte aucune donnée de frappe/contenu privé (demande 24) : action,
# horodatage, utilisateur, cible — rien de plus.

_ACTION_TO_MODULE = {
    "login": "Connexion",
    "create_sale": "Ventes",
    "return_order_items": "Ventes (retours)",
    "record_debt_payment": "Dettes",
    "create_financial_transaction": "Finances",
}


@router.get(
    "/tenants/{tenant_id}/activity",
    summary="Activité et monitoring d'une boutique (Super Admin uniquement)",
)
def get_tenant_activity(
    tenant_id: uuid.UUID,
    _: AdminUser,
    db: DB,
    period: Optional[str] = Query(None, description="24h, 7j, 30j, all, custom"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
) -> dict:
    """Vue d'activité d'une boutique : dernière connexion par utilisateur,
    modules utilisés, historique d'événements récents — pour que l'équipe
    BoutikFlow puisse répondre à "ce client utilise-t-il l'app, et
    comment ?" sans avoir besoin d'accéder aux données métier de la
    boutique elle-même."""
    from app.core.period import resolve_period
    from app.modules.audit.models import AuditLog

    tenant = _get_tenant_or_404(tenant_id, db)

    start, end = resolve_period(period, start_date, end_date)
    q = db.query(AuditLog).filter(AuditLog.tenant_id == tenant_id)
    if start:
        q = q.filter(AuditLog.created_at >= start)
    if end:
        q = q.filter(AuditLog.created_at < end)
    # Plafonné : une vue de monitoring, pas un export d'audit complet (voir
    # /audit pour l'historique intégral déjà disponible côté boutique).
    entries = q.order_by(AuditLog.created_at.desc()).limit(500).all()

    users = db.query(User).filter(
        and_(User.tenant_id == tenant_id, User.deleted_at.is_(None))
    ).order_by(User.created_at.asc()).all()

    module_counts: dict[str, int] = {}
    for e in entries:
        label = _ACTION_TO_MODULE.get(e.action, e.action)
        module_counts[label] = module_counts.get(label, 0) + 1

    active_days = len({e.created_at.date() for e in entries})
    last_login = max((u.last_login_at for u in users if u.last_login_at), default=None)

    return {
        "tenant_id": str(tenant_id),
        "tenant_name": tenant.name,
        "period": {"period": period, "start_date": start_date, "end_date": end_date},
        "last_login_at": last_login.isoformat() if last_login else None,
        "total_events": len(entries),
        "active_days": active_days,
        "modules_used": [
            {"module": k, "count": v}
            for k, v in sorted(module_counts.items(), key=lambda kv: -kv[1])
        ],
        "users": [
            {
                "id": str(u.id),
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role.value if hasattr(u.role, "value") else u.role,
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
                "is_active": u.is_active,
            }
            for u in users
        ],
        "recent_events": [
            {
                "id": str(e.id),
                "action": e.action,
                "module": _ACTION_TO_MODULE.get(e.action, e.action),
                "user_email": e.user_email,
                "target_entity": e.target_entity,
                "details": e.details,
                "created_at": e.created_at.isoformat(),
            }
            for e in entries[:50]
        ],
    }


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
    Suppression DÉFINITIVE et complète d'une boutique et de toutes ses
    données (produits, clients, commandes, finances, équipe...).

    Un précédent soft delete (deleted_at + is_active=False) désactivait
    l'accès mais laissait toutes les lignes en base — visibles dans
    Supabase, jamais réellement supprimées. Ceci est irréversible : un
    seul DELETE par table, dans l'ordre imposé par les clés étrangères
    (des tables les plus dépendantes vers la boutique elle-même), le tout
    dans une seule transaction pour ne jamais laisser une suppression
    partielle si une étape échoue.
    """
    tenant = _get_tenant_or_404(tenant_id, db)
    slug = tenant.slug
    tid = str(tenant.id)

    try:
        db.execute(text("DELETE FROM debt_payments WHERE tenant_id = CAST(:t AS uuid)"), {"t": tid})
        db.execute(text("DELETE FROM client_debts WHERE tenant_id = CAST(:t AS uuid)"), {"t": tid})
        db.execute(text("DELETE FROM order_logs WHERE tenant_id = CAST(:t AS uuid)"), {"t": tid})
        db.execute(text(
            "DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE tenant_id = CAST(:t AS uuid))"
        ), {"t": tid})
        db.execute(text("DELETE FROM inventory_logs WHERE tenant_id = CAST(:t AS uuid)"), {"t": tid})
        db.execute(text("DELETE FROM whatsapp_messages WHERE tenant_id = CAST(:t AS uuid)"), {"t": tid})
        db.execute(text("DELETE FROM orders WHERE tenant_id = CAST(:t AS uuid)"), {"t": tid})
        db.execute(text("DELETE FROM clients WHERE tenant_id = CAST(:t AS uuid)"), {"t": tid})
        db.execute(text("DELETE FROM campaigns WHERE tenant_id = CAST(:t AS uuid)"), {"t": tid})
        db.execute(text("DELETE FROM segments WHERE tenant_id = CAST(:t AS uuid)"), {"t": tid})
        db.execute(text("DELETE FROM products WHERE tenant_id = CAST(:t AS uuid)"), {"t": tid})
        db.execute(text("DELETE FROM categories WHERE tenant_id = CAST(:t AS uuid)"), {"t": tid})
        db.execute(text("DELETE FROM suppliers WHERE tenant_id = CAST(:t AS uuid)"), {"t": tid})
        db.execute(text("DELETE FROM financial_transactions WHERE tenant_id = CAST(:t AS uuid)"), {"t": tid})
        db.execute(text("DELETE FROM admin_notifications WHERE tenant_id = CAST(:t AS uuid)"), {"t": tid})
        db.execute(text("DELETE FROM audit_logs WHERE tenant_id = CAST(:t AS uuid)"), {"t": tid})
        db.execute(text("DELETE FROM ai_logs WHERE tenant_id = CAST(:t AS uuid)"), {"t": tid})
        db.execute(text("DELETE FROM idempotency_keys WHERE tenant_id = CAST(:t AS uuid)"), {"t": tid})
        db.execute(text("DELETE FROM subscriptions WHERE tenant_id = CAST(:t AS uuid)"), {"t": tid})
        db.execute(text("DELETE FROM users WHERE tenant_id = CAST(:t AS uuid)"), {"t": tid})
        db.execute(text("DELETE FROM tenants WHERE id = CAST(:t AS uuid)"), {"t": tid})
        db.commit()
    except Exception:
        db.rollback()
        raise

    logger.info("Admin %s a supprimé DÉFINITIVEMENT la boutique %s", admin.email, slug)


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
