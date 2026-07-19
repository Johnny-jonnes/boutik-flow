import type { Metadata } from "next";
import { ThemeProvider } from '@/components/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';
import "./globals.css";

export const metadata: Metadata = {
  title: "BoutikFlow — CRM WhatsApp pour boutiques africaines",
  description:
    "Gérez vos clients, automatisez vos ventes WhatsApp et développez votre boutique avec BoutikFlow. Le CRM intelligent conçu pour les commerçants guinéens.",
  keywords: ["CRM", "WhatsApp", "boutique", "Guinée", "ventes", "e-commerce", "automatisation"],
  authors: [{ name: "BoutikFlow" }],
  openGraph: {
    title: "BoutikFlow",
    description: "CRM WhatsApp pour boutiques africaines",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning évite le warning lié à la classe .light/.dark
    // que next-themes injecte côté client sur <html>
    <html lang="fr" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
          {/* Toaster global — fonctionne avec les deux thèmes via next-themes */}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
