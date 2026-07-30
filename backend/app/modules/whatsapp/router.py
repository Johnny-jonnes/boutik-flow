from typing import Annotated
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import List
from .schemas import WhatsAppChat, WhatsAppSendRequest
from app.core.config import settings
from app.core.deps import get_current_user, CurrentUser
from twilio.rest import Client
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])

# NOTE : cette liste est un jeu de données de démonstration statique — la
# fonctionnalité WhatsApp n'est pas encore branchée à une table par tenant
# (voir le TODO du webhook plus bas). Comme elle n'était même pas protégée
# par une authentification, deux boutiques différentes voyaient exactement
# les mêmes conversations factices : vu de l'extérieur, cela ressemble à un
# mélange de données entre boutiques. Une vraie persistance par tenant_id
# reste à construire ; en attendant, l'endpoint est au moins authentifié.
@router.get("/chats", response_model=List[WhatsAppChat])
async def get_chats(current_user: Annotated[CurrentUser, Depends(get_current_user)]):
    return [
        {"id": "c1", "client": "Fatoumata Bah", "lastMessage": "Merci, la robe est parfaite !", "time": "10:05", "unread": 0, "aiSuggestion": None},
        {"id": "c2", "client": "Mamadou Diallo", "lastMessage": "Combien coûte la livraison pour Dixinn ?", "time": "09:30", "unread": 1, "aiSuggestion": "La livraison à Dixinn coûte 20 000 GNF et prend 24h."},
        {"id": "c3", "client": "+224 628 11 22 33", "lastMessage": "Bonjour, vous avez le sac en rouge ?", "time": "Hier", "unread": 1, "aiSuggestion": "Bonjour ! Oui, le sac est disponible en rouge au prix de 180 000 GNF."},
        {"id": "c4", "client": "Ibrahima Souaré", "lastMessage": "Je vais passer à la boutique.", "time": "Lun.", "unread": 0, "aiSuggestion": None},
    ]

@router.post("/send")
async def send_message(req: WhatsAppSendRequest, current_user: Annotated[CurrentUser, Depends(get_current_user)]):
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        logger.warning("Twilio credentials not configured. Mocking send.")
        return {"status": "success", "message_id": "mock_123", "note": "Credentials missing"}
        
    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        
        # Twilio WhatsApp numbers must be prefixed with 'whatsapp:'
        to_number = req.to if req.to.startswith("whatsapp:") else f"whatsapp:{req.to}"
        from_number = settings.TWILIO_WHATSAPP_NUMBER
        if not from_number.startswith("whatsapp:"):
            from_number = f"whatsapp:{from_number}"
            
        message = client.messages.create(
            from_=from_number,
            body=req.message,
            to=to_number
        )
        return {"status": "success", "message_id": message.sid}
    except Exception as e:
        logger.error(f"Error sending WhatsApp via Twilio: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send message: {str(e)}")

@router.post("/webhook")
async def webhook(request: Request):
    """
    Twilio sends webhooks as Form data (application/x-www-form-urlencoded)
    """
    form_data = await request.form()
    
    # Extraire les infos pertinentes de Twilio
    from_number = form_data.get("From", "")
    body = form_data.get("Body", "")
    message_sid = form_data.get("MessageSid", "")
    
    logger.info(f"Received WhatsApp message from {from_number}: {body}")
    
    # TODO: Sauvegarder dans la DB, traiter avec l'IA Groq, etc.
    
    return {"status": "received"}
