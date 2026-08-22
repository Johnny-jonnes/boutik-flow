import { ThemeToggle } from '@/components/ThemeToggle';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* top/right en px ignorent l'encoche/Dynamic Island — position:fixed
          se positionne par rapport au viewport, jamais ajusté automatiquement
          pour une zone sûre. max(...) garde le décalage habituel de 1rem sur
          un écran sans encoche, et bascule sur l'inset réel dès qu'il existe
          (même mécanisme déjà utilisé par .auth-page dans login/page.tsx,
          qui ne couvre que le contenu de la carte, pas cet élément — rendu
          en dehors, comme frère de {children} dans ce layout). */}
      <div style={{
        position: 'fixed',
        top: 'max(1rem, env(safe-area-inset-top, 0px))',
        right: 'max(1rem, env(safe-area-inset-right, 0px))',
        zIndex: 50,
      }}>
        <ThemeToggle />
      </div>
      {children}
    </>
  );
}
