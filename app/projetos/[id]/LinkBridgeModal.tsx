"use client";

import { useEffect, useState } from "react";
import { Btn, Modal } from "../ui";
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
    <Modal title="Vincular Bridge" onClose={onClose} busy={submitting}>
      {loadError && <p className="text-sm text-[#C42B2B]">{loadError}</p>}
      {bridges === null ? (
        <p className="text-sm text-[#50545C]">Carregando...</p>
      ) : bridges.length === 0 ? (
        <p className="text-sm text-[#50545C]">Nenhum Bridge disponível (todos já estão em algum Projeto).</p>
      ) : (
        <div className="max-h-72 space-y-1.5 overflow-y-auto">
          {bridges.map((bridge) => (
            <button
              key={bridge.id}
              type="button"
              onClick={() => setSelectedId(bridge.id)}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                selectedId === bridge.id
                  ? "border-[#8B40F5] bg-[#F5EEFE] text-[#1D1F25]"
                  : "border-[#E6E8EC] bg-white text-[#1D1F25] hover:bg-[#F4F5F7]"
              }`}
            >
              <span className="truncate">{bridge.planetName}</span>
              <span className="ml-3 shrink-0 text-xs text-[#6B6F77]">{bridge.galaxiaName ?? "—"}</span>
            </button>
          ))}
        </div>
      )}

      {submitError && <p className="mt-3 text-sm text-[#C42B2B]">{submitError}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <Btn onClick={onClose} disabled={submitting}>
          Cancelar
        </Btn>
        <Btn variant="primary" onClick={handleSubmit} disabled={!selectedId || submitting}>
          {submitting ? "Vinculando..." : "Vincular"}
        </Btn>
      </div>
    </Modal>
  );
}
