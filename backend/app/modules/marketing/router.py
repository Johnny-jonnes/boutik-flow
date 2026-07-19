import uuid
import logging
from typing import Annotated
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.core.database import get_db
from app.core.deps import get_current_user, CurrentUser
from app.modules.marketing.models import Campaign, CampaignStatusEnum
from app.modules.marketing.schemas import (
    CampaignCreate,
    CampaignUpdate,
    CampaignResponse,
    CampaignListResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/campaigns", tags=["Marketing - Campagnes"])

@router.get(
    "",
    response_model=CampaignListResponse,
    summary="Lister les campagnes marketing",
)
def list_campaigns(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
) -> CampaignListResponse:
    query = db.query(Campaign).filter(
        and_(
            Campaign.tenant_id == current_user.tenant_id,
            Campaign.deleted_at.is_(None)
        )
    )
    total = query.count()
    items = query.order_by(Campaign.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    
    return CampaignListResponse(
        items=[CampaignResponse.model_validate(c) for c in items],
        total=total,
        page=page,
        per_page=per_page,
    )

@router.post(
    "",
    response_model=CampaignResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer une campagne",
)
def create_campaign(
    payload: CampaignCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> CampaignResponse:
    campaign = Campaign(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        name=payload.name,
        segment_id=payload.segment_id,
        channel=payload.channel,
        message=payload.message,
        status=payload.status,
        scheduled_at=payload.scheduled_at,
    )
    
    # Si le statut est envoyé immédiatement, on met à jour la date d'envoi
    if payload.status == CampaignStatusEnum.envoyee:
        campaign.sent_at = datetime.now(timezone.utc)
        
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return CampaignResponse.model_validate(campaign)

@router.put(
    "/{campaign_id}",
    response_model=CampaignResponse,
    summary="Modifier une campagne",
)
def update_campaign(
    campaign_id: uuid.UUID,
    payload: CampaignUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> CampaignResponse:
    campaign = db.query(Campaign).filter(
        and_(
            Campaign.id == campaign_id,
            Campaign.tenant_id == current_user.tenant_id,
            Campaign.deleted_at.is_(None)
        )
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campagne introuvable")
        
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(campaign, field, value)
        
    if payload.status == CampaignStatusEnum.envoyee and not campaign.sent_at:
        campaign.sent_at = datetime.now(timezone.utc)
        
    db.commit()
    db.refresh(campaign)
    return CampaignResponse.model_validate(campaign)

@router.delete(
    "/{campaign_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer une campagne",
)
def delete_campaign(
    campaign_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    campaign = db.query(Campaign).filter(
        and_(
            Campaign.id == campaign_id,
            Campaign.tenant_id == current_user.tenant_id,
            Campaign.deleted_at.is_(None)
        )
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campagne introuvable")
        
    campaign.deleted_at = datetime.now(timezone.utc)
    db.commit()
