"use client";

import { useState } from "react";
import GlassCard from "@/components/GlassCard";
import PillButton from "@/components/PillButton";
import { ClockIcon, EditIcon, PlusIcon, TrashIcon } from "@/components/icons";
import type { ApiProjectDetail, ApiProjectSprint } from "../types";
import NewSprintModal from "./NewSprintModal";

interface Props {
  project: ApiProjectDetail;
  onChanged: () => void;
}

// timeZone: "UTC" — ver comentário equivalente em ProjectOverviewTab.tsx.
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function sprintTone(sprint: ApiProjectSprint): { label: string; color: string } {
  const today = new Date();
  const start = new Date(sprint.startDate);
  const end = new Date(sprint.endDate);
  if (today < start) return { label: "Planejada", color: "text-luminous-on-surface-variant" };
  if (today > end) return { label: "Concluída", color: "text-emerald-400" };
  return { label: "Em execução", color: "text-[#0077ff]" };
}

export default function ProjectSprintsTab({ project, onChanged }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ApiProjectSprint | null>(null);
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null);

  async function handleDelete(sprintId: string) {
    setDeleteBusy(sprintId);
    try {
      await fetch(`/api/projetos/${project.id}/sprints/${sprintId}`, { method: "DELETE" });
      onChanged();
    } finally {
      setDeleteBusy(null);
    }
  }

  return (
    <div>
      <div className="flex justify-end">
        <PillButton type="button" variant="primary" onClick={() => setModalOpen(true)} className="!px-4 !py-2 !text-[11px]">
          <span className="flex items-center gap-1.5">
            <PlusIcon className="h-3.5 w-3.5" />
            Nova Sprint
          </span>
        </PillButton>
      </div>

      {project.sprints.length === 0 ? (
        <GlassCard className="mt-4 text-center text-sm text-luminous-on-surface-variant">Nenhuma Sprint cadastrada ainda.</GlassCard>
      ) : (
        <div className="mt-4 space-y-3">
          {project.sprints.map((sprint) => {
            const tone = sprintTone(sprint);
            return (
              <GlassCard key={sprint.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-sora text-sm font-semibold text-luminous-on-surface">{sprint.name}</h3>
                    <span className={`text-xs font-medium ${tone.color}`}>{tone.label}</span>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-luminous-on-surface-variant">
                    <ClockIcon className="h-3.5 w-3.5" />
                    {formatDate(sprint.startDate)} — {formatDate(sprint.endDate)}
                  </p>
                  {sprint.notes && <p className="mt-1.5 text-xs text-luminous-on-surface-variant">{sprint.notes}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditTarget(sprint)}
                    aria-label={`Editar ${sprint.name}`}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-luminous-on-surface-variant transition hover:bg-white/10"
                  >
                    <EditIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(sprint.id)}
                    disabled={deleteBusy === sprint.id}
                    aria-label={`Excluir ${sprint.name}`}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-luminous-error/30 bg-luminous-error/15 text-luminous-error transition hover:bg-luminous-error/25 disabled:opacity-50"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <NewSprintModal
          projectId={project.id}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            onChanged();
          }}
        />
      )}
      {editTarget && (
        <NewSprintModal
          projectId={project.id}
          sprint={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
