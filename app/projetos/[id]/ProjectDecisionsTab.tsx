"use client";

import { useState } from "react";
import GlassCard from "@/components/GlassCard";
import PillButton from "@/components/PillButton";
import { TrashIcon } from "@/components/icons";
import type { ApiProjectDetail } from "../types";

interface Props {
  project: ApiProjectDetail;
  onChanged: () => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function ProjectDecisionsTab({ project, onChanged }: Props) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null);

  async function handleSubmit() {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/projetos/${project.id}/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao registrar a decisão.");
      setText("");
      onChanged();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Falha ao registrar a decisão.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(decisionId: string) {
    setDeleteBusy(decisionId);
    try {
      await fetch(`/api/projetos/${project.id}/decisions/${decisionId}`, { method: "DELETE" });
      onChanged();
    } finally {
      setDeleteBusy(null);
    }
  }

  return (
    <div>
      <GlassCard>
        <h3 className="font-sora text-sm font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">Registrar decisão</h3>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={2}
          placeholder="Ex: Priorizamos a tela de login antes do cadastro, por dependência técnica."
          className="mt-3 w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-luminous-on-surface outline-none focus:border-luminous-primary"
        />
        {submitError && <p className="mt-2 text-sm text-luminous-error">{submitError}</p>}
        <div className="mt-3 flex justify-end">
          <PillButton type="button" variant="primary" onClick={handleSubmit} disabled={!text.trim() || submitting}>
            {submitting ? "Registrando..." : "Registrar"}
          </PillButton>
        </div>
      </GlassCard>

      {project.decisions.length === 0 ? (
        <GlassCard className="mt-4 text-center text-sm text-luminous-on-surface-variant">Nenhuma decisão registrada ainda.</GlassCard>
      ) : (
        <div className="mt-4 space-y-2.5">
          {project.decisions.map((decision) => (
            <GlassCard key={decision.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-luminous-on-surface">{decision.text}</p>
                <p className="mt-1.5 text-xs text-luminous-on-surface-variant">
                  {decision.authorName} · {formatDateTime(decision.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(decision.id)}
                disabled={deleteBusy === decision.id}
                aria-label="Remover decisão"
                className="shrink-0 text-luminous-on-surface-variant hover:text-luminous-error disabled:opacity-50"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
