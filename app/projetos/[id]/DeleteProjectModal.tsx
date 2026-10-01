"use client";

import { useState } from "react";
import PillButton from "@/components/PillButton";
import { CloseIcon } from "@/components/icons";
import type { ApiProjectDetail } from "../types";

interface Props {
  project: ApiProjectDetail;
  onClose: () => void;
  onDeleted: () => void;
}

type Choice = "keep" | "delete" | null;

// "Excluir Projeto" (menu "Mais opções") — duas opções: manter os Bridges
// soltos, ou apagar tudo junto (destrutivo, com confirmação extra).
export default function DeleteProjectModal({ project, onClose, onDeleted }: Props) {
  const [choice, setChoice] = useState<Choice>(null);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsExtraConfirm = choice === "delete";
  const canConfirm = choice === "keep" || (choice === "delete" && confirmText.trim() === project.name);

  async function handleConfirm() {
    if (!choice || !canConfirm || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projetos/${project.id}?mode=${choice}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao excluir o Projeto.");
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir o Projeto.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-white/10 bg-luminous-surface-container p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-sora text-lg font-semibold text-white">Excluir Projeto</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Fechar" className="text-luminous-on-surface-variant hover:text-luminous-on-surface">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-luminous-on-surface-variant">
          O que fazer com os <strong className="text-luminous-on-surface">{project.bridgeCount} Bridge(s)</strong> vinculados a{" "}
          <strong className="text-luminous-on-surface">{project.name}</strong>?
        </p>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => setChoice("keep")}
            className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition ${
              choice === "keep" ? "border-luminous-primary bg-luminous-primary/10" : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            <span className="font-medium text-luminous-on-surface">Excluir Projeto e manter os Bridges</span>
            <p className="mt-0.5 text-xs text-luminous-on-surface-variant">Os Bridges continuam existindo, só sem Projeto.</p>
          </button>
          <button
            type="button"
            onClick={() => setChoice("delete")}
            className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition ${
              choice === "delete" ? "border-luminous-error bg-luminous-error/10" : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            <span className="font-medium text-luminous-error">Excluir Projeto e os Bridges vinculados</span>
            <p className="mt-0.5 text-xs text-luminous-on-surface-variant">Apaga tudo — Projeto e Bridges. Não pode ser desfeito.</p>
          </button>
        </div>

        {needsExtraConfirm && (
          <div className="mt-4">
            <label className="mb-1.5 block text-xs text-luminous-on-surface-variant">
              Digite <strong className="text-luminous-on-surface">{project.name}</strong> para confirmar a exclusão permanente:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              className="w-full rounded-lg border border-luminous-error/40 bg-black/30 px-3 py-2 text-sm text-luminous-on-surface outline-none focus:border-luminous-error"
            />
          </div>
        )}

        {error && <p className="mt-3 text-sm text-luminous-error">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <PillButton type="button" variant="inactive" onClick={onClose} disabled={busy}>
            Cancelar
          </PillButton>
          <PillButton
            type="button"
            variant="primary"
            className={choice === "delete" ? "!bg-luminous-error !text-luminous-on-error hover:!bg-luminous-error/90" : ""}
            onClick={handleConfirm}
            disabled={!canConfirm || busy}
          >
            {busy ? "Excluindo..." : "Confirmar exclusão"}
          </PillButton>
        </div>
      </div>
    </div>
  );
}
