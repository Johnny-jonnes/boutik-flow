import type { Metadata } from "next";
import { Toaster } from 'sonner';
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
    <html lang="fr">
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
