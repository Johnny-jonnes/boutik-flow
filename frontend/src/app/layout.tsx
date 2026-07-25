import type { Metadata, Viewport } from "next";
import { ThemeProvider } from '@/components/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';
import { LanguageProvider } from '@/context/LanguageContext';
import { PWARegister } from "@/components/PWARegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "BoutikFlow — Vendre, gérer, suivre votre boutique",
  description:
    "BoutikFlow : vendez, gérez vos produits, clients et finances. 100% offline. Conçu pour les commerçants africains.",
  keywords: ["caisse", "POS", "CRM", "boutique", "Guinée", "ventes", "offline", "stock", "BoutikFlow"],
  authors: [{ name: "BoutikFlow" }],
  openGraph: {
    title: "BoutikFlow — Vendre & Gérer",
    description: "Vendre, gérer, suivre. La caisse la plus simple pour les commerçants africains.",
    type: "website",
  },
  manifest: "/manifest.json?v=3",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BoutikFlow",
  },
  icons: {
    icon: [
      { url: "/logo-bf.svg?v=3", type: "image/svg+xml" },
      { url: "/favicon-32x32.png?v=3", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png?v=3", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png?v=3", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/logo-bf.svg?v=3",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#009460' },
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
        <link rel="icon" href="/logo-bf.svg?v=3" type="image/svg+xml" />
        <link rel="icon" href="/favicon-32x32.png?v=3" sizes="32x32" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=3" />
        <link rel="apple-touch-icon-precomposed" href="/apple-touch-icon-precomposed.png?v=3" />
        <meta name="msapplication-TileColor" content="#009460" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png?v=3" />
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
