import type { ReactNode } from "react";

type Props = { title: string; value: string; unit?: string; icon?: ReactNode; trend?: string };
// Métrica compacta reutilizada nos blocos de indicadores.
export default function KpiCard({ title, value, unit, icon, trend }: Props) {
  return <div className="min-w-0"><div className="mb-1 flex items-center gap-1 text-xs text-luminous-on-surface-variant">{icon}{title}</div><div className="flex items-baseline gap-1"><strong className="font-sora text-3xl leading-none text-luminous-on-surface">{value}</strong>{unit && <span className="text-xs text-luminous-on-surface-variant">{unit}</span>}</div>{trend && <span className="mt-1 block font-mono text-[10px] text-luminous-primary">{trend}</span>}</div>;
}
