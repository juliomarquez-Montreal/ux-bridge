"use client";

import { useEffect, useState, type ReactNode } from "react";
import Skeleton from "@/components/Skeleton";
import {
  BarChartIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  CloudIcon,
  DocumentIcon,
  MessageCircleIcon,
  MoreIcon,
  PlusIcon,
  RefreshIcon,
  StoryMapIcon,
  TargetIcon,
} from "@/components/icons";
import { Btn, Pill } from "../ui";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE } from "../statusMeta";
import type { ApiProjectDetail, ProjectStatus } from "../types";
import ProjectOverviewTab from "./ProjectOverviewTab";
import ProjectStoryMapTab from "./ProjectStoryMapTab";
import ProjectSprintsTab from "./ProjectSprintsTab";
import ProjectMetricsTab from "./ProjectMetricsTab";
import ProjectDecisionsTab from "./ProjectDecisionsTab";
import DeleteProjectModal from "./DeleteProjectModal";
import LinkBridgeModal from "./LinkBridgeModal";
import AddMemberModal from "./AddMemberModal";
import NewSprintModal from "./NewSprintModal";

export type ProjectTab = "overview" | "story-map" | "sprints" | "metrics" | "decisions";

const TABS: { key: ProjectTab; label: string; icon: (p: { className?: string }) => ReactNode }[] = [
  { key: "overview", label: "Visão geral", icon: TargetIcon },
  { key: "story-map", label: "Story Map", icon: StoryMapIcon },
  { key: "sprints", label: "Sprints", icon: RefreshIcon },
  { key: "metrics", label: "Métricas", icon: BarChartIcon },
  { key: "decisions", label: "Decisões", icon: MessageCircleIcon },
];

const STATUS_OPTIONS: ProjectStatus[] = ["PLANEJAMENTO", "EM_EXECUCAO", "EM_VALIDACAO", "FINALIZADO"];

type SaveState = "idle" | "saving" | "saved";

function formatTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function relativeFrom(iso: string): string {
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMin < 1) return "agora há pouco";
  if (diffMin < 60) return `há ${diffMin} min`;
  const hours = Math.round(diffMin / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} d`;
}

// /projetos/[id] — TEMA CLARO (mockup Layout/Projetos.html): cabeçalho com
// breadcrumb + título + código + status + progresso, abas com ícone e roxo
// no ativo, conteúdo em cards brancos sobre fundo #F4F5F7 e barra de status
// no rodapé do conteúdo ("Última decisão..." / "Salvo automaticamente").
export default function ProjectDetail({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ApiProjectDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectTab>("overview");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [sprintOpen, setSprintOpen] = useState(false);
  const [progressWidth, setProgressWidth] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  function refresh() {
    return fetch(`/api/projetos/${projectId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { project: ApiProjectDetail }) => setProject(data.project))
      .catch(() => setLoadError("Não foi possível carregar este Projeto."));
  }

  // Chamado pelas abas/modais depois de qualquer alteração: mostra
  // "Salvando..." -> "Salvo automaticamente às HH:MM" no rodapé, com transição.
  async function onMutated() {
    setSaveState("saving");
    await refresh();
    setSavedAt(new Date());
    setSaveState("saved");
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Progresso do Projeto = % de Bridges vinculados já Finalizado — dado real
  // direto de Bridge.status. Anima de 0 até o valor real ao carregar.
  const finalizedCount = project ? project.bridges.filter((b) => b.status === "FINALIZADO").length : 0;
  const progressPct = project && project.bridges.length > 0 ? Math.round((finalizedCount / project.bridges.length) * 100) : 0;
  useEffect(() => {
    if (!project) return;
    const frame = requestAnimationFrame(() => setProgressWidth(progressPct));
    return () => cancelAnimationFrame(frame);
  }, [project, progressPct]);

  async function handleStatusChange(status: ProjectStatus) {
    setStatusMenuOpen(false);
    if (!project || project.status === status) return;
    setProject({ ...project, status });
    setSaveState("saving");
    await fetch(`/api/projetos/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => refresh());
    setSavedAt(new Date());
    setSaveState("saved");
  }

  if (loadError) {
    return <p className="mx-auto max-w-[1480px] px-8 py-8 text-sm text-[#C42B2B]">{loadError}</p>;
  }

  if (!project) {
    return (
      <div>
        <div className="border-b border-[#E6E8EC] bg-[#FAFBFC] px-8 py-6">
          <div className="mx-auto max-w-[1480px] space-y-3">
            <Skeleton tone="light" className="h-4 w-48 rounded" />
            <Skeleton tone="light" className="h-9 w-80 rounded-lg" />
            <Skeleton tone="light" className="h-4 w-64 rounded" />
          </div>
        </div>
        <div className="mx-auto grid max-w-[1480px] gap-5 px-8 py-6 lg:grid-cols-3">
          <Skeleton tone="light" className="h-56 rounded-[10px]" />
          <Skeleton tone="light" className="h-56 rounded-[10px]" />
          <Skeleton tone="light" className="h-56 rounded-[10px]" />
        </div>
      </div>
    );
  }

  const lastDecision = project.decisions[0] ?? null;

  return (
    <div>
      <div className="border-b border-[#E6E8EC] bg-[#FAFBFC]">
        <div className="mx-auto max-w-[1480px] px-6 pt-5 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex items-start gap-4">
              <a
                href="/projetos"
                aria-label="Voltar"
                className="mt-1 grid h-[38px] w-[38px] shrink-0 place-items-center rounded-lg border border-[#DFE1E6] bg-white text-[#1D1F25] transition hover:bg-[#F4F5F7] active:scale-95"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </a>
              <div>
                <div className="flex items-center gap-2 text-[13.5px] text-[#50545C]">
                  <a href="/projetos" className="transition hover:text-[#8B40F5]">
                    Projetos
                  </a>
                  <span>/</span>
                  <span className="text-[#1D1F25]">{project.name}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <h1 className="text-[30px] font-bold leading-tight text-[#15161A]">{project.name}</h1>
                  <span className="rounded-[6px] bg-[#EEF0F3] px-2.5 py-1 text-[13.5px] text-[#52565E]">{project.code}</span>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setStatusMenuOpen((prev) => !prev)}
                      className="flex items-center gap-1 transition hover:opacity-80"
                    >
                      <Pill tone={PROJECT_STATUS_TONE[project.status]} className="!text-[13.5px]">
                        {PROJECT_STATUS_LABEL[project.status]}
                      </Pill>
                      <ChevronDownIcon className="h-3.5 w-3.5 text-[#6B6F77]" />
                    </button>
                    {statusMenuOpen && (
                      <div className="absolute left-0 top-9 z-30 w-48 animate-[fadeIn_0.15s_ease-out] overflow-hidden rounded-lg border border-[#E6E8EC] bg-white py-1 shadow-[0_8px_24px_rgba(16,24,40,0.12)]">
                        {STATUS_OPTIONS.map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => handleStatusChange(status)}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[#1D1F25] transition hover:bg-[#F4F5F7]"
                          >
                            {PROJECT_STATUS_LABEL[status]}
                            {project.status === status && <CheckIcon className="h-3.5 w-3.5 text-[#8B40F5]" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-[15px] text-[#50545C]">
                  {project.bridgeCount} Bridge(s) vinculado(s) · Criado por {project.createdByName}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5">
              <div>
                <p className="text-[13.5px] text-[#50545C]">Progresso do projeto</p>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="h-[9px] w-[260px] max-w-[40vw] overflow-hidden rounded-[5px] bg-[#E6E8EC]">
                    <div
                      className="h-full rounded-[5px] bg-[#1F6FE8] transition-[width] duration-1000 ease-out"
                      style={{ width: `${progressWidth}%` }}
                    />
                  </div>
                  <span className="text-[17px] font-bold text-[#15161A]">{progressPct}%</span>
                </div>
              </div>
              <div className="hidden h-10 w-px bg-[#E6E8EC] sm:block" />
              <div className="flex items-center gap-2.5">
                <Btn variant="primary" onClick={() => setSprintOpen(true)}>
                  <PlusIcon className="h-4 w-4" />
                  Nova Sprint
                </Btn>
                <Btn onClick={() => setLinkOpen(true)}>
                  <PlusIcon className="h-4 w-4" />
                  Vincular Bridge
                </Btn>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMoreMenuOpen((prev) => !prev)}
                    aria-label="Mais opções"
                    className="grid h-[42px] w-[42px] place-items-center rounded-[7px] border border-[#D7DAE0] bg-white text-[#1D1F25] transition hover:bg-[#F4F5F7] active:scale-95"
                  >
                    <MoreIcon className="h-4 w-4" />
                  </button>
                  {moreMenuOpen && (
                    <div className="absolute right-0 top-12 z-30 w-48 animate-[fadeIn_0.15s_ease-out] overflow-hidden rounded-lg border border-[#E6E8EC] bg-white py-1 shadow-[0_8px_24px_rgba(16,24,40,0.12)]">
                      <button
                        type="button"
                        onClick={() => {
                          setMoreMenuOpen(false);
                          setDeleteOpen(true);
                        }}
                        className="flex w-full items-center px-3 py-2 text-left text-sm text-[#C42B2B] transition hover:bg-[#FDF1F1]"
                      >
                        Excluir Projeto
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex gap-1 overflow-x-auto">
            {TABS.map(({ key, label, icon: Icon }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`relative flex shrink-0 items-center gap-2.5 px-5 py-3.5 text-[16px] transition-colors ${
                    isActive ? "font-semibold text-[#7B3BF0]" : "text-[#1D1F25] hover:text-[#7B3BF0]"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? "text-[#7B3BF0]" : "text-[#50545C]"}`} />
                  {label}
                  <span
                    className={`absolute inset-x-3 bottom-0 h-[3px] rounded-t-[2px] bg-[#7B3BF0] transition-all duration-300 ${
                      isActive ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1480px] px-6 py-6 lg:px-8">
        <div key={activeTab} className="animate-[fadeIn_0.25s_ease-out]">
          {activeTab === "overview" && (
            <ProjectOverviewTab
              project={project}
              onChanged={onMutated}
              onOpenLink={() => setLinkOpen(true)}
              onOpenMember={() => setMemberOpen(true)}
              onOpenSprint={() => setSprintOpen(true)}
              onGoTab={setActiveTab}
            />
          )}
          {activeTab === "story-map" && <ProjectStoryMapTab project={project} />}
          {activeTab === "sprints" && <ProjectSprintsTab project={project} onChanged={onMutated} />}
          {activeTab === "metrics" && <ProjectMetricsTab project={project} />}
          {activeTab === "decisions" && <ProjectDecisionsTab project={project} onChanged={onMutated} />}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#E6E8EC] pt-4 text-[12.5px] text-[#50545C]">
          <div className="flex items-center gap-2">
            <DocumentIcon className="h-4 w-4 text-[#6B6F77]" />
            {lastDecision ? (
              <>
                <span>Última decisão registrada {relativeFrom(lastDecision.createdAt)}</span>
                <button type="button" onClick={() => setActiveTab("decisions")} className="font-medium text-[#1F6FE8] transition hover:underline">
                  Ver decisões →
                </button>
              </>
            ) : (
              <span>Nenhuma decisão registrada ainda</span>
            )}
          </div>
          <div
            className={`flex items-center gap-2 transition-colors duration-500 ${
              saveState === "saving" ? "text-[#6B6F77]" : saveState === "saved" ? "text-[#1A7A3C]" : "text-[#6B6F77]"
            }`}
          >
            {saveState === "saving" ? (
              <>
                <CloudIcon className="h-4 w-4 animate-pulse" />
                Salvando...
              </>
            ) : saveState === "saved" && savedAt ? (
              <>
                <CheckCircleIcon className="h-4 w-4 text-[#2EB872]" />
                Salvo automaticamente às {formatTime(savedAt)}
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-4 w-4 text-[#9A9EA6]" />
                Alterações são salvas automaticamente
              </>
            )}
          </div>
        </div>
      </div>

      {deleteOpen && (
        <DeleteProjectModal
          project={project}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            window.location.href = "/projetos";
          }}
        />
      )}
      {linkOpen && (
        <LinkBridgeModal
          projectId={project.id}
          onClose={() => setLinkOpen(false)}
          onLinked={() => {
            setLinkOpen(false);
            onMutated();
          }}
        />
      )}
      {memberOpen && (
        <AddMemberModal
          projectId={project.id}
          onClose={() => setMemberOpen(false)}
          onAdded={() => {
            setMemberOpen(false);
            onMutated();
          }}
        />
      )}
      {sprintOpen && (
        <NewSprintModal
          projectId={project.id}
          onClose={() => setSprintOpen(false)}
          onSaved={() => {
            setSprintOpen(false);
            onMutated();
          }}
        />
      )}
    </div>
  );
}
