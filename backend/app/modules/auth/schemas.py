"""
Schémas Pydantic v2 — Module Auth
Validation stricte des entrées/sorties API.
"""
import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator
import re


# ──────────────────────────── Register ────────────────────────────

class RegisterRequest(BaseModel):
    """Création simultanée d'une boutique (tenant) + propriétaire."""
    boutique_name: str = Field(..., min_length=2, max_length=255, description="Nom de la boutique")
    boutique_slug: str = Field(..., min_length=2, max_length=100, description="Identifiant URL unique")
    full_name: str = Field(..., min_length=2, max_length=255, description="Nom complet du propriétaire")
    email: EmailStr = Field(..., description="Email du propriétaire")
    password: str = Field(..., min_length=8, max_length=128, description="Mot de passe sécurisé")
    phone: str | None = Field(None, max_length=20, description="Téléphone optionnel")

    @field_validator("boutique_slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        if not re.match(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$", v):
            raise ValueError("Le slug ne doit contenir que des lettres minuscules, chiffres et tirets")
        return v.lower()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Le mot de passe doit contenir au moins une majuscule")
        if not re.search(r"[0-9]", v):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre")
        return v


# ──────────────────────────── Login ────────────────────────────

class LoginRequest(BaseModel):
    """Connexion avec slug de boutique + email + mot de passe."""
    boutique_slug: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


# ──────────────────────────── Token ────────────────────────────

class TokenResponse(BaseModel):
    """Réponse d'authentification avec access + refresh tokens."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class RefreshTokenRequest(BaseModel):
    """Demande de renouvellement de token."""
    refresh_token: str


# ──────────────────────────── User Response ────────────────────────────

class UserResponse(BaseModel):
    """Données utilisateur retournées par l'API (jamais de mot de passe)."""
    id: uuid.UUID
    tenant_id: uuid.UUID
    email: str
    full_name: str | None
    phone: str | None
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TenantResponse(BaseModel):
    """Données boutique retournées par l'API."""
    id: uuid.UUID
    name: str
    slug: str
    plan: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
