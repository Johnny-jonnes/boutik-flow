import type { Metadata, Viewport } from "next";
import { ThemeProvider } from '@/components/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';
import { LanguageProvider } from '@/context/LanguageContext';
import "./globals.css";

export const metadata: Metadata = {
  title: "BoutikFlow — Caisse, CRM & Gestion de boutique",
  description:
    "BoutikFlow : caisse enregistreuse, CRM clients, gestion de stock et finances pour votre boutique. 100% offline, conçu pour les commerçants africains.",
  keywords: ["caisse", "POS", "CRM", "boutique", "Guinée", "ventes", "offline", "stock", "BoutikFlow"],
  authors: [{ name: "BoutikFlow" }],
  openGraph: {
    title: "BoutikFlow — Caisse & CRM",
    description: "Caisse, CRM et gestion de boutique 100% offline pour commerçants africains.",
    type: "website",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BoutikFlow",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icon-192.png",
    shortcut: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#4f46e5',
};

import { PWARegister } from "@/components/PWARegister";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning évite le warning lié à la classe .light/.dark
    // que next-themes injecte côté client sur <html>
    <html lang="fr" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/icon-192.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="msapplication-TileColor" content="#4f46e5" />
      </head>
      <body>
        <LanguageProvider>
          <ThemeProvider>
            <PWARegister />
            {children}
            {/* Toaster global — fonctionne avec les deux thèmes via next-themes */}
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
