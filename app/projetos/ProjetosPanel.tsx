"use client";

import { useEffect, useState } from "react";
import Skeleton from "@/components/Skeleton";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { Btn, Card, Pill } from "./ui";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE } from "./statusMeta";
import type { ApiProjectSummary } from "./types";
import CreateProjectModal from "./CreateProjectModal";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// /projetos (Projeto-1): lista de Projetos existentes + botão "Criar novo
// Projeto". Tema claro (cores do mockup Projetos.html).
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
          <h1 className="text-[30px] font-bold leading-tight text-[#15161A]">Projetos</h1>
          <p className="mt-1 text-[15px] text-[#50545C]">
            Agrupe múltiplos Bridges e colaboradores sob um mesmo Projeto de entrega.
          </p>
        </div>
        <Btn variant="primary" onClick={() => setCreateOpen(true)}>
          <PlusIcon className="h-4 w-4" />
          Criar novo Projeto
        </Btn>
      </div>

      {loadError && <p className="mt-6 text-sm text-[#C42B2B]">{loadError}</p>}

      <div className="mt-7 space-y-3">
        {projects === null ? (
          <>
            <Skeleton tone="light" className="h-[88px] w-full rounded-[10px]" />
            <Skeleton tone="light" className="h-[88px] w-full rounded-[10px]" />
            <Skeleton tone="light" className="h-[88px] w-full rounded-[10px]" />
          </>
        ) : projects.length === 0 ? (
          <Card className="p-8 text-center text-sm text-[#50545C]">
            Nenhum Projeto cadastrado ainda. Clique em &quot;Criar novo Projeto&quot; acima.
          </Card>
        ) : (
          projects.map((project) => (
            <a
              key={project.id}
              href={`/projetos/${project.id}`}
              className="group block rounded-[10px] transition hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(16,24,40,0.08)]"
            >
              <Card className="flex flex-wrap items-center justify-between gap-4 p-5 transition group-hover:border-[#C9CDD4]">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-[18px] font-bold text-[#15161A]">{project.name}</h3>
                    <span className="rounded-[6px] bg-[#EEF0F3] px-2.5 py-1 text-[13px] text-[#52565E]">{project.code}</span>
                    <Pill tone={PROJECT_STATUS_TONE[project.status]}>{PROJECT_STATUS_LABEL[project.status]}</Pill>
                  </div>
                  {project.objective && <p className="mt-1.5 line-clamp-1 text-sm text-[#50545C]">{project.objective}</p>}
                  <p className="mt-1.5 text-[13px] text-[#6B6F77]">
                    {project.bridgeCount} Bridge(s) vinculado(s) · Criado por {project.createdByName} em {formatDate(project.createdAt)}
                  </p>
                </div>
                <ChevronRightIcon className="h-5 w-5 text-[#9A9EA6] transition group-hover:translate-x-0.5 group-hover:text-[#8B40F5]" />
              </Card>
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
