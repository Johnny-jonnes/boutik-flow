import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Badge de développement (next dev uniquement) déplacé à droite : en bas à
  // gauche, il recouvrait le profil et le bouton de déconnexion du menu.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
