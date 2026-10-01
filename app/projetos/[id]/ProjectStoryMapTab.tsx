"use client";

import GlassCard from "@/components/GlassCard";
import { CheckIcon } from "@/components/icons";
import { BRIDGE_STAGE_LABEL, BRIDGE_STAGES, mapBridgeToStage } from "@/lib/projects/bridgeStage";
import type { ApiProjectDetail } from "../types";

interface Props {
  project: ApiProjectDetail;
}

// Story Map (versão mínima/funcional, Projeto-1): cada Bridge vinculado vira
// um "cartão" com a trilha Material enviado → Bridge Spec aprovado →
// Wireframe PO → Wireframe UX → Finalizado — mesmas 5 etapas reais do
// pipeline "Status dos Bridges" da Visão geral, só numa visualização por
// cartão em vez de agregada.
export default function ProjectStoryMapTab({ project }: Props) {
  if (project.bridges.length === 0) {
    return (
      <GlassCard className="text-center text-sm text-luminous-on-surface-variant">
        Nenhum Bridge vinculado ainda — vincule pela aba Visão geral.
      </GlassCard>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {project.bridges.map((bridge) => {
        const currentStage = mapBridgeToStage(bridge);
        const currentIndex = BRIDGE_STAGES.indexOf(currentStage);
        return (
          <GlassCard key={bridge.id} className="transition hover:-translate-y-0.5">
            <a href={`/bridges/${bridge.id}`} className="font-sora text-sm font-semibold text-luminous-on-surface hover:underline">
              {bridge.planetName}
            </a>
            <p className="mt-0.5 text-xs text-luminous-on-surface-variant">
              {bridge.estrelaName} {bridge.galaxiaName ? `· ${bridge.galaxiaName}` : ""}
            </p>

            <div className="mt-4 space-y-2.5">
              {BRIDGE_STAGES.map((stage, index) => {
                const done = index < currentIndex || bridge.status === "FINALIZADO";
                const active = index === currentIndex && bridge.status !== "FINALIZADO";
                return (
                  <div key={stage} className="flex items-center gap-2.5">
                    <div
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition ${
                        done
                          ? "border-emerald-400 bg-emerald-400/20 text-emerald-400"
                          : active
                            ? "border-luminous-primary bg-luminous-primary/20 text-luminous-primary-fixed-dim"
                            : "border-white/10 bg-white/5 text-luminous-on-surface-variant/50"
                      }`}
                    >
                      {done ? <CheckIcon className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                    </div>
                    <span className={`text-xs ${active ? "font-medium text-luminous-on-surface" : "text-luminous-on-surface-variant"}`}>
                      {BRIDGE_STAGE_LABEL[stage]}
                    </span>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
