from fastapi import APIRouter, HTTPException
import uuid

from .schemas import SubscriptionResponse, CheckoutRequest, CheckoutResponse

router = APIRouter(prefix="/billing", tags=["Billing"])

@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription():
    # Données mockées pour la démo
    return SubscriptionResponse(
        plan="Freemium",
        status="active",
        expires_at=None
    )

@router.post("/checkout", response_model=CheckoutResponse)
async def initiate_checkout(request: CheckoutRequest):
    # Simulation de l'initiation d'un paiement Orange Money
    if not request.phone_number:
        raise HTTPException(status_code=400, detail="Numéro de téléphone requis.")
    
    # Process payment logic ...
    transaction_id = f"OM-{uuid.uuid4().hex[:8].upper()}"
    
    return CheckoutResponse(
        transaction_id=transaction_id,
        status="pending",
        message=f"Paiement initié pour le forfait {request.plan_id}. Veuillez valider sur votre téléphone."
    )
