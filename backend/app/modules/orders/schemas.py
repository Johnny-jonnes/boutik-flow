"""
Schémas Pydantic v2 — Module Commandes
Validation des commandes et lignes de commande.
"""
import uuid
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class OrderItemCreate(BaseModel):
    """Ligne de commande à la création."""
    product_id: uuid.UUID
    quantity: int = Field(..., gt=0)
    # On ne demande pas le prix, il est récupéré depuis le produit côté serveur.


class OrderCreate(BaseModel):
    """Création d'une commande (client_id optionnel pour la caisse rapide)."""
    client_id: uuid.UUID | str | None = Field(None, description="ID du client (optionnel)")
    status: str | None = Field(None, description="Statut initial: pending | confirmed | delivered")
    notes: str | None = Field(None, max_length=2000)
    items: list[OrderItemCreate] = Field(..., min_length=1, description="Au moins un produit requis")
    discount: Decimal = Field(
        Decimal("0"), ge=0,
        description="Remise globale sur la vente, déduite du total et de la transaction financière automatique",
    )
    payment_method: str | None = Field(None, max_length=50, description="cash | orange_money | card | transfer...")
    # Vente à crédit uniquement : ce qui est réellement encaissé à la
    # vente (absent ou égal au total net = vente comptant classique,
    # comportement inchangé pour tout appelant qui ne l'envoie pas ; 0 =
    # différé total ; entre les deux = paiement partiel). Le reste devient
    # une dette créée dans la même transaction que la commande.
    amount_paid_now: Decimal | None = Field(None, ge=0, description="Montant réellement encaissé à la vente (vente à crédit)")
    # Posé à True uniquement par le rejeu de la file de synchronisation
    # hors-ligne : une vente déjà annoncée au client (reçu imprimé,
    # paiement encaissé) pendant une coupure ne doit jamais être rejetée
    # après coup pour un désaccord de stock — le stock est alors autorisé
    # à devenir négatif plutôt que de perdre la vente.
    allow_stock_shortage: bool = Field(False, description="Autorise un stock négatif (rejeu hors-ligne)")

    @field_validator("client_id", mode="before")
    @classmethod
    def validate_client_id(cls, v):
        if not v or v == "null" or v == "undefined":
            return None
        if isinstance(v, uuid.UUID):
            return v
        if isinstance(v, str):
            try:
                return uuid.UUID(v)
            except ValueError:
                return None
        return None


class OrderUpdateStatus(BaseModel):
    """Mise à jour du statut d'une commande."""
    status: str = Field(..., description="pending | confirmed | delivered | cancelled")
    note: str | None = Field(None, description="Raison du changement de statut (optionnel)")


class OrderReturnItemRequest(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(..., gt=0)


class OrderReturnRequest(BaseModel):
    items: list[OrderReturnItemRequest] = Field(..., min_length=1)
    reason: str = Field(..., min_length=2, max_length=500)
    restock_inventory: bool = Field(True, description="Réintégrer les articles retournés en stock")


class OrderItemResponse(BaseModel):
    """Ligne de commande retournée."""
    id: uuid.UUID
    product_id: uuid.UUID
    product_name: str | None = None
    quantity: int
    unit_price: Decimal

    model_config = {"from_attributes": True}


class OrderResponse(BaseModel):
    """Commande retournée par l'API."""
    id: uuid.UUID
    tenant_id: uuid.UUID
    client_id: uuid.UUID
    client_name: str | None = None
    created_by: uuid.UUID | None = None
    created_by_name: str | None = None
    status: str
    total: Decimal
    notes: str | None
    payment_method: str | None = None
    # Part réellement encaissée à la vente pour une vente à crédit (Phase 4) —
    # None pour une vente comptant classique. Le reçu et l'historique des
    # ventes s'en servent pour afficher "Payé maintenant" / "Reste dû" au
    # lieu de laisser croire que `total` a été intégralement encaissé.
    amount_paid_now: Decimal | None = None
    # Cumul remboursé sur cette commande (voir POST /orders/{id}/return) —
    # jamais soustrait de `total` lui-même. is_returned/is_partially_returned
    # sont dérivés, jamais stockés, pour ne jamais diverger des vraies
    # transactions de remboursement.
    returned_amount: Decimal = Decimal("0")
    is_returned: bool = False
    is_partially_returned: bool = False
    # Renseigné uniquement par POST /orders quand cette vente crée une dette
    # (voir create_client_debt) — permet à la synchronisation hors-ligne de
    # réconcilier l'id local de la dette (créée en miroir avant la
    # synchronisation) avec son vrai id serveur, exactement comme le fait
    # déjà OfflineQueue.replaceMatching pour l'id de la commande elle-même.
    # None partout ailleurs (liste, détail...) : jamais résolu a posteriori.
    debt_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime
    # Présent uniquement pour une synchronisation incrémentale (voir
    # updated_since sur GET /orders) : signale au client qu'il doit retirer
    # cette commande de son cache local plutôt que la mettre à jour.
    deleted_at: datetime | None = None
    items: list[OrderItemResponse]

    model_config = {"from_attributes": True}


class OrderListResponse(BaseModel):
    """Liste paginée de commandes."""
    items: list[OrderResponse]
    total: int
    page: int
    per_page: int
