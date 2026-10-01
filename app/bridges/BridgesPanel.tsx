"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import CreateBridgeModal from "@/components/CreateBridgeModal";
import ConvertToProjectModal from "@/components/ConvertToProjectModal";
import {
  AlertIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  DownloadIcon,
  EyeIcon,
  FilterIcon,
  FolderIcon,
  FolderPlusIcon,
  MailIcon,
  PackageIcon,
  PlusIcon,
  SearchIcon,
  ShareIcon,
  SortIcon,
  TrashIcon,
} from "@/components/icons";
import { progressForBridge, STATUS_LABEL, STATUS_TONE } from "./statusMeta";
import type { ApiBridgeListItem, BridgeStatus } from "./types";

const PAGE_SIZE = 10;
const STATUS_ORDER: BridgeStatus[] = [
  "GERANDO_BDD",
  "AGUARDANDO_APROVACAO_BDD",
  "GERANDO_WIREFRAME",
  "AGUARDANDO_APROVACAO_WIREFRAME_PO",
  "AGUARDANDO_APROVACAO_UX",
  "FINALIZADO",
  "ERRO_GERACAO",
];

type SortOption = "recent" | "oldest" | "planeta";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function matchesSearch(bridge: ApiBridgeListItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    bridge.planeta.name.toLowerCase().includes(q) ||
    (bridge.estrela?.name.toLowerCase().includes(q) ?? false) ||
    (bridge.galaxia?.name.toLowerCase().includes(q) ?? false)
  );
}

const TONE_PILL_STYLES: Record<"pending" | "done" | "error", string> = {
  pending: "border-[#ffb688]/40 bg-[#ffb688]/10 text-[#ffb688]",
  done: "border-luminous-tertiary/40 bg-luminous-tertiary/10 text-luminous-tertiary-fixed-dim",
  error: "border-luminous-error/40 bg-luminous-error/10 text-luminous-error",
};

function StatusPill({ status }: { status: BridgeStatus }) {
  const tone = STATUS_TONE[status];
  const Icon = tone === "done" ? CheckCircleIcon : tone === "error" ? AlertIcon : ClockIcon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.05em] ${TONE_PILL_STYLES[tone]}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {STATUS_LABEL[status]}
    </span>
  );
}

const STAT_TONE_STYLES = {
  primary: { border: "border-luminous-primary/30", from: "from-luminous-primary/10", iconBg: "bg-luminous-primary/20", iconText: "text-luminous-primary" },
  tertiary: {
    border: "border-luminous-tertiary/30",
    from: "from-luminous-tertiary/10",
    iconBg: "bg-luminous-tertiary/20",
    iconText: "text-luminous-tertiary-fixed-dim",
  },
  amber: { border: "border-[#ffb688]/30", from: "from-[#ffb688]/10", iconBg: "bg-[#ffb688]/20", iconText: "text-[#ffb688]" },
} as const;

