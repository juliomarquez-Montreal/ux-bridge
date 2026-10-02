"use client";

import { useEffect, useState } from "react";
import { CheckIcon, TagIcon } from "@/components/icons";
import { Card, CardTitle, fieldClass } from "../../ui";
import type { ApiProjectDetail } from "../../types";

interface Props {
  project: ApiProjectDetail;
  onChanged: () => Promise<void>;
}

const NO_AREA = "Sem área";
const BAR_COLORS = ["#8F5CF6", "#2F7CF6", "#3DBB6A", "#F5B014", "#E5484D", "#8DBBF7"];

// Ferramenta 5 — Mapa de Áreas: etiqueta livre por Bridge (com autocomplete
// das áreas já usadas, pra reaproveitar nomes em vez de criar variações) e
// resumo agrupado "N Bridges por área". Sem área = "Sem área".
export default function AreaMap({ project, onChanged }: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Áreas já usadas (únicas, ignorando maiúsculas/minúsculas) pro autocomplete.
  const usedAreas: string[] = [];
  for (const b of project.bridges) {
    const area = b.area?.trim();
    if (area && !usedAreas.some((a) => a.toLowerCase() === area.toLowerCase())) usedAreas.push(area);
  }
  usedAreas.sort((a, b) => a.localeCompare(b));

  // Resumo agrupado: "Login" e "login" contam como a mesma área.
  const groups = new Map<string, { label: string; count: number }>();
  for (const b of project.bridges) {
    const area = b.area?.trim() || NO_AREA;
    const key = area.toLowerCase();
    const current = groups.get(key);
    groups.set(key, { label: current?.label ?? area, count: (current?.count ?? 0) + 1 });
  }
  const summary = Array.from(groups.values()).sort((a, b) => {
    if (a.label === NO_AREA) return 1;
    if (b.label === NO_AREA) return -1;
    return b.count - a.count || a.label.localeCompare(b.label);
  });
  const maxCount = Math.max(1, ...summary.map((g) => g.count));

  async function save(bridgeId: string, value: string) {
    const current = project.bridges.find((b) => b.id === bridgeId)?.area ?? "";
    // Se digitou uma variação de maiúsculas de uma área já usada, reaproveita o nome existente.
    const reuse = usedAreas.find((a) => a.toLowerCase() === value.trim().toLowerCase());
    const next = reuse ?? value.trim();
    if (next === current.trim()) {
      setDrafts((d) => {
        const { [bridgeId]: _omit, ...rest } = d;
        return rest;
      });
      return;
    }
    setSavingId(bridgeId);
    setError(null);
    try {
      const res = await fetch(`/api/projetos/${project.id}/bridges/${bridgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area: next || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar a área.");
      await onChanged();
      setDrafts((d) => {
        const { [bridgeId]: _omit, ...rest } = d;
        return rest;
      });
      setSavedId(bridgeId);
      setTimeout(() => setSavedId((id) => (id === bridgeId ? null : id)), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar a área.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <Card className="p-5">
        <CardTitle icon={<TagIcon className="h-6 w-6" />}>Área de cada Bridge</CardTitle>
        <p className="mt-1 text-[13px] text-[#6B6F77]">Digite ou escolha uma área já usada. Salva ao sair do campo (ou com Enter).</p>
        <datalist id="project-areas">
          {usedAreas.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
        {error && <p className="mt-3 text-sm text-[#C42B2B]">{error}</p>}
        {project.bridges.length === 0 ? (
          <p className="mt-4 text-sm text-[#50545C]">Nenhum Bridge vinculado ainda.</p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {project.bridges.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3">
                <span className="min-w-[140px] flex-1 truncate text-[14.5px] font-medium text-[#1D1F25]">{b.planetName}</span>
                <div className="relative w-[240px] max-w-full">
                  <input
                    list="project-areas"
                    value={drafts[b.id] ?? b.area ?? ""}
                    placeholder="Sem área"
                    maxLength={60}
                    disabled={savingId === b.id}
                    onChange={(e) => setDrafts((d) => ({ ...d, [b.id]: e.target.value }))}
                    onBlur={(e) => save(b.id, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    className={`${fieldClass} pr-9`}
                  />
                  <span
                    className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#2EB872] transition-opacity duration-500 ${
                      savedId === b.id ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <CheckIcon className="h-4 w-4" />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <CardTitle icon={<TagIcon className="h-6 w-6" />}>Resumo por área</CardTitle>
        <div className="mt-4 space-y-3">
          {summary.map((g, index) => (
            <div key={g.label} className="flex items-center gap-3">
              <span className="w-[110px] shrink-0 truncate text-[14px] text-[#1D1F25]" title={g.label}>
                {g.label}
              </span>
              <div className="h-[18px] flex-1">
                <div
                  className="h-full rounded-[4px] transition-[width] duration-700 ease-out"
                  style={{
                    width: animate ? `${(g.count / maxCount) * 100}%` : "0%",
                    backgroundColor: g.label === NO_AREA ? "#D3D5DA" : BAR_COLORS[index % BAR_COLORS.length],
                  }}
                />
              </div>
              <span className="w-20 text-right text-[13.5px] font-semibold text-[#1D1F25]">
                {g.count} Bridge{g.count === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
