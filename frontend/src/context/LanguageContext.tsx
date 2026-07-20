'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'fr' | 'en';

type Translations = Record<string, string>;

const translations: Record<Language, Translations> = {
  fr: {
    // Sidebar
    'nav.dashboard': "Vue d'ensemble",
    'nav.analytics': 'Analytique',
    'nav.crm': 'Clients',
    'nav.segments': 'Segments',
    'nav.products': 'Produits',
    'nav.categories': 'Catégories',
    'nav.orders': 'Commandes',
    'nav.whatsapp': 'WhatsApp',
    'nav.campaigns': 'Campagnes',
    'nav.admin': 'Administration',
    'nav.tenants': 'Boutiques',
    'sidebar.trial': "Version d'évaluation",
    'sidebar.monthly': 'Abonnement Mensuel',
    'sidebar.lifetime': 'Abonné à Vie',
    'sidebar.active': 'Boutique Active',
    'sidebar.lifetimeActive': 'Licence à vie active',
    'sidebar.upgradePro': 'Passer en Version Pro',
    'sidebar.upgradeLifetime': 'Passer à la Version à Vie',
    'sidebar.billing': 'Facturation',
    'sidebar.logout': 'Déconnexion',
    'sidebar.freemium': 'Plan Freemium',

    // Dashboard
    'dash.title': 'Tableau de Bord',
    'dash.subtitle': 'Pilotez l\'activité de votre commerce.',
    'dash.revenue': 'Chiffre d\'affaires',
    'dash.orders': 'Commandes',
    'dash.clients': 'Clients',
    'dash.pending_orders': 'Commandes en attente',
    'dash.recent_orders': 'Commandes récentes',
    'dash.vip_clients': 'Clients VIP',
    'dash.active_clients': 'Clients actifs',
    'dash.total_orders': 'Commandes totales',
    'dash.total_clients': 'Clients total',
    'dash.whatsapp_active': 'Canal WhatsApp actif',
    'dash.welcome_morning': 'Bonjour',
    'dash.welcome_afternoon': 'Bon après-midi',
    'dash.welcome_evening': 'Bonsoir',

    // Billing
    'bill.title': 'Abonnements & Facturation',
    'bill.subtitle': 'Choisissez la formule qui correspond à la taille de votre boutique.',
    'bill.monthly': 'Abonnement Mensuel',
    'bill.lifetime': 'Abonné à Vie',
    'bill.monthly_desc': 'Tous les outils essentiels pour votre commerce au mois le mois.',
    'bill.lifetime_desc': 'Payez une seule fois, profitez de BoutikFlow à vie.',
    'bill.features': 'Fonctionnalités incluses :',
    'bill.current': 'Votre plan actuel',
    'bill.choose': 'Choisir cette formule',
    'bill.orange_money': 'Paiement Orange Money',
    'bill.phone': 'Numéro de téléphone (Orange)',
    'bill.pay': 'Payer maintenant',
    'bill.cancel': 'Annuler',
    'bill.success': 'Paiement initié avec succès !',

    // Products
    'prod.title': 'Catalogue Produits',
    'prod.subtitle': 'Gérez votre inventaire et vos prix.',
    'prod.add': 'Ajouter produit',
    'prod.search': 'Rechercher par nom, SKU ou code-barres...',
    'prod.name': 'Produit',
    'prod.category': 'Catégorie',
    'prod.price': 'Prix',
    'prod.stock': 'Stock',
    'prod.sku': 'SKU',
    'prod.status': 'Statut',
    'prod.actions': 'Actions',
    'prod.available': 'Disponible',
    'prod.unavailable': 'Indisponible',
    'prod.in_stock': 'en stock',
    'prod.out_of_stock': 'Rupture de stock',
  },
  en: {
    // Sidebar
    'nav.dashboard': 'Overview',
    'nav.analytics': 'Analytics',
    'nav.crm': 'Customers',
    'nav.segments': 'Segments',
    'nav.products': 'Products',
    'nav.categories': 'Categories',
    'nav.orders': 'Orders',
    'nav.whatsapp': 'WhatsApp',
    'nav.campaigns': 'Campaigns',
    'nav.admin': 'Administration',
    'nav.tenants': 'Shops',
    'sidebar.trial': 'Trial Version',
    'sidebar.monthly': 'Monthly Subscription',
    'sidebar.lifetime': 'Lifetime Subscriber',
    'sidebar.active': 'Active Shop',
    'sidebar.lifetimeActive': 'Lifetime license active',
    'sidebar.upgradePro': 'Upgrade to Pro Version',
    'sidebar.upgradeLifetime': 'Upgrade to Lifetime',
    'sidebar.billing': 'Billing',
    'sidebar.logout': 'Log Out',
    'sidebar.freemium': 'Freemium Plan',

    // Dashboard
    'dash.title': 'Dashboard',
    'dash.subtitle': 'Manage your business activity.',
    'dash.revenue': 'Revenue',
    'dash.orders': 'Orders',
    'dash.clients': 'Customers',
    'dash.pending_orders': 'Pending Orders',
    'dash.recent_orders': 'Recent Orders',
    'dash.vip_clients': 'VIP Customers',
    'dash.active_clients': 'Active Customers',
    'dash.total_orders': 'Total Orders',
    'dash.total_clients': 'Total Customers',
    'dash.whatsapp_active': 'WhatsApp channel active',
    'dash.welcome_morning': 'Good morning',
    'dash.welcome_afternoon': 'Good afternoon',
    'dash.welcome_evening': 'Good evening',

    // Billing
    'bill.title': 'Subscriptions & Billing',
    'bill.subtitle': 'Choose the plan that matches your shop size.',
    'bill.monthly': 'Monthly Subscription',
    'bill.lifetime': 'Lifetime Subscriber',
    'bill.monthly_desc': 'All essential tools for your business on a month-to-month basis.',
    'bill.lifetime_desc': 'Pay once, enjoy BoutikFlow for a lifetime.',
    'bill.features': 'Included features:',
    'bill.current': 'Your current plan',
    'bill.choose': 'Choose this plan',
    'bill.orange_money': 'Orange Money Payment',
    'bill.phone': 'Phone number (Orange)',
    'bill.pay': 'Pay Now',
    'bill.cancel': 'Cancel',
    'bill.success': 'Payment initiated successfully!',

    // Products
    'prod.title': 'Product Catalog',
    'prod.subtitle': 'Manage your inventory and prices.',
    'prod.add': 'Add product',
    'prod.search': 'Search by name, SKU or barcode...',
    'prod.name': 'Product',
    'prod.category': 'Category',
    'prod.price': 'Price',
    'prod.stock': 'Stock',
    'prod.sku': 'SKU',
    'prod.status': 'Status',
    'prod.actions': 'Actions',
    'prod.available': 'Available',
    'prod.unavailable': 'Unavailable',
    'prod.in_stock': 'in stock',
    'prod.out_of_stock': 'Out of stock',
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('fr');

  useEffect(() => {
    const saved = localStorage.getItem('boutikflow_lang') as Language;
    if (saved === 'fr' || saved === 'en') {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('boutikflow_lang', lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || translations['fr'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
