"""
Script d'injection massive de données de test de performance pour BoutikFlow.
Génère :
- 1 Boutique ('boutique-test')
- 5 Membres d'Équipe (Owner, Manager, Cashier, Stock Manager, Staff)
- 5 000 Produits
- 1 000 Clients CRM
- 1 000 Fournisseurs
- 10 000 Commandes standards
- 10 000 Ventes Rapides POS

Usage:
  Injection : python seed_test_data.py --slug boutique-test
  Nettoyage : python seed_test_data.py --slug boutique-test --clean
"""

import sys
import os
import uuid
import random
from datetime import datetime, timedelta

# Ajouter le dossier backend au path Python
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from app.core.database import SessionLocal, engine, Base
from app.core.security import hash_password
from app.modules.auth.models import Tenant, User, RoleEnum, PlanEnum, TenantStatusEnum
from app.modules.products.models import Product, Order, OrderItem, OrderStatusEnum
from app.modules.crm.models import Client, ClientStatusEnum
from app.modules.suppliers.models import Supplier


COMMON_PASSWORD = "Test12345!"


def seed_data(slug: str = "boutique-test"):
    # Assurer que toutes les tables (notamment suppliers) existent dans la BDD
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Note sur la création des tables : {e}")

    db = SessionLocal()
    try:
        print(f"🔍 Recherche de la boutique de test '{slug}'...")
        tenant = db.query(Tenant).filter(Tenant.slug == slug).first()

        if not tenant:
            print(f"✨ Création de la boutique de test '{slug}'...")
            tenant = Tenant(
                id=uuid.uuid4(),
                name="BoutikFlow Test Performance",
                slug=slug,
                plan=PlanEnum.pro,
                status=TenantStatusEnum.active,
                is_active=True,
            )
            db.add(tenant)
            db.flush()

        tenant_id = tenant.id
        hashed_pwd = hash_password(COMMON_PASSWORD)

        # 1. Création des membres de l'équipe (5 rôles)
        print("👥 1/6 - Création des comptes de l'équipe (Owner, Manager, Caissier, Stock, Staff)...")
        team_configs = [
            ("Propriétaire Principal", f"owner@{slug}.com", RoleEnum.owner, "+224620000001"),
            ("Mamadou Gérant", f"gerant@{slug}.com", RoleEnum.staff, "+224620000002"),
            ("Aissatou Caissière", f"caisse@{slug}.com", RoleEnum.staff, "+224620000003"),
            ("Ousmane Stock", f"stock@{slug}.com", RoleEnum.staff, "+224620000004"),
            ("Binta Employée", f"staff@{slug}.com", RoleEnum.staff, "+224620000005"),
        ]

        for full_name, email, role, phone in team_configs:
            existing_user = db.query(User).filter(User.email == email).first()
            if not existing_user:
                usr = User(
                    id=uuid.uuid4(),
                    tenant_id=tenant_id,
                    email=email,
                    hashed_password=hashed_pwd,
                    full_name=full_name,
                    phone=phone,
                    role=role,
                    is_active=True,
                )
                db.add(usr)
        db.commit()

        # 2. Génération de 5 000 Produits
        print("📦 2/6 - Création de 5 000 produits de test en masse...")
        categories_sample = ["Téléphones & High-Tech", "Mode & Vetements", "Beauté & Cosmétiques", "Alimentation", "Maison & Électroménager"]
        products_batch = []
        for i in range(1, 5001):
            prod = Product(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                name=f"Produit #{i:05d} - {random.choice(categories_sample)}",
                description=f"Description du produit de test haute performance #{i}",
                price=random.randint(5, 500) * 1000, # 5 000 à 500 000 GNF
                stock=random.randint(5, 300),
                is_available=True,
                sku=f"SKU-{i:05d}",
                barcode=f"690{i:09d}",
                created_at=datetime.utcnow() - timedelta(days=random.randint(0, 180)),
            )
            products_batch.append(prod)
            if len(products_batch) >= 1000:
                db.bulk_save_objects(products_batch)
                db.commit()
                products_batch = []
                print(f"   ↳ {i} / 5 000 produits enregistrés...")

        if products_batch:
            db.bulk_save_objects(products_batch)
            db.commit()

        db_products = db.query(Product.id, Product.price).filter(Product.tenant_id == tenant_id).all()

        # 3. Génération de 1 000 Clients CRM
        print("👤 3/6 - Création de 1 000 clients CRM...")
        names_list = ["Diallo", "Bah", "Camara", "Barry", "Soumah", "Sylla", "Touré", "Kaba", "Traoré", "Keita"]
        first_names = ["Mamadou", "Ibrahima", "Aissatou", "Mariama", "Ousmane", "Kadiatou", "Alpha", "Fatoumata", "Cherif", "Binta"]
        clients_batch = []
        for i in range(1, 1001):
            cli = Client(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                name=f"{random.choice(first_names)} {random.choice(names_list)} #{i:04d}",
                phone=f"+2246{random.randint(10000000, 99999999)}",
                email=f"client{i}@test-boutikflow.com",
                status=random.choice([ClientStatusEnum.nouveau, ClientStatusEnum.actif, ClientStatusEnum.vip]),
                notes="Client généré pour test de performance",
                created_at=datetime.utcnow() - timedelta(days=random.randint(0, 180)),
            )
            clients_batch.append(cli)
        db.bulk_save_objects(clients_batch)
        db.commit()

        db_clients = db.query(Client.id).filter(Client.tenant_id == tenant_id).all()

        # 4. Génération de 1 000 Fournisseurs
        print("🚚 4/6 - Création de 1 000 fournisseurs...")
        try:
            suppliers_batch = []
            company_types = ["Import-Export", "Distribution Sarl", "Trading Global", "Services & Gros"]
            for i in range(1, 1001):
                sup = Supplier(
                    id=uuid.uuid4(),
                    tenant_id=tenant_id,
                    name=f"Fournisseur {random.choice(names_list)} #{i:04d}",
                    company=f"{random.choice(company_types)} {i}",
                    phone=f"+2246{random.randint(10000000, 99999999)}",
                    email=f"fournisseur{i}@business-guinee.com",
                    city="Conakry",
                    country="Guinée",
                    contact_person=f"{random.choice(first_names)} {random.choice(names_list)}",
                    notes="Fournisseur généré pour test de volume",
                    created_at=datetime.utcnow() - timedelta(days=random.randint(0, 120)),
                )
                suppliers_batch.append(sup)
            db.bulk_save_objects(suppliers_batch)
            db.commit()
        except Exception as err:
            db.rollback()
            print(f"⚠️ Note sur la création des fournisseurs : {err}")

        # 5. Génération de 10 000 Commandes Standards
        print("🛍️ 5/6 - Création de 10 000 commandes standards...")
        statuses = [OrderStatusEnum.delivered, OrderStatusEnum.confirmed, OrderStatusEnum.pending, OrderStatusEnum.cancelled]

        for i in range(1, 10001):
            client_obj = random.choice(db_clients)
            order_id = uuid.uuid4()
            sample_prods = random.sample(db_products, k=random.randint(1, 3))
            total_amount = 0
            order_items = []

            for prod_item in sample_prods:
                qty = random.randint(1, 3)
                unit_price = prod_item.price
                total_amount += unit_price * qty
                order_items.append(
                    OrderItem(
                        id=uuid.uuid4(),
                        order_id=order_id,
                        product_id=prod_item.id,
                        quantity=qty,
                        unit_price=unit_price
                    )
                )

            order = Order(
                id=order_id,
                tenant_id=tenant_id,
                client_id=client_obj.id,
                status=random.choice(statuses),
                total=total_amount,
                notes=f"Commande standard #{i:05d}",
                created_at=datetime.utcnow() - timedelta(days=random.randint(0, 90)),
            )
            db.add(order)
            db.add_all(order_items)

            if i % 1000 == 0:
                db.commit()
                print(f"   ↳ {i} / 10 000 commandes standards créées...")

        db.commit()

        # 6. Génération de 10 000 Ventes Rapides POS (Caisse)
        print("💳 6/6 - Création de 10 000 ventes rapides POS (Caisse)...")
        payment_methods = ["Espèces (Cash)", "Orange Money", "Carte Bancaire", "Virement"]

        for i in range(1, 10001):
            client_obj = random.choice(db_clients)
            order_id = uuid.uuid4()
            sample_prods = random.sample(db_products, k=random.randint(1, 2))
            total_amount = 0
            order_items = []

            for prod_item in sample_prods:
                qty = random.randint(1, 4)
                unit_price = prod_item.price
                total_amount += unit_price * qty
                order_items.append(
                    OrderItem(
                        id=uuid.uuid4(),
                        order_id=order_id,
                        product_id=prod_item.id,
                        quantity=qty,
                        unit_price=unit_price
                    )
                )

            pay_method = random.choice(payment_methods)
            discount_val = random.choice([0, 5000, 10000, 15000])

            order = Order(
                id=order_id,
                tenant_id=tenant_id,
                client_id=client_obj.id,
                status=OrderStatusEnum.delivered, # Les ventes POS sont livrées/validées
                total=max(0, total_amount - discount_val),
                notes=f"Mode de paiement: {pay_method} | Remise: {discount_val} GNF | Vente POS #{i:05d}",
                created_at=datetime.utcnow() - timedelta(days=random.randint(0, 60)),
            )
            db.add(order)
            db.add_all(order_items)

            if i % 1000 == 0:
                db.commit()
                print(f"   ↳ {i} / 10 000 ventes POS créées...")

        db.commit()

        print("\n🎉 INJECTION MASSIVE TERMINÉE AVEC SUCCÈS !")
        print("--------------------------------------------------")
        print(f"Boutique : {slug}")
        print(f"Identifiant boutique : {slug}")
        print(f"Mot de passe unique : {COMMON_PASSWORD}")
        print("Comptes d'équipe créés :")
        for full_name, email, role, _ in team_configs:
            print(f"  • [{role.value.upper()}] {full_name} -> Email: {email}")
        print("--------------------------------------------------")
        print("Statistiques des données injectées :")
        print("  • Produits : 5 000")
        print("  • Clients CRM : 1 000")
        print("  • Fournisseurs : 1 000")
        print("  • Commandes : 10 000")
        print("  • Ventes POS Caisse : 10 000")
        print("  • Total Éléments : 27 005 données de test")

    except Exception as e:
        db.rollback()
        print(f"❌ Erreur lors de l'injection : {e}")
    finally:
        db.close()


