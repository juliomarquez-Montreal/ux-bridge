"use client";

import { useEffect, useState } from "react";
import GlassCard from "@/components/GlassCard";
import PillButton from "@/components/PillButton";
import Avatar from "@/components/Avatar";
import { CheckIcon, ClockIcon, CloudIcon, EditIcon, LinkIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { BRIDGE_STAGE_LABEL, BRIDGE_STAGES, mapBridgeToStage } from "@/lib/projects/bridgeStage";
import { STATUS_LABEL } from "@/app/bridges/statusMeta";
import type { ApiProjectDetail } from "../types";
import LinkBridgeModal from "./LinkBridgeModal";
import AddMemberModal from "./AddMemberModal";
import NewSprintModal from "./NewSprintModal";

interface Props {
  project: ApiProjectDetail;
  onChanged: () => void;
}

const STAGE_BAR_COLOR: Record<(typeof BRIDGE_STAGES)[number], string> = {
  MATERIAL_ENVIADO: "bg-[#8e8e93]",
  BRIDGE_SPEC_APROVADO: "bg-[#0077ff]",
  WIREFRAME_PO: "bg-[#ffb688]",
  WIREFRAME_UX: "bg-luminous-tertiary",
  FINALIZADO: "bg-emerald-400",
};

const PO_PENDING_STATUSES = ["AGUARDANDO_APROVACAO_BDD", "AGUARDANDO_APROVACAO_WIREFRAME_PO"];

// timeZone: "UTC" é necessário aqui porque ProjectSprint.startDate/endDate
// vêm de um <input type="date"> (só "AAAA-MM-DD", sem horário) — o
// JavaScript interpreta isso como meia-noite UTC, e sem forçar UTC na
// formatação o fuso local (ex: UTC-3) exibiria um dia a menos.
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export default function ProjectOverviewTab({ project, onChanged }: Props) {
  const [editingObjective, setEditingObjective] = useState(false);
  const [objectiveDraft, setObjectiveDraft] = useState(project.objective ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [linkOpen, setLinkOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [sprintOpen, setSprintOpen] = useState(false);
  const [unlinkBusy, setUnlinkBusy] = useState<string | null>(null);
  const [removeMemberBusy, setRemoveMemberBusy] = useState<string | null>(null);
  const [stagePct, setStagePct] = useState<Record<string, number>>({});

  useEffect(() => {
    setObjectiveDraft(project.objective ?? "");
  }, [project.objective]);

  // Pipeline "Status dos Bridges" — conta real por etapa (nunca uma métrica
  // paralela, só agrupa Bridge.status existente — ver lib/projects/bridgeStage.ts).
  const stageCounts = BRIDGE_STAGES.reduce<Record<string, number>>((acc, stage) => {
    acc[stage] = project.bridges.filter((b) => mapBridgeToStage(b) === stage).length;
    return acc;
  }, {});
  const totalBridges = project.bridges.length || 1;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const next: Record<string, number> = {};
      for (const stage of BRIDGE_STAGES) next[stage] = Math.round(((stageCounts[stage] ?? 0) / totalBridges) * 100);
      setStagePct(next);
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.bridges.length]);

  async function saveObjective() {
    setSaveState("saving");
    try {
      await fetch(`/api/projetos/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective: objectiveDraft }),
      });
      setSaveState("saved");
      setEditingObjective(false);
      onChanged();
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("idle");
    }
  }

  async function handleUnlink(bridgeId: string) {
    setUnlinkBusy(bridgeId);
    try {
      await fetch(`/api/projetos/${project.id}/bridges/${bridgeId}`, { method: "DELETE" });
      onChanged();
    } finally {
      setUnlinkBusy(null);
    }
  }

  async function handleRemoveMember(memberId: string) {
    setRemoveMemberBusy(memberId);
    try {
      await fetch(`/api/projetos/${project.id}/members/${memberId}`, { method: "DELETE" });
      onChanged();
    } finally {
      setRemoveMemberBusy(null);
    }
  }

  const pendingBridges = project.bridges.filter((b) => PO_PENDING_STATUSES.includes(b.status) || b.status === "AGUARDANDO_APROVACAO_UX");

  const today = new Date();
  const currentSprint =
    project.sprints.find((s) => new Date(s.startDate) <= today && today <= new Date(s.endDate)) ??
    project.sprints.find((s) => new Date(s.startDate) > today) ??
    null;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <GlassCard>
        <div className="flex items-center justify-between">
          <h3 className="font-sora text-sm font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">
            Objetivo do Projeto
          </h3>
          {!editingObjective && (
            <button
              type="button"
              onClick={() => setEditingObjective(true)}
              className="flex items-center gap-1.5 text-xs text-luminous-primary-fixed-dim hover:text-luminous-primary-fixed"
            >
              <EditIcon className="h-3.5 w-3.5" />
              Editar
            </button>
          )}
        </div>

        {editingObjective ? (
          <div className="mt-3 space-y-3">
            <textarea
              autoFocus
              value={objectiveDraft}
              onChange={(event) => setObjectiveDraft(event.target.value)}
              rows={4}
              className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-luminous-on-surface outline-none focus:border-luminous-primary"
            />
            <div className="flex justify-end gap-2">
              <PillButton type="button" variant="inactive" onClick={() => setEditingObjective(false)}>
                Cancelar
              </PillButton>
              <PillButton type="button" variant="primary" onClick={saveObjective} disabled={saveState === "saving"}>
                {saveState === "saving" ? "Salvando..." : "Salvar"}
              </PillButton>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-luminous-on-surface-variant">
            {project.objective || "Nenhum objetivo definido ainda."}
          </p>
        )}

        <div
          className={`mt-3 flex items-center gap-1.5 text-xs text-luminous-on-surface-variant transition-opacity duration-500 ${
            saveState === "saved" ? "opacity-100" : "opacity-0"
          }`}
        >
          <CloudIcon className="h-3.5 w-3.5" />
          Salvo automaticamente
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="font-sora text-sm font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">Ações do PO</h3>
        {pendingBridges.length === 0 ? (
          <p className="mt-3 text-sm text-luminous-on-surface-variant">Nenhuma aprovação pendente nos Bridges deste Projeto.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pendingBridges.map((bridge) => (
              <li key={bridge.id}>
                <a
                  href={`/bridges/${bridge.id}`}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-luminous-on-surface transition hover:bg-white/10"
                >
                  <span className="truncate">{bridge.planetName}</span>
                  <span className="shrink-0 text-xs text-[#ffb688]">{STATUS_LABEL[bridge.status as keyof typeof STATUS_LABEL]}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      <GlassCard className="lg:col-span-2">
        <h3 className="font-sora text-sm font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">Status dos Bridges</h3>
        <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-white/5">
          {BRIDGE_STAGES.map((stage) => (
            <div
              key={stage}
              className={`h-full transition-all duration-700 ease-out ${STAGE_BAR_COLOR[stage]}`}
              style={{ width: `${stagePct[stage] ?? 0}%` }}
              title={BRIDGE_STAGE_LABEL[stage]}
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {BRIDGE_STAGES.map((stage) => (
            <div key={stage} className="text-center">
              <div className={`mx-auto mb-1.5 h-2 w-2 rounded-full ${STAGE_BAR_COLOR[stage]}`} />
              <p className="text-lg font-semibold text-luminous-on-surface">{stageCounts[stage] ?? 0}</p>
              <p className="text-[11px] text-luminous-on-surface-variant">{BRIDGE_STAGE_LABEL[stage]}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex items-center justify-between">
          <h3 className="font-sora text-sm font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">Sprint atual</h3>
          <PillButton type="button" variant="inactive" className="!px-3 !py-1.5 !text-[10px]" onClick={() => setSprintOpen(true)}>
            Nova Sprint
          </PillButton>
        </div>
        {currentSprint ? (
          <div className="mt-3">
            <p className="text-sm font-medium text-luminous-on-surface">{currentSprint.name}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-luminous-on-surface-variant">
              <ClockIcon className="h-3.5 w-3.5" />
              {formatDate(currentSprint.startDate)} — {formatDate(currentSprint.endDate)}
            </p>
            <p className="mt-1 text-xs text-luminous-on-surface-variant">
              {new Date(currentSprint.startDate) <= today
                ? `${Math.max(0, daysBetween(new Date(currentSprint.endDate), today))} dias restantes`
                : `Começa em ${daysBetween(new Date(currentSprint.startDate), today)} dias`}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-luminous-on-surface-variant">Nenhuma Sprint cadastrada ainda.</p>
        )}
      </GlassCard>

      <GlassCard>
        <div className="flex items-center justify-between">
          <h3 className="font-sora text-sm font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">Equipe</h3>
          <button
            type="button"
            onClick={() => setMemberOpen(true)}
            aria-label="Adicionar membro"
            className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/5 text-luminous-on-surface transition hover:bg-white/10 active:scale-95"
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </button>
        </div>
        {project.members.length === 0 ? (
          <p className="mt-3 text-sm text-luminous-on-surface-variant">Nenhum colaborador adicionado ainda.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {project.members.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-2 rounded-lg px-1 py-1">
                <div className="flex items-center gap-2.5">
                  <Avatar name={member.name} avatarUrl={member.avatarUrl} size={28} />
                  <span className="text-sm text-luminous-on-surface">{member.name}</span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-luminous-on-surface-variant">
                    {member.role}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveMember(member.id)}
                  disabled={removeMemberBusy === member.id}
                  aria-label={`Remover ${member.name}`}
                  className="text-luminous-on-surface-variant hover:text-luminous-error disabled:opacity-50"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      <GlassCard className="lg:col-span-2">
        <div className="flex items-center justify-between">
          <h3 className="font-sora text-sm font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">Bridges vinculados</h3>
          <PillButton type="button" variant="inactive" className="!px-3 !py-1.5 !text-[10px]" onClick={() => setLinkOpen(true)}>
            <span className="flex items-center gap-1.5">
              <LinkIcon className="h-3 w-3" />
              Vincular Bridge
            </span>
          </PillButton>
        </div>
        {project.bridges.length === 0 ? (
          <p className="mt-3 text-sm text-luminous-on-surface-variant">Nenhum Bridge vinculado ainda.</p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {project.bridges.map((bridge) => (
              <div
                key={bridge.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 transition hover:bg-white/[0.07]"
              >
                <a href={`/bridges/${bridge.id}`} className="min-w-0 flex-1 truncate text-sm text-luminous-on-surface hover:underline">
                  {bridge.planetName}
                  <span className="ml-2 text-xs text-luminous-on-surface-variant">{BRIDGE_STAGE_LABEL[mapBridgeToStage(bridge)]}</span>
                </a>
                {bridge.status === "FINALIZADO" && <CheckIcon className="h-4 w-4 shrink-0 text-emerald-400" />}
                <button
                  type="button"
                  onClick={() => handleUnlink(bridge.id)}
                  disabled={unlinkBusy === bridge.id}
                  className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-luminous-on-surface-variant transition hover:bg-white/10 hover:text-luminous-on-surface disabled:opacity-50"
                >
                  {unlinkBusy === bridge.id ? "Desvinculando..." : "Desvincular"}
                </button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {linkOpen && (
        <LinkBridgeModal
          projectId={project.id}
          onClose={() => setLinkOpen(false)}
          onLinked={() => {
            setLinkOpen(false);
            onChanged();
          }}
        />
      )}
      {memberOpen && (
        <AddMemberModal
          projectId={project.id}
          onClose={() => setMemberOpen(false)}
          onAdded={() => {
            setMemberOpen(false);
            onChanged();
          }}
        />
      )}
      {sprintOpen && (
        <NewSprintModal
          projectId={project.id}
          onClose={() => setSprintOpen(false)}
          onSaved={() => {
            setSprintOpen(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
