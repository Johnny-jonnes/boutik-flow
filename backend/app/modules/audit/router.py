"""
Routeur FastAPI — Module Audit
Réservé aux propriétaires / gérants de la boutique.
"""
from typing import Annotated
import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.core.database import get_db
from app.core.deps import require_owner_or_manager, CurrentUser
from app.modules.audit.models import AuditLog
from app.modules.audit.schemas import AuditLogResponse, AuditLogListResponse, AuditLogCreate


router = APIRouter(prefix="/audit", tags=["Audit & Traçabilité"])


def log_action(
    db: Session,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID | None,
    user_email: str | None,
    action: str,
    target_entity: str | None = None,
    target_id: str | None = None,
    details: str | None = None,
):
    """Fonction utilitaire pour ajouter une entrée d'audit."""
    try:
        entry = AuditLog(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            user_id=user_id,
            user_email=user_email,
            action=action,
            target_entity=target_entity,
            target_id=target_id,
            details=details,
        )
        db.add(entry)
        db.flush()
    except Exception as e:
        print(f"Erreur d'enregistrement d'audit : {e}")


@router.get(
    "",
    response_model=AuditLogListResponse,
    summary="Consulter le journal d'audit (Propriétaire & Gérant)",
)
def list_audit_logs(
    current_user: Annotated[CurrentUser, Depends(require_owner_or_manager)],
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    action: str | None = Query(None),
    user_email: str | None = Query(None),
) -> AuditLogListResponse:
    query = db.query(AuditLog).filter(AuditLog.tenant_id == current_user.tenant_id)

    if action:
        query = query.filter(AuditLog.action == action)
    if user_email:
        query = query.filter(AuditLog.user_email.ilike(f"%{user_email}%"))

    total = query.count()
    items = (
        query
        .order_by(AuditLog.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return AuditLogListResponse(
        items=[AuditLogResponse.model_validate(log) for log in items],
        total=total,
        page=page,
        per_page=per_page,
    )
