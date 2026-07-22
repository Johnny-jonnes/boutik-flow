"""Schémas Pydantic — Module Suppliers"""
import uuid
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr
from typing import Optional


class SupplierCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    company: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    city: str | None = None
    country: str | None = None
    contact_person: str | None = None
    notes: str | None = None


class SupplierUpdate(BaseModel):
    name: str | None = None
    company: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    city: str | None = None
    country: str | None = None
    contact_person: str | None = None
    notes: str | None = None


class SupplierResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    company: str | None
    phone: str | None
    email: str | None
    address: str | None
    city: str | None
    country: str | None
    contact_person: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SupplierListResponse(BaseModel):
    items: list[SupplierResponse]
    total: int
    page: int
    per_page: int
