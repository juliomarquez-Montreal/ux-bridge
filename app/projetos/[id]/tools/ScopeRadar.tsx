"use client";

import { useState } from "react";
import Skeleton from "@/components/Skeleton";
import { AlertIcon, CheckCircleIcon, RadarIcon } from "@/components/icons";
import { Btn, Card, CardTitle } from "../../ui";
import { formatDateTime, type ToolProps } from "./shared";

// Ferramenta 1 — Radar de Desvio de Escopo: pergunta à IA, Bridge a Bridge,
// se ele contribui pro `objective` do Projeto (lendo CONTEXTO / PROBLEMA e
// HISTÓRIA DE USUÁRIO do Bridge Spec). Bridges marcados aligned:false ficam
// destacados com alerta e a explicação da IA.
export default function ScopeRadar({ project, tools, reload, onChanged }: ToolProps) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const hasObjective = !!project.objective?.trim();
  const analysisByBridge = new Map(tools.scopeAnalyses.map((a) => [a.bridgeId, a]));
  const misaligned = project.bridges.filter((b) => analysisByBridge.get(b.id)?.aligned === false).length;

  async function run() {
    setRunning(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/projetos/${project.id}/scope-analysis`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao analisar o alinhamento.");
      const notes: string[] = [];
      if (data.skippedWithoutSpec > 0) notes.push(`${data.skippedWithoutSpec} Bridge(s) sem Bridge Spec foram ignorados.`);
      if (data.failed?.length > 0) notes.push(`${data.failed.length} análise(s) falharam — rode de novo.`);
      setInfo(notes.length ? notes.join(" ") : null);
      await reload();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao analisar o alinhamento.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <CardTitle
          icon={<RadarIcon className="h-6 w-6" />}
          right={
            <Btn variant="primary" onClick={run} disabled={running || !hasObjective || project.bridges.length === 0}>
              {running ? "Analisando..." : "Analisar Alinhamento"}
            </Btn>
          }
        >
          Radar de Desvio de Escopo
        </CardTitle>
        <div className="mt-3 rounded-[8px] bg-[#F4F5F7] px-4 py-3 text-[14px] text-[#50545C]">
          <span className="font-semibold text-[#1D1F25]">Objetivo do Projeto: </span>
          {hasObjective ? project.objective : "não definido."}
        </div>
        {!hasObjective && (
          <p className="mt-3 flex items-center gap-2 text-[14px] text-[#8A5A00]">
            <AlertIcon className="h-4 w-4" />
            Preencha o objetivo do Projeto primeiro (Visão geral → card &quot;Objetivo do projeto&quot; → Editar) para poder analisar o alinhamento.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-[#C42B2B]">{error}</p>}
        {info && <p className="mt-3 text-sm text-[#8A5A00]">{info}</p>}
        {tools.scopeAnalyses.length > 0 && !running && (
          <p className="mt-3 text-[13px] text-[#6B6F77]">
            {misaligned === 0
              ? "Todos os Bridges analisados estão alinhados ao objetivo."
              : `${misaligned} Bridge(s) possivelmente fora do escopo.`}
          </p>
        )}
      </Card>

      {running ? (
        <div className="space-y-3">
          {project.bridges.map((b) => (
            <Skeleton key={b.id} tone="light" className="h-[76px] w-full rounded-[10px]" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {project.bridges.map((bridge) => {
            const analysis = analysisByBridge.get(bridge.id);
            const state = analysis ? (analysis.aligned ? "ok" : "bad") : "none";
            return (
              <Card
                key={bridge.id}
                className={`flex items-start gap-4 p-4 transition ${state === "bad" ? "!border-[#F5C26B] !bg-[#FFFBF0]" : ""}`}
              >
                <span
                  className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                    state === "ok" ? "bg-[#DCF4E3] text-[#1A7A3C]" : state === "bad" ? "bg-[#FDF0CC] text-[#8A5A00]" : "bg-[#ECEEF1] text-[#6B6F77]"
                  }`}
                >
                  {state === "bad" ? <AlertIcon className="h-5 w-5" /> : <CheckCircleIcon className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <p className="text-[16px] font-bold text-[#15161A]">{bridge.planetName}</p>
                    {state === "ok" && <span className="rounded-[6px] bg-[#DCF4E3] px-2 py-0.5 text-[12.5px] font-medium text-[#1A7A3C]">Alinhado</span>}
                    {state === "bad" && <span className="rounded-[6px] bg-[#FDF0CC] px-2 py-0.5 text-[12.5px] font-medium text-[#8A5A00]">Fora do escopo?</span>}
                  </div>
                  {analysis ? (
                    <>
                      <p className="mt-1 text-[14px] leading-relaxed text-[#1D1F25]">{analysis.explanation}</p>
                      <p className="mt-1 text-[12.5px] text-[#6B6F77]">Analisado em {formatDateTime(analysis.analyzedAt)}</p>
                    </>
                  ) : (
                    <p className="mt-1 text-[14px] text-[#6B6F77]">
                      {bridge.hasSpec ? "Ainda não analisado — clique em Analisar Alinhamento." : "Sem Bridge Spec gerado — não dá pra analisar."}
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
