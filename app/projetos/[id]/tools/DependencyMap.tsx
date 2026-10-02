"use client";

import { useState } from "react";
import { AlertIcon, DependencyIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { Btn, Card, CardTitle, fieldClass, labelClass } from "../../ui";
import { bridgeName, isLinked, type ToolProps } from "./shared";

const NODE_W = 190;
const NODE_H = 48;
const GAP_X = 120;
const GAP_Y = 26;
const PAD = 24;
// A partir de quantos Bridges apontando PARA um mesmo Bridge ele vira "gargalo".
const BOTTLENECK_MIN = 2;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// Ferramenta 3 — Mapa de Dependências: o PO declara "X depende de Y"; o
// diagrama (SVG simples) põe quem não depende de ninguém à esquerda e quem
// depende à direita, com setas apontando de quem DEPENDE para o que ele
// precisa. Bridge com muitos dependentes apontando pra ele = gargalo (vermelho).
export default function DependencyMap({ project, tools, reload, onChanged }: ToolProps) {
  const [bridgeId, setBridgeId] = useState("");
  const [dependsOnId, setDependsOnId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeBusy, setRemoveBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const edges = tools.dependencies.filter((d) => isLinked(project, d.bridgeId) && isLinked(project, d.dependsOnBridgeId));

  // Camada = 0 se não depende de ninguém, senão 1 + a maior camada das que ele precisa.
  const depsOf = new Map<string, string[]>();
  for (const e of edges) depsOf.set(e.bridgeId, [...(depsOf.get(e.bridgeId) ?? []), e.dependsOnBridgeId]);
  const layerCache = new Map<string, number>();
  const layerOf = (id: string, visiting = new Set<string>()): number => {
    if (layerCache.has(id)) return layerCache.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const deps = depsOf.get(id) ?? [];
    const layer = deps.length === 0 ? 0 : 1 + Math.max(...deps.map((d) => layerOf(d, visiting)));
    layerCache.set(id, layer);
    return layer;
  };

  const layers: string[][] = [];
  for (const b of [...project.bridges].sort((a, c) => a.planetName.localeCompare(c.planetName))) {
    const layer = layerOf(b.id);
    (layers[layer] ??= []).push(b.id);
  }
  const position = new Map<string, { x: number; y: number }>();
  layers.forEach((ids, layerIndex) => {
    ids?.forEach((id, row) => position.set(id, { x: PAD + layerIndex * (NODE_W + GAP_X), y: PAD + row * (NODE_H + GAP_Y) }));
  });
  const columns = layers.length || 1;
  const maxRows = Math.max(1, ...layers.map((l) => l?.length ?? 0));
  const svgW = PAD * 2 + columns * NODE_W + (columns - 1) * GAP_X;
  const svgH = PAD * 2 + maxRows * NODE_H + (maxRows - 1) * GAP_Y;

  const incoming = new Map<string, number>();
  for (const e of edges) incoming.set(e.dependsOnBridgeId, (incoming.get(e.dependsOnBridgeId) ?? 0) + 1);
  const maxIncoming = Math.max(0, ...Array.from(incoming.values()));
  const isBottleneck = (id: string) => (incoming.get(id) ?? 0) >= BOTTLENECK_MIN && incoming.get(id) === maxIncoming;
  const touched = new Set(edges.flatMap((e) => [e.bridgeId, e.dependsOnBridgeId]));

  async function add() {
    if (!bridgeId || !dependsOnId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projetos/${project.id}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bridgeId, dependsOnBridgeId: dependsOnId, note: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao declarar a dependência.");
      setBridgeId("");
      setDependsOnId("");
      setNote("");
      await reload();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao declarar a dependência.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setRemoveBusy(id);
    try {
      await fetch(`/api/projetos/${project.id}/dependencies/${id}`, { method: "DELETE" });
      await reload();
      await onChanged();
    } finally {
      setRemoveBusy(null);
    }
  }

  const selectClass = `${fieldClass} !w-auto min-w-[200px] flex-1`;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <CardTitle icon={<DependencyIcon className="h-6 w-6" />}>Declarar dependência</CardTitle>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <label className={labelClass}>Este Bridge...</label>
            <select value={bridgeId} onChange={(e) => setBridgeId(e.target.value)} className={selectClass}>
              <option value="">Selecione</option>
              {project.bridges.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.planetName}
                </option>
              ))}
            </select>
          </div>
          <span className="pb-2.5 text-[14.5px] font-semibold text-[#6B2FD1]">depende de</span>
          <div className="flex-1">
            <label className={labelClass}>Este outro Bridge</label>
            <select value={dependsOnId} onChange={(e) => setDependsOnId(e.target.value)} className={selectClass}>
              <option value="">Selecione</option>
              {project.bridges.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.planetName}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px] flex-1">
            <label className={labelClass}>Nota (opcional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Por quê?" className={fieldClass} />
          </div>
          <Btn variant="primary" onClick={add} disabled={!bridgeId || !dependsOnId || busy}>
            <PlusIcon className="h-4 w-4" />
            {busy ? "Salvando..." : "Adicionar"}
          </Btn>
        </div>
        {error && (
          <p className="mt-3 flex items-center gap-2 text-sm text-[#C42B2B]">
            <AlertIcon className="h-4 w-4" />
            {error}
          </p>
        )}
      </Card>

      <Card className="p-5">
        <CardTitle icon={<DependencyIcon className="h-6 w-6" />}>Diagrama de dependências</CardTitle>
        <p className="mt-1 text-[13px] text-[#6B6F77]">
          As setas apontam de quem <strong>depende</strong> para o que ele precisa. Em vermelho: possível gargalo (vários Bridges dependem dele).
        </p>
        <div className="mt-4 overflow-x-auto rounded-[8px] border border-[#E6E8EC] bg-[#FAFBFC]">
          <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} role="img" aria-label="Diagrama de dependências entre Bridges" className="mx-auto block h-auto max-w-full">
            <defs>
              <marker id="dep-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill="#6B6F77" />
              </marker>
              <marker id="dep-arrow-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill="#E5484D" />
              </marker>
            </defs>
            {edges.map((e) => {
              const from = position.get(e.bridgeId);
              const to = position.get(e.dependsOnBridgeId);
              if (!from || !to) return null;
              const x1 = from.x;
              const y1 = from.y + NODE_H / 2;
              const x2 = to.x + NODE_W;
              const y2 = to.y + NODE_H / 2;
              const mid = (x1 + x2) / 2;
              const red = isBottleneck(e.dependsOnBridgeId);
              return (
                <path
                  key={e.id}
                  d={`M${x1} ${y1} C${mid} ${y1}, ${mid} ${y2}, ${x2 + 2} ${y2}`}
                  fill="none"
                  stroke={red ? "#E5484D" : "#9A9EA6"}
                  strokeWidth={1.8}
                  markerEnd={red ? "url(#dep-arrow-red)" : "url(#dep-arrow)"}
                  className="transition-all duration-500"
                />
              );
            })}
            {project.bridges.map((b) => {
              const pos = position.get(b.id)!;
              const bottleneck = isBottleneck(b.id);
              return (
                <g key={b.id} transform={`translate(${pos.x} ${pos.y})`}>
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={10}
                    fill={bottleneck ? "#FDE3E3" : "#FFFFFF"}
                    stroke={bottleneck ? "#E5484D" : "#D7DAE0"}
                    strokeWidth={bottleneck ? 2 : 1.2}
                    strokeDasharray={touched.has(b.id) ? undefined : "4 3"}
                  />
                  <text x={NODE_W / 2} y={bottleneck ? 20 : 29} textAnchor="middle" fontSize={13.5} fontWeight={600} fill="#15161A">
                    {truncate(b.planetName, 22)}
                  </text>
                  {bottleneck && (
                    <text x={NODE_W / 2} y={37} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="#C42B2B">
                      Gargalo · {incoming.get(b.id)} dependem
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
        {edges.length === 0 && <p className="mt-3 text-[13px] text-[#6B6F77]">Nenhuma dependência declarada ainda — os Bridges aparecem soltos (borda tracejada).</p>}
      </Card>

      {edges.length > 0 && (
        <Card className="p-5">
          <CardTitle>Dependências declaradas</CardTitle>
          <ul className="mt-3 divide-y divide-[#EEF0F3]">
            {edges.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 text-[14.5px] text-[#1D1F25]">
                  <strong>{bridgeName(project, e.bridgeId)}</strong> <span className="text-[#6B2FD1]">depende de</span>{" "}
                  <strong>{bridgeName(project, e.dependsOnBridgeId)}</strong>
                  {e.note && <p className="mt-0.5 text-[13px] text-[#50545C]">{e.note}</p>}
                  <p className="text-[12px] text-[#6B6F77]">por {e.createdByName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(e.id)}
                  disabled={removeBusy === e.id}
                  aria-label="Remover dependência"
                  className="text-[#9A9EA6] transition hover:text-[#E5484D] disabled:opacity-50"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
