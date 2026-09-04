"use client";

import { useState, type FormEvent } from "react";
import PillButton from "@/components/PillButton";
import { CloseIcon } from "@/components/icons";
import { TYPE_LABEL } from "./clientPermissions";
import type { ApiPlanetType, FormModalState } from "./types";

interface Props {
  state: FormModalState;
  planetTypes: ApiPlanetType[] | null;
  onClose: () => void;
  onSaved: () => void;
}

// Modal único para criar (state.mode === "create") ou editar (state.mode ===
// "edit") um nó. Planeta exige planetTypeId, obrigatório também do lado da
// API — aqui só bloqueamos o submit antes de gastar uma request.
export default function NodeFormModal({ state, planetTypes, onClose, onSaved }: Props) {
  const isEdit = state.mode === "edit";
  const nodeType = isEdit ? state.node.type : state.type;
  const isPlaneta = nodeType === "PLANETA";

  const [name, setName] = useState(isEdit ? state.node.name : "");
  const [planetTypeId, setPlanetTypeId] = useState(isEdit ? (state.node.planetTypeId ?? "") : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && (!isPlaneta || planetTypeId.length > 0);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || saving) return;

    setSaving(true);
    setError(null);

    try {
      const res =
        state.mode === "edit"
          ? await fetch(`/api/nova/nodes/${state.node.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: name.trim(), ...(isPlaneta ? { planetTypeId } : {}) }),
            })
          : await fetch("/api/nova/nodes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: state.type,
                name: name.trim(),
                parentId: state.parentId,
                ...(isPlaneta ? { planetTypeId } : {}),
              }),
            });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar. Tente novamente.");
        return;
      }
      onSaved();
    } catch {
      setError("Não foi possível salvar. Verifique sua conexão e tente novamente.");
    } finally {
      setSaving(false);
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
          <h2 className="font-sora text-lg font-semibold">
            {isEdit ? `Editar ${TYPE_LABEL[nodeType]}` : `Novo(a) ${TYPE_LABEL[nodeType]}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-luminous-on-surface-variant hover:text-luminous-on-surface"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="node-name"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant"
            >
              Nome
            </label>
            <input
              id="node-name"
              type="text"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={`Nome do(a) ${TYPE_LABEL[nodeType].toLowerCase()}`}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-luminous-primary"
            />
          </div>

          {isPlaneta && (
            <div>
              <label
                htmlFor="planet-type"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant"
              >
                Tipo de Planeta
              </label>
              {planetTypes === null ? (
                <p className="text-xs text-luminous-on-surface-variant">Carregando tipos...</p>
              ) : (
                <select
                  id="planet-type"
                  value={planetTypeId}
                  onChange={(event) => setPlanetTypeId(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-luminous-primary"
                >
                  <option value="" disabled>
                    Selecione um tipo...
                  </option>
                  {planetTypes.map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {error && <p className="text-sm text-luminous-error">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <PillButton type="button" variant="inactive" onClick={onClose}>
              Cancelar
            </PillButton>
            <PillButton type="submit" variant="primary" disabled={!canSubmit || saving}>
              {saving ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
            </PillButton>
          </div>
        </form>
      </div>
    </div>
  );
}
