"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import Skeleton from "@/components/Skeleton";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, FilterIcon, SortIcon, UsersIcon } from "@/components/icons";
import { ACTIVITY_ACTIONS, ACTIVITY_ACTION_FILTER_LABEL, describeActivity } from "@/lib/activity/actions";

interface ApiActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityLabel: string;
  metadata: unknown;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
  link: string | null;
}

interface ApiActivityResponse {
  items: ApiActivityItem[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  users: { id: string; name: string }[];
}

const RELATIVE = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

// "há 2 horas", "ontem", "há 3 dias"... (passando de ~30 dias, mostra a data).
function relativeTime(iso: string): string {
  const diffSeconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 45) return "agora mesmo";
  if (abs < 3600) return RELATIVE.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86400) return RELATIVE.format(Math.round(diffSeconds / 3600), "hour");
  if (abs < 86400 * 30) return RELATIVE.format(Math.round(diffSeconds / 86400), "day");
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fullDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "medium" });
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function FilterSelect({
  icon,
  value,
  onChange,
  label,
  children,
}: {
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex h-11 min-w-[210px] items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3.5">
      <span className="shrink-0 text-luminous-on-surface-variant">{icon}</span>
      <select
        aria-label={label}
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

const OPTION_CLASS = "bg-luminous-surface-container text-luminous-on-surface";

export default function AtividadesPanel() {
  const [data, setData] = useState<ApiActivityResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [userId, setUserId] = useState("");
  const [order, setOrder] = useState<"desc" | "asc">("desc");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), order });
    if (action) params.set("action", action);
    if (userId) params.set("userId", userId);
    return fetch(`/api/atividades?${params}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json: ApiActivityResponse) => {
        setData(json);
        setLoadError(null);
      })
      .catch(() => setLoadError("Não foi possível carregar as atividades. Tente recarregar a página."))
      .finally(() => setLoading(false));
  }, [page, action, userId, order]);

  useEffect(() => {
    load();
  }, [load]);

  function changeFilter(update: () => void) {
    update();
    setPage(1);
  }

  const first = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data ? (data.page - 1) * data.pageSize + data.items.length : 0;

  return (
    <div>
      <h1 className="text-3xl font-bold text-white">Atividades</h1>
      <p className="mt-1 text-sm text-luminous-on-surface-variant">
        Histórico das principais ações: Bridges, Wireframes, Projetos e mudanças na NOVA.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <FilterSelect
          icon={<FilterIcon className="h-4 w-4" />}
          label="Filtrar por tipo de ação"
          value={action}
          onChange={(v) => changeFilter(() => setAction(v))}
        >
          <option value="" className={OPTION_CLASS}>
            Todas as ações
          </option>
          {ACTIVITY_ACTIONS.map((a) => (
            <option key={a} value={a} className={OPTION_CLASS}>
              {ACTIVITY_ACTION_FILTER_LABEL[a]}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          icon={<UsersIcon className="h-4 w-4" />}
          label="Filtrar por usuário"
          value={userId}
          onChange={(v) => changeFilter(() => setUserId(v))}
        >
          <option value="" className={OPTION_CLASS}>
            Todos os usuários
          </option>
          {data?.users.map((u) => (
            <option key={u.id} value={u.id} className={OPTION_CLASS}>
              {u.name}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          icon={<SortIcon className="h-4 w-4" />}
          label="Ordenação"
          value={order}
          onChange={(v) => changeFilter(() => setOrder(v as "desc" | "asc"))}
        >
          <option value="desc" className={OPTION_CLASS}>
            Mais recentes
          </option>
          <option value="asc" className={OPTION_CLASS}>
            Mais antigos
          </option>
        </FilterSelect>
      </div>

      {loadError && <p className="mt-6 text-sm text-luminous-error">{loadError}</p>}

      <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-[.05em] text-luminous-on-surface-variant">
                <th className="px-4 py-3 font-medium">Usuário</th>
                <th className="px-4 py-3 font-medium">Ação</th>
                <th className="px-4 py-3 font-medium">Item afetado</th>
                <th className="px-4 py-3 font-medium">Quando</th>
              </tr>
            </thead>
            <tbody className={`transition-opacity duration-200 ${loading && data ? "opacity-50" : "opacity-100"}`}>
              {data === null ? (
                [0, 1, 2, 3, 4].map((i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td colSpan={4} className="px-4 py-3">
                      <Skeleton className="h-8 w-full rounded-lg" />
                    </td>
                  </tr>
                ))
              ) : data.items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-luminous-on-surface-variant">
                    {action || userId ? "Nenhuma atividade encontrada com esses filtros." : "Nenhuma atividade registrada ainda."}
                  </td>
                </tr>
              ) : (
                data.items.map((item) => (
                  <tr key={item.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border border-luminous-primary/40 bg-luminous-primary-container font-mono text-[10px] text-luminous-on-surface">
                          {item.user.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- foto vem do Supabase Storage
                            <img src={item.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            initials(item.user.name)
                          )}
                        </span>
                        <span className="font-medium text-luminous-on-surface">{item.user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-luminous-on-surface-variant">{describeActivity(item.action, item.metadata)}</td>
                    <td className="px-4 py-3">
                      {item.link ? (
                        <a href={item.link} className="font-medium text-luminous-primary-fixed-dim underline-offset-2 transition hover:underline">
                          {item.entityLabel}
                        </a>
                      ) : (
                        <span className="text-luminous-on-surface">{item.entityLabel}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-luminous-on-surface-variant">
                      <time dateTime={item.createdAt} title={fullDate(item.createdAt)}>
                        {relativeTime(item.createdAt)}
                      </time>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs text-luminous-on-surface-variant">
              Mostrando {first}–{last} de {data.total} atividade(s)
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Página anterior"
                disabled={data.page <= 1}
                onClick={() => setPage(data.page - 1)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-luminous-on-surface-variant transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <span className="grid h-8 min-w-8 place-items-center rounded-lg bg-luminous-primary px-2 text-xs font-semibold text-luminous-on-primary">
                {data.page} / {data.totalPages}
              </span>
              <button
                type="button"
                aria-label="Próxima página"
                disabled={data.page >= data.totalPages}
                onClick={() => setPage(data.page + 1)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-luminous-on-surface-variant transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
