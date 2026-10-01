"use client";

import { useEffect, useState } from "react";
import PillButton from "@/components/PillButton";
import { CloseIcon } from "@/components/icons";
import type { ApiUnlinkedBridge } from "../types";

interface Props {
  projectId: string;
  onClose: () => void;
  onLinked: () => void;
}

// "Vincular Bridge" (dentro da página do Projeto) — adiciona mais Bridges a
// qualquer momento, não só na criação.
export default function LinkBridgeModal({ projectId, onClose, onLinked }: Props) {
  const [bridges, setBridges] = useState<ApiUnlinkedBridge[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projetos/available-bridges")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { bridges: ApiUnlinkedBridge[] }) => setBridges(data.bridges))
      .catch(() => setLoadError("Não foi possível carregar os Bridges disponíveis."));
  }, []);

  async function handleSubmit() {
    if (!selectedId || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/projetos/${projectId}/bridges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bridgeId: selectedId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao vincular o Bridge.");
      onLinked();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Falha ao vincular o Bridge.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl border border-white/10 bg-luminous-surface-container p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-sora text-lg font-semibold text-white">Vincular Bridge</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-luminous-on-surface-variant hover:text-luminous-on-surface">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {loadError && <p className="text-sm text-luminous-error">{loadError}</p>}
        {bridges === null ? (
          <p className="text-sm text-luminous-on-surface-variant">Carregando...</p>
        ) : bridges.length === 0 ? (
          <p className="text-sm text-luminous-on-surface-variant">Nenhum Bridge disponível (todos já estão em algum Projeto).</p>
        ) : (
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {bridges.map((bridge) => (
              <button
                key={bridge.id}
                type="button"
                onClick={() => setSelectedId(bridge.id)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                  selectedId === bridge.id
                    ? "border-luminous-primary bg-luminous-primary/10 text-luminous-on-surface"
                    : "border-white/10 bg-white/5 text-luminous-on-surface-variant hover:bg-white/10"
                }`}
              >
                <span className="truncate">{bridge.planetName}</span>
                <span className="shrink-0 text-xs">{bridge.galaxiaName ?? "—"}</span>
              </button>
            ))}
          </div>
        )}

        {submitError && <p className="mt-3 text-sm text-luminous-error">{submitError}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <PillButton type="button" variant="inactive" onClick={onClose}>
            Cancelar
          </PillButton>
          <PillButton type="button" variant="primary" onClick={handleSubmit} disabled={!selectedId || submitting}>
            {submitting ? "Vinculando..." : "Vincular"}
          </PillButton>
        </div>
      </div>
    </div>
  );
}
