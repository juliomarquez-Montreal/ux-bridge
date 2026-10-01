"use client";

import { useState } from "react";
import PillButton from "@/components/PillButton";
import { CloseIcon } from "@/components/icons";
import type { ApiProjectSprint } from "../types";

interface Props {
  projectId: string;
  sprint?: ApiProjectSprint;
  onClose: () => void;
  onSaved: () => void;
}

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

// "Nova Sprint" (Visão geral) / editar Sprint (aba Sprints) — formulário
// simples: nome + datas início/fim + observações, sem simulador de cenários.
export default function NewSprintModal({ projectId, sprint, onClose, onSaved }: Props) {
  const isEdit = !!sprint;
  const [name, setName] = useState(sprint?.name ?? "");
  const [startDate, setStartDate] = useState(sprint ? toDateInputValue(sprint.startDate) : "");
  const [endDate, setEndDate] = useState(sprint ? toDateInputValue(sprint.endDate) : "");
  const [notes, setNotes] = useState(sprint?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim() || !startDate || !endDate || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const url = isEdit ? `/api/projetos/${projectId}/sprints/${sprint!.id}` : `/api/projetos/${projectId}/sprints`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), startDate, endDate, notes: notes.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar a Sprint.");
      onSaved();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Falha ao salvar a Sprint.");
    } finally {
      setSubmitting(false);
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
          <h2 className="font-sora text-lg font-semibold text-white">{isEdit ? "Editar Sprint" : "Nova Sprint"}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-luminous-on-surface-variant hover:text-luminous-on-surface">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">Nome</label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex: Sprint 01"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-luminous-on-surface outline-none focus:border-luminous-primary"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">Início</label>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                style={{ colorScheme: "dark" }}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-luminous-on-surface outline-none focus:border-luminous-primary"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">Fim</label>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                style={{ colorScheme: "dark" }}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-luminous-on-surface outline-none focus:border-luminous-primary"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">
              Observações (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-luminous-on-surface outline-none focus:border-luminous-primary"
            />
          </div>

          {submitError && <p className="text-sm text-luminous-error">{submitError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <PillButton type="button" variant="inactive" onClick={onClose}>
              Cancelar
            </PillButton>
            <PillButton type="button" variant="primary" onClick={handleSubmit} disabled={!name.trim() || !startDate || !endDate || submitting}>
              {submitting ? "Salvando..." : isEdit ? "Salvar" : "Criar Sprint"}
            </PillButton>
          </div>
        </div>
      </div>
    </div>
  );
}
