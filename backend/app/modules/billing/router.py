import uuid
import logging
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, CurrentUser
from app.core.config import settings
from app.core.mailer import _send, _build_message
from app.modules.auth.models import AdminNotification, AdminNotificationTypeEnum, Tenant, User
from .schemas import SubscriptionResponse, CheckoutRequest, CheckoutResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["Billing"])

@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    plan_name = tenant.plan.value if tenant and hasattr(tenant.plan, "value") else (tenant.plan if tenant else "freemium")
    return SubscriptionResponse(
        plan=plan_name,
        status="active" if tenant and tenant.is_active else "pending",
        expires_at=None
    )

@router.post("/checkout", response_model=CheckoutResponse)
async def initiate_checkout(
    request_data: CheckoutRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    if not request_data.phone_number:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Numéro de téléphone requis.")
    
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    tenant_name = tenant.name if tenant else "Inconnu"
    tenant_slug = tenant.slug if tenant else "inconnu"

    transaction_id = f"PRO-{uuid.uuid4().hex[:8].upper()}"

    # 1. Créer une notification pour l'administrateur dans la base de données
    admin_notif = AdminNotification(
        id=uuid.uuid4(),
        type=AdminNotificationTypeEnum.new_registration,
        message=f"Demande de changement de forfait ({request_data.plan_id.upper()}) pour la boutique '{tenant_name}' ({tenant_slug}) — Contact: {request_data.phone_number}",
        tenant_id=current_user.tenant_id,
        is_read=False,
    )
    db.add(admin_notif)
    db.commit()

    # 2. Envoyer un email de notification à l'équipe admin
    if settings.ADMIN_NOTIFICATION_EMAIL:
        subject = f"Demande de passage en version PRO — {tenant_name}"
        body = (
            f"La boutique « {tenant_name} » ({tenant_slug}) souhaite passer au forfait PRO ({request_data.plan_id.upper()}).\n\n"
            f"Numéro de contact indiqué : {request_data.phone_number}\n"
            f"Email du propriétaire : {current_user.email}\n\n"
            f"Rendez-vous dans l'espace d'administration ({settings.FRONTEND_URL}/admin) pour modifier la version de la boutique.\n\n"
            "— BoutikFlow"
        )
        try:
            _send(_build_message(settings.ADMIN_NOTIFICATION_EMAIL, subject, body), settings.ADMIN_NOTIFICATION_EMAIL)
        except Exception as e:
            logger.warning("Erreur envoi notification mail admin upgrade: %s", str(e))

    return CheckoutResponse(
        transaction_id=transaction_id,
        status="pending",
        message=f"Votre demande de passage à la version PRO ({request_data.plan_id.upper()}) a bien été envoyée à l'administration ! Un conseiller va valider le changement sous peu."
    )
