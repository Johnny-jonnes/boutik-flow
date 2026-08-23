"""
Génère des données synthétiques multi-boutiques pour les tests de charge k6.

AUCUNE donnée réelle : tous les tenants/users/produits/clients créés ici
sont fictifs, préfixés `lt-` (load-test), et supprimables sans risque via
cleanup_synthetic_data.py. Ne JAMAIS pointer DATABASE_URL vers une base de
production pour lancer ce script sans avoir conscience que ces lignes y
seront réellement écrites (voir load-tests/README.md, section
"Environnement").

Écrit load-tests/data/tenants.json : une liste de boutiques, chacune avec
plusieurs utilisateurs déjà authentifiés (JWT pré-généré — on ne fait PAS
passer chaque utilisateur virtuel par /auth/login, qui est rate-limité à
10/minute par IP ; voir README section "Pourquoi des tokens pré-générés").
Un pool séparé et volontairement petit de comptes "réels" est marqué
`for_login_test: true` pour le scénario dédié qui, lui, teste vraiment
POST /auth/login sous charge.

Usage :
    cd backend && python ../load-tests/data/generate_synthetic_data.py
Variables d'env (optionnelles) :
    LOADTEST_TENANT_COUNT (défaut 25)
    LOADTEST_USERS_PER_TENANT (défaut 3)
    LOADTEST_PRODUCTS_PER_TENANT (défaut 30)
    LOADTEST_CLIENTS_PER_TENANT (défaut 15)
    LOADTEST_LOGIN_TEST_ACCOUNTS (défaut 10 — comptes dédiés au scénario de login)
"""
import json
import os
import random
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))
import app.main  # noqa: résout les relations SQLAlchemy avant tout le reste

from app.core.database import BypassSessionLocal
from app.core.security import hash_password, create_access_token
from app.modules.auth.models import Tenant, User, PlanEnum, RoleEnum, TenantStatusEnum
from app.modules.products.models import Product, Category
from app.modules.crm.models import Client, ClientStatusEnum

TENANT_COUNT = int(os.environ.get("LOADTEST_TENANT_COUNT", "25"))
USERS_PER_TENANT = int(os.environ.get("LOADTEST_USERS_PER_TENANT", "3"))
PRODUCTS_PER_TENANT = int(os.environ.get("LOADTEST_PRODUCTS_PER_TENANT", "30"))
CLIENTS_PER_TENANT = int(os.environ.get("LOADTEST_CLIENTS_PER_TENANT", "15"))
LOGIN_TEST_ACCOUNTS = int(os.environ.get("LOADTEST_LOGIN_TEST_ACCOUNTS", "10"))

RUN_ID = uuid.uuid4().hex[:8]
PREFIX = f"lt-{RUN_ID}"
ROLES = [RoleEnum.owner, RoleEnum.manager, RoleEnum.cashier]
CATEGORY_NAMES = ["Alimentation", "Boissons", "Hygiène", "Électronique", "Divers"]
PRODUCT_NAMES = [
    "Riz local 5kg", "Huile végétale 1L", "Savon Kabakoudou", "Lait en poudre",
    "Sucre en morceaux", "Farine de blé", "Boîte de tomates", "Sardines en boîte",
    "Bouteille d'eau 1.5L", "Jus de fruit", "Chargeur téléphone", "Écouteurs filaires",
    "Cahier 100 pages", "Stylo bille (x10)", "Savon liquide", "Dentifrice",
    "Café soluble", "Thé en sachets", "Biscuits", "Bonbons",
]


def make_password() -> str:
    return "LoadTest123!"


