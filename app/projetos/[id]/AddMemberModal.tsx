"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import { Btn, labelClass, Modal } from "../ui";
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
    <Modal title="Adicionar colaborador" onClose={onClose} maxWidth="max-w-sm" busy={submitting}>
      <div className="mb-4">
        <label className={labelClass}>Papel</label>
        <div className="flex gap-2">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded-lg border px-4 py-1.5 text-sm font-medium transition ${
                role === r
                  ? "border-[#8B40F5] bg-[#F5EEFE] text-[#6B2FD1]"
                  : "border-[#D7DAE0] bg-white text-[#50545C] hover:bg-[#F4F5F7]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loadError && <p className="text-sm text-[#C42B2B]">{loadError}</p>}
      {users === null ? (
        <p className="text-sm text-[#50545C]">Carregando...</p>
      ) : (
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {users.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => setSelectedUserId(candidate.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition ${
                selectedUserId === candidate.id
                  ? "border-[#8B40F5] bg-[#F5EEFE] text-[#1D1F25]"
                  : "border-[#E6E8EC] bg-white text-[#1D1F25] hover:bg-[#F4F5F7]"
              }`}
            >
              <Avatar name={candidate.name} avatarUrl={candidate.avatarUrl} size={26} className="!border-[#E6E8EC]" />
              {candidate.name}
            </button>
          ))}
        </div>
      )}

      {submitError && <p className="mt-3 text-sm text-[#C42B2B]">{submitError}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <Btn onClick={onClose} disabled={submitting}>
          Cancelar
        </Btn>
        <Btn variant="primary" onClick={handleSubmit} disabled={!selectedUserId || submitting}>
          {submitting ? "Adicionando..." : "Adicionar"}
        </Btn>
      </div>
    </Modal>
  );
}
