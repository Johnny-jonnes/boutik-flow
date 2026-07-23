import sys
import os

# Add app to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))
sys.path.append(os.path.dirname(__file__))

from app.core.database import engine, Base
from app.modules.auth.models import Tenant, User, AdminNotification
from app.modules.crm.models import Client
from app.modules.products.models import Product, InventoryLog, Order, OrderItem, OrderLog, WhatsAppMessage, AILog, Subscription
from app.modules.marketing.models import Campaign
from app.modules.suppliers.models import Supplier
from app.modules.audit.models import AuditLog
from app.modules.finance.models import FinancialTransaction

print("Creating tables in Database...")
Base.metadata.create_all(bind=engine)
print("Tables created successfully!")
