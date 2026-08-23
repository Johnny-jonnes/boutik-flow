"""
Idempotence des écritures critiques (ventes, transactions, dettes).

Avec une connexion instable — pas seulement coupée — une requête peut tout
à fait atteindre le serveur et être traitée avec succès, mais voir sa
réponse se perdre en chemin ou expirer côté client. Le client, ne sachant
pas si la requête a réellement été prise en compte, la retente (retry
manuel, ou rejeu automatique de la file de synchronisation hors-ligne).
Sans protection, cela crée une VRAIE commande, transaction ou dette en
double côté serveur.

Le client envoie un en-tête `Idempotency-Key` stable (le même à chaque
tentative d'une même action utilisateur). Le serveur associe la première
réponse réussie à cette clé ; toute requête ultérieure avec la même clé
reçoit la réponse déjà enregistrée au lieu de recréer la ressource.
"""
import uuid
from typing import Annotated, Any

from fastapi import Header
from sqlalchemy import Column, String, DateTime, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import Base


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"
    __table_args__ = (
        UniqueConstraint("tenant_id", "endpoint", "key", name="uq_idempotency_tenant_endpoint_key"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    endpoint = Column(String(100), nullable=False)
    key = Column(String(200), nullable=False)
    status_code = Column(String(10), nullable=False)
    response_body = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# En-tête optionnel : les endpoints qui ne le déclarent pas ignorent
# simplement l'idempotence, aucun changement de comportement pour eux.
IdempotencyHeader = Annotated[str | None, Header(alias="Idempotency-Key")]


def get_cached_response(
    db: Session, tenant_id: uuid.UUID, endpoint: str, key: str | None
) -> tuple[int, Any] | None:
    """Retourne (status_code, corps) si cette clé a déjà été traitée avec succès."""
    if not key:
        return None
    row = (
        db.query(IdempotencyKey)
        .filter(
            IdempotencyKey.tenant_id == tenant_id,
            IdempotencyKey.endpoint == endpoint,
            IdempotencyKey.key == key,
        )
        .first()
    )
    if row is None:
        return None
    return int(row.status_code), row.response_body


def store_response(
    db: Session,
    tenant_id: uuid.UUID,
    endpoint: str,
    key: str | None,
    status_code: int,
    response_body: Any,
) -> None:
    """Enregistre la réponse pour qu'une requête identique ultérieure la réutilise."""
    if not key:
        return
    entry = IdempotencyKey(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        endpoint=endpoint,
        key=key,
        status_code=str(status_code),
        response_body=response_body,
    )
    db.add(entry)
    try:
        db.commit()
    except IntegrityError:
        # Deux requêtes concurrentes avec la même clé (ex: onglet dupliqué) :
        # la première a déjà écrit la réponse de référence, rien à faire.
        db.rollback()


def store_response_atomic(
    db: Session,
    tenant_id: uuid.UUID,
    endpoint: str,
    key: str | None,
    status_code: int,
    response_body: Any,
) -> None:
    """Comme store_response, mais N'APPELLE JAMAIS commit() elle-même —
    l'ajout rejoint la transaction déjà ouverte par l'appelant, qui doit
    committer juste après (voir orders.create/debts.pay).

    Pourquoi : store_response() committe séparément, APRÈS que l'appelant
    a déjà committé sa propre écriture métier (la vente, le paiement...).
    Entre les deux commits, une requête concurrente portant la MÊME clé
    (retry après une réponse perdue sur une connexion instable — le cas
    que l'idempotence est censée couvrir) peut passer get_cached_response()
    avant que la première n'ait fini d'écrire sa ligne d'idempotence, et
    créer sa propre vente en double ; le rollback de son store_response()
    qui échoue ensuite n'annule QUE cette ligne d'idempotence, jamais la
    vente déjà committée juste avant. En ajoutant la ligne d'idempotence
    À LA MÊME transaction que l'écriture métier (un seul commit pour les
    deux), la contrainte UNIQUE (tenant_id, endpoint, key) départage les
    deux requêtes AVANT que l'une ou l'autre ne devienne visible : la
    perdante voit tout son commit (vente incluse) annulé d'un bloc,
    jamais seulement sa ligne d'idempotence — voir le bloc try/except
    IntegrityError autour de db.commit() dans l'appelant."""
    if not key:
        return
    entry = IdempotencyKey(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        endpoint=endpoint,
        key=key,
        status_code=str(status_code),
        response_body=response_body,
    )
    db.add(entry)
