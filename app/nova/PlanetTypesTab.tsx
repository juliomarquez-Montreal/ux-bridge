"use client";

import { useState } from "react";
import GlassCard from "@/components/GlassCard";
import PillButton from "@/components/PillButton";
import { EditIcon, TrashIcon } from "@/components/icons";
import PlanetTypeFormModal, { type PlanetTypeFormState } from "./PlanetTypeFormModal";
import type { ApiPlanetType, NovaUser } from "./types";

interface Props {
  user: NovaUser;
  planetTypes: ApiPlanetType[] | null;
  search: string;
  showCreateForm: boolean;
  onCreateFormClose: () => void;
  onChanged: () => void;
}

// Aba "Gestão de Planetas" — catálogo global de Tipos de Planeta (migrado do
// modal da Fase N4 pra uma aba própria de /nova). CRUD ADMIN-only; exclusão
// é bloqueada pela API (409) quando algum Planeta ainda usa o tipo.
export default function PlanetTypesTab({ user, planetTypes, search, showCreateForm, onCreateFormClose, onChanged }: Props) {
  const [formState, setFormState] = useState<PlanetTypeFormState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiPlanetType | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = user.permissionLevel === "ADMIN";
  const q = search.trim().toLowerCase();
  const filtered = (planetTypes ?? []).filter((type) => !q || type.name.toLowerCase().includes(q));

  function handleSaved() {
    setFormState(null);
    onCreateFormClose();
    onChanged();
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
      onChanged();
    } catch {
      setDeleteError("Não foi possível excluir. Verifique sua conexão e tente novamente.");
    } finally {
      setDeleting(false);
    }
  }

  if (!planetTypes) {
    return <p className="text-sm text-luminous-on-surface-variant">Carregando...</p>;
  }

  return (
    <div>
      {filtered.length === 0 ? (
        <GlassCard className="text-center text-sm text-luminous-on-surface-variant">
          {planetTypes.length === 0
            ? isAdmin
              ? 'Nenhum tipo cadastrado ainda. Clique em "Novo Tipo" acima.'
              : "Nenhum tipo de Planeta cadastrado ainda."
            : "Nenhum resultado para essa busca."}
        </GlassCard>
      ) : (
        <ul className="space-y-2">
          {filtered.map((type) => (
            <li key={type.id}>
              <GlassCard className="flex items-start justify-between gap-3 !p-4">
                <div className="min-w-0">
                  <h3 className="font-sora text-sm font-semibold">{type.name}</h3>
                  {type.description && (
                    <p className="mt-1 text-xs text-luminous-on-surface-variant">{type.description}</p>
                  )}
                </div>
                {isAdmin && (
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
                )}
              </GlassCard>
            </li>
          ))}
        </ul>
      )}

      {(showCreateForm || formState) && (
        <PlanetTypeFormModal
          state={formState ?? { mode: "create" }}
          onClose={() => {
            setFormState(null);
            onCreateFormClose();
          }}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-luminous-surface-container p-6 shadow-2xl">
            <h2 className="mb-4 font-sora text-lg font-semibold">Excluir tipo de Planeta</h2>
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
