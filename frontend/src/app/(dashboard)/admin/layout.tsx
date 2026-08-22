'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentRole, firstAllowedRoute } from '@/lib/permissions';

/**
 * Garde d'accès pour tout le sous-arbre /admin (demande 41 : "seul Super
 * Admin peut accéder ; une boutique cliente ne peut pas accéder"). Sans ce
 * garde, une boutique naviguant directement vers /admin/... affichait la
 * coquille de la page (le contenu réel échouait déjà côté serveur — voir
 * require_admin sur chaque route /admin/* du backend, seule couche qui
 * fait réellement autorité — mais rien ne l'empêchait de VOIR l'existence
 * du panneau Super Admin ni de rester bloqué dessus).
 *
 * `layout.tsx` (racine du groupe (dashboard)) filtre déjà le MENU par
 * permission mais n'a jamais bloqué l'accès direct à /admin par URL,
 * volontairement laissé ouvert pour tout utilisateur authentifié (voir
 * ROUTE_PERMISSIONS, lib/permissions.ts) — ce layout comble ce trou
 * spécifiquement pour /admin, sans toucher au reste du routage.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const role = useCurrentRole();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (role === null) return; // décodage du token pas encore prêt
    if (role.toLowerCase() !== 'admin') {
      router.replace(firstAllowedRoute(role));
      return;
    }
    setChecked(true);
  }, [role, router]);

  if (!checked) return null;
  return <>{children}</>;
}
