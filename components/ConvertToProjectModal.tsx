"use client";

import { useEffect, useState } from "react";
import { Btn, fieldClass, Modal } from "@/app/projetos/ui";
import type { ApiBridgeListItem } from "@/app/bridges/types";
import type { ApiProjectSummary } from "@/app/projetos/types";

type Mode = "choose" | "new" | "existing";

interface Props {
  bridge: ApiBridgeListItem;
  onClose: () => void;
  onConverted: () => void;
}

// "Converter em Projeto" — ícone de ações de /bridges (Projeto-1). Dois
// caminhos: criar um Projeto NOVO (com este Bridge como primeiro vinculado)
// ou vincular a um Projeto JÁ EXISTENTE.
export default function ConvertToProjectModal({ bridge, onClose, onConverted }: Props) {
  const [mode, setMode] = useState<Mode>("choose");
  const [projects, setProjects] = useState<ApiProjectSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "existing" || projects !== null) return;
    fetch("/api/projetos")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { projects: ApiProjectSummary[] }) => setProjects(data.projects))
      .catch(() => setLoadError("Não foi possível carregar os Projetos existentes."));
  }, [mode, projects]);

  async function handleCreateNew() {
    if (!newName.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/projetos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), bridgeIds: [bridge.id] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao criar o Projeto.");
      onConverted();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Falha ao criar o Projeto.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLinkExisting() {
    if (!selectedProjectId || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/projetos/${selectedProjectId}/bridges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bridgeId: bridge.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao vincular ao Projeto.");
      onConverted();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Falha ao vincular ao Projeto.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Converter em Projeto" onClose={onClose} busy={submitting}>
      <div>
        <p className="mb-4 text-sm text-[#50545C]">
          Vincule <strong className="text-[#1D1F25]">{bridge.planeta.name}</strong> a um Projeto.
        </p>

        {mode === "choose" && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setMode("new")}
              className="w-full rounded-lg border border-[#E6E8EC] bg-[#FAFBFC] px-4 py-3 text-left text-sm text-[#1D1F25] transition hover:bg-[#F4F5F7]"
            >
              <span className="font-medium">Criar Projeto novo</span>
              <p className="mt-0.5 text-xs text-[#50545C]">Este Bridge vira o primeiro vinculado.</p>
            </button>
            <button
              type="button"
              onClick={() => setMode("existing")}
              className="w-full rounded-lg border border-[#E6E8EC] bg-[#FAFBFC] px-4 py-3 text-left text-sm text-[#1D1F25] transition hover:bg-[#F4F5F7]"
            >
              <span className="font-medium">Vincular a Projeto existente</span>
              <p className="mt-0.5 text-xs text-[#50545C]">Escolha um Projeto já cadastrado.</p>
            </button>
          </div>
        )}

        {mode === "new" && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[.05em] text-[#50545C]">
                Nome do Projeto
              </label>
              <input
                type="text"
                autoFocus
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Ex: Portal de Concessões"
                className={fieldClass}
              />
            </div>
            {submitError && <p className="text-sm text-[#C42B2B]">{submitError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Btn type="button" onClick={() => setMode("choose")}>
                Voltar
              </Btn>
              <Btn type="button" variant="primary" onClick={handleCreateNew} disabled={!newName.trim() || submitting}>
                {submitting ? "Criando..." : "Criar e vincular"}
              </Btn>
            </div>
          </div>
        )}

        {mode === "existing" && (
          <div className="space-y-4">
            {loadError && <p className="text-sm text-[#C42B2B]">{loadError}</p>}
            {projects === null ? (
              <p className="text-sm text-[#50545C]">Carregando Projetos...</p>
            ) : projects.length === 0 ? (
              <p className="text-sm text-[#50545C]">Nenhum Projeto cadastrado ainda. Crie um novo.</p>
            ) : (
              <div className="max-h-64 space-y-1.5 overflow-y-auto">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                      selectedProjectId === project.id
                        ? "border-[#8B40F5] bg-[#F5EEFE] text-[#1D1F25]"
                        : "border-[#E6E8EC] bg-[#FAFBFC] text-[#50545C] hover:bg-[#F4F5F7]"
                    }`}
                  >
                    <span>
                      <span className="font-mono text-xs text-[#50545C]">{project.code}</span> {project.name}
                    </span>
                    <span className="text-xs text-[#50545C]">{project.bridgeCount} Bridge(s)</span>
                  </button>
                ))}
              </div>
            )}
            {submitError && <p className="text-sm text-[#C42B2B]">{submitError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Btn type="button" onClick={() => setMode("choose")}>
                Voltar
              </Btn>
              <Btn type="button" variant="primary" onClick={handleLinkExisting} disabled={!selectedProjectId || submitting}>
                {submitting ? "Vinculando..." : "Vincular"}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
