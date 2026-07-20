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


import json
from .schemas import AIAnalyzeProductImageRequest, AIAnalyzeProductImageResponse

@router.post("/analyze-product-image", response_model=AIAnalyzeProductImageResponse)
async def analyze_product_image(req: AIAnalyzeProductImageRequest):
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        return AIAnalyzeProductImageResponse(
            name="Produit exemple",
            category="Électronique",
            description="Exemple d'analyse d'image. Configurez GROQ_API_KEY en production.",
            brand="BoutikFlow",
            attributes={}
        )
    
    headers = {
        "Authorization": f"Bearer {groq_api_key}",
        "Content-Type": "application/json"
    }

    user_content = [
        {
            "type": "text",
            "text": "Analyse cette photo de produit et extrait les informations suivantes en français sous format JSON strict avec les clés: name (nom du produit), category (catégorie du produit), description (description détaillée), brand (marque), attributes (dictionnaire d'attributs clé-valeur comme couleur, taille, etc. s'il y en a)."
        }
    ]
    
    img_url = req.image_data
    if img_url.startswith("data:image/") or img_url.startswith("http"):
        user_content.append({
            "type": "image_url",
            "image_url": {
                "url": img_url
            }
        })
    else:
        if not img_url.startswith("http") and not img_url.startswith("data:"):
            img_url = f"data:image/jpeg;base64,{img_url}"
        user_content.append({
            "type": "image_url",
            "image_url": {
                "url": img_url
            }
        })

    data = {
        "model": "llama-3.2-11b-vision-preview",
        "messages": [
            {"role": "system", "content": "Tu es un assistant IA spécialisé dans l'analyse de produits pour e-commerce. Tu réponds STRICTEMENT sous forme de JSON valide."},
            {"role": "user", "content": user_content}
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=data, timeout=30.0)
            response.raise_for_status()
            res_data = response.json()
            content_str = res_data["choices"][0]["message"]["content"]
            parsed = json.loads(content_str)
            return AIAnalyzeProductImageResponse(
                name=parsed.get("name"),
                category=parsed.get("category"),
                description=parsed.get("description"),
                brand=parsed.get("brand"),
                attributes=parsed.get("attributes", {})
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erreur d'analyse IA : {str(e)}")
