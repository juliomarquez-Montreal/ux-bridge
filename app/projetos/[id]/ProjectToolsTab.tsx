"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Skeleton from "@/components/Skeleton";
import { CompareIcon, ConflictIcon, DependencyIcon, RadarIcon, TagIcon } from "@/components/icons";
import { Card } from "../ui";
import type { ApiProjectDetail, ApiToolsData } from "../types";
import ScopeRadar from "./tools/ScopeRadar";
import ConflictDetector from "./tools/ConflictDetector";
import DependencyMap from "./tools/DependencyMap";
import SpecComparer from "./tools/SpecComparer";
import AreaMap from "./tools/AreaMap";

export type ToolKey = "scope" | "conflicts" | "dependencies" | "compare" | "areas";

export const TOOLS: { key: ToolKey; label: string; description: string; icon: (p: { className?: string }) => ReactNode }[] = [
  { key: "scope", label: "Radar de Escopo", description: "A IA confere se cada Bridge contribui para o objetivo do Projeto.", icon: RadarIcon },
  { key: "conflicts", label: "Detector de Conflitos", description: "A IA procura regras de negócio contraditórias entre os Bridge Specs.", icon: ConflictIcon },
  { key: "dependencies", label: "Mapa de Dependências", description: "Declare quem depende de quem e veja o diagrama (e os gargalos).", icon: DependencyIcon },
  { key: "compare", label: "Comparador de Specs", description: "Bridge Specs lado a lado, com anotações do PO.", icon: CompareIcon },
  { key: "areas", label: "Mapa de Áreas", description: "Etiquete cada Bridge com uma área e veja o resumo agrupado.", icon: TagIcon },
];

interface Props {
  project: ApiProjectDetail;
  section: ToolKey;
  onSectionChange: (section: ToolKey) => void;
  onChanged: () => Promise<void>;
}

// 6ª aba "Ferramentas do PO" (Projeto-2): 5 ferramentas que só fazem sentido
// com vários Bridges reunidos. Os dados guardados por elas vêm de
// GET /api/projetos/:id/tools; cada ferramenta recarrega depois de agir e
// avisa a página (onChanged) pra atualizar o indicador "Salvo automaticamente".
export default function ProjectToolsTab({ project, section, onSectionChange, onChanged }: Props) {
  const [tools, setTools] = useState<ApiToolsData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reloadTools = useCallback(async () => {
    try {
      const res = await fetch(`/api/projetos/${project.id}/tools`);
      if (!res.ok) throw new Error();
      setTools((await res.json()) as ApiToolsData);
      setLoadError(null);
    } catch {
      setLoadError("Não foi possível carregar os dados das ferramentas.");
    }
  }, [project.id]);

  useEffect(() => {
    reloadTools();
  }, [reloadTools]);

  const active = TOOLS.find((t) => t.key === section) ?? TOOLS[0];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {TOOLS.map(({ key, label, icon: Icon }) => {
          const isActive = key === section;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSectionChange(key)}
              className={`flex items-center gap-2 rounded-[8px] border px-4 py-2.5 text-[14.5px] font-medium transition active:scale-[0.97] ${
                isActive
                  ? "border-[#8B40F5] bg-[#F5EEFE] text-[#6B2FD1]"
                  : "border-[#E6E8EC] bg-white text-[#1D1F25] hover:border-[#C9CDD4] hover:bg-[#F7F8FA]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[14px] text-[#50545C]">{active.description}</p>

      <div key={section} className="mt-4 animate-[fadeIn_0.25s_ease-out]">
        {loadError ? (
          <Card className="p-6 text-sm text-[#C42B2B]">{loadError}</Card>
        ) : !tools ? (
          <div className="space-y-3">
            <Skeleton tone="light" className="h-24 w-full rounded-[10px]" />
            <Skeleton tone="light" className="h-40 w-full rounded-[10px]" />
          </div>
        ) : (
          <>
            {section === "scope" && <ScopeRadar project={project} tools={tools} reload={reloadTools} onChanged={onChanged} />}
            {section === "conflicts" && <ConflictDetector project={project} tools={tools} reload={reloadTools} onChanged={onChanged} />}
            {section === "dependencies" && <DependencyMap project={project} tools={tools} reload={reloadTools} onChanged={onChanged} />}
            {section === "compare" && <SpecComparer project={project} tools={tools} reload={reloadTools} onChanged={onChanged} />}
            {section === "areas" && <AreaMap project={project} onChanged={onChanged} />}
          </>
        )}
      </div>
    </div>
  );
}
