"use client";

import { useState } from "react";
import { CalendarIcon, EditIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { Btn, Card, Pill } from "../ui";
import type { ApiProjectDetail, ApiProjectSprint } from "../types";
import NewSprintModal from "./NewSprintModal";

interface Props {
  project: ApiProjectDetail;
  onChanged: () => Promise<void>;
}

// Datas de Sprint vêm de <input type="date"> (meia-noite UTC) — formatação e
// comparação em UTC pra não deslocar um dia (ver ProjectOverviewTab).
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function sprintTone(sprint: ApiProjectSprint): { label: string; tone: "green" | "blue" | "gray" } {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  if (today < new Date(sprint.startDate).getTime()) return { label: "Planejada", tone: "gray" };
  if (today > new Date(sprint.endDate).getTime()) return { label: "Concluída", tone: "green" };
  return { label: "Em execução", tone: "blue" };
}

export default function ProjectSprintsTab({ project, onChanged }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ApiProjectSprint | null>(null);
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null);

  async function handleDelete(sprintId: string) {
    setDeleteBusy(sprintId);
    try {
      await fetch(`/api/projetos/${project.id}/sprints/${sprintId}`, { method: "DELETE" });
      await onChanged();
    } finally {
      setDeleteBusy(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-[20px] font-bold text-[#15161A]">Sprints</h2>
        <Btn variant="primary" onClick={() => setModalOpen(true)}>
          <PlusIcon className="h-4 w-4" />
          Nova Sprint
        </Btn>
      </div>

      {project.sprints.length === 0 ? (
        <Card className="mt-4 p-8 text-center text-sm text-[#50545C]">Nenhuma Sprint cadastrada ainda.</Card>
      ) : (
        <div className="mt-4 space-y-3">
          {project.sprints.map((sprint) => {
            const tone = sprintTone(sprint);
            return (
              <Card key={sprint.id} className="flex flex-wrap items-center justify-between gap-3 p-5 transition hover:shadow-[0_6px_18px_rgba(16,24,40,0.08)]">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-[17px] font-bold text-[#15161A]">{sprint.name}</h3>
                    <Pill tone={tone.tone} className="!text-[12.5px]">
                      {tone.label}
                    </Pill>
                  </div>
                  <p className="mt-1.5 flex items-center gap-2 text-[14px] text-[#50545C]">
                    <CalendarIcon className="h-4 w-4" />
                    {formatDate(sprint.startDate)} — {formatDate(sprint.endDate)}
                  </p>
                  {sprint.notes && <p className="mt-2 text-[14px] text-[#50545C]">{sprint.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditTarget(sprint)}
                    aria-label={`Editar ${sprint.name}`}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-[#D7DAE0] bg-white text-[#1D1F25] transition hover:bg-[#F4F5F7] active:scale-95"
                  >
                    <EditIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(sprint.id)}
                    disabled={deleteBusy === sprint.id}
                    aria-label={`Excluir ${sprint.name}`}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-[#F2B8BA] bg-[#FDF1F1] text-[#C42B2B] transition hover:bg-[#FDE3E3] active:scale-95 disabled:opacity-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </Card>
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
