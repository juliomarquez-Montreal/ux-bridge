import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; variant?: "primary" | "secondary" | "inactive" };
// Botão em formato pill para ações e filtros rápidos.
export default function PillButton({ children, variant = "primary", className = "", ...props }: Props) {
  const styles = { primary: "bg-luminous-primary text-luminous-on-primary hover:bg-luminous-primary-fixed", secondary: "border border-luminous-primary/50 bg-luminous-primary/10 text-luminous-on-surface hover:bg-luminous-primary/20", inactive: "border border-white/10 bg-white/5 text-luminous-on-surface-variant hover:text-luminous-on-surface" };
  return <button className={`rounded-full px-4 py-2 font-mono text-xs uppercase tracking-[0.1em] transition ${styles[variant]} ${className}`} {...props}>{children}</button>;
}
