"""
Supprime toutes les données synthétiques générées pour les tests de charge
(tenants dont le slug commence par `lt-`), y compris les commandes/dettes/
transactions créées PENDANT l'exécution des scénarios k6 (POST /orders,
POST /crm/debts/pay, etc. — pas seulement les données de seed initiales).

Usage :
    cd backend && python ../load-tests/data/cleanup_synthetic_data.py [prefix]

Sans argument, nettoie TOUS les tenants `lt-*` trouvés en base (filet de
sécurité si un run précédent n'a pas été nettoyé). Avec un préfixe explicite
(ex: `lt-a1b2c3d4`), ne touche que ce run précis.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))
import app.main  # noqa

from app.core.database import BypassSessionLocal
from app.modules.auth.models import Tenant, User, AdminNotification
from app.modules.products.models import Product, Category, Order, OrderItem, OrderLog, InventoryLog
from app.modules.crm.models import Client
from app.modules.crm.debt_models import ClientDebt, DebtPayment
from app.modules.finance.models import FinancialTransaction
from app.modules.audit.models import AuditLog
from app.core.idempotency import IdempotencyKey


def main():
    prefix = sys.argv[1] if len(sys.argv) > 1 else "lt-"
    db = BypassSessionLocal()

    tenant_rows = db.query(Tenant.id, Tenant.slug).filter(Tenant.slug.like(f"{prefix}%")).all()
    tenant_ids = [t.id for t in tenant_rows]
    print(f"Trouvé {len(tenant_ids)} boutique(s) synthétique(s) (préfixe='{prefix}').")
    if not tenant_ids:
        db.close()
        return

    order_ids = [o.id for o in db.query(Order.id).filter(Order.tenant_id.in_(tenant_ids)).all()]
    debt_ids = [d.id for d in db.query(ClientDebt.id).filter(ClientDebt.tenant_id.in_(tenant_ids)).all()]
    product_ids = [p.id for p in db.query(Product.id).filter(Product.tenant_id.in_(tenant_ids)).all()]

    if debt_ids:
        db.query(DebtPayment).filter(DebtPayment.debt_id.in_(debt_ids)).delete(synchronize_session=False)
    if order_ids:
        db.query(OrderItem).filter(OrderItem.order_id.in_(order_ids)).delete(synchronize_session=False)
        db.query(OrderLog).filter(OrderLog.order_id.in_(order_ids)).delete(synchronize_session=False)
    if product_ids:
        db.query(InventoryLog).filter(InventoryLog.product_id.in_(product_ids)).delete(synchronize_session=False)
    if debt_ids:
        db.query(ClientDebt).filter(ClientDebt.id.in_(debt_ids)).delete(synchronize_session=False)
    if order_ids:
        db.query(Order).filter(Order.id.in_(order_ids)).delete(synchronize_session=False)

    db.query(FinancialTransaction).filter(FinancialTransaction.tenant_id.in_(tenant_ids)).delete(synchronize_session=False)
    db.query(IdempotencyKey).filter(IdempotencyKey.tenant_id.in_(tenant_ids)).delete(synchronize_session=False)
    db.query(AuditLog).filter(AuditLog.tenant_id.in_(tenant_ids)).delete(synchronize_session=False)
    db.query(AdminNotification).filter(AdminNotification.tenant_id.in_(tenant_ids)).delete(synchronize_session=False)
    db.query(Client).filter(Client.tenant_id.in_(tenant_ids)).delete(synchronize_session=False)
    db.query(Product).filter(Product.tenant_id.in_(tenant_ids)).delete(synchronize_session=False)
    db.query(Category).filter(Category.tenant_id.in_(tenant_ids)).delete(synchronize_session=False)
    db.query(User).filter(User.tenant_id.in_(tenant_ids)).delete(synchronize_session=False)
    db.query(Tenant).filter(Tenant.id.in_(tenant_ids)).delete(synchronize_session=False)

    db.commit()
    db.close()
    print(f"Nettoyage terminé : {len(tenant_ids)} boutique(s), {len(order_ids)} commande(s), "
          f"{len(debt_ids)} dette(s), {len(product_ids)} produit(s) supprimés.")


if __name__ == "__main__":
    main()
