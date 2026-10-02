"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import { MessageCircleIcon, TrashIcon } from "@/components/icons";
import { Btn, Card, CardTitle, fieldClass } from "../ui";
import type { ApiProjectDetail } from "../types";

interface Props {
  project: ApiProjectDetail;
  onChanged: () => Promise<void>;
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
      await onChanged();
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
      await onChanged();
    } finally {
      setDeleteBusy(null);
    }
  }

  return (
    <div>
      <Card className="p-5">
        <CardTitle icon={<MessageCircleIcon className="h-6 w-6" />}>Registrar decisão</CardTitle>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={2}
          placeholder="Ex: Priorizamos a tela de login antes do cadastro, por dependência técnica."
          className={`${fieldClass} mt-4 resize-none`}
        />
        {submitError && <p className="mt-2 text-sm text-[#C42B2B]">{submitError}</p>}
        <div className="mt-3 flex justify-end">
          <Btn variant="primary" onClick={handleSubmit} disabled={!text.trim() || submitting}>
            {submitting ? "Registrando..." : "Registrar"}
          </Btn>
        </div>
      </Card>

      {project.decisions.length === 0 ? (
        <Card className="mt-4 p-8 text-center text-sm text-[#50545C]">Nenhuma decisão registrada ainda.</Card>
      ) : (
        <div className="mt-4 space-y-3">
          {project.decisions.map((decision) => (
            <Card key={decision.id} className="flex items-start justify-between gap-3 p-5 transition hover:shadow-[0_6px_18px_rgba(16,24,40,0.08)]">
              <div className="flex min-w-0 items-start gap-3">
                <Avatar name={decision.authorName} size={34} className="!border-[#E6E8EC]" />
                <div className="min-w-0">
                  <p className="text-[15px] leading-relaxed text-[#1D1F25]">{decision.text}</p>
                  <p className="mt-1.5 text-[13px] text-[#6B6F77]">
                    {decision.authorName} · {formatDateTime(decision.createdAt)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(decision.id)}
                disabled={deleteBusy === decision.id}
                aria-label="Remover decisão"
                className="shrink-0 text-[#9A9EA6] transition hover:text-[#E5484D] disabled:opacity-50"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
