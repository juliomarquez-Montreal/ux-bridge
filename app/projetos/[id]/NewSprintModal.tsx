"use client";

import { useState } from "react";
import { Btn, fieldClass, labelClass, Modal } from "../ui";
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
    <Modal title={isEdit ? "Editar Sprint" : "Nova Sprint"} onClose={onClose} maxWidth="max-w-sm" busy={submitting}>
      <div className="space-y-3">
        <div>
          <label className={labelClass}>Nome</label>
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex: Sprint 01"
            className={fieldClass}
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={labelClass}>Início</label>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={fieldClass} />
          </div>
          <div className="flex-1">
            <label className={labelClass}>Fim</label>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className={fieldClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Observações (opcional)</label>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className={`${fieldClass} resize-none`} />
        </div>

        {submitError && <p className="text-sm text-[#C42B2B]">{submitError}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Btn onClick={onClose} disabled={submitting}>
            Cancelar
          </Btn>
          <Btn variant="primary" onClick={handleSubmit} disabled={!name.trim() || !startDate || !endDate || submitting}>
            {submitting ? "Salvando..." : isEdit ? "Salvar" : "Criar Sprint"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
