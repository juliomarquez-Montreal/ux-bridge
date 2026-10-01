"use client";

import { useEffect, useState } from "react";
import PillButton from "@/components/PillButton";
import Avatar from "@/components/Avatar";
import { CloseIcon } from "@/components/icons";
import type { ApiProjectUser, ProjectMemberRole } from "../types";

interface Props {
  projectId: string;
  onClose: () => void;
  onAdded: () => void;
}

const ROLES: ProjectMemberRole[] = ["PO", "UX"];

// "+" da seção Equipe — adiciona um colaborador (usuário do sistema + papel
// PO ou UX). Um Projeto pode ter vários PO e vários UX.
export default function AddMemberModal({ projectId, onClose, onAdded }: Props) {
  const [users, setUsers] = useState<ApiProjectUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [role, setRole] = useState<ProjectMemberRole>("PO");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projetos/users")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { users: ApiProjectUser[] }) => setUsers(data.users))
      .catch(() => setLoadError("Não foi possível carregar os usuários."));
  }, []);

  async function handleSubmit() {
    if (!selectedUserId || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/projetos/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao adicionar colaborador.");
      onAdded();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Falha ao adicionar colaborador.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-xl border border-white/10 bg-luminous-surface-container p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-sora text-lg font-semibold text-white">Adicionar colaborador</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-luminous-on-surface-variant hover:text-luminous-on-surface">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">Papel</label>
          <div className="flex gap-2">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-lg border px-4 py-1.5 text-sm transition ${
                  role === r
                    ? "border-luminous-primary bg-luminous-primary/15 text-luminous-on-surface"
                    : "border-white/10 bg-white/5 text-luminous-on-surface-variant hover:bg-white/10"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {loadError && <p className="text-sm text-luminous-error">{loadError}</p>}
        {users === null ? (
          <p className="text-sm text-luminous-on-surface-variant">Carregando...</p>
        ) : (
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {users.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => setSelectedUserId(candidate.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition ${
                  selectedUserId === candidate.id
                    ? "border-luminous-primary bg-luminous-primary/10 text-luminous-on-surface"
                    : "border-white/10 bg-white/5 text-luminous-on-surface-variant hover:bg-white/10"
                }`}
              >
                <Avatar name={candidate.name} avatarUrl={candidate.avatarUrl} size={26} />
                {candidate.name}
              </button>
            ))}
          </div>
        )}

        {submitError && <p className="mt-3 text-sm text-luminous-error">{submitError}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <PillButton type="button" variant="inactive" onClick={onClose}>
            Cancelar
          </PillButton>
          <PillButton type="button" variant="primary" onClick={handleSubmit} disabled={!selectedUserId || submitting}>
            {submitting ? "Adicionando..." : "Adicionar"}
          </PillButton>
        </div>
      </div>
    </div>
  );
}
