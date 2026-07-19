import uuid
import sys
import os

# Ajuster le PYTHONPATH pour pouvoir importer 'app'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.modules.auth.models import Tenant, User, PlanEnum, RoleEnum, TenantStatusEnum
from app.core.security import hash_password

def create_admin():
    print("=== Création d'un compte Administrateur BoutikFlow ===")
    email = input("Email de l'administrateur : ").strip()
    if not email:
        print("Erreur : l'email est obligatoire.")
        return
        
    password = input("Mot de passe (8 caractères minimum, 1 chiffre, 1 majuscule) : ").strip()
    if len(password) < 8:
        print("Erreur : le mot de passe doit comporter au moins 8 caractères.")
        return
        
    full_name = input("Nom complet (ex: Admin BoutikFlow) : ").strip()
    
    db = SessionLocal()
    try:
        # 1. Récupérer ou créer le tenant système pour l'admin
        ADMIN_TENANT_SLUG = "boutikflow-admin"
        admin_tenant = db.query(Tenant).filter(Tenant.slug == ADMIN_TENANT_SLUG).first()
        
        if not admin_tenant:
            print(f"Création du tenant d'administration : @{ADMIN_TENANT_SLUG}...")
            admin_tenant = Tenant(
                id=uuid.uuid4(),
                name="BoutikFlow Admin",
                slug=ADMIN_TENANT_SLUG,
                plan=PlanEnum.pro,
                status=TenantStatusEnum.active,
                is_active=True,
            )
            db.add(admin_tenant)
            db.flush()
            
        # 2. Vérifier si l'utilisateur existe déjà
        existing_user = db.query(User).filter(
            User.tenant_id == admin_tenant.id,
            User.email == email
        ).first()
        
        if existing_user:
            print(f"Erreur : Un utilisateur admin avec l'email '{email}' existe déjà dans le tenant admin.")
            return
            
        # 3. Créer l'utilisateur admin
        new_admin = User(
            id=uuid.uuid4(),
            tenant_id=admin_tenant.id,
            email=email,
            hashed_password=hash_password(password),
            full_name=full_name or "Administrateur",
            role=RoleEnum.admin,
            is_active=True,
            is_verified=True,
        )
        db.add(new_admin)
        db.commit()
        
        print("\n=== Compte admin créé avec succès ===")
        print(f"Boutique ID (slug) : {ADMIN_TENANT_SLUG}")
        print(f"Email : {email}")
        print("Vous pouvez maintenant vous connecter sur le portail de connexion normal !")
        print("=====================================================")
        
    except Exception as e:
        db.rollback()
        print(f"Une erreur est survenue lors de la création de l'admin : {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()
