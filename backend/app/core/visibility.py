"""
Masquage des chiffres financiers par rôle (marge, prix d'achat, CA, module
Finance) — activable par le propriétaire depuis les paramètres boutique
(Tenant.hidden_financial_roles, voir PUT /auth/tenant/financial-visibility).

Appliqué strictement côté serveur : les champs concernés sont omis de la
réponse (jamais seulement masqués à l'affichage), pour rester impossible à
contourner depuis le navigateur.
"""
import uuid

from sqlalchemy.orm import Session

from app.modules.auth.models import Tenant

# owner/admin ne peuvent jamais être masqués, même ajoutés par erreur à
# hidden_financial_roles — ce sont les seuls rôles qui configurent ce
# réglage, se le masquer à eux-mêmes n'aurait aucun sens.
_NEVER_HIDDEN = {"owner", "admin"}


def financials_hidden_for(db: Session, tenant_id: uuid.UUID, role: str | None) -> bool:
    role_key = (role or "").strip().lower()
    if role_key in _NEVER_HIDDEN:
        return False
    hidden_roles = db.query(Tenant.hidden_financial_roles).filter(Tenant.id == tenant_id).scalar()
    return role_key in (hidden_roles or [])
