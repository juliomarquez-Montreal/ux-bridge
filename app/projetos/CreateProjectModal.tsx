"use client";

import { useEffect, useState } from "react";
import { Btn, fieldClass, labelClass, Modal } from "./ui";
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
    <Modal title="Criar novo Projeto" onClose={onClose} maxWidth="max-w-lg" busy={submitting}>
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Nome do Projeto</label>
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex: Portal de Concessões"
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass}>Objetivo (opcional)</label>
          <textarea
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
            rows={2}
            placeholder="O que este Projeto entrega?"
            className={`${fieldClass} resize-none`}
          />
        </div>

        <div>
          <label className={labelClass}>Bridges a vincular (ao menos um)</label>
          {loadError && <p className="text-sm text-[#C42B2B]">{loadError}</p>}
          {bridges === null ? (
            <p className="text-sm text-[#50545C]">Carregando...</p>
          ) : bridges.length === 0 ? (
            <p className="text-sm text-[#50545C]">Nenhum Bridge disponível (todos já estão em algum Projeto).</p>
          ) : (
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-[#E6E8EC] bg-[#FAFBFC] p-2">
              {bridges.map((bridge) => (
                <label
                  key={bridge.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-[#1D1F25] transition hover:bg-white"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(bridge.id)}
                    onChange={() => toggleBridge(bridge.id)}
                    className="h-4 w-4 accent-[#8B40F5]"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {bridge.planetName}
                    <span className="ml-1.5 text-xs text-[#6B6F77]">
                      {bridge.estrelaName ? `· ${bridge.estrelaName}` : ""} {bridge.galaxiaName ? `· ${bridge.galaxiaName}` : ""}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {submitError && <p className="text-sm text-[#C42B2B]">{submitError}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Btn onClick={onClose} disabled={submitting}>
            Cancelar
          </Btn>
          <Btn variant="primary" onClick={handleSubmit} disabled={!name.trim() || selectedIds.size === 0 || submitting}>
            {submitting ? "Criando..." : "Criar Projeto"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
