/**
 * Périodes de filtrage — SOURCE UNIQUE DE VÉRITÉ côté client.
 *
 * Tout écran qui propose un filtre par date (Tableau de bord, Finance,
 * Analytics) doit produire ses paramètres avec `buildPeriodParams()`.
 * Deux écrans qui affichent la même période envoient ainsi exactement les
 * mêmes `start_date` / `end_date` au backend, lequel les interprète avec
 * la fonction jumelle `app/core/period.py::resolve_period()`.
 */

export type PeriodKey = '24h' | '7j' | '30j' | '90j' | 'all' | 'custom';

export interface PeriodParams {
  period: PeriodKey;
  start_date?: string;
  end_date?: string;
}

/** Nombre de jours couvert par chaque période glissante. */
const PERIOD_DAYS: Partial<Record<PeriodKey, number>> = {
  '7j': 7,
  '30j': 30,
  '90j': 90,
};

/**
 * Formate une date en `YYYY-MM-DD` à partir de ses composantes **locales**.
 *
 * `toISOString()` convertit d'abord en UTC : passé 00 h dans un fuseau en
 * avance, il renvoie la veille et décale toute la période d'un jour.
 */
export function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Date d'aujourd'hui au format attendu par `<input type="date">`. */
export function today(): string {
  return toDateInput(new Date());
}

/**
 * Traduit une sélection d'interface en paramètres d'API.
 *
 * Pour une période personnalisée incomplète (une seule des deux dates
 * saisies), la borne renseignée est tout de même transmise : l'utilisateur
 * voit immédiatement l'effet de sa saisie.
 */
export function buildPeriodParams(
  period: PeriodKey,
  customStart?: string,
  customEnd?: string,
): PeriodParams {
  if (period === 'custom') {
    return {
      period: 'custom',
      start_date: customStart || undefined,
      end_date: customEnd || undefined,
    };
  }

  if (period === 'all' || period === '24h') {
    // "all" ne porte aucune borne ; "24h" est une fenêtre horaire que seul
    // le backend peut ancrer précisément.
    return { period };
  }

  const days = PERIOD_DAYS[period];
  if (!days) return { period };

  const start = new Date();
  start.setDate(start.getDate() - days);

  return {
    period,
    start_date: toDateInput(start),
    end_date: today(),
  };
}

/**
 * Teste si une date ISO tombe dans la période sélectionnée.
 *
 * Utilisé pour les listes filtrées côté client (commandes récentes) afin
 * qu'elles couvrent exactement la même fenêtre que les KPI : borne de début
 * inclusive, journée de fin incluse en entier.
 */
export function isWithinPeriod(
  isoDate: string | null | undefined,
  params: PeriodParams,
): boolean {
  if (!isoDate) return false;
  if (!params.start_date && !params.end_date) return true;

  const time = new Date(isoDate).getTime();
  if (Number.isNaN(time)) return false;

  if (params.start_date) {
    const from = new Date(`${params.start_date}T00:00:00`).getTime();
    if (time < from) return false;
  }
  if (params.end_date) {
    const to = new Date(`${params.end_date}T23:59:59.999`).getTime();
    if (time > to) return false;
  }
  return true;
}

/** Libellés affichés dans les sélecteurs de période. */
export function periodLabel(period: PeriodKey, language: string): string {
  const fr: Record<PeriodKey, string> = {
    '24h': '24 dernières heures',
    '7j': '7 derniers jours',
    '30j': '30 derniers jours',
    '90j': '90 derniers jours',
    all: 'Tout l’historique',
    custom: 'Période personnalisée',
  };
  const en: Record<PeriodKey, string> = {
    '24h': 'Last 24 hours',
    '7j': 'Last 7 days',
    '30j': 'Last 30 days',
    '90j': 'Last 90 days',
    all: 'All time',
    custom: 'Custom range',
  };
  return language === 'fr' ? fr[period] : en[period];
}
