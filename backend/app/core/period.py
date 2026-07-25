"""
Résolution des périodes de filtrage — SOURCE UNIQUE DE VÉRITÉ.

Tout module qui filtre des données par date (Tableau de bord, Finance,
Analytics, exports…) DOIT passer par `resolve_period()`.

C'est cette fonction qui garantit qu'une même sélection de dates produit
exactement la même fenêtre temporelle dans tous les modules, et donc
exactement les mêmes chiffres.

Conventions retenues :
- Toutes les dates renvoyées sont *timezone-aware* en UTC.
- La borne de début est **inclusive**, la borne de fin est **exclusive**
  (`start <= created_at < end`). L'appelant n'a donc jamais à gérer
  lui-même le « +1 jour » pour inclure la journée de fin.
- Une date explicite (`start_date` / `end_date`) l'emporte toujours sur
  le libellé de période : c'est ce qui permet au Tableau de bord et à
  Finance de rester synchronisés même si leurs sélecteurs diffèrent.
- Les périodes glissantes sont ancrées sur des frontières de journée
  (minuit UTC) et non sur l'instant présent : deux requêtes envoyées à
  quelques secondes d'intervalle renvoient ainsi des résultats identiques.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

# Libellés de période acceptés par l'ensemble de l'API.
PERIOD_VALUES = ("24h", "7j", "30j", "90j", "all", "custom")

# Nombre de jours associé à chaque période glissante.
_PERIOD_DAYS = {"7j": 7, "30j": 30, "90j": 90}


def _parse_date(value: str | None) -> datetime | None:
    """
    Convertit une date fournie par le client en datetime UTC.

    Accepte `YYYY-MM-DD` ainsi que les formats ISO complets renvoyés par
    `Date.toISOString()` côté navigateur. Renvoie None si la valeur est
    vide ou illisible (le filtre est alors simplement ignoré).
    """
    if not value:
        return None

    raw = value.strip()
    if not raw:
        return None

    try:
        # `fromisoformat` gère "2026-07-25" comme "2026-07-25T10:30:00+00:00".
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _start_of_day(moment: datetime) -> datetime:
    return moment.replace(hour=0, minute=0, second=0, microsecond=0)


def resolve_period(
    period: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    now: datetime | None = None,
) -> tuple[datetime | None, datetime | None]:
    """
    Traduit les paramètres de filtrage en fenêtre `[start, end)` UTC.

    Renvoie `(None, None)` pour « toutes les données », ce qui permet à
    l'appelant de ne poser aucune contrainte de date sur sa requête.

    Règles de priorité :
    1. `start_date` et/ou `end_date` fournies  → fenêtre explicite.
    2. `period` = "all"                        → aucune contrainte.
    3. `period` = "24h" / "7j" / "30j" / "90j" → fenêtre glissante.
    4. Rien de reconnaissable                  → aucune contrainte.
    """
    current = now.astimezone(timezone.utc) if now else datetime.now(timezone.utc)

    explicit_start = _parse_date(start_date)
    explicit_end = _parse_date(end_date)

    # ── 1. Dates explicites : elles priment sur le libellé de période ──
    if explicit_start or explicit_end:
        start = _start_of_day(explicit_start) if explicit_start else None
        end = None
        if explicit_end:
            # Borne haute exclusive : on inclut la totalité de la journée de fin.
            end = _start_of_day(explicit_end) + timedelta(days=1)

        # Une plage inversée serait vide et donnerait des KPI à zéro sans
        # explication : on la remet à l'endroit plutôt que de piéger l'utilisateur.
        if start and end and start >= end:
            start, end = _start_of_day(end - timedelta(days=1)), start + timedelta(days=1)

        return start, end

    # ── 2. Aucune contrainte ──
    if period == "all":
        return None, None

    # ── 3. Périodes glissantes ──
    if period == "24h":
        return current - timedelta(hours=24), current

    days = _PERIOD_DAYS.get(period or "")
    if days is not None:
        # Ancrage sur minuit : la fenêtre couvre les N derniers jours pleins
        # plus la journée en cours, exactement comme le sélecteur du frontend.
        start = _start_of_day(current) - timedelta(days=days)
        end = _start_of_day(current) + timedelta(days=1)
        return start, end

    # ── 4. Valeur inconnue : on ne filtre pas plutôt que de mentir ──
    return None, None


def previous_period(
    start: datetime | None,
    end: datetime | None,
) -> tuple[datetime | None, datetime | None]:
    """
    Fenêtre immédiatement antérieure et de même durée, utilisée pour les
    variations en pourcentage (« +12,4 % sur la période »).

    Renvoie `(None, None)` si la période courante n'est pas bornée : on ne
    peut pas comparer « tout l'historique » à quoi que ce soit.
    """
    if start is None or end is None:
        return None, None

    span = end - start
    return start - span, start
