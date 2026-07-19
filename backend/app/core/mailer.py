"""
Envoi d'emails — BoutikFlow
Utilisé pour la réinitialisation de mot de passe et le cycle de vie des
comptes (nouvelle inscription, validation, refus, blocage).

Si aucun serveur SMTP n'est configuré (SMTP_HOST/SMTP_USER vides), l'email
n'est pas réellement envoyé : le contenu est journalisé (niveau WARNING) afin
de permettre de tester les flux de bout en bout en local/dev sans dépendance
externe. En production, configurez SMTP_HOST/SMTP_USER/SMTP_PASSWORD dans
le .env pour un envoi réel.
"""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


def _send(message: MIMEMultipart, to_email: str) -> None:
    """Envoi SMTP générique, best-effort (n'lève jamais d'exception)."""
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.warning("SMTP non configuré (dev) — email non envoyé à %s", to_email)
        return
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(message["From"], [to_email], message.as_string())
        logger.info("Email envoyé à %s", to_email)
    except Exception:
        logger.exception("Échec de l'envoi de l'email à %s", to_email)


def _build_message(to_email: str, subject: str, body: str) -> MIMEMultipart:
    message = MIMEMultipart()
    message["From"] = settings.SMTP_FROM_EMAIL or settings.SMTP_USER or "noreply@boutikflow.app"
    message["To"] = to_email
    message["Subject"] = subject
    message.attach(MIMEText(body, "plain", "utf-8"))
    return message


def send_password_reset_email(to_email: str, reset_link: str, boutique_name: str) -> None:
    """Envoie (ou journalise) l'email de réinitialisation de mot de passe."""
    subject = f"Réinitialisation de votre mot de passe — {boutique_name}"
    body = (
        "Bonjour,\n\n"
        f"Vous avez demandé la réinitialisation du mot de passe de votre compte "
        f"BoutikFlow pour la boutique « {boutique_name} ».\n\n"
        "Cliquez sur le lien suivant pour choisir un nouveau mot de passe "
        f"(valide {settings.RESET_TOKEN_EXPIRE_MINUTES} minutes) :\n"
        f"{reset_link}\n\n"
        "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.\n\n"
        "— L'équipe BoutikFlow"
    )
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.warning(
            "SMTP non configuré (dev) — lien de réinitialisation pour %s : %s",
            to_email, reset_link,
        )
        return
    _send(_build_message(to_email, subject, body), to_email)


def send_admin_new_registration_notification(
    tenant_name: str, tenant_slug: str, owner_email: str, owner_full_name: str | None,
) -> None:
    """Notifie l'équipe BoutikFlow d'une nouvelle demande d'inscription à valider."""
    if not settings.ADMIN_NOTIFICATION_EMAIL:
        logger.warning(
            "ADMIN_NOTIFICATION_EMAIL non configuré — nouvelle demande d'inscription : "
            "boutique=%s (slug=%s), propriétaire=%s <%s>. À valider depuis /admin.",
            tenant_name, tenant_slug, owner_full_name or "?", owner_email,
        )
        return

    subject = f"Nouvelle demande d'inscription — {tenant_name}"
    body = (
        "Une nouvelle boutique attend votre validation :\n\n"
        f"Boutique : {tenant_name} ({tenant_slug})\n"
        f"Propriétaire : {owner_full_name or 'N/A'} <{owner_email}>\n\n"
        f"Rendez-vous sur {settings.FRONTEND_URL}/admin pour valider ou refuser ce compte.\n\n"
        "— BoutikFlow"
    )
    _send(_build_message(settings.ADMIN_NOTIFICATION_EMAIL, subject, body), settings.ADMIN_NOTIFICATION_EMAIL)


def send_account_approved_email(to_email: str, tenant_name: str) -> None:
    """Informe le propriétaire que sa boutique a été validée."""
    subject = f"Votre boutique {tenant_name} est validée ✅"
    body = (
        "Bonjour,\n\n"
        f"Bonne nouvelle : votre boutique « {tenant_name} » a été validée par notre équipe.\n"
        f"Vous pouvez désormais vous connecter et commencer à l'utiliser : {settings.FRONTEND_URL}/login\n\n"
        "— L'équipe BoutikFlow"
    )
    _send(_build_message(to_email, subject, body), to_email)


def send_account_rejected_email(to_email: str, tenant_name: str, reason: str | None = None) -> None:
    """Informe le propriétaire que sa demande a été refusée."""
    subject = f"Votre demande pour {tenant_name} n'a pas été validée"
    body = (
        "Bonjour,\n\n"
        f"Votre demande de création de boutique « {tenant_name} » n'a pas été validée.\n"
        + (f"Motif : {reason}\n" if reason else "")
        + "\nPour toute question, contactez notre support.\n\n"
        "— L'équipe BoutikFlow"
    )
    _send(_build_message(to_email, subject, body), to_email)


def send_account_blocked_email(to_email: str, tenant_name: str, reason: str | None = None) -> None:
    """Informe le propriétaire que sa boutique a été bloquée."""
    subject = f"Votre boutique {tenant_name} a été suspendue"
    body = (
        "Bonjour,\n\n"
        f"Votre boutique « {tenant_name} » a été suspendue par notre équipe.\n"
        + (f"Motif : {reason}\n" if reason else "")
        + "\nContactez notre support pour plus d'informations.\n\n"
        "— L'équipe BoutikFlow"
    )
    _send(_build_message(to_email, subject, body), to_email)


def send_account_unblocked_email(to_email: str, tenant_name: str) -> None:
    """Informe le propriétaire que sa boutique a été réactivée."""
    subject = f"Votre boutique {tenant_name} est réactivée"
    body = (
        "Bonjour,\n\n"
        f"Votre boutique « {tenant_name} » a été réactivée. Vous pouvez de nouveau vous connecter : "
        f"{settings.FRONTEND_URL}/login\n\n"
        "— L'équipe BoutikFlow"
    )
    _send(_build_message(to_email, subject, body), to_email)
