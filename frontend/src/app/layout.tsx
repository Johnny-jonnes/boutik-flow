import type { Metadata, Viewport } from "next";
import { ThemeProvider } from '@/components/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';
import { LanguageProvider } from '@/context/LanguageContext';
import { PWARegister } from "@/components/PWARegister";
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
  manifest: "/manifest.json?v=2",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BoutikFlow",
  },
  icons: {
    icon: [
      { url: "/icon.svg?v=2", type: "image/svg+xml" },
      { url: "/favicon-32x32.png?v=2", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png?v=2", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/icon.svg?v=2",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#6dd5c4' },
    { media: '(prefers-color-scheme: dark)', color: '#080c0b' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="BoutikFlow" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="icon" href="/icon.svg?v=2" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico?v=2" sizes="any" />
        <link rel="alternate icon" href="/icon-192.png?v=2" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" />
        <meta name="msapplication-TileColor" content="#6dd5c4" />
        <meta name="msapplication-TileImage" content="/icon-144.png?v=2" />
      </head>
      <body>
        <LanguageProvider>
          <ThemeProvider>
            <PWARegister />
            {children}
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
