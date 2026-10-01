"use client";

import { useEffect, useState } from "react";
import PillButton from "@/components/PillButton";
import { CloseIcon } from "@/components/icons";
import type { ApiUnlinkedBridge } from "./types";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

// "Criar novo Projeto" (/projetos) — nome + objetivo opcional + seleção
// MÚLTIPLA de Bridges ainda sem Projeto (pelo menos um obrigatório).
export default function CreateProjectModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [bridges, setBridges] = useState<ApiUnlinkedBridge[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projetos/available-bridges")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { bridges: ApiUnlinkedBridge[] }) => setBridges(data.bridges))
      .catch(() => setLoadError("Não foi possível carregar os Bridges disponíveis."));
  }, []);

  function toggleBridge(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    if (!name.trim() || selectedIds.size === 0 || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/projetos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), objective: objective.trim() || undefined, bridgeIds: Array.from(selectedIds) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao criar o Projeto.");
      onCreated();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Falha ao criar o Projeto.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-luminous-surface-container p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-sora text-lg font-semibold text-white">Criar novo Projeto</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-luminous-on-surface-variant hover:text-luminous-on-surface">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">
              Nome do Projeto
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex: Portal de Concessões"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-luminous-on-surface outline-none focus:border-luminous-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">
              Objetivo (opcional)
            </label>
            <textarea
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              rows={2}
              placeholder="O que este Projeto entrega?"
              className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-luminous-on-surface outline-none focus:border-luminous-primary"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">
              Bridges a vincular (ao menos um)
            </label>
            {loadError && <p className="text-sm text-luminous-error">{loadError}</p>}
            {bridges === null ? (
              <p className="text-sm text-luminous-on-surface-variant">Carregando...</p>
            ) : bridges.length === 0 ? (
              <p className="text-sm text-luminous-on-surface-variant">Nenhum Bridge disponível (todos já estão em algum Projeto).</p>
            ) : (
              <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-white/10 p-2">
                {bridges.map((bridge) => (
                  <label
                    key={bridge.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-luminous-on-surface transition hover:bg-white/5"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(bridge.id)}
                      onChange={() => toggleBridge(bridge.id)}
                      className="h-4 w-4 accent-luminous-primary"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {bridge.planetName}
                      <span className="ml-1.5 text-xs text-luminous-on-surface-variant">
                        {bridge.estrelaName ? `· ${bridge.estrelaName}` : ""} {bridge.galaxiaName ? `· ${bridge.galaxiaName}` : ""}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {submitError && <p className="text-sm text-luminous-error">{submitError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <PillButton type="button" variant="inactive" onClick={onClose}>
              Cancelar
            </PillButton>
            <PillButton type="button" variant="primary" onClick={handleSubmit} disabled={!name.trim() || selectedIds.size === 0 || submitting}>
              {submitting ? "Criando..." : "Criar Projeto"}
            </PillButton>
          </div>
        </div>
      </div>
    </div>
  );
}
