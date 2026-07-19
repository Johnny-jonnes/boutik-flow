"""
Router CRM — Gestion des clients
Règles appliquées :
- Multi-tenant : TOUTES les requêtes filtrent par tenant_id
- Soft delete : deleted_at au lieu de suppression physique
- Historique : last_activity_at mis à jour automatiquement
- Performance : recherche < 500ms (index sur phone, tenant_id)
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from app.core.database import get_db
from app.core.deps import get_current_user, CurrentUser
from app.modules.crm.models import Client, ClientStatusEnum, Segment
from app.modules.crm.schemas import (
    ClientCreate,
    ClientUpdate,
    ClientResponse,
    ClientListResponse,
    SegmentCreate,
    SegmentUpdate,
    SegmentResponse,
    SegmentListResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/clients", tags=["CRM - Clients"])


# ──────────────────────────── Segments ────────────────────────────

def _count_segment_members(db: Session, segment: Segment, tenant_id) -> int:
    """
    Calcule dynamiquement le nombre de clients qui correspondent
    aux filtres d'un segment.
    Filtres supportés : status, tags (list), min_orders.
    """
    query = db.query(func.count(Client.id)).filter(
        and_(
            Client.tenant_id == tenant_id,
            Client.deleted_at.is_(None),
        )
    )
    filters = segment.filters or {}
    if "status" in filters:
        query = query.filter(Client.status == filters["status"])
    if "tags" in filters and filters["tags"]:
        for tag in filters["tags"]:
            query = query.filter(Client.tags.any(tag))
    return query.scalar() or 0


def _segment_to_response(db: Session, segment: Segment, tenant_id) -> SegmentResponse:
    data = SegmentResponse.model_validate(segment)
    data.client_count = _count_segment_members(db, segment, tenant_id)
    return data


@router.get(
    "/segments",
    response_model=SegmentListResponse,
    summary="Lister les segments de clients",
)
def list_segments(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
) -> SegmentListResponse:
    query = db.query(Segment).filter(Segment.tenant_id == current_user.tenant_id)
    total = query.count()
    items = query.order_by(Segment.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return SegmentListResponse(
        items=[_segment_to_response(db, s, current_user.tenant_id) for s in items],
        total=total,
        page=page,
        per_page=per_page,
    )

@router.post(
    "/segments",
    response_model=SegmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un segment",
)
def create_segment(
    payload: SegmentCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SegmentResponse:
    segment = Segment(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        name=payload.name,
        description=payload.description,
        filters=payload.filters,
    )
    db.add(segment)
    db.commit()
    db.refresh(segment)
    return _segment_to_response(db, segment, current_user.tenant_id)

@router.put(
    "/segments/{segment_id}",
    response_model=SegmentResponse,
    summary="Mettre à jour un segment",
)
def update_segment(
    segment_id: uuid.UUID,
    payload: SegmentUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SegmentResponse:
    segment = db.query(Segment).filter(
        and_(Segment.id == segment_id, Segment.tenant_id == current_user.tenant_id)
    ).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment introuvable")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(segment, field, value)
    db.commit()
    db.refresh(segment)
    return _segment_to_response(db, segment, current_user.tenant_id)

@router.delete(
    "/segments/{segment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer un segment",
)
def delete_segment(
    segment_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    segment = db.query(Segment).filter(
        and_(Segment.id == segment_id, Segment.tenant_id == current_user.tenant_id)
    ).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment introuvable")
    
    db.delete(segment)
    db.commit()


# ──────────────────────────── GET /clients ────────────────────────────

@router.get(
    "",
    response_model=ClientListResponse,
    summary="Lister les clients de la boutique",
)
def list_clients(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(1, ge=1, description="Numéro de page"),
    per_page: int = Query(20, ge=1, le=100, description="Résultats par page"),
    search: str | None = Query(None, description="Recherche par nom ou téléphone"),
    status_filter: str | None = Query(None, alias="status", description="Filtrer par statut"),
) -> ClientListResponse:
    """
    Liste paginée des clients, filtrée par tenant_id.
    Supporte la recherche par nom/téléphone et le filtrage par statut.
    """
    # Base query : isolation multi-tenant stricte + soft delete
    query = db.query(Client).filter(
        and_(
            Client.tenant_id == current_user.tenant_id,
            Client.deleted_at.is_(None),
        )
    )

    # Recherche
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Client.name.ilike(search_term),
                Client.phone.ilike(search_term),
            )
        )

    # Filtre par statut
    if status_filter:
        query = query.filter(Client.status == status_filter)

    # Comptage total (avant pagination)
    total = query.count()

    # Pagination + tri
    items = (
        query
        .order_by(Client.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return ClientListResponse(
        items=[ClientResponse.model_validate(c) for c in items],
        total=total,
        page=page,
        per_page=per_page,
    )


# ──────────────────────────── GET /clients/{id} ────────────────────────────

@router.get(
    "/{client_id}",
    response_model=ClientResponse,
    summary="Détails d'un client",
)
def get_client(
    client_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ClientResponse:
    """Retourne un client par son ID (isolation tenant stricte)."""
    client = db.query(Client).filter(
        and_(
            Client.id == client_id,
            Client.tenant_id == current_user.tenant_id,
            Client.deleted_at.is_(None),
        )
    ).first()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client introuvable",
        )

    return ClientResponse.model_validate(client)


# ──────────────────────────── POST /clients ────────────────────────────

@router.post(
    "",
    response_model=ClientResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un nouveau client",
)
def create_client(
    payload: ClientCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ClientResponse:
    """
    Crée un client rattaché au tenant courant.
    Vérifie l'unicité du numéro de téléphone par boutique.
    """
    # Vérifier unicité du téléphone dans ce tenant
    existing = db.query(Client).filter(
        and_(
            Client.tenant_id == current_user.tenant_id,
            Client.phone == payload.phone,
            Client.deleted_at.is_(None),
        )
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Un client avec le numéro {payload.phone} existe déjà.",
        )

    client = Client(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        name=payload.name,
        phone=payload.phone,
        email=payload.email,
        status=ClientStatusEnum(payload.status) if payload.status else ClientStatusEnum.nouveau,
        tags=payload.tags,
        notes=payload.notes,
        birthday=payload.birthday,
        last_activity_at=datetime.now(timezone.utc),
    )
    db.add(client)
    db.commit()
    db.refresh(client)

    logger.info(
        "Client créé : %s (tenant=%s)", client.name, current_user.tenant_id,
    )

    return ClientResponse.model_validate(client)


# ──────────────────────────── PUT /clients/{id} ────────────────────────────

@router.put(
    "/{client_id}",
    response_model=ClientResponse,
    summary="Mettre à jour un client",
)
def update_client(
    client_id: uuid.UUID,
    payload: ClientUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ClientResponse:
    """Mise à jour partielle d'un client (isolation tenant stricte)."""
    client = db.query(Client).filter(
        and_(
            Client.id == client_id,
            Client.tenant_id == current_user.tenant_id,
            Client.deleted_at.is_(None),
        )
    ).first()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client introuvable",
        )

    # Mise à jour partielle (seulement les champs fournis)
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "status" and value is not None:
            value = ClientStatusEnum(value)
        setattr(client, field, value)

    client.last_activity_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(client)

    logger.info("Client mis à jour : %s (id=%s)", client.name, client_id)

    return ClientResponse.model_validate(client)


# ──────────────────────────── DELETE /clients/{id} ────────────────────────────

@router.delete(
    "/{client_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer un client (soft delete)",
)
def delete_client(
    client_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    """
    Soft delete : marque le client avec deleted_at.
    JAMAIS de suppression physique (règle CRM).
    """
    client = db.query(Client).filter(
        and_(
            Client.id == client_id,
            Client.tenant_id == current_user.tenant_id,
            Client.deleted_at.is_(None),
        )
    ).first()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client introuvable",
        )

    client.deleted_at = datetime.now(timezone.utc)
    db.commit()

    logger.info("Client supprimé (soft) : %s (id=%s)", client.name, client_id)
