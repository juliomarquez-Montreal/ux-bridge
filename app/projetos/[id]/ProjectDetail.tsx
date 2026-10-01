"use client";

import { useEffect, useRef, useState } from "react";
import Badge from "@/components/Badge";
import Skeleton from "@/components/Skeleton";
import { ChevronDownIcon, ChevronLeftIcon, MoreIcon } from "@/components/icons";
import { PROJECT_STATUS_BADGE_VARIANT, PROJECT_STATUS_LABEL } from "../statusMeta";
import type { ApiProjectDetail, ProjectStatus } from "../types";
import ProjectOverviewTab from "./ProjectOverviewTab";
import ProjectStoryMapTab from "./ProjectStoryMapTab";
import ProjectSprintsTab from "./ProjectSprintsTab";
import ProjectMetricsTab from "./ProjectMetricsTab";
import ProjectDecisionsTab from "./ProjectDecisionsTab";
import DeleteProjectModal from "./DeleteProjectModal";

type Tab = "overview" | "story-map" | "sprints" | "metrics" | "decisions";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Visão geral" },
  { key: "story-map", label: "Story Map" },
  { key: "sprints", label: "Sprints" },
  { key: "metrics", label: "Métricas" },
  { key: "decisions", label: "Decisões" },
];

const STATUS_OPTIONS: ProjectStatus[] = ["PLANEJAMENTO", "EM_EXECUCAO", "EM_VALIDACAO", "FINALIZADO"];

export default function ProjectDetail({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ApiProjectDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [progressWidth, setProgressWidth] = useState(0);

  function refresh() {
    return fetch(`/api/projetos/${projectId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { project: ApiProjectDetail }) => setProject(data.project))
      .catch(() => setLoadError("Não foi possível carregar este Projeto."));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Progresso do Projeto = % de Bridges vinculados que já estão Finalizado —
  // dado real (não uma métrica inventada), direto do campo Bridge.status.
  // Anima de 0 até o valor real ao carregar (microinteração pedida).
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
    await fetch(`/api/projetos/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => refresh());
  }

  if (loadError) {
    return <p className="text-sm text-luminous-error">{loadError}</p>;
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72 rounded-lg" />
        <Skeleton className="h-6 w-96 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-luminous-on-surface-variant">
        <a href="/projetos" className="flex items-center gap-1.5 hover:text-luminous-on-surface">
          <ChevronLeftIcon className="h-4 w-4" />
          Projetos
        </a>
        <span>/</span>
        <span className="text-luminous-on-surface">{project.name}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-sora text-2xl font-bold text-white">{project.name}</h1>
            <span className="font-mono text-xs text-luminous-on-surface-variant">{project.code}</span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setStatusMenuOpen((prev) => !prev)}
                className="flex items-center gap-1 transition hover:opacity-80"
              >
                <Badge variant={PROJECT_STATUS_BADGE_VARIANT[project.status]}>{PROJECT_STATUS_LABEL[project.status]}</Badge>
                <ChevronDownIcon className="h-3 w-3 text-luminous-on-surface-variant" />
              </button>
              {statusMenuOpen && (
                <div className="absolute left-0 top-8 z-30 w-48 overflow-hidden rounded-lg border border-white/10 bg-luminous-surface-container py-1 shadow-lg">
                  {STATUS_OPTIONS.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleStatusChange(status)}
                      className="flex w-full items-center px-3 py-2 text-left text-sm text-luminous-on-surface hover:bg-white/5"
                    >
                      {PROJECT_STATUS_LABEL[status]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="mt-1 text-sm text-luminous-on-surface-variant">
            {project.bridgeCount} Bridge(s) vinculado(s) · Criado por {project.createdByName}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-luminous-on-surface-variant">Progresso do Projeto</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-luminous-primary to-luminous-tertiary transition-[width] duration-700 ease-out"
                  style={{ width: `${progressWidth}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-luminous-on-surface">{progressPct}%</span>
            </div>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreMenuOpen((prev) => !prev)}
              aria-label="Mais opções"
              className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-luminous-on-surface-variant transition hover:bg-white/10 active:scale-95"
            >
              <MoreIcon className="h-4 w-4" />
            </button>
            {moreMenuOpen && (
              <div className="absolute right-0 top-11 z-30 w-48 overflow-hidden rounded-lg border border-white/10 bg-luminous-surface-container py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    setDeleteOpen(true);
                  }}
                  className="flex w-full items-center px-3 py-2 text-left text-sm text-luminous-error hover:bg-luminous-error/10"
                >
                  Excluir Projeto
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative mt-7 flex gap-0 overflow-x-auto overflow-y-hidden border-b border-[#252231]">
        {TABS.map(({ key, label }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`relative shrink-0 px-6 py-3 text-sm transition ${
                isActive ? "font-medium text-luminous-on-surface" : "text-luminous-on-surface-variant hover:text-luminous-on-surface"
              }`}
            >
              {label}
              {isActive && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-[1px] bg-luminous-primary transition-all" />}
            </button>
          );
        })}
      </div>

      <div key={activeTab} className="mt-6 animate-[fadeIn_0.25s_ease-out]">
        {activeTab === "overview" && <ProjectOverviewTab project={project} onChanged={refresh} />}
        {activeTab === "story-map" && <ProjectStoryMapTab project={project} />}
        {activeTab === "sprints" && <ProjectSprintsTab project={project} onChanged={refresh} />}
        {activeTab === "metrics" && <ProjectMetricsTab project={project} />}
        {activeTab === "decisions" && <ProjectDecisionsTab project={project} onChanged={refresh} />}
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
    </div>
  );
}
