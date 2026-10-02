"use client";

import { BarChartIcon, ClockIcon } from "@/components/icons";
import { BRIDGE_STAGE_LABEL, BRIDGE_STAGES, mapBridgeToStage, type BridgeStage } from "@/lib/projects/bridgeStage";
import { Card, CardTitle } from "../ui";
import type { ApiProjectDetail } from "../types";

interface Props {
  project: ApiProjectDetail;
}

const STAGE_BAR_COLOR: Record<BridgeStage, string> = {
  MATERIAL_ENVIADO: "#D3D5DA",
  BRIDGE_SPEC_APROVADO: "#8DBBF7",
  WIREFRAME_PO: "#2F7CF6",
  WIREFRAME_UX: "#8F5CF6",
  FINALIZADO: "#3DBB6A",
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function daysBetween(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

// Métricas (versão mínima/funcional): só o que dá pra calcular com os
// timestamps reais que o Bridge já guarda (createdAt, bddApprovedAt). Não
// existe "finalizadoEm" no Bridge, então não há métrica de tempo até
// Finalizado — preferimos omitir a inventar uma aproximação enganosa.
export default function ProjectMetricsTab({ project }: Props) {
  const withSpecApproved = project.bridges.filter((b) => b.bddApprovedAt);
  // Math.max(0, ...): createdAt é sempre <= bddApprovedAt na prática; nunca
  // negativo na exibição mesmo num caso de relógio/seed extremo.
  const materialToSpecDays = average(
    withSpecApproved.map((b) => Math.max(0, daysBetween(new Date(b.bddApprovedAt!), new Date(b.createdAt))))
  );

  const stageCounts = BRIDGE_STAGES.reduce<Record<BridgeStage, number>>((acc, stage) => {
    acc[stage] = project.bridges.filter((b) => mapBridgeToStage(b) === stage).length;
    return acc;
  }, {} as Record<BridgeStage, number>);
  const maxCount = Math.max(1, ...BRIDGE_STAGES.map((s) => stageCounts[s]));

  if (project.bridges.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-[#50545C]">
        Nenhum Bridge vinculado ainda — as métricas aparecem aqui assim que houver Bridges no Projeto.
      </Card>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Card className="p-5">
        <CardTitle icon={<ClockIcon className="h-6 w-6" />}>Tempo médio até o Bridge Spec aprovado</CardTitle>
        {materialToSpecDays === null ? (
          <p className="mt-4 text-sm text-[#50545C]">Nenhum Bridge com Bridge Spec aprovado ainda.</p>
        ) : (
          <p className="mt-4 text-[34px] font-bold leading-none text-[#15161A]">
            {materialToSpecDays.toFixed(1)} <span className="text-[16px] font-medium text-[#50545C]">dias</span>
          </p>
        )}
        <p className="mt-3 text-[13px] text-[#6B6F77]">
          Da criação do Bridge até a aprovação do Bridge Spec — média de {withSpecApproved.length} Bridge(s).
        </p>
      </Card>

      <Card className="p-5">
        <CardTitle icon={<BarChartIcon className="h-6 w-6" />}>Distribuição por etapa</CardTitle>
        <div className="mt-4 space-y-3">
          {BRIDGE_STAGES.map((stage) => (
            <div key={stage} className="flex items-center gap-3">
              <span className="w-[130px] shrink-0 text-[14px] text-[#1D1F25]">{BRIDGE_STAGE_LABEL[stage]}</span>
              <div className="h-[16px] flex-1">
                <div
                  className="h-full rounded-[4px]"
                  style={{ width: `${(stageCounts[stage] / maxCount) * 100}%`, minWidth: stageCounts[stage] > 0 ? 6 : 0, backgroundColor: STAGE_BAR_COLOR[stage] }}
                />
              </div>
              <span className="w-6 text-right text-[14.5px] font-semibold text-[#1D1F25]">{stageCounts[stage]}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