function StatCard({ icon, value, label, tone }: { icon: ReactNode; value: number; label: string; tone: keyof typeof STAT_TONE_STYLES }) {
  const styles = STAT_TONE_STYLES[tone];
  return (
    <div className={`flex flex-1 items-center gap-4 rounded-xl border bg-gradient-to-br to-transparent p-5 ${styles.border} ${styles.from}`}>
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${styles.iconBg} ${styles.iconText}`}>{icon}</div>
      <div>
        <p className="font-sora text-3xl font-bold text-white">{value}</p>
        <p className="text-sm text-luminous-on-surface-variant">{label}</p>
      </div>
    </div>
  );
}

function FilterSelect({
  icon,
  value,
  onChange,
  children,
}: {
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative flex h-11 min-w-[190px] items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3.5">
      <span className="shrink-0 text-luminous-on-surface-variant">{icon}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ colorScheme: "dark" }}
        className="w-full appearance-none bg-transparent pr-5 text-sm text-luminous-on-surface outline-none"
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-3 h-4 w-4 text-luminous-on-surface-variant" />
    </div>
  );
}

export default function BridgesPanel() {
  const [bridges, setBridges] = useState<ApiBridgeListItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BridgeStatus | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [page, setPage] = useState(1);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiBridgeListItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Confirmação visual rápida ("Link copiado!") no ícone de compartilhar —
  // guarda o id do Bridge cujo link acabou de ser copiado, por ~2s.
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);
  // Projeto-1: Bridge sendo convertido em Projeto (novo ou vínculo a um já
  // existente) — ver ConvertToProjectModal.
  const [convertTarget, setConvertTarget] = useState<ApiBridgeListItem | null>(null);

  function refreshBridges() {
    return fetch("/api/bridges")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { bridges: ApiBridgeListItem[] }) => setBridges(data.bridges))
      .catch(() => setLoadError("Não foi possível carregar os Bridges. Tente recarregar a página."));
  }

  useEffect(() => {
    refreshBridges();
  }, []);

  const stats = useMemo(() => {
    const list = bridges ?? [];
    return {
      total: list.length,
      finalizadas: list.filter((bridge) => STATUS_TONE[bridge.status] === "done").length,
      aguardando: list.filter((bridge) => STATUS_TONE[bridge.status] === "pending").length,
    };
  }, [bridges]);

  const filteredAndSorted = useMemo(() => {
    const list = (bridges ?? []).filter((bridge) => matchesSearch(bridge, search) && (statusFilter === "ALL" || bridge.status === statusFilter));
    return list.sort((a, b) => {
      if (sortBy === "recent") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return a.planeta.name.localeCompare(b.planeta.name);
    });
  }, [bridges, search, statusFilter, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(page, 1), pageCount);
  const pageItems = filteredAndSorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function resetToFirstPage() {
    setPage(1);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/bridges/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao excluir o Bridge.");
      setBridges((prev) => (prev ? prev.filter((bridge) => bridge.id !== deleteTarget.id) : prev));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Falha ao excluir o Bridge.");
    } finally {
      setDeleteBusy(false);
    }
  }

  // Link de compartilhar: permanente, sem token/expiração — qualquer usuário
  // autenticado que abrir essa URL vê a versão somente-leitura (ver
  // app/bridges/[id]/share/page.tsx e .../api/bridges/[id]/shared, que de
  // propósito não checam acesso por Galáxia).
  function shareUrlFor(bridgeId: string): string {
    return `${window.location.origin}/bridges/${bridgeId}/share`;
  }

  async function handleCopyShareLink(bridge: ApiBridgeListItem) {
    const url = shareUrlFor(bridge.id);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback pra navegadores/contextos sem Clipboard API (ex: HTTP sem
      // permissão) — um textarea temporário + document.execCommand ainda
      // funciona na maioria dos casos.
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
      } catch {
        // silencioso — melhor não copiar do que travar a ação
      }
      document.body.removeChild(textarea);
    }
    setCopiedShareId(bridge.id);
    setTimeout(() => setCopiedShareId((current) => (current === bridge.id ? null : current)), 2000);
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Bridges</h1>
          <p className="mt-1 text-sm text-luminous-on-surface-variant">
            Acompanhe a criação de cada Bridge, do material bruto até o Bridge Spec (BS) aprovado.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-luminous-primary px-5 py-3 text-sm font-semibold text-luminous-on-primary transition hover:bg-luminous-primary-fixed"
        >
          <PlusIcon className="h-4 w-4" />
          Nova Bridge
        </button>
      </div>

      {loadError && <p className="mt-6 text-sm text-luminous-error">{loadError}</p>}

      {!loadError && bridges === null && <p className="mt-6 text-sm text-luminous-on-surface-variant">Carregando...</p>}

      {!loadError && bridges !== null && (
        <>
          <div className="mt-6 flex flex-wrap gap-4">
            <StatCard icon={<PackageIcon className="h-6 w-6" />} value={stats.total} label="bridges" tone="primary" />
            <StatCard icon={<CheckCircleIcon className="h-6 w-6" />} value={stats.finalizadas} label="finalizadas" tone="tertiary" />
            <StatCard icon={<ClockIcon className="h-6 w-6" />} value={stats.aguardando} label="aguardando aprovação" tone="amber" />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <div className="flex h-11 min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3.5">
              <SearchIcon className="h-4 w-4 shrink-0 text-luminous-on-surface-variant" />
              <input
                type="text"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetToFirstPage();
                }}
                placeholder="Buscar por planeta, estrela ou galáxia..."
                className="w-full bg-transparent text-sm text-luminous-on-surface outline-none placeholder:text-luminous-on-surface-variant"
              />
            </div>

            <FilterSelect
              icon={<FilterIcon className="h-4 w-4" />}
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value as BridgeStatus | "ALL");
                resetToFirstPage();
              }}
            >
              <option value="ALL" className="bg-luminous-surface-container text-luminous-on-surface">
                Todos os status
              </option>
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status} className="bg-luminous-surface-container text-luminous-on-surface">
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </FilterSelect>

            <FilterSelect
              icon={<SortIcon className="h-4 w-4" />}
              value={sortBy}
              onChange={(value) => {
                setSortBy(value as SortOption);
                resetToFirstPage();
              }}
            >
              <option value="recent" className="bg-luminous-surface-container text-luminous-on-surface">
                Mais recentes
              </option>
              <option value="oldest" className="bg-luminous-surface-container text-luminous-on-surface">
                Mais antigos
              </option>
              <option value="planeta" className="bg-luminous-surface-container text-luminous-on-surface">
                Planeta (A-Z)
              </option>
            </FilterSelect>
          </div>

          {bridges.length === 0 ? (
            <div className="mt-6 rounded-xl border border-white/10 bg-luminous-surface-container/50 py-10 text-center text-sm text-luminous-on-surface-variant">
              Nenhum Bridge criado ainda. Use o botão &quot;Nova Bridge&quot; para começar.
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-[.05em] text-luminous-on-surface-variant">
                      <th className="px-4 py-3 font-medium">Planeta</th>
                      <th className="px-4 py-3 font-medium">Estrela</th>
                      <th className="px-4 py-3 font-medium">Galáxia</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Completado</th>
                      <th className="px-4 py-3 font-medium">Criado por</th>
                      <th className="px-4 py-3 font-medium">Criado em</th>
                      <th className="px-4 py-3 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-luminous-on-surface-variant">
                          Nenhum Bridge encontrado com esses filtros.
                        </td>
                      </tr>
                    ) : (
                      pageItems.map((bridge) => {
                        const progress = progressForBridge(bridge);
                        return (
                          <tr key={bridge.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                            <td className="px-4 py-3 font-medium text-luminous-on-surface">{bridge.planeta.name}</td>
                            <td className="px-4 py-3 text-luminous-on-surface-variant">{bridge.estrela?.name ?? "—"}</td>
                            <td className="px-4 py-3 text-luminous-on-surface-variant">{bridge.galaxia?.name ?? "—"}</td>
                            <td className="px-4 py-3">
                              <StatusPill status={bridge.status} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="w-9 shrink-0 text-xs font-semibold text-luminous-on-surface">{progress}%</span>
                                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-luminous-primary to-luminous-tertiary"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-luminous-on-surface-variant">{bridge.createdBy}</td>
                            <td className="px-4 py-3 text-luminous-on-surface-variant">{formatDate(bridge.createdAt)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <a
                                  href={`/bridges/${bridge.id}`}
                                  aria-label={`Ver Bridge de ${bridge.planeta.name}`}
                                  className="grid h-8 w-8 place-items-center rounded-lg border border-luminous-tertiary/30 bg-luminous-tertiary/15 text-luminous-tertiary-fixed-dim transition hover:bg-luminous-tertiary/25"
                                >
                                  <EyeIcon className="h-4 w-4" />
                                </a>
                                {/* Compartilhar/baixar PDF/e-mail — só fazem sentido a partir do BDD
                                    aprovado (antes disso não há nada substancial pra ver/exportar). */}
                                {bridge.bddApprovedAt && (
                                  <>
                                    <div className="relative">
                                      <button
                                        type="button"
                                        aria-label={`Copiar link de compartilhamento de ${bridge.planeta.name}`}
                                        onClick={() => handleCopyShareLink(bridge)}
                                        className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-luminous-on-surface-variant transition hover:bg-white/10 hover:text-luminous-on-surface"
                                      >
                                        <ShareIcon className="h-4 w-4" />
                                      </button>
                                      {copiedShareId === bridge.id && (
                                        <span className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-luminous-on-surface px-2.5 py-1 text-[11px] font-medium text-luminous-surface shadow-lg">
                                          Link copiado!
                                        </span>
                                      )}
                                    </div>
                                    <a
                                      href={`/api/bridges/${bridge.id}/pdf`}
                                      aria-label={`Baixar PDF de ${bridge.planeta.name}`}
                                      className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-luminous-on-surface-variant transition hover:bg-white/10 hover:text-luminous-on-surface"
                                    >
                                      <DownloadIcon className="h-4 w-4" />
                                    </a>
                                    <a
                                      href={`mailto:?subject=${encodeURIComponent(`UX Bridge — ${bridge.planeta.name}`)}&body=${encodeURIComponent(shareUrlFor(bridge.id))}`}
                                      aria-label={`Enviar ${bridge.planeta.name} por e-mail`}
                                      className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-luminous-on-surface-variant transition hover:bg-white/10 hover:text-luminous-on-surface"
                                    >
                                      <MailIcon className="h-4 w-4" />
                                    </a>
                                  </>
                                )}
                                {bridge.project ? (
                                  <a
                                    href={`/projetos/${bridge.project.id}`}
                                    aria-label={`Ver Projeto ${bridge.project.name}`}
                                    title={`Projeto: ${bridge.project.name}`}
                                    className="grid h-8 w-8 place-items-center rounded-lg border border-luminous-primary/30 bg-luminous-primary/15 text-luminous-primary-fixed-dim transition hover:bg-luminous-primary/25"
                                  >
                                    <FolderIcon className="h-4 w-4" />
                                  </a>
                                ) : (
                                  <button
                                    type="button"
                                    aria-label={`Converter ${bridge.planeta.name} em Projeto`}
                                    title="Converter em Projeto"
                                    onClick={() => setConvertTarget(bridge)}
                                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-luminous-on-surface-variant transition hover:bg-white/10 hover:text-luminous-on-surface"
                                  >
                                    <FolderPlusIcon className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  aria-label={`Excluir Bridge de ${bridge.planeta.name}`}
                                  onClick={() => {
                                    setDeleteError(null);
                                    setDeleteTarget(bridge);
                                  }}
                                  className="grid h-8 w-8 place-items-center rounded-lg border border-luminous-error/30 bg-luminous-error/15 text-luminous-error transition hover:bg-luminous-error/25"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs text-luminous-on-surface-variant">
                  Mostrando {pageItems.length} de {filteredAndSorted.length} bridges
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Página anterior"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-luminous-on-surface-variant transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </button>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-luminous-primary text-xs font-semibold text-luminous-on-primary">
                    {currentPage}
                  </span>
                  <button
                    type="button"
                    aria-label="Próxima página"
                    disabled={currentPage >= pageCount}
                    onClick={() => setPage(currentPage + 1)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-luminous-on-surface-variant transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {createModalOpen && <CreateBridgeModal onClose={() => setCreateModalOpen(false)} />}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => !deleteBusy && setDeleteTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-xl border border-white/10 bg-luminous-surface-container p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="font-sora text-lg font-semibold text-white">Excluir Bridge</h2>
            <p className="mt-2 text-sm text-luminous-on-surface-variant">
              Tem certeza que deseja excluir o Bridge de{" "}
              <strong className="text-luminous-on-surface">{deleteTarget.planeta.name}</strong>? Essa ação não pode ser
              desfeita.
            </p>
            {deleteError && <p className="mt-3 text-sm text-luminous-error">{deleteError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteBusy}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-mono text-xs uppercase tracking-[0.1em] text-luminous-on-surface-variant transition hover:text-luminous-on-surface disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteBusy}
                className="rounded-full bg-luminous-error px-4 py-2 font-mono text-xs uppercase tracking-[0.1em] text-luminous-on-error transition hover:opacity-90 disabled:opacity-60"
              >
                {deleteBusy ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {convertTarget && (
        <ConvertToProjectModal
          bridge={convertTarget}
          onClose={() => setConvertTarget(null)}
          onConverted={() => {
            setConvertTarget(null);
            refreshBridges();
          }}
        />
      )}
    </div>
  );
}
