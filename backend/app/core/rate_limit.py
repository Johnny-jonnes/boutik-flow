"""
Limitation de débit — protège /auth/login et /auth/register contre le
brute-force et le spam d'inscriptions.

Stockage en mémoire (par défaut de slowapi) : suffisant pour l'instance
Render actuelle (un seul worker/process), mais chaque instance a son
propre compteur si le service passe un jour en plusieurs instances —
la limite réelle serait alors multipliée par le nombre d'instances.
Un backend partagé (Redis, déjà une dépendance mais pas encore branché
en production) résoudrait ce point si besoin — voir docs/SCALABILITY_AUDIT.md.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