def clean_data(slug: str = "boutique-test"):
    db = SessionLocal()
    try:
        print(f"🧹 Nettoyage complet des données de test pour la boutique '{slug}'...")
        tenant = db.query(Tenant).filter(Tenant.slug == slug).first()
        if not tenant:
            print(f"⚠️ Aucune boutique trouvée avec le slug '{slug}'.")
            return

        tenant_id = tenant.id

        # Supprimer les OrderItems
        orders = db.query(Order.id).filter(Order.tenant_id == tenant_id).all()
        order_ids = [o.id for o in orders]
        if order_ids:
            db.query(OrderItem).filter(OrderItem.order_id.in_(order_ids)).delete(synchronize_session=False)

        # Supprimer les Commandes
        db.query(Order).filter(Order.tenant_id == tenant_id).delete(synchronize_session=False)
        # Supprimer les Produits
        db.query(Product).filter(Product.tenant_id == tenant_id).delete(synchronize_session=False)
        # Supprimer les Clients
        db.query(Client).filter(Client.tenant_id == tenant_id).delete(synchronize_session=False)
        # Supprimer les Fournisseurs
        db.query(Supplier).filter(Supplier.tenant_id == tenant_id).delete(synchronize_session=False)
        # Supprimer les Utilisateurs
        db.query(User).filter(User.tenant_id == tenant_id).delete(synchronize_session=False)
        # Supprimer la Boutique de test
        db.query(Tenant).filter(Tenant.id == tenant_id).delete(synchronize_session=False)

        db.commit()
        print(f"✨ Nettoyage terminé avec succès pour la boutique '{slug}' !")

    except Exception as e:
        db.rollback()
        print(f"❌ Erreur lors du nettoyage : {e}")
    finally:
        db.close()


if __name__ == "__main__":
    args = sys.argv[1:]
    slug = "boutique-test"
    clean_mode = "--clean" in args

    for i, arg in enumerate(args):
        if arg == "--slug" and i + 1 < len(args):
            slug = args[i + 1]

    if clean_mode:
        clean_data(slug)
    else:
        seed_data(slug)
