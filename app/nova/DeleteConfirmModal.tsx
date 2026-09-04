"use client";

import { useState } from "react";
import PillButton from "@/components/PillButton";
import { CloseIcon } from "@/components/icons";
import { TYPE_LABEL } from "./clientPermissions";
import type { ApiContextNode } from "./types";

interface Props {
  node: ApiContextNode;
  onClose: () => void;
  onDeleted: () => void;
}

// Confirmação de exclusão. Se o nó tiver filhos, a API recusa com 409 e uma
// mensagem clara (quantidade de filhos) — mostramos ela aqui em vez de um
// erro genérico, sem fechar o modal, pra o usuário entender o motivo.
export default function DeleteConfirmModal({ node, onClose, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/nova/nodes/${node.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível excluir. Tente novamente.");
        return;
      }
      onDeleted();
    } catch {
      setError("Não foi possível excluir. Verifique sua conexão e tente novamente.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-xl border border-white/10 bg-luminous-surface-container p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-sora text-lg font-semibold">Excluir {TYPE_LABEL[node.type].toLowerCase()}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-luminous-on-surface-variant hover:text-luminous-on-surface"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-luminous-on-surface-variant">
          Tem certeza que deseja excluir <span className="font-medium text-luminous-on-surface">{node.name}</span>?
          Esta ação não pode ser desfeita.
        </p>

        {error && <p className="mt-3 text-sm text-luminous-error">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <PillButton type="button" variant="inactive" onClick={onClose}>
            Cancelar
          </PillButton>
          <PillButton
            type="button"
            variant="primary"
            className="!bg-luminous-error !text-luminous-on-error hover:!bg-luminous-error/90"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Excluindo..." : "Excluir"}
          </PillButton>
        </div>
      </div>
    </div>
  );
}
