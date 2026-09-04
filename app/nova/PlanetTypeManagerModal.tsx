"use client";

import { useCallback, useEffect, useState } from "react";
import GlassCard from "@/components/GlassCard";
import PillButton from "@/components/PillButton";
import { CloseIcon, EditIcon, PlusIcon, TrashIcon } from "@/components/icons";
import PlanetTypeFormModal, { type PlanetTypeFormState } from "./PlanetTypeFormModal";
import type { ApiPlanetType } from "./types";

interface Props {
  onClose: () => void;
  // Avisa o painel pai que o catálogo mudou, pra recarregar a lista usada no
  // seletor de criação de Planeta.
  onChanged: () => void;
}

// Painel ADMIN-only de gestão do catálogo global de Tipos de Planeta —
// aberto a partir de /nova. CRUD completo; exclusão é bloqueada pela API
// (409) quando algum Planeta ainda usa o tipo, e mostramos essa mensagem.
export default function PlanetTypeManagerModal({ onClose, onChanged }: Props) {
  const [types, setTypes] = useState<ApiPlanetType[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formState, setFormState] = useState<PlanetTypeFormState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiPlanetType | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [changed, setChanged] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/nova/planet-types");
    if (!res.ok) throw new Error("Falha ao carregar tipos.");
    const data = (await res.json()) as { planetTypes: ApiPlanetType[] };
    setTypes(data.planetTypes);
    setLoadError(null);
  }, []);

  useEffect(() => {
    refresh().catch(() => setLoadError("Não foi possível carregar os tipos de Planeta."));
  }, [refresh]);

  function handleClose() {
    if (changed) onChanged();
    onClose();
  }

  async function handleSaved() {
    setFormState(null);
    setChanged(true);
    await refresh().catch(() => setLoadError("Não foi possível recarregar os tipos."));
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/nova/planet-types/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data.error ?? "Não foi possível excluir. Tente novamente.");
        return;
      }
      setDeleteTarget(null);
      setChanged(true);
      await refresh().catch(() => setLoadError("Não foi possível recarregar os tipos."));
    } catch {
      setDeleteError("Não foi possível excluir. Verifique sua conexão e tente novamente.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={handleClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-luminous-surface-container p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-sora text-lg font-semibold">Gerenciar Tipos de Planeta</h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar"
            className="text-luminous-on-surface-variant hover:text-luminous-on-surface"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <PillButton
          type="button"
          variant="secondary"
          className="mb-4 inline-flex items-center gap-1.5"
          onClick={() => setFormState({ mode: "create" })}
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Novo tipo
        </PillButton>

        {loadError && <p className="mb-3 text-sm text-luminous-error">{loadError}</p>}

        {!types ? (
          <p className="text-sm text-luminous-on-surface-variant">Carregando...</p>
        ) : types.length === 0 ? (
          <p className="text-sm text-luminous-on-surface-variant">Nenhum tipo cadastrado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {types.map((type) => (
              <li key={type.id}>
                <GlassCard className="flex items-start justify-between gap-3 !p-4">
                  <div className="min-w-0">
                    <h3 className="font-sora text-sm font-semibold">{type.name}</h3>
                    {type.description && (
                      <p className="mt-1 text-xs text-luminous-on-surface-variant">{type.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setFormState({ mode: "edit", planetType: type })}
                      aria-label={`Editar ${type.name}`}
                      className="grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-white/5 hover:bg-white/10"
                    >
                      <EditIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(type);
                      }}
                      aria-label={`Excluir ${type.name}`}
                      className="grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-white/5 text-luminous-error hover:bg-luminous-error/10"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </GlassCard>
              </li>
            ))}
          </ul>
        )}
      </div>

      {formState && (
        <div onClick={(event) => event.stopPropagation()}>
          <PlanetTypeFormModal state={formState} onClose={() => setFormState(null)} onSaved={handleSaved} />
        </div>
      )}

      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(event) => event.stopPropagation()}
          className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-luminous-surface-container p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-sora text-lg font-semibold">Excluir tipo de Planeta</h2>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                aria-label="Fechar"
                className="text-luminous-on-surface-variant hover:text-luminous-on-surface"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-luminous-on-surface-variant">
              Tem certeza que deseja excluir{" "}
              <span className="font-medium text-luminous-on-surface">{deleteTarget.name}</span>? Esta ação não pode
              ser desfeita.
            </p>

            {deleteError && <p className="mt-3 text-sm text-luminous-error">{deleteError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <PillButton type="button" variant="inactive" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </PillButton>
              <PillButton
                type="button"
                variant="primary"
                className="!bg-luminous-error !text-luminous-on-error hover:!bg-luminous-error/90"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? "Excluindo..." : "Excluir"}
              </PillButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
