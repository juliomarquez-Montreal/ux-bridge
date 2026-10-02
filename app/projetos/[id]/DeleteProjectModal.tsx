"use client";

import { useState } from "react";
import { Btn, fieldClass, Modal } from "../ui";
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
    <Modal title="Excluir Projeto" onClose={onClose} busy={busy}>
      <p className="text-sm text-[#50545C]">
        O que fazer com os <strong className="text-[#1D1F25]">{project.bridgeCount} Bridge(s)</strong> vinculados a{" "}
        <strong className="text-[#1D1F25]">{project.name}</strong>?
      </p>

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={() => setChoice("keep")}
          className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition ${
            choice === "keep" ? "border-[#8B40F5] bg-[#F5EEFE]" : "border-[#E6E8EC] bg-white hover:bg-[#F4F5F7]"
          }`}
        >
          <span className="font-semibold text-[#1D1F25]">Excluir Projeto e manter os Bridges</span>
          <p className="mt-0.5 text-xs text-[#6B6F77]">Os Bridges continuam existindo, só sem Projeto.</p>
        </button>
        <button
          type="button"
          onClick={() => setChoice("delete")}
          className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition ${
            choice === "delete" ? "border-[#E5484D] bg-[#FDF1F1]" : "border-[#E6E8EC] bg-white hover:bg-[#F4F5F7]"
          }`}
        >
          <span className="font-semibold text-[#C42B2B]">Excluir Projeto e os Bridges vinculados</span>
          <p className="mt-0.5 text-xs text-[#6B6F77]">Apaga tudo — Projeto e Bridges. Não pode ser desfeito.</p>
        </button>
      </div>

      {choice === "delete" && (
        <div className="mt-4">
          <label className="mb-1.5 block text-xs text-[#50545C]">
            Digite <strong className="text-[#1D1F25]">{project.name}</strong> para confirmar a exclusão permanente:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            className={`${fieldClass} !border-[#F2B8BA] focus:!border-[#E5484D] focus:!ring-[#E5484D]/15`}
          />
        </div>
      )}

      {error && <p className="mt-3 text-sm text-[#C42B2B]">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <Btn onClick={onClose} disabled={busy}>
          Cancelar
        </Btn>
        <Btn variant={choice === "delete" ? "danger" : "primary"} onClick={handleConfirm} disabled={!canConfirm || busy}>
          {busy ? "Excluindo..." : "Confirmar exclusão"}
        </Btn>
      </div>
    </Modal>
  );
}
