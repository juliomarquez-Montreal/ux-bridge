"use client";

import { useState } from "react";
import Skeleton from "@/components/Skeleton";
import { AlertIcon, CheckCircleIcon, ConflictIcon } from "@/components/icons";
import { Btn, Card, CardTitle, Pill } from "../../ui";
import { bridgeName, formatDateTime, isLinked, type ToolProps } from "./shared";

// Ferramenta 2 — Detector de Conflitos: manda REGRAS DE NEGÓCIO + DEPENDÊNCIAS
// de todos os Bridge Specs do Projeto numa só chamada de IA e lista as
// contradições/sobreposições reais entre pares de Bridges.
export default function ConflictDetector({ project, tools, reload, onChanged }: ToolProps) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withSpec = project.bridges.filter((b) => b.hasSpec).length;
  const enough = withSpec >= 2;
  const analysis = tools.conflictAnalysis;
  // Conflitos que citam Bridge já desvinculado do Projeto deixam de valer.
  const conflicts = (analysis?.conflicts ?? []).filter((c) => isLinked(project, c.bridgeIdA) && isLinked(project, c.bridgeIdB));

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/projetos/${project.id}/conflict-analysis`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao detectar conflitos.");
      await reload();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao detectar conflitos.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <CardTitle
          icon={<ConflictIcon className="h-6 w-6" />}
          right={
            <Btn variant="primary" onClick={run} disabled={running || !enough}>
              {running ? "Detectando..." : "Detectar Conflitos"}
            </Btn>
          }
        >
          Detector de Conflitos
        </CardTitle>
        <p className="mt-3 text-[14px] text-[#50545C]">
          Compara as seções <strong className="text-[#1D1F25]">Regras de negócio</strong> e <strong className="text-[#1D1F25]">Dependências</strong> de
          todos os Bridge Specs do Projeto ({withSpec} com Bridge Spec gerado).
        </p>
        {!enough && (
          <p className="mt-3 flex items-center gap-2 text-[14px] text-[#8A5A00]">
            <AlertIcon className="h-4 w-4" />É preciso ter pelo menos 2 Bridges com Bridge Spec gerado para detectar conflitos.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-[#C42B2B]">{error}</p>}
      </Card>

      {running ? (
        <div className="space-y-3">
          <Skeleton tone="light" className="h-24 w-full rounded-[10px]" />
          <Skeleton tone="light" className="h-24 w-full rounded-[10px]" />
        </div>
      ) : analysis ? (
        conflicts.length === 0 ? (
          <Card className="flex items-center gap-3 !border-[#BFE6CB] !bg-[#F1FAF4] p-5 text-[15px] text-[#1A7A3C]">
            <CheckCircleIcon className="h-6 w-6" />
            Nenhum conflito detectado entre os Bridge Specs. Tudo certo por aqui!
            <span className="ml-auto text-[12.5px] font-normal text-[#50545C]">Análise de {formatDateTime(analysis.analyzedAt)}</span>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-[13px] text-[#6B6F77]">
              {conflicts.length} conflito(s) — análise de {formatDateTime(analysis.analyzedAt)}
            </p>
            {conflicts.map((conflict, index) => (
              <Card key={index} className="!border-[#F5C26B] !bg-[#FFFBF0] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <AlertIcon className="h-5 w-5 text-[#8A5A00]" />
                  <Pill tone="amber">{bridgeName(project, conflict.bridgeIdA)}</Pill>
                  <span className="text-[13px] font-semibold text-[#8A5A00]">×</span>
                  <Pill tone="amber">{bridgeName(project, conflict.bridgeIdB)}</Pill>
                </div>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-[#1D1F25]">{conflict.description}</p>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card className="p-6 text-center text-sm text-[#50545C]">Nenhuma análise feita ainda. Clique em &quot;Detectar Conflitos&quot;.</Card>
      )}
    </div>
  );
}
