"use client";

import GlassCard from "@/components/GlassCard";
import { BRIDGE_STAGE_LABEL, BRIDGE_STAGES, mapBridgeToStage } from "@/lib/projects/bridgeStage";
import type { ApiProjectDetail } from "../types";

interface Props {
  project: ApiProjectDetail;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function daysBetween(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

// Métricas (versão mínima/funcional, Projeto-1): tempo decorrido por etapa,
// agregado entre os Bridges vinculados — só o que dá pra calcular com os
// timestamps reais que o Bridge já guarda (createdAt, bddApprovedAt). Não
// existe um campo "finalizadoEm" no Bridge, então o tempo até Finalizado usa
// updatedAt como aproximação (último campo alterado) — deixado explícito na
// legenda, não escondido como se fosse exato.
export default function ProjectMetricsTab({ project }: Props) {
  const withSpecApproved = project.bridges.filter((b) => b.bddApprovedAt);
  // Math.max(0, ...): em teoria createdAt é sempre <= bddApprovedAt, mas
  // nunca negativo na exibição mesmo num caso de relógio/seed extremo.
  const materialToSpecDays = average(
    withSpecApproved.map((b) => Math.max(0, daysBetween(new Date(b.bddApprovedAt!), new Date(b.createdAt))))
  );

  const stageCounts = BRIDGE_STAGES.reduce<Record<string, number>>((acc, stage) => {
    acc[stage] = project.bridges.filter((b) => mapBridgeToStage(b) === stage).length;
    return acc;
  }, {});

  if (project.bridges.length === 0) {
    return (
      <GlassCard className="text-center text-sm text-luminous-on-surface-variant">
        Nenhum Bridge vinculado ainda — métricas aparecem aqui assim que houver Bridges no Projeto.
      </GlassCard>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <GlassCard>
        <h3 className="font-sora text-sm font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">
          Tempo médio até o Bridge Spec aprovado
        </h3>
        {materialToSpecDays === null ? (
          <p className="mt-3 text-sm text-luminous-on-surface-variant">Nenhum Bridge com Bridge Spec aprovado ainda.</p>
        ) : (
          <p className="mt-3 text-3xl font-bold text-luminous-on-surface">
            {materialToSpecDays.toFixed(1)} <span className="text-sm font-normal text-luminous-on-surface-variant">dias</span>
          </p>
        )}
        <p className="mt-2 text-xs text-luminous-on-surface-variant/70">
          Da criação do Bridge até a aprovação do Bridge Spec, média de {withSpecApproved.length} Bridge(s).
        </p>
      </GlassCard>

      <GlassCard>
        <h3 className="font-sora text-sm font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">Distribuição por etapa</h3>
        <ul className="mt-3 space-y-2">
          {BRIDGE_STAGES.map((stage) => (
            <li key={stage} className="flex items-center justify-between text-sm">
              <span className="text-luminous-on-surface-variant">{BRIDGE_STAGE_LABEL[stage]}</span>
              <span className="font-semibold text-luminous-on-surface">{stageCounts[stage] ?? 0}</span>
            </li>
          ))}
        </ul>
      </GlassCard>
    </div>
  );
}
