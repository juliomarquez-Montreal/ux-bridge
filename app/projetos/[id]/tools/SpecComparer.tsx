"use client";

import { useEffect, useState } from "react";
import Skeleton from "@/components/Skeleton";
import { ChevronLeftIcon, ChevronRightIcon, CompareIcon } from "@/components/icons";
import { Btn, Card, CardTitle, fieldClass, Pill } from "../../ui";
import type { ApiBridgeSpec } from "../../types";
import { bridgeName, formatDateTime, type ToolProps } from "./shared";

const VISIBLE_COLUMNS = 3;

// Ferramenta 4 — Comparador de Bridge Specs: o PO marca 2+ Bridges do
// Projeto e lê os Specs completos lado a lado (até 3 colunas por vez, com
// setas pra trocar a janela). A anotação salva fica no histórico do Projeto
// (BridgeComparisonNote), sem precisar reabrir a comparação exata.
export default function SpecComparer({ project, tools, reload, onChanged }: ToolProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [specs, setSpecs] = useState<ApiBridgeSpec[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [windowStart, setWindowStart] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const selectable = project.bridges.filter((b) => b.hasSpec);

  useEffect(() => {
    if (selected.length < 2) {
      setSpecs(null);
      return;
    }
    let cancelled = false;
    setSpecs(null);
    setLoadError(null);
    fetch(`/api/projetos/${project.id}/specs?ids=${selected.join(",")}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Falha ao carregar os Bridge Specs.");
        return data.specs as ApiBridgeSpec[];
      })
      .then((data) => {
        if (cancelled) return;
        // Mantém a ordem em que o PO marcou os Bridges.
        setSpecs(selected.map((id) => data.find((s) => s.bridgeId === id)).filter((s): s is ApiBridgeSpec => !!s));
        setWindowStart(0);
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : "Falha ao carregar os Bridge Specs."));
    return () => {
      cancelled = true;
    };
  }, [selected, project.id]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function saveNote() {
    if (!note.trim() || selected.length < 2 || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/projetos/${project.id}/comparison-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bridgeIds: selected, note: note.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar a anotação.");
      setNote("");
      await reload();
      await onChanged();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Falha ao salvar a anotação.");
    } finally {
      setSaving(false);
    }
  }

  const visible = specs ? specs.slice(windowStart, windowStart + VISIBLE_COLUMNS) : [];
  const canPrev = windowStart > 0;
  const canNext = specs ? windowStart + VISIBLE_COLUMNS < specs.length : false;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <CardTitle icon={<CompareIcon className="h-6 w-6" />}>Escolha os Bridges para comparar</CardTitle>
        {selectable.length < 2 ? (
          <p className="mt-3 text-sm text-[#8A5A00]">É preciso ter pelo menos 2 Bridges com Bridge Spec gerado neste Projeto.</p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {selectable.map((b) => {
              const on = selected.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggle(b.id)}
                  className={`rounded-[8px] border px-3.5 py-2 text-[14px] font-medium transition active:scale-[0.97] ${
                    on ? "border-[#8B40F5] bg-[#F5EEFE] text-[#6B2FD1]" : "border-[#D7DAE0] bg-white text-[#1D1F25] hover:bg-[#F4F5F7]"
                  }`}
                >
                  {on && <span className="mr-1.5">{selected.indexOf(b.id) + 1}.</span>}
                  {b.planetName}
                </button>
              );
            })}
          </div>
        )}
        {selected.length === 1 && <p className="mt-3 text-[13px] text-[#6B6F77]">Marque mais um Bridge para ver a comparação.</p>}
      </Card>

      {selected.length >= 2 && (
        <>
          {specs && specs.length > VISIBLE_COLUMNS && (
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-[#6B6F77]">
                Mostrando {windowStart + 1}–{Math.min(windowStart + VISIBLE_COLUMNS, specs.length)} de {specs.length} Bridge Specs
              </p>
              <div className="flex gap-2">
                <Btn small onClick={() => setWindowStart((s) => Math.max(0, s - 1))} disabled={!canPrev} aria-label="Coluna anterior">
                  <ChevronLeftIcon className="h-4 w-4" />
                </Btn>
                <Btn small onClick={() => setWindowStart((s) => s + 1)} disabled={!canNext} aria-label="Próxima coluna">
                  <ChevronRightIcon className="h-4 w-4" />
                </Btn>
              </div>
            </div>
          )}

          {loadError && <p className="text-sm text-[#C42B2B]">{loadError}</p>}
          {!specs && !loadError ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton tone="light" className="h-72 rounded-[10px]" />
              <Skeleton tone="light" className="h-72 rounded-[10px]" />
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(1, visible.length)}, minmax(0, 1fr))` }}>
              {visible.map((s) => (
                <Card key={s.bridgeId} className="flex max-h-[560px] flex-col overflow-hidden animate-[fadeIn_0.25s_ease-out]">
                  <div className="border-b border-[#E6E8EC] bg-[#FAFBFC] px-4 py-3">
                    <p className="truncate text-[15px] font-bold text-[#15161A]">{s.name}</p>
                  </div>
                  <pre className="flex-1 overflow-y-auto whitespace-pre-wrap p-4 font-sans text-[13.5px] leading-relaxed text-[#1D1F25]">
                    {s.spec ?? "Sem Bridge Spec gerado."}
                  </pre>
                </Card>
              ))}
            </div>
          )}

          <Card className="p-5">
            <CardTitle>Anotação desta comparação</CardTitle>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Ex: Os dois definem o prazo de expiração de formas diferentes — alinhar com o time jurídico."
              className={`${fieldClass} mt-3 resize-none`}
            />
            {saveError && <p className="mt-2 text-sm text-[#C42B2B]">{saveError}</p>}
            <div className="mt-3 flex justify-end">
              <Btn variant="primary" onClick={saveNote} disabled={!note.trim() || saving}>
                {saving ? "Salvando..." : "Salvar anotação"}
              </Btn>
            </div>
          </Card>
        </>
      )}

      <Card className="p-5">
        <CardTitle>Histórico de anotações de comparação</CardTitle>
        {tools.comparisonNotes.length === 0 ? (
          <p className="mt-3 text-sm text-[#50545C]">Nenhuma anotação de comparação registrada ainda.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {tools.comparisonNotes.map((n) => (
              <li key={n.id} className="rounded-[8px] border border-[#E6E8EC] bg-[#FAFBFC] p-3.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {n.bridgeIds.map((id) => (
                    <Pill key={id} tone="purple" className="!px-2 !py-0.5 !text-[12px]">
                      {bridgeName(project, id)}
                    </Pill>
                  ))}
                </div>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[#1D1F25]">{n.note}</p>
                <p className="mt-1.5 text-[12.5px] text-[#6B6F77]">
                  {n.authorName} · {formatDateTime(n.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