def main():
    db = BypassSessionLocal()
    tenants_out = []
    login_test_accounts = []

    print(f"Génération de {TENANT_COUNT} boutiques synthétiques (préfixe slug: {PREFIX})...")

    for t_idx in range(TENANT_COUNT):
        slug = f"{PREFIX}-{t_idx:04d}"
        tenant = Tenant(
            id=uuid.uuid4(), name=f"Boutique Test {t_idx}", slug=slug,
            plan=PlanEnum.freemium, status=TenantStatusEnum.active, is_active=True,
        )
        db.add(tenant)
        db.flush()

        categories = []
        for cname in random.sample(CATEGORY_NAMES, k=3):
            cat = Category(id=uuid.uuid4(), tenant_id=tenant.id, name=cname)
            db.add(cat)
            categories.append(cat)
        db.flush()

        products = []
        for p_idx in range(PRODUCTS_PER_TENANT):
            name = random.choice(PRODUCT_NAMES)
            p = Product(
                id=uuid.uuid4(), tenant_id=tenant.id, name=f"{name} #{p_idx}",
                sku=f"SKU-{slug}-{p_idx}", price=random.randint(1000, 50000),
                stock=random.randint(20, 500),
                category_id=random.choice(categories).id,
                is_available=True,
            )
            db.add(p)
            products.append(p)

        # Produit dédié au test de concurrence sur le stock (scénario "vente
        # simultanée du même produit") — stock volontairement bas et connu.
        stock_test_product = Product(
            id=uuid.uuid4(), tenant_id=tenant.id, name="[STOCK-TEST] Produit rare",
            sku=f"SKU-{slug}-STOCKTEST", price=5000, stock=10,
            category_id=categories[0].id, is_available=True,
        )
        db.add(stock_test_product)
        products.append(stock_test_product)
        db.flush()

        clients = []
        for c_idx in range(CLIENTS_PER_TENANT):
            c = Client(
                id=uuid.uuid4(), tenant_id=tenant.id, name=f"Client Test {c_idx}",
                phone=f"+2246{t_idx:03d}{c_idx:04d}", status=ClientStatusEnum.actif,
            )
            db.add(c)
            clients.append(c)
        db.flush()

        users_out = []
        for u_idx in range(USERS_PER_TENANT):
            role = ROLES[u_idx % len(ROLES)]
            email = f"user{u_idx}@{slug}.loadtest"
            password = make_password()
            user = User(
                id=uuid.uuid4(), tenant_id=tenant.id, email=email,
                hashed_password=hash_password(password), full_name=f"Utilisateur Test {u_idx}",
                role=role, is_active=True,
            )
            db.add(user)
            db.flush()

            token = create_access_token({
                "sub": str(user.id),
                "tenant_id": str(tenant.id),
                "tenant_name": tenant.name,
                "tenant_plan": "freemium",
                "email": user.email,
                "role": role.value,
            })
            users_out.append({
                "id": str(user.id), "email": email, "password": password,
                "role": role.value, "token": token,
            })

            # Un petit sous-ensemble de comptes sert au scénario de login réel
            # (voir docstring) — pas les milliers de VUs simulés.
            if len(login_test_accounts) < LOGIN_TEST_ACCOUNTS:
                login_test_accounts.append({
                    "boutique_slug": slug, "email": email, "password": password,
                })

        tenants_out.append({
            "tenant_id": str(tenant.id),
            "slug": slug,
            "stock_test_product_id": str(stock_test_product.id),
            "product_ids": [str(p.id) for p in products],
            "client_ids": [str(c.id) for c in clients],
            "users": users_out,
        })

        if (t_idx + 1) % 5 == 0:
            db.commit()
            print(f"  {t_idx + 1}/{TENANT_COUNT} boutiques créées...")

    db.commit()
    db.close()

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "run_id": RUN_ID,
        "prefix": PREFIX,
        "tenant_count": len(tenants_out),
        "login_test_accounts": login_test_accounts,
        "tenants": tenants_out,
    }

    out_path = Path(__file__).parent / "tenants.json"
    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")

    # Le run_id sert au cleanup ciblé (une seule génération à la fois est
    # supportée — regénérer écrase le fichier précédent, donc toujours
    # nettoyer avant de regénérer si un run précédent existe encore en base).
    (Path(__file__).parent / "last_run_id.txt").write_text(RUN_ID, encoding="utf-8")

    print(f"\nOK : {len(tenants_out)} boutiques, "
          f"{len(tenants_out) * USERS_PER_TENANT} utilisateurs, "
          f"{len(tenants_out) * (PRODUCTS_PER_TENANT + 1)} produits, "
          f"{len(tenants_out) * CLIENTS_PER_TENANT} clients.")
    print(f"Écrit dans {out_path}")
    print(f"run_id={RUN_ID} (nécessaire pour cleanup_synthetic_data.py)")


if __name__ == "__main__":
    main()
