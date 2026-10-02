// Placeholder de carregamento com "shimmer" (gradiente varrendo da esquerda
// pra direita em loop) — usado em vez de texto estático "Carregando..." nas
// telas de Projetos. `tone="light"` é pro tema claro de /projetos (fundo
// cinza-claro + brilho branco); o padrão "dark" serve o resto do app. A
// animação (keyframes + classes .skeleton-shimmer/.skeleton-shimmer-light)
// vem de app/globals.css.
export default function Skeleton({ className = "", tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <div
      className={`${tone === "light" ? "skeleton-shimmer skeleton-shimmer-light bg-[#E9EBEF]" : "skeleton-shimmer bg-white/5"} ${className}`}
      aria-hidden="true"
    />
  );
}
