// Toute la configuration passe par variables d'environnement — jamais de
// secret/URL en dur (voir README, section Sécurité). BASE_URL pointe par
// défaut sur un serveur backend local dédié aux tests de charge (PAS la
// production Render).
export const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:8159/api/v1';
