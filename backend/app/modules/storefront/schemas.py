"""
Schémas Pydantic — Vitrine publique.

Schémas DÉDIÉS, jamais une réutilisation de ProductResponse/TenantResponse
internes : un visiteur non authentifié ne doit voir QUE ce qui est listé
ici, quels que soient les champs qui existent côté interne (cost_price,
stock exact, sku, tenant_id, etc. — jamais exposés ici, même par erreur
d'un futur ajout de champ interne qui « passerait au travers »).
"""
import uuid
from decimal import Decimal

from pydantic import BaseModel


class PublicStoreResponse(BaseModel):
    """Informations boutique visibles sur la vitrine publique."""
    name: str
    slug: str


class PublicProductResponse(BaseModel):
    """Produit tel que visible par un visiteur non authentifié — jamais de
    cost_price, stock exact, sku/barcode interne, ni aucun identifiant de
    tenant."""
    id: uuid.UUID
    name: str
    description: str | None
    price: Decimal
    category_name: str | None = None
    is_available: bool
    # Signal simple plutôt qu'une URL construite côté serveur (qui devrait
    # connaître sa propre origine publique, fragile derrière un futur proxy/
    # domaine personnalisé) — le frontend construit l'URL absolue lui-même
    # via GET /storefront/{slug}/products/{id}/image (jamais le data-URI
    # brut, voir app.core.thumbnails.decode_data_uri).
    has_image: bool = False

    model_config = {"from_attributes": True}


class PublicProductListResponse(BaseModel):
    items: list[PublicProductResponse]
    total: int
    page: int
    per_page: int
