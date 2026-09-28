import type { ReactNode } from "react";

type Props = { children: ReactNode; variant?: "success" | "warning" | "info" | "neutral" };
// Etiqueta curta para status, prioridades e metadados.
export default function Badge({ children, variant = "neutral" }: Props) {
  // "warning" fica com âmbar fixo (não segue mais o token tertiary): a
  // terciária virou azul (acento geral, ver tailwind.config.ts), mas
  // "atenção/prioridade alta" continua fazendo mais sentido em âmbar.
  const styles = { success: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200", warning: "border-[#ffb688]/40 bg-[#ffb688]/10 text-[#ffb688]", info: "border-luminous-primary/40 bg-luminous-primary/10 text-luminous-primary-fixed", neutral: "border-white/10 bg-white/5 text-luminous-on-surface-variant" };
  return <span className={`inline-flex rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] ${styles[variant]}`}>{children}</span>;
}
