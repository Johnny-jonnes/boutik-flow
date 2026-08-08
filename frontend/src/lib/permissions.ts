/**
 * Permissions par rôle — miroir de backend/app/core/permissions.py.
 *
 * Cette version ne fait PAS autorité : elle sert uniquement à l'affichage
 * (masquer un menu, un bouton, rediriger loin d'une page non autorisée).
 * L'application réelle des droits reste côté FastAPI (voir require_permission) —
 * un utilisateur qui contournerait cette couche resterait bloqué par l'API.
 */
'use client';

import { useEffect, useState } from 'react';

export type Module =
  | 'dashboard'
  | 'products'
  | 'categories'
  | 'stock'
  | 'orders'
  | 'returns'
  | 'clients'
  | 'debts'
  | 'suppliers'
  | 'finance'
  | 'team'
  | 'audit'
  | 'settings';

export type Role = 'owner' | 'manager' | 'stock_manager' | 'cashier' | 'staff' | 'admin';

const ALL_SELLING_ROLES: Role[] = ['owner', 'manager', 'stock_manager', 'cashier', 'staff'];

export const PERMISSIONS: Record<Module, Record<string, Role[]>> = {
  dashboard: {
    view: ['owner', 'manager'],
  },
  products: {
    view: ALL_SELLING_ROLES,
    write: ['owner', 'manager', 'stock_manager'],
    delete: ['owner', 'manager', 'stock_manager'],
  },
  categories: {
    view: ALL_SELLING_ROLES,
    write: ['owner', 'manager', 'stock_manager'],
    delete: ['owner', 'manager', 'stock_manager'],
  },
  stock: {
    write: ['owner', 'manager', 'stock_manager'],
  },
  orders: {
    view: ALL_SELLING_ROLES,
    create: ['owner', 'manager', 'cashier', 'staff'],
    cancel: ['owner', 'manager'],
  },
  returns: {
    create: ['owner', 'manager', 'stock_manager', 'cashier'],
  },
  clients: {
    view: ALL_SELLING_ROLES,
    create: ALL_SELLING_ROLES,
    edit: ['owner', 'manager', 'cashier'],
    delete: ['owner', 'manager'],
  },
  // Miroir exact de PERMISSIONS["debts"] dans core/permissions.py (Phase 4).
  debts: {
    view: ALL_SELLING_ROLES,
    create: ['owner', 'manager', 'cashier', 'staff'],
    pay: ['owner', 'manager', 'cashier', 'staff'],
  },
  suppliers: {
    view: ['owner', 'manager', 'stock_manager'],
    write: ['owner', 'manager', 'stock_manager'],
    delete: ['owner', 'manager', 'stock_manager'],
  },
  finance: {
    view: ['owner', 'manager'],
    create: ['owner', 'manager'],
  },
  team: {
    view: ['owner', 'manager'],
    write: ['owner', 'manager'],
    delete: ['owner', 'manager'],
  },
  audit: {
    view: ['owner', 'manager'],
  },
  settings: {
    view: ['owner', 'manager'],
    write: ['owner'],
  },
};

export function hasPermission(role: string | null | undefined, module: Module, action: string): boolean {
  // 'admin' = administrateur plateforme, hors matrice tenant — a toujours accès
  // (miroir de require_admin côté backend, séparé de cette matrice par rôle).
  const r = (role || '').trim().toLowerCase();
  if (r === 'admin') return true;
  const allowed = PERMISSIONS[module]?.[action] ?? [];
  return allowed.includes(r as Role);
}

export function decodeRoleFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role || null;
  } catch {
    return null;
  }
}

/** Route (préfixe de pathname) -> permission requise pour y accéder.
 *  Utilisée pour filtrer le menu et garder l'utilisateur hors des pages
 *  non autorisées (voir layout.tsx). Routes absentes de cette liste
 *  (login, register, admin/*, whatsapp...) restent ouvertes à tout
 *  utilisateur authentifié — hors du périmètre des 14 modules à contrôler. */
export const ROUTE_PERMISSIONS: { prefix: string; module: Module; action: string }[] = [
  { prefix: '/dashboard', module: 'dashboard', action: 'view' },
  { prefix: '/analytics', module: 'dashboard', action: 'view' },
  { prefix: '/pos', module: 'orders', action: 'create' },
  { prefix: '/products', module: 'products', action: 'view' },
  { prefix: '/categories', module: 'categories', action: 'view' },
  { prefix: '/crm', module: 'clients', action: 'view' },
  { prefix: '/segments', module: 'clients', action: 'view' },
  { prefix: '/dettes', module: 'debts', action: 'view' },
  { prefix: '/sales', module: 'orders', action: 'view' },
  { prefix: '/orders', module: 'orders', action: 'view' },
  { prefix: '/suppliers', module: 'suppliers', action: 'view' },
  { prefix: '/finance', module: 'finance', action: 'view' },
  { prefix: '/team', module: 'team', action: 'view' },
  { prefix: '/audit', module: 'audit', action: 'view' },
  { prefix: '/settings', module: 'settings', action: 'view' },
  { prefix: '/billing', module: 'settings', action: 'view' },
];

/** Première route de la navigation principale accessible à ce rôle —
 *  utilisée pour rediriger hors d'une page non autorisée sans supposer
 *  que /dashboard (réservé owner/manager) convient à tout le monde. */
export function firstAllowedRoute(role: string | null | undefined): string {
  const order: { href: string; module: Module; action: string }[] = [
    { href: '/dashboard', module: 'dashboard', action: 'view' },
    { href: '/pos', module: 'orders', action: 'create' },
    { href: '/sales', module: 'orders', action: 'view' },
    { href: '/products', module: 'products', action: 'view' },
    { href: '/crm', module: 'clients', action: 'view' },
  ];
  for (const item of order) {
    if (hasPermission(role, item.module, item.action)) return item.href;
  }
  return '/settings';
}

/** Rôle courant décodé depuis le JWT stocké en localStorage — même source
 *  que layout.tsx, dupliquée volontairement ici pour rester utilisable
 *  depuis n'importe quelle page sans dépendre d'un contexte React partagé. */
export function useCurrentRole(): string | null {
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    setRole(decodeRoleFromToken(localStorage.getItem('boutikflow_access_token')));
  }, []);
  return role;
}

export function usePermission(module: Module, action: string): boolean {
  const role = useCurrentRole();
  return hasPermission(role, module, action);
}
