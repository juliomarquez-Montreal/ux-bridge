"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import {
  AlertIcon,
  CalendarIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  LayersIcon,
  LinkIcon,
  PlusIcon,
  RefreshIcon,
  TargetIcon,
  TrashIcon,
  UsersIcon,
} from "@/components/icons";
import { BRIDGE_STAGE_LABEL, BRIDGE_STAGES, mapBridgeToStage, type BridgeStage } from "@/lib/projects/bridgeStage";
import { Btn, Card, CardTitle, fieldClass, Pill } from "../ui";
import type { ApiProjectDetail, ApiProjectSprint } from "../types";
import type { ProjectTab } from "./ProjectDetail";

interface Props {
  project: ApiProjectDetail;
  onChanged: () => Promise<void>;
  onOpenLink: () => void;
  onOpenMember: () => void;
  onOpenSprint: () => void;
  onGoTab: (tab: ProjectTab) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Cores das barras do "Status dos Bridges" — mesma paleta das barras da
// "Saúde do backlog" do mockup (cinza -> azul claro -> azul -> roxo -> verde).
const STAGE_BAR_COLOR: Record<BridgeStage, string> = {
  MATERIAL_ENVIADO: "#D3D5DA",
  BRIDGE_SPEC_APROVADO: "#8DBBF7",
  WIREFRAME_PO: "#2F7CF6",
  WIREFRAME_UX: "#8F5CF6",
  FINALIZADO: "#3DBB6A",
};

const STAGE_PILL_TONE: Record<BridgeStage, "gray" | "blue" | "amber" | "purple" | "green"> = {
  MATERIAL_ENVIADO: "gray",
  BRIDGE_SPEC_APROVADO: "blue",
  WIREFRAME_PO: "amber",
  WIREFRAME_UX: "purple",
  FINALIZADO: "green",
};

// Datas de Sprint vêm de <input type="date"> (meia-noite UTC) — toda a
// matemática/exibição de data abaixo é em UTC pra não deslocar um dia.
function utcDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatShort(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).replace(".", "");
}

type SprintPhase = "done" | "current" | "planned";

function sprintPhase(sprint: ApiProjectSprint, todayUtc: number): SprintPhase {
  const start = new Date(sprint.startDate).getTime();
  const end = new Date(sprint.endDate).getTime();
  if (todayUtc > end) return "done";
  if (todayUtc >= start) return "current";
  return "planned";
}

const PHASE_PILL: Record<SprintPhase, { label: string; tone: "green" | "blue" | "gray" }> = {
  done: { label: "Concluída", tone: "green" },
  current: { label: "Em execução", tone: "blue" },
  planned: { label: "Planejada", tone: "gray" },
};

