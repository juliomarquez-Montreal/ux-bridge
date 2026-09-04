"use client";

import { useState, type FormEvent } from "react";
import PillButton from "@/components/PillButton";
import { CloseIcon } from "@/components/icons";
import type { ApiPlanetType } from "./types";

export type PlanetTypeFormState = { mode: "create" } | { mode: "edit"; planetType: ApiPlanetType };

interface Props {
  state: PlanetTypeFormState;
  onClose: () => void;
  onSaved: (planetType: ApiPlanetType) => void;
}

// Cria ou edita um tipo de Planeta do catálogo global (nome + descrição).
export default function PlanetTypeFormModal({ state, onClose, onSaved }: Props) {
  const isEdit = state.mode === "edit";
  const [name, setName] = useState(isEdit ? state.planetType.name : "");
  const [description, setDescription] = useState(isEdit ? (state.planetType.description ?? "") : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || saving) return;

    setSaving(true);
    setError(null);

    try {
      const res =
        state.mode === "edit"
          ? await fetch(`/api/nova/planet-types/${state.planetType.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
            })
          : await fetch("/api/nova/planet-types", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
            });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar. Tente novamente.");
        return;
      }
      onSaved(data.planetType);
    } catch {
      setError("Não foi possível salvar. Verifique sua conexão e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-xl border border-white/10 bg-luminous-surface-container p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-sora text-lg font-semibold">{isEdit ? "Editar tipo de Planeta" : "Novo tipo de Planeta"}</h2>
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
              htmlFor="planet-type-name"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant"
            >
              Nome
            </label>
            <input
              id="planet-type-name"
              type="text"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex: Listagem"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-luminous-primary"
            />
          </div>

          <div>
            <label
              htmlFor="planet-type-description"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant"
            >
              Descrição (opcional)
            </label>
            <textarea
              id="planet-type-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Uma frase curta explicando este tipo de tela."
              className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-luminous-primary"
            />
          </div>

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
