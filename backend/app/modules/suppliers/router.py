"""
Router Fournisseurs — Module Suppliers
"""
import uuid
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.core.database import get_db
from app.core.deps import get_current_user, CurrentUser
from app.modules.suppliers.models import Supplier
from app.modules.suppliers.schemas import (
    SupplierCreate,
    SupplierUpdate,
    SupplierResponse,
    SupplierListResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/suppliers", tags=["Catalogue - Fournisseurs"])


@router.get(
    "",
    response_model=SupplierListResponse,
    summary="Lister les fournisseurs",
)
def list_suppliers(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
) -> SupplierListResponse:
    query = db.query(Supplier).filter(Supplier.tenant_id == current_user.tenant_id)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Supplier.name.ilike(search_term),
                Supplier.company.ilike(search_term),
                Supplier.email.ilike(search_term),
            )
        )
        
    total = query.count()
    items = query.order_by(Supplier.name.asc()).offset((page - 1) * per_page).limit(per_page).all()
    
    return SupplierListResponse(
        items=[SupplierResponse.model_validate(s) for s in items],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get(
    "/{supplier_id}",
    response_model=SupplierResponse,
    summary="Détails d'un fournisseur",
)
def get_supplier(
    supplier_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SupplierResponse:
    supplier = db.query(Supplier).filter(
        and_(
            Supplier.id == supplier_id,
            Supplier.tenant_id == current_user.tenant_id,
        )
    ).first()
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")
        
    return SupplierResponse.model_validate(supplier)


@router.post(
    "",
    response_model=SupplierResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un fournisseur",
)
def create_supplier(
    payload: SupplierCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SupplierResponse:
    supplier = Supplier(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        **payload.model_dump()
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return SupplierResponse.model_validate(supplier)


@router.put(
    "/{supplier_id}",
    response_model=SupplierResponse,
    summary="Mettre à jour un fournisseur",
)
def update_supplier(
    supplier_id: uuid.UUID,
    payload: SupplierUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SupplierResponse:
    supplier = db.query(Supplier).filter(
        and_(
            Supplier.id == supplier_id,
            Supplier.tenant_id == current_user.tenant_id,
        )
    ).first()
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")
        
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(supplier, field, value)
        
    db.commit()
    db.refresh(supplier)
    return SupplierResponse.model_validate(supplier)


@router.delete(
    "/{supplier_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer un fournisseur",
)
def delete_supplier(
    supplier_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    supplier = db.query(Supplier).filter(
        and_(
            Supplier.id == supplier_id,
            Supplier.tenant_id == current_user.tenant_id,
        )
    ).first()
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")
        
    db.delete(supplier)
    db.commit()