export default function ProjectOverviewTab({ project, onChanged, onOpenLink, onOpenMember, onOpenSprint, onGoTab }: Props) {
  const [editingObjective, setEditingObjective] = useState(false);
  const [objectiveDraft, setObjectiveDraft] = useState(project.objective ?? "");
  const [savingObjective, setSavingObjective] = useState(false);
  const [unlinkBusy, setUnlinkBusy] = useState<string | null>(null);
  const [removeMemberBusy, setRemoveMemberBusy] = useState<string | null>(null);
  // Dispara as transições (barras, anel) logo depois da montagem.
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setObjectiveDraft(project.objective ?? "");
  }, [project.objective]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const bridges = project.bridges;
  const total = bridges.length;
  const specApproved = bridges.filter((b) => b.bddApprovedAt).length;
  const finalized = bridges.filter((b) => b.status === "FINALIZADO").length;

  const stageCounts = BRIDGE_STAGES.reduce<Record<BridgeStage, number>>((acc, stage) => {
    acc[stage] = bridges.filter((b) => mapBridgeToStage(b) === stage).length;
    return acc;
  }, {} as Record<BridgeStage, number>);
  const maxStageCount = Math.max(1, ...BRIDGE_STAGES.map((s) => stageCounts[s]));

  // Ações do PO — só o que dá pra derivar de Bridge.status de verdade.
  const firstOf = (status: string) => bridges.find((b) => b.status === status);
  const actions = [
    { key: "erro", dot: "#E5484D", count: bridges.filter((b) => b.status === "ERRO_GERACAO").length, text: "Bridges com erro na geração", target: firstOf("ERRO_GERACAO") },
    { key: "spec", dot: "#F5B014", count: bridges.filter((b) => b.status === "AGUARDANDO_APROVACAO_BDD").length, text: "Bridge Specs aguardam aprovação", target: firstOf("AGUARDANDO_APROVACAO_BDD") },
    { key: "wf-po", dot: "#F5B014", count: bridges.filter((b) => b.status === "AGUARDANDO_APROVACAO_WIREFRAME_PO").length, text: "wireframes para aprovar (PO)", target: firstOf("AGUARDANDO_APROVACAO_WIREFRAME_PO") },
    { key: "wf-ux", dot: "#1F6FE8", count: bridges.filter((b) => b.status === "AGUARDANDO_APROVACAO_UX").length, text: "wireframes aguardam validação do UX", target: firstOf("AGUARDANDO_APROVACAO_UX") },
  ].filter((a) => a.count > 0);

  // Sprint em destaque: a que está acontecendo; senão a próxima; senão a última.
  const todayUtc = utcDay(new Date());
  const sprintsByStart = [...project.sprints].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const spotlight =
    sprintsByStart.find((s) => sprintPhase(s, todayUtc) === "current") ??
    sprintsByStart.find((s) => sprintPhase(s, todayUtc) === "planned") ??
    sprintsByStart[sprintsByStart.length - 1] ??
    null;
  const spotlightPhase = spotlight ? sprintPhase(spotlight, todayUtc) : null;
  let elapsedPct = 0;
  let totalDays = 0;
  let elapsedDays = 0;
  let daysLabel = "";
  if (spotlight) {
    const start = new Date(spotlight.startDate).getTime();
    const end = new Date(spotlight.endDate).getTime();
    totalDays = Math.round((end - start) / DAY_MS) + 1;
    elapsedDays = Math.min(totalDays, Math.max(0, Math.round((todayUtc - start) / DAY_MS) + 1));
    elapsedPct = Math.round((elapsedDays / totalDays) * 100);
    if (spotlightPhase === "current") daysLabel = `${Math.max(0, Math.round((end - todayUtc) / DAY_MS))} dias restantes`;
    else if (spotlightPhase === "planned") daysLabel = `Começa em ${Math.round((start - todayUtc) / DAY_MS)} dias`;
    else daysLabel = "Sprint concluída";
  }

  async function saveObjective() {
    setSavingObjective(true);
    try {
      await fetch(`/api/projetos/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective: objectiveDraft }),
      });
      setEditingObjective(false);
      await onChanged();
    } finally {
      setSavingObjective(false);
    }
  }

  async function handleUnlink(bridgeId: string) {
    setUnlinkBusy(bridgeId);
    try {
      await fetch(`/api/projetos/${project.id}/bridges/${bridgeId}`, { method: "DELETE" });
      await onChanged();
    } finally {
      setUnlinkBusy(null);
    }
  }

  async function handleRemoveMember(memberId: string) {
    setRemoveMemberBusy(memberId);
    try {
      await fetch(`/api/projetos/${project.id}/members/${memberId}`, { method: "DELETE" });
      await onChanged();
    } finally {
      setRemoveMemberBusy(null);
    }
  }

  // Anel da sprint (SVG): r=46, circunferência ~289; o traço azul anima de
  // vazio até a % de tempo decorrido ao montar.
  const RING_R = 46;
  const RING_C = 2 * Math.PI * RING_R;

  // Linha das sprints: posição do último marcador "preenchido" (concluída ou
  // em execução), pra desenhar o trecho sólido azul da linha.
  const lastFilledIdx = sprintsByStart.reduce((acc, s, i) => (sprintPhase(s, todayUtc) !== "planned" ? i : acc), -1);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1fr_1.15fr_1fr]">
        {/* Objetivo do projeto */}
        <Card className="flex flex-col p-5">
          <CardTitle
            icon={<TargetIcon className="h-6 w-6" />}
            right={
              !editingObjective && (
                <button
                  type="button"
                  onClick={() => setEditingObjective(true)}
                  className="rounded-[6px] border border-[#DCDFE4] bg-white px-3 py-1.5 text-[13.5px] text-[#1D1F25] transition hover:bg-[#F4F5F7] active:scale-95"
                >
                  Editar
                </button>
              )
            }
          >
            Objetivo do projeto
          </CardTitle>

          {editingObjective ? (
            <div className="mt-4 space-y-3">
              <textarea
                autoFocus
                value={objectiveDraft}
                onChange={(event) => setObjectiveDraft(event.target.value)}
                rows={4}
                className={`${fieldClass} resize-none`}
              />
              <div className="flex justify-end gap-2">
                <Btn small onClick={() => setEditingObjective(false)} disabled={savingObjective}>
                  Cancelar
                </Btn>
                <Btn small variant="primary" onClick={saveObjective} disabled={savingObjective}>
                  {savingObjective ? "Salvando..." : "Salvar"}
                </Btn>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-[15px] leading-relaxed text-[#50545C]">
              {project.objective || "Nenhum objetivo definido ainda. Clique em Editar para descrever o que este Projeto entrega."}
            </p>
          )}

          <div className="mt-auto grid grid-cols-2 gap-3 pt-5">
            {[
              { title: "Bridge Spec aprovado", count: specApproved },
              { title: "Finalizado", count: finalized },
            ].map((chip) => (
              <div key={chip.title} className="flex items-center gap-3 rounded-[10px] bg-[#F4F5F7] px-3.5 py-3">
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-white transition-colors duration-500 ${
                    chip.count > 0 && chip.count === total ? "bg-[#2EB872]" : "bg-[#9A9EA6]"
                  }`}
                >
                  <CheckIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[14.5px] font-semibold text-[#1D1F25]">{chip.title}</p>
                  <p className="text-[12.5px] text-[#6B6F77]">
                    {chip.count} de {total} Bridge(s)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Sprint em destaque */}
        <Card className="p-5">
          <CardTitle
            icon={<RefreshIcon className="h-6 w-6" />}
            right={
              <button type="button" onClick={() => onGoTab("sprints")} className="flex items-center gap-1 text-[14px] font-medium text-[#1F6FE8] transition hover:underline">
                Ver sprints <ChevronRightIcon className="h-4 w-4" />
              </button>
            }
          >
            {spotlight ? `${spotlightPhase === "planned" ? "Próxima sprint" : "Sprint"} — ${spotlight.name}` : "Sprint atual"}
          </CardTitle>

          {spotlight ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px] text-[#50545C]">
                <span className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {formatShort(spotlight.startDate)} — {formatShort(spotlight.endDate)}
                </span>
                <span className="flex items-center gap-2 font-medium text-[#1F6FE8]">
                  <ClockIcon className="h-4 w-4" />
                  {daysLabel}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-6">
                <div className="relative h-[116px] w-[116px] shrink-0">
                  <svg viewBox="0 0 116 116" className="-rotate-90">
                    <circle cx="58" cy="58" r={RING_R} fill="none" stroke="#E8F0FD" strokeWidth="13" />
                    <circle
                      cx="58"
                      cy="58"
                      r={RING_R}
                      fill="none"
                      stroke="#1F6FE8"
                      strokeWidth="13"
                      strokeLinecap="round"
                      strokeDasharray={RING_C}
                      strokeDashoffset={animate ? RING_C * (1 - elapsedPct / 100) : RING_C}
                      className="transition-[stroke-dashoffset] duration-1000 ease-out"
                    />
                  </svg>
                  <span className="absolute inset-0 grid place-items-center text-[22px] font-bold text-[#15161A]">{elapsedPct}%</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="text-[#50545C]">Tempo da sprint</span>
                    <span className="font-bold text-[#15161A]">
                      {elapsedDays} / {totalDays} dias
                    </span>
                  </div>
                  <div className="mt-2 h-[9px] overflow-hidden rounded-[5px] bg-[#E6E8EC]">
                    <div
                      className="h-full rounded-[5px] bg-[#1F6FE8] transition-[width] duration-1000 ease-out"
                      style={{ width: animate ? `${elapsedPct}%` : "0%" }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 divide-x divide-[#E6E8EC] border-t border-[#E6E8EC] pt-4">
                {[
                  { icon: <LayersIcon className="h-5 w-5 text-[#50545C]" />, label: "Bridges", value: total },
                  { icon: <RefreshIcon className="h-5 w-5 text-[#1F6FE8]" />, label: "Em andamento", value: total - finalized },
                  { icon: <CheckCircleIcon className="h-5 w-5 text-[#2EB872]" />, label: "Concluídos", value: finalized },
                ].map((stat) => (
                  <div key={stat.label} className="px-4 first:pl-0">
                    <div className="flex items-center gap-2 text-[13.5px] text-[#50545C]">
                      {stat.icon}
                      {stat.label}
                    </div>
                    <p className="mt-1 text-[20px] font-semibold text-[#15161A]">{stat.value}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-6 rounded-[10px] border border-dashed border-[#D7DAE0] p-6 text-center">
              <p className="text-sm text-[#50545C]">Nenhuma sprint cadastrada ainda.</p>
              <Btn small variant="primary" className="mt-3" onClick={onOpenSprint}>
                <PlusIcon className="h-3.5 w-3.5" />
                Nova Sprint
              </Btn>
            </div>
          )}
        </Card>

        {/* Ações do PO */}
        <Card className="p-5">
          <CardTitle icon={<CheckCircleIcon className="h-6 w-6" />}>Ações do PO</CardTitle>
          {actions.length === 0 ? (
            <div className="mt-5 flex items-center gap-3 rounded-[10px] bg-[#F1FAF4] px-4 py-3.5 text-[14.5px] text-[#1A7A3C]">
              <CheckCircleIcon className="h-5 w-5" />
              Nenhuma pendência nos Bridges deste Projeto.
            </div>
          ) : (
            <ul className="mt-4 overflow-hidden rounded-[8px] border border-[#E6E8EC]">
              {actions.map((action) => (
                <li key={action.key} className="border-b border-[#E6E8EC] last:border-b-0">
                  <a
                    href={action.target ? `/bridges/${action.target.id}` : "/bridges"}
                    className="group flex items-center gap-3 px-3.5 py-2.5 text-[14px] text-[#1D1F25] transition hover:bg-[#F7F8FA]"
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: action.dot }} />
                    <span>
                      <strong className="mr-1.5 font-semibold">{action.count}</strong>
                      {action.text}
                    </span>
                    <ChevronRightIcon className="ml-auto h-4 w-4 text-[#9A9EA6] transition group-hover:translate-x-0.5 group-hover:text-[#8B40F5]" />
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-[#6B6F77]">
            <AlertIcon className="h-3.5 w-3.5" />
            Baseado no status real de cada Bridge vinculado.
          </p>
        </Card>
      </div>

      {/* Linha das sprints */}
      <Card className="p-5">
        <CardTitle
          icon={<RefreshIcon className="h-6 w-6" />}
          right={
            <button
              type="button"
              onClick={() => onGoTab("sprints")}
              className="flex items-center gap-2 rounded-[6px] border border-[#D7DAE0] bg-white px-3.5 py-1.5 text-[13.5px] text-[#1D1F25] transition hover:bg-[#F4F5F7] active:scale-95"
            >
              Ver sprints <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          }
        >
          Linha das sprints
        </CardTitle>
        <p className="mt-1 pl-[34px] text-[14px] text-[#50545C]">Acompanhe o andamento das sprints do projeto.</p>

        {sprintsByStart.length === 0 ? (
          <p className="mt-5 rounded-[10px] border border-dashed border-[#D7DAE0] p-5 text-center text-sm text-[#50545C]">
            Cadastre sprints para ver a linha do tempo aqui.
          </p>
        ) : (
          <div className="relative mt-6 overflow-x-auto pb-1">
            <div className="relative" style={{ minWidth: Math.max(520, sprintsByStart.length * 150) }}>
              {/* Linha-base tracejada + trecho concluído/em execução (sólido azul) */}
              <div
                className="absolute top-[52px] h-0 border-t-2 border-dashed border-[#D3D5DA]"
                style={{ left: `${50 / sprintsByStart.length}%`, right: `${50 / sprintsByStart.length}%` }}
              />
              {lastFilledIdx > 0 && (
                <div
                  className="absolute top-[51px] h-[3px] rounded bg-[#1F6FE8] transition-[width] duration-1000 ease-out"
                  style={{
                    left: `${50 / sprintsByStart.length}%`,
                    width: animate ? `${(lastFilledIdx / sprintsByStart.length) * 100}%` : "0%",
                  }}
                />
              )}
              <div className="relative grid" style={{ gridTemplateColumns: `repeat(${sprintsByStart.length}, minmax(0, 1fr))` }}>
                {sprintsByStart.map((sprint) => {
                  const phase = sprintPhase(sprint, todayUtc);
                  const pill = PHASE_PILL[phase];
                  return (
                    <div key={sprint.id} className="flex flex-col items-center text-center">
                      <p className="text-[14.5px] font-bold text-[#15161A]">{sprint.name}</p>
                      <p className="mt-0.5 text-[13px] text-[#50545C]">
                        {formatShort(sprint.startDate)} — {formatShort(sprint.endDate)}
                      </p>
                      <div className="mt-3 grid h-[34px] place-items-center">
                        {phase === "done" ? (
                          <span className="grid h-[28px] w-[28px] place-items-center rounded-full bg-[#2EB872] text-white">
                            <CheckIcon className="h-4 w-4" />
                          </span>
                        ) : phase === "current" ? (
                          <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[#CFE0FB]">
                            <span className="h-[24px] w-[24px] rounded-full border-[3px] border-white bg-[#1F6FE8] shadow" />
                          </span>
                        ) : (
                          <span className="h-[26px] w-[26px] rounded-full border-2 border-[#9A9EA6] bg-white" />
                        )}
                      </div>
                      <Pill tone={pill.tone} className="mt-3 !text-[12.5px]">
                        {pill.label}
                      </Pill>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Status dos Bridges */}
        <Card className="p-5">
          <CardTitle
            icon={<LayersIcon className="h-6 w-6" />}
            right={
              <button type="button" onClick={() => onGoTab("story-map")} aria-label="Abrir Story Map" className="text-[#6B6F77] transition hover:text-[#8B40F5]">
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            }
          >
            Status dos Bridges
          </CardTitle>
          <div className="mt-4 space-y-3">
            {BRIDGE_STAGES.map((stage, index) => (
              <div key={stage} className="flex items-center gap-3">
                <span className="w-[118px] shrink-0 text-[14px] text-[#1D1F25]">{BRIDGE_STAGE_LABEL[stage]}</span>
                <div className="h-[18px] flex-1">
                  <div
                    className="h-full rounded-[4px] transition-[width] duration-1000 ease-out"
                    style={{
                      width: animate ? `${(stageCounts[stage] / maxStageCount) * 100}%` : "0%",
                      minWidth: stageCounts[stage] > 0 && animate ? 6 : 0,
                      backgroundColor: STAGE_BAR_COLOR[stage],
                      transitionDelay: `${index * 90}ms`,
                    }}
                  />
                </div>
                <span className="w-6 text-right text-[14.5px] font-semibold text-[#1D1F25]">{stageCounts[stage]}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Equipe */}
        <Card className="p-5">
          <CardTitle
            icon={<UsersIcon className="h-6 w-6" />}
            right={
              <button
                type="button"
                onClick={onOpenMember}
                aria-label="Adicionar membro"
                className="grid h-8 w-8 place-items-center rounded-full border border-[#D7DAE0] bg-white text-[#1D1F25] transition hover:bg-[#F4F5F7] active:scale-95"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            }
          >
            Equipe
          </CardTitle>
          {project.members.length === 0 ? (
            <p className="mt-4 text-sm text-[#50545C]">Nenhum colaborador adicionado ainda.</p>
          ) : (
            <ul className="mt-4 space-y-1">
              {project.members.map((member) => (
                <li key={member.id} className="group flex items-center justify-between gap-2 rounded-lg px-1.5 py-1.5 transition hover:bg-[#F7F8FA]">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={member.name} avatarUrl={member.avatarUrl} size={32} className="!border-[#E6E8EC]" />
                    <span className="truncate text-[14.5px] text-[#1D1F25]">{member.name}</span>
                    <Pill tone={member.role === "PO" ? "purple" : "blue"} className="!px-2 !py-0.5 !text-[11.5px]">
                      {member.role}
                    </Pill>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={removeMemberBusy === member.id}
                    aria-label={`Remover ${member.name}`}
                    className="text-[#9A9EA6] transition hover:text-[#E5484D] disabled:opacity-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Bridges vinculados */}
        <Card className="p-5">
          <CardTitle
            icon={<LinkIcon className="h-6 w-6" />}
            right={
              <Btn small onClick={onOpenLink}>
                <PlusIcon className="h-3.5 w-3.5" />
                Vincular Bridge
              </Btn>
            }
          >
            Bridges vinculados
          </CardTitle>
          {bridges.length === 0 ? (
            <p className="mt-4 text-sm text-[#50545C]">Nenhum Bridge vinculado ainda.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {bridges.map((bridge) => {
                const stage = mapBridgeToStage(bridge);
                return (
                  <li
                    key={bridge.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[#E6E8EC] bg-white px-3 py-2.5 transition hover:border-[#C9CDD4] hover:shadow-[0_2px_8px_rgba(16,24,40,0.06)]"
                  >
                    <a href={`/bridges/${bridge.id}`} className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-medium text-[#1D1F25] hover:underline">{bridge.planetName}</p>
                      <Pill tone={STAGE_PILL_TONE[stage]} className="mt-1 !px-2 !py-0.5 !text-[11.5px]">
                        {BRIDGE_STAGE_LABEL[stage]}
                      </Pill>
                    </a>
                    <Btn small variant="ghost" onClick={() => handleUnlink(bridge.id)} disabled={unlinkBusy === bridge.id}>
                      {unlinkBusy === bridge.id ? "Desvinculando..." : "Desvincular"}
                    </Btn>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
