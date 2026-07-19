import os
import httpx
from fastapi import APIRouter, HTTPException
from datetime import datetime
from .schemas import AISuggestReplyRequest, AISuggestReplyResponse
# Dans un projet complet on utiliserait la BD pour logguer
# from app.db.session import get_db

router = APIRouter(prefix="/ai", tags=["AI"])

@router.post("/suggest-reply", response_model=AISuggestReplyResponse)
async def suggest_reply(req: AISuggestReplyRequest):
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        return AISuggestReplyResponse(suggestion="Voici une suggestion générée localement. Configurez GROQ_API_KEY pour l'IA.")
    
    headers = {
        "Authorization": f"Bearer {groq_api_key}",
        "Content-Type": "application/json"
    }
    
    prompt = "Voici les derniers messages de la conversation :\n"
    for m in req.messages:
        prompt += f"- {m.sender}: {m.text}\n"
    prompt += "\nSuggère une réponse professionnelle et courtoise pour la boutique. La réponse doit être directe, sans guillemets ni introduction."
    
    data = {
        "model": "mixtral-8x7b-32768",
        "messages": [
            {"role": "system", "content": "Tu es un assistant de boutique. Réponds toujours en français."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=data)
            response.raise_for_status()
            res_data = response.json()
            suggestion = res_data["choices"][0]["message"]["content"]
            
            # Log AI usage in AILog
            # Log = AILog(action="suggest-reply", tokens=res_data.get("usage", {}).get("total_tokens", 0), timestamp=datetime.utcnow())
            # db.add(Log) ...
            
            return AISuggestReplyResponse(suggestion=suggestion.strip())
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
