import type { Metadata, Viewport } from "next";
import { ThemeProvider } from '@/components/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';
import { LanguageProvider } from '@/context/LanguageContext';
import "./globals.css";

export const metadata: Metadata = {
  title: "BoutikFlow \u2014 CRM WhatsApp pour boutiques africaines",
  description:
    "Gérez vos clients, automatisez vos ventes WhatsApp et développez votre boutique avec BoutikFlow. Le CRM intelligent conçu pour les commerçants guinéens.",
  keywords: ["CRM", "WhatsApp", "boutique", "Guinée", "ventes", "e-commerce", "automatisation"],
  authors: [{ name: "BoutikFlow" }],
  openGraph: {
    title: "BoutikFlow",
    description: "CRM WhatsApp pour boutiques africaines",
    type: "website",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BoutikFlow",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#10b981',
};

import { PWARegister } from "@/components/PWARegister";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning évite le warning lié à la classe .light/.dark
    // que next-themes injecte côté client sur <html>
    <html lang="fr" suppressHydrationWarning>
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
