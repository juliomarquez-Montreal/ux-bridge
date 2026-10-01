"use client";

import { useEffect, useState } from "react";
import PillButton from "@/components/PillButton";
import { CloseIcon } from "@/components/icons";
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-white/10 bg-luminous-surface-container p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-sora text-lg font-semibold text-white">Converter em Projeto</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-luminous-on-surface-variant hover:text-luminous-on-surface">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-luminous-on-surface-variant">
          Vincule <strong className="text-luminous-on-surface">{bridge.planeta.name}</strong> a um Projeto.
        </p>

        {mode === "choose" && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setMode("new")}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-luminous-on-surface transition hover:bg-white/10"
            >
              <span className="font-medium">Criar Projeto novo</span>
              <p className="mt-0.5 text-xs text-luminous-on-surface-variant">Este Bridge vira o primeiro vinculado.</p>
            </button>
            <button
              type="button"
              onClick={() => setMode("existing")}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-luminous-on-surface transition hover:bg-white/10"
            >
              <span className="font-medium">Vincular a Projeto existente</span>
              <p className="mt-0.5 text-xs text-luminous-on-surface-variant">Escolha um Projeto já cadastrado.</p>
            </button>
          </div>
        )}

        {mode === "new" && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">
                Nome do Projeto
              </label>
              <input
                type="text"
                autoFocus
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Ex: Portal de Concessões"
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-luminous-on-surface outline-none focus:border-luminous-primary"
              />
            </div>
            {submitError && <p className="text-sm text-luminous-error">{submitError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <PillButton type="button" variant="inactive" onClick={() => setMode("choose")}>
                Voltar
              </PillButton>
              <PillButton type="button" variant="primary" onClick={handleCreateNew} disabled={!newName.trim() || submitting}>
                {submitting ? "Criando..." : "Criar e vincular"}
              </PillButton>
            </div>
          </div>
        )}

        {mode === "existing" && (
          <div className="space-y-4">
            {loadError && <p className="text-sm text-luminous-error">{loadError}</p>}
            {projects === null ? (
              <p className="text-sm text-luminous-on-surface-variant">Carregando Projetos...</p>
            ) : projects.length === 0 ? (
              <p className="text-sm text-luminous-on-surface-variant">Nenhum Projeto cadastrado ainda. Crie um novo.</p>
            ) : (
              <div className="max-h-64 space-y-1.5 overflow-y-auto">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                      selectedProjectId === project.id
                        ? "border-luminous-primary bg-luminous-primary/10 text-luminous-on-surface"
                        : "border-white/10 bg-white/5 text-luminous-on-surface-variant hover:bg-white/10"
                    }`}
                  >
                    <span>
                      <span className="font-mono text-xs text-luminous-on-surface-variant">{project.code}</span> {project.name}
                    </span>
                    <span className="text-xs text-luminous-on-surface-variant">{project.bridgeCount} Bridge(s)</span>
                  </button>
                ))}
              </div>
            )}
            {submitError && <p className="text-sm text-luminous-error">{submitError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <PillButton type="button" variant="inactive" onClick={() => setMode("choose")}>
                Voltar
              </PillButton>
              <PillButton type="button" variant="primary" onClick={handleLinkExisting} disabled={!selectedProjectId || submitting}>
                {submitting ? "Vinculando..." : "Vincular"}
              </PillButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
