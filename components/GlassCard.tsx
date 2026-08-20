import type { ReactNode } from "react";

type Props = { children: ReactNode; className?: string; icon?: ReactNode };
// Superfície de vidro para agrupar informações do dashboard.
export default function GlassCard({ children, className = "", icon }: Props) {
  return <section className={`rounded-xl border border-white/10 bg-luminous-surface-container/65 p-6 backdrop-blur-md ${className}`}>{icon && <div className="mb-4">{icon}</div>}{children}</section>;
}
