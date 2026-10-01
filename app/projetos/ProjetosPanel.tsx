"use client";

import { useEffect, useState } from "react";
import GlassCard from "@/components/GlassCard";
import PillButton from "@/components/PillButton";
import Badge from "@/components/Badge";
import Skeleton from "@/components/Skeleton";
import { EyeIcon, PlusIcon } from "@/components/icons";
import { PROJECT_STATUS_BADGE_VARIANT, PROJECT_STATUS_LABEL } from "./statusMeta";
import type { ApiProjectSummary } from "./types";
import CreateProjectModal from "./CreateProjectModal";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// /projetos (Projeto-1): lista de Projetos existentes + botão "Criar novo
// Projeto". Qualquer usuário autenticado pode ver e criar.
export default function ProjetosPanel() {
  const [projects, setProjects] = useState<ApiProjectSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  function refresh() {
    return fetch("/api/projetos")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { projects: ApiProjectSummary[] }) => setProjects(data.projects))
      .catch(() => setLoadError("Não foi possível carregar os Projetos. Tente recarregar a página."));
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-extrabold leading-tight tracking-[-0.5px] text-white">Projetos</h1>
          <p className="mt-1 text-[15px] text-luminous-on-surface-variant">
            Agrupe múltiplos Bridges e colaboradores sob um mesmo Projeto de entrega.
          </p>
        </div>
        <PillButton type="button" variant="primary" onClick={() => setCreateOpen(true)} className="!px-5 !py-3 !text-xs">
          <span className="flex items-center gap-2">
            <PlusIcon className="h-3.5 w-3.5" />
            Criar novo Projeto
          </span>
        </PillButton>
      </div>

      {loadError && <p className="mt-6 text-sm text-luminous-error">{loadError}</p>}

      <div className="mt-8 space-y-3">
        {projects === null ? (
          <>
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </>
        ) : projects.length === 0 ? (
          <GlassCard className="text-center text-sm text-luminous-on-surface-variant">
            Nenhum Projeto cadastrado ainda. Clique em &quot;Criar novo Projeto&quot; acima.
          </GlassCard>
        ) : (
          projects.map((project) => (
            <a key={project.id} href={`/projetos/${project.id}`} className="block transition hover:-translate-y-0.5">
              <GlassCard className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-xs text-luminous-on-surface-variant">{project.code}</span>
                    <h3 className="font-sora text-base font-semibold text-luminous-on-surface">{project.name}</h3>
                    <Badge variant={PROJECT_STATUS_BADGE_VARIANT[project.status]}>{PROJECT_STATUS_LABEL[project.status]}</Badge>
                  </div>
                  {project.objective && (
                    <p className="mt-1.5 line-clamp-1 text-xs text-luminous-on-surface-variant">{project.objective}</p>
                  )}
                  <p className="mt-1.5 text-xs text-luminous-on-surface-variant/70">
                    {project.bridgeCount} Bridge(s) vinculado(s) · Criado por {project.createdByName} em {formatDate(project.createdAt)}
                  </p>
                </div>
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-luminous-tertiary/30 bg-luminous-tertiary/15 text-luminous-tertiary-fixed-dim">
                  <EyeIcon className="h-4 w-4" />
                </div>
              </GlassCard>
            </a>
          ))
        )}
      </div>

      {createOpen && (
        <CreateProjectModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
