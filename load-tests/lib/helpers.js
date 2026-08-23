import { tenants } from './data.js';

// Sélection aléatoire d'une boutique/d'un utilisateur — c'est ce qui garantit
// une distribution réaliste multi-boutiques (jamais "100 000 VUs → 1 seule
// boutique", voir README section Multi-tenant).
export function randomTenant() {
  return tenants[Math.floor(Math.random() * tenants.length)];
}

export function randomUser(tenant) {
  return tenant.users[Math.floor(Math.random() * tenant.users.length)];
}

export function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function authHeaders(user, extra = {}) {
  return {
    headers: {
      Authorization: `Bearer ${user.token}`,
      'Content-Type': 'application/json',
      ...extra,
    },
  };
}

// Pause "humaine" entre deux actions — sans ça, un scénario "consultation"
// n'est qu'une boucle de martelage, pas un utilisateur réaliste.
export function thinkTime(minSec = 1, maxSec = 3) {
  return minSec + Math.random() * (maxSec - minSec);
}
