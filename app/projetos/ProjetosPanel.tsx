"use client";

import { useEffect, useMemo, useState } from "react";
import Skeleton from "@/components/Skeleton";
import { ChevronLeftIcon, ChevronRightIcon, EyeIcon, MailIcon, PlusIcon, SearchIcon, ShareIcon, TrashIcon } from "@/components/icons";
import { Card, Pill } from "./ui";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE } from "./statusMeta";
import type { ApiProjectSummary } from "./types";
import CreateProjectModal from "./CreateProjectModal";
import DeleteProjectModal from "./[id]/DeleteProjectModal";
import { copyText, projectMailtoHref, projectShareUrl } from "./shareLink";

const PAGE_SIZE = 10;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const ICON_BTN =
  "grid h-8 w-8 place-items-center rounded-lg border border-[#D7DAE0] bg-white text-[#50545C] transition hover:border-[#C9CDD4] hover:bg-[#F4F5F7] hover:text-[#1D1F25] active:scale-95";

// /projetos: tabela de Projetos (nome + código, status, Bridges vinculados,
// criador, data) com busca, paginação e ações por linha — Visualizar, copiar
// link de compartilhar, enviar por e-mail e apagar. Conteúdo no tema claro;
// o botão de criar segue o botão primário roxo do header global.
export default function ProjetosPanel() {
  const [projects, setProjects] = useState<ApiProjectSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiProjectSummary | null>(null);

  function refresh() {
    return fetch("/api/projetos")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { projects: ApiProjectSummary[] }) => setProjects(data.projects))
      .catch(() => setLoadError("Não foi possível carregar os Projetos. Tente recarregar a página."));
  }

  useEffect(() => {
    refresh();
    // Atalho da busca (Ctrl+K): /projetos?novo=1 já abre o modal de criar.
    if (new URLSearchParams(window.location.search).get("novo") === "1") setCreateOpen(true);
  }, []);

  const filtered = useMemo(() => {
    if (!projects) return [];
    const term = search.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term));
  }, [projects, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstShown = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastShown = (currentPage - 1) * PAGE_SIZE + pageRows.length;

  async function handleCopy(project: ApiProjectSummary) {
    await copyText(projectShareUrl(project.id));
    setCopiedId(project.id);
    setTimeout(() => setCopiedId((current) => (current === project.id ? null : current)), 2000);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold leading-tight text-[#15161A]">Projetos</h1>
          <p className="mt-1 text-[15px] text-[#50545C]">
            Agrupe múltiplos Bridges e colaboradores sob um mesmo Projeto de entrega.
          </p>
        </div>
        {/* Mesmo botão primário do header global ("Criar novo Bridge"). */}
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-luminous-primary px-4 py-2.5 text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-primary transition hover:bg-luminous-primary-fixed hover:text-luminous-on-primary-fixed active:scale-[0.97]"
        >
          <PlusIcon className="h-4 w-4" />
          Criar novo Projeto
        </button>
      </div>

      {loadError && <p className="mt-6 text-sm text-[#C42B2B]">{loadError}</p>}

      {projects !== null && projects.length > 0 && (
        <div className="relative mt-6 max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9A9EA6]" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nome ou código..."
            aria-label="Buscar Projetos"
            className="w-full rounded-lg border border-[#D7DAE0] bg-white py-2 pl-9 pr-3 text-sm text-[#1D1F25] outline-none transition placeholder:text-[#9A9EA6] focus:border-[#8B40F5] focus:ring-2 focus:ring-[#8B40F5]/15"
          />
        </div>
      )}

      <Card className="mt-4 overflow-hidden">
        {projects === null ? (
          <div className="space-y-3 p-5">
            <Skeleton tone="light" className="h-10 w-full rounded-[8px]" />
            <Skeleton tone="light" className="h-10 w-full rounded-[8px]" />
            <Skeleton tone="light" className="h-10 w-full rounded-[8px]" />
            <Skeleton tone="light" className="h-10 w-full rounded-[8px]" />
          </div>
        ) : projects.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#50545C]">
            Nenhum Projeto cadastrado ainda. Clique em &quot;Criar novo Projeto&quot; acima.
          </p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#50545C]">Nenhum Projeto encontrado para &quot;{search.trim()}&quot;.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E6E8EC] bg-[#FAFBFC] text-xs font-semibold uppercase tracking-[.05em] text-[#6B6F77]">
                  <th className="px-5 py-3">Projeto</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Bridges vinculados</th>
                  <th className="px-4 py-3">Criado por</th>
                  <th className="px-4 py-3">Data de criação</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody key={currentPage} className="animate-[fadeIn_0.25s_ease-out]">
                {pageRows.map((project) => (
                  <tr key={project.id} className="border-b border-[#EEF0F3] transition-colors last:border-b-0 hover:bg-[#FAFBFC]">
                    <td className="px-5 py-3.5">
                      <a href={`/projetos/${project.id}`} className="text-[15px] font-semibold text-[#15161A] transition hover:text-[#8B40F5]">
                        {project.name}
                      </a>
                      <span className="ml-2 rounded-[6px] bg-[#EEF0F3] px-2 py-0.5 text-[12px] text-[#52565E]">{project.code}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Pill tone={PROJECT_STATUS_TONE[project.status]}>{PROJECT_STATUS_LABEL[project.status]}</Pill>
                    </td>
                    <td className="px-4 py-3.5 text-center text-[14.5px] font-semibold text-[#1D1F25]">{project.bridgeCount}</td>
                    <td className="px-4 py-3.5 text-[14px] text-[#50545C]">{project.createdByName}</td>
                    <td className="px-4 py-3.5 text-[14px] text-[#50545C]">{formatDate(project.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/projetos/${project.id}`}
                          aria-label={`Visualizar Projeto ${project.name}`}
                          title="Visualizar"
                          className="grid h-8 w-8 place-items-center rounded-lg border border-[#E1D3FB] bg-[#F5EEFE] text-[#6B2FD1] transition hover:bg-[#EDE0FD] active:scale-95"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </a>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => handleCopy(project)}
                            aria-label={`Copiar link de compartilhamento de ${project.name}`}
                            title="Copiar link"
                            className={ICON_BTN}
                          >
                            <ShareIcon className="h-4 w-4" />
                          </button>
                          {copiedId === project.id && (
                            <span className="absolute -top-9 left-1/2 -translate-x-1/2 animate-[fadeIn_0.15s_ease-out] whitespace-nowrap rounded-md bg-[#1D1F25] px-2.5 py-1 text-[11px] font-medium text-white shadow-lg">
                              Link copiado!
                            </span>
                          )}
                        </div>
                        <a
                          href={projectMailtoHref(project.name, project.id)}
                          aria-label={`Enviar ${project.name} por e-mail`}
                          title="Enviar por e-mail"
                          className={ICON_BTN}
                        >
                          <MailIcon className="h-4 w-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(project)}
                          disabled={!project.canManage}
                          aria-label={`Apagar Projeto ${project.name}`}
                          title={project.canManage ? "Apagar" : "Só a equipe do Projeto ou um ADMIN pode apagar"}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-[#F2B8BA] bg-[#FDF1F1] text-[#C42B2B] transition hover:bg-[#FDE3E3] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#FDF1F1]"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {projects !== null && filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6E8EC] bg-[#FAFBFC] px-5 py-3 text-[13px] text-[#50545C]">
            <span>
              Mostrando {firstShown}–{lastShown} de {filtered.length} Projeto(s)
            </span>
            {totalPages > 1 && (
              <nav aria-label="Paginação" className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  aria-label="Página anterior"
                  className={`${ICON_BTN} disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    aria-label={`Página ${n}`}
                    aria-current={n === currentPage ? "page" : undefined}
                    className={`grid h-8 min-w-8 place-items-center rounded-lg border px-2 text-[13px] font-medium transition active:scale-95 ${
                      n === currentPage
                        ? "border-[#8B40F5] bg-[#8B40F5] text-white"
                        : "border-[#D7DAE0] bg-white text-[#50545C] hover:bg-[#F4F5F7]"
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  aria-label="Próxima página"
                  className={`${ICON_BTN} disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </nav>
            )}
          </div>
        )}
      </Card>

      {createOpen && (
        <CreateProjectModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            refresh();
          }}
        />
      )}

      {deleteTarget && (
        <DeleteProjectModal
          project={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
