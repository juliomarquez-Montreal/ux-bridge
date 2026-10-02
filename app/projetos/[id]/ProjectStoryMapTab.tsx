"use client";

import { CheckIcon } from "@/components/icons";
import { BRIDGE_STAGE_LABEL, BRIDGE_STAGES, mapBridgeToStage } from "@/lib/projects/bridgeStage";
import { Card } from "../ui";
import type { ApiProjectDetail } from "../types";

interface Props {
  project: ApiProjectDetail;
}

// Story Map (versão mínima/funcional): cada Bridge vinculado vira um cartão
// com a trilha Material enviado → Bridge Spec aprovado → Wireframe PO →
// Wireframe UX → Finalizado — as mesmas 5 etapas reais do "Status dos
// Bridges" da Visão geral, só por cartão. Visual da "Linha da release" do
// mockup (concluído = verde, atual = azul com halo, futuro = vazado).
export default function ProjectStoryMapTab({ project }: Props) {
  if (project.bridges.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-[#50545C]">Nenhum Bridge vinculado ainda — vincule pela aba Visão geral.</Card>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {project.bridges.map((bridge) => {
        const currentStage = mapBridgeToStage(bridge);
        const currentIndex = BRIDGE_STAGES.indexOf(currentStage);
        const allDone = bridge.status === "FINALIZADO";
        const filledUntil = allDone ? BRIDGE_STAGES.length - 1 : currentIndex;
        return (
          <Card key={bridge.id} className="p-5 transition hover:shadow-[0_6px_18px_rgba(16,24,40,0.08)]">
            <a href={`/bridges/${bridge.id}`} className="text-[17px] font-bold text-[#15161A] hover:text-[#8B40F5]">
              {bridge.planetName}
            </a>
            <p className="mt-0.5 text-[13.5px] text-[#50545C]">
              {[bridge.estrelaName, bridge.galaxiaName].filter(Boolean).join(" · ")}
            </p>

            <div className="relative mt-6">
              <div
                className="absolute top-[13px] h-0 border-t-2 border-dashed border-[#D3D5DA]"
                style={{ left: `${50 / BRIDGE_STAGES.length}%`, right: `${50 / BRIDGE_STAGES.length}%` }}
              />
              {filledUntil > 0 && (
                <div
                  className="absolute top-[12px] h-[3px] rounded bg-[#1F6FE8]"
                  style={{ left: `${50 / BRIDGE_STAGES.length}%`, width: `${(filledUntil / BRIDGE_STAGES.length) * 100}%` }}
                />
              )}
              <div className="relative grid grid-cols-5">
                {BRIDGE_STAGES.map((stage, index) => {
                  const done = index < currentIndex || allDone;
                  const active = index === currentIndex && !allDone;
                  return (
                    <div key={stage} className="flex flex-col items-center text-center">
                      <div className="grid h-[28px] place-items-center">
                        {done ? (
                          <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-[#2EB872] text-white">
                            <CheckIcon className="h-3.5 w-3.5" />
                          </span>
                        ) : active ? (
                          <span className="grid h-[28px] w-[28px] place-items-center rounded-full bg-[#CFE0FB]">
                            <span className="h-[18px] w-[18px] rounded-full border-[3px] border-white bg-[#1F6FE8] shadow" />
                          </span>
                        ) : (
                          <span className="h-[22px] w-[22px] rounded-full border-2 border-[#9A9EA6] bg-white" />
                        )}
                      </div>
                      <span
                        className={`mt-2 px-1 text-[12.5px] leading-tight ${
                          active ? "font-semibold text-[#1A5FD0]" : done ? "text-[#1B6B36]" : "text-[#6B6F77]"
                        }`}
                      >
                        {BRIDGE_STAGE_LABEL[stage]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
