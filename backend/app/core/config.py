from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "BoutikFlow"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str
    # Connexion applicative restreinte (RLS) — voir migration
    # a546853c47ae_structural_rls_policies. Optionnelle et vide par défaut :
    # tant qu'elle n'est pas configurée, l'app continue de tourner
    # exactement comme avant (repli sur DATABASE_URL, qui contourne RLS).
    # La poser active réellement l'isolation en profondeur pour toutes les
    # routes authentifiées normales ; les 3 endpoints d'auth publics et le
    # panneau admin continuent d'utiliser DATABASE_URL (ils en ont besoin :
    # chercher un tenant avant qu'un contexte n'existe, ou accès
    # cross-tenant légitime pour l'admin).
    APP_DATABASE_URL: str = ""

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Frontend (liens envoyés par email)
    FRONTEND_URL: str = "http://localhost:3000"

    # Email de l'équipe BoutikFlow recevant les notifications d'inscription
    ADMIN_NOTIFICATION_EMAIL: str = ""

    # Email / SMTP (réinitialisation de mot de passe)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_USE_TLS: bool = True

    # WhatsApp
    WHATSAPP_API_URL: str = "https://graph.facebook.com/v21.0"
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_ACCESS_TOKEN: str = ""
    WHATSAPP_VERIFY_TOKEN: str = ""
    
    # Twilio WhatsApp Sandbox
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_NUMBER: str = ""

    # Groq
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_MAX_TOKENS: int = 1024

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Orange Money
    ORANGE_MONEY_API_URL: str = ""
    ORANGE_MONEY_MERCHANT_KEY: str = ""
    ORANGE_MONEY_SECRET: str = ""

    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    @property
    def allowed_origins_list(self) -> List[str]:
        return self.ALLOWED_ORIGINS


settings = Settings()
