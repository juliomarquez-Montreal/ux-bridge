// Placeholder de carregamento com "shimmer" (gradiente varrendo da esquerda
// pra direita em loop) — usado em vez de texto estático "Carregando..." nas
// telas de Projetos (Projeto-1). A animação em si (keyframes + classe
// .skeleton-shimmer) vem de app/globals.css.
export default function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton-shimmer bg-white/5 ${className}`} aria-hidden="true" />;
}
