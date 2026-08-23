"""
Monitoring d'erreurs (Sentry) — strictement optionnel.

Sans SENTRY_DSN configuré (cas par défaut, y compris en local et tant que
la variable n'est pas ajoutée sur Render), `init_sentry()` ne fait rien :
aucun SDK initialisé, aucun appel réseau, comportement inchangé.
"""
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


def init_sentry() -> None:
    if not settings.SENTRY_DSN:
        return

    import sentry_sdk

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        release=settings.APP_VERSION,
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        send_default_pii=False,
    )
    logger.info("Sentry initialisé (environment=%s)", settings.ENVIRONMENT)
