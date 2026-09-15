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


class RegisterResponse(BaseModel):
    """
    Réponse à l'inscription : aucun token n'est émis, le compte doit d'abord
    être validé manuellement par l'équipe BoutikFlow (voir module admin).
    """
    message: str
    boutique_slug: str
    status: str


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
    # Rôles pour lesquels les chiffres financiers (marge, prix d'achat, CA,
    # module Finance) sont masqués — voir app.core.visibility et
    # PUT /auth/tenant/financial-visibility.
    hidden_financial_roles: list[str] = []
    # Personnalisation vitrine publique — voir UpdateTenantRequest ci-dessous.
    # logo en data-URI base64 (comme Product.images côté interne authentifié,
    # jamais un souci de taille ici : un seul logo par boutique, pas une liste).
    logo: str | None = None
    description: str | None = None
    theme_color: str | None = None
    public_whatsapp: str | None = None

    model_config = {"from_attributes": True}


# ──────────────────────────── Team Management ────────────────────────────

class InviteUserRequest(BaseModel):
    """Invitation d'un membre dans la boutique."""
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    phone: str | None = Field(None, max_length=20)
    role: str = Field("staff", description="Role: owner, manager, cashier, stock_manager, seller_stock_manager, staff")

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        allowed = {"owner", "manager", "cashier", "stock_manager", "seller_stock_manager", "staff"}
        if v not in allowed:
            raise ValueError(f"Rôle invalide. Rôles autorisés : {', '.join(allowed)}")
        return v


class UpdateUserRoleRequest(BaseModel):
    role: str = Field(...)

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        allowed = {"owner", "manager", "cashier", "stock_manager", "seller_stock_manager", "staff"}
        if v not in allowed:
            raise ValueError(f"Rôle invalide. Rôles autorisés : {', '.join(allowed)}")
        return v


class UpdateUserStatusRequest(BaseModel):
    is_active: bool


class TeamMemberResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    email: str
    full_name: str | None
    phone: str | None
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────── Change Password ────────────────────────────

class UpdateMeRequest(BaseModel):
    """Modification du profil de l'utilisateur connecté (self-service)."""
    full_name: str | None = Field(None, min_length=2, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=20)


class ChangeMyPasswordRequest(BaseModel):
    """Changement de son propre mot de passe — exige l'ancien pour confirmer l'identité."""
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)


class UpdateTenantRequest(BaseModel):
    """Modification des informations de la boutique (propriétaire uniquement).
    Formulaire "état complet" (comme le reste des Réglages) : le frontend
    renvoie toujours l'état courant de chaque champ, jamais de mise à jour
    partielle — description/theme_color/logo à None effacent explicitement
    la valeur en base plutôt que de la laisser inchangée par erreur."""
    name: str = Field(..., min_length=2, max_length=255)
    description: str | None = Field(None, max_length=300)
    theme_color: str | None = Field(None, description="Couleur d'accent hex, ex: #10b981")
    logo: str | None = Field(None, description="Logo en data-URI base64, None pour retirer")
    public_whatsapp: str | None = Field(None, max_length=20, description="Numéro WhatsApp affiché aux visiteurs, format E.164")

    @field_validator("theme_color")
    @classmethod
    def validate_theme_color(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not re.fullmatch(r"#[0-9A-Fa-f]{6}", v):
            raise ValueError("Couleur invalide, format attendu: #RRGGBB")
        return v

    @field_validator("public_whatsapp")
    @classmethod
    def validate_public_whatsapp(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        if not re.fullmatch(r"\+[1-9]\d{7,14}", v):
            raise ValueError("Numéro invalide, format attendu: +224620000000 (E.164)")
        return v


class UpdateFinancialVisibilityRequest(BaseModel):
    """Rôles pour lesquels masquer marge/prix d'achat/CA/module Finance
    (propriétaire uniquement) — voir app.core.visibility."""
    hidden_roles: list[str] = Field(default_factory=list)

    @field_validator("hidden_roles")
    @classmethod
    def validate_hidden_roles(cls, v: list[str]) -> list[str]:
        # owner/admin exclus explicitement : ce sont les seuls rôles qui
        # peuvent régler ce paramètre, se le masquer à eux-mêmes n'a pas
        # de sens (voir app.core.visibility._NEVER_HIDDEN).
        allowed = {"manager", "cashier", "stock_manager", "seller_stock_manager", "staff"}
        invalid = set(v) - allowed
        if invalid:
            raise ValueError(f"Rôle(s) invalide(s) pour le masquage : {', '.join(sorted(invalid))}")
        return list(dict.fromkeys(v))  # dédoublonne en préservant l'ordre


class ChangePasswordRequest(BaseModel):
    """Changement de mot de passe d'un membre de l'équipe."""
    new_password: str = Field(..., min_length=6, max_length=128, description="Nouveau mot de passe")
