"use client";

import { useEffect, useState } from "react";
import Skeleton from "@/components/Skeleton";
import { ChevronLeftIcon, ChevronRightIcon, EditIcon, KeyIcon, PlusIcon, SearchIcon, UserCheckIcon, UserOffIcon } from "@/components/icons";
import { Card, Pill } from "@/app/projetos/ui";
import { FUNCAO_LABEL, FUNCOES, PERMISSION_LABEL, PERMISSIONS } from "@/lib/users/validation";
import ResetPasswordModal from "./ResetPasswordModal";
import UserFormModal from "./UserFormModal";
import type { ApiUserRow, ApiUsersResponse } from "./types";

const ICON_BTN =
  "grid h-8 w-8 place-items-center rounded-lg border border-[#D7DAE0] bg-white text-[#50545C] transition hover:border-[#C9CDD4] hover:bg-[#F4F5F7] hover:text-[#1D1F25] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40";
const SELECT_CLASS =
  "h-10 rounded-lg border border-[#D7DAE0] bg-white px-3 text-sm text-[#1D1F25] outline-none transition focus:border-[#8B40F5] focus:ring-2 focus:ring-[#8B40F5]/15";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

// /usuarios: tabela de usuários (só ADMIN) com busca, filtros, paginação e as
// ações Criar, Editar, Redefinir senha e Desativar/Reativar. Tema claro.
export default function UsuariosPanel({ currentUserId }: { currentUserId: string }) {
  const [data, setData] = useState<ApiUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [funcao, setFuncao] = useState("");
  const [permissao, setPermissao] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [formUser, setFormUser] = useState<ApiUserRow | "new" | null>(null);
  const [resetUser, setResetUser] = useState<ApiUserRow | null>(null);
  const [toggleBusy, setToggleBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("novo") === "1") setFormUser("new");
  }, []);

  // Debounce da busca (300ms).
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch((current) => {
        if (current !== searchInput.trim()) setPage(1);
        return searchInput.trim();
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("q", search);
    if (funcao) params.set("funcao", funcao);
    if (permissao) params.set("permissao", permissao);
    fetch(`/api/usuarios?${params}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json: ApiUsersResponse) => {
        if (cancelled) return;
        setData(json);
        setLoadError(null);
      })
      .catch(() => !cancelled && setLoadError("Não foi possível carregar os usuários. Tente recarregar a página."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, search, funcao, permissao, reloadKey]);

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast((current) => (current === message ? null : current)), 3000);
  }

  async function toggleActive(user: ApiUserRow) {
    setToggleBusy(user.id);
    try {
      const res = await fetch(`/api/usuarios/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !user.active }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Não foi possível alterar o status.");
      flash(user.active ? `${user.name} foi desativado(a).` : `${user.name} foi reativado(a).`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Não foi possível alterar o status.");
    } finally {
      setToggleBusy(null);
    }
  }

  const first = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data ? (data.page - 1) * data.pageSize + data.items.length : 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold leading-tight text-[#15161A]">Usuários</h1>
          <p className="mt-1 text-[15px] text-[#50545C]">Crie e gerencie as pessoas que usam o sistema: função, permissão e acesso às Galáxias.</p>
        </div>
        {/* Mesmo botão primário do header global. */}
        <button
          type="button"
          onClick={() => setFormUser("new")}
          className="flex items-center gap-1.5 rounded-full bg-luminous-primary px-4 py-2.5 text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-primary transition hover:bg-luminous-primary-fixed hover:text-luminous-on-primary-fixed active:scale-[0.97]"
        >
          <PlusIcon className="h-4 w-4" />
          Criar novo usuário
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9A9EA6]" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            aria-label="Buscar usuários"
            className="h-10 w-full rounded-lg border border-[#D7DAE0] bg-white pl-9 pr-3 text-sm text-[#1D1F25] outline-none transition placeholder:text-[#9A9EA6] focus:border-[#8B40F5] focus:ring-2 focus:ring-[#8B40F5]/15"
          />
        </div>
        <select
          aria-label="Filtrar por função"
          value={funcao}
          onChange={(e) => {
            setFuncao(e.target.value);
            setPage(1);
          }}
          className={SELECT_CLASS}
        >
          <option value="">Todas as funções</option>
          {FUNCOES.map((f) => (
            <option key={f} value={f}>
              {FUNCAO_LABEL[f]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por permissão"
          value={permissao}
          onChange={(e) => {
            setPermissao(e.target.value);
            setPage(1);
          }}
          className={SELECT_CLASS}
        >
          <option value="">Todas as permissões</option>
          {PERMISSIONS.map((p) => (
            <option key={p} value={p}>
              {PERMISSION_LABEL[p]}
            </option>
          ))}
        </select>
      </div>

      {loadError && <p className="mt-4 text-sm text-[#C42B2B]">{loadError}</p>}

      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E6E8EC] bg-[#FAFBFC] text-xs font-semibold uppercase tracking-[.05em] text-[#6B6F77]">
                <th className="px-5 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Função</th>
                <th className="px-4 py-3">Permissão</th>
                <th className="px-4 py-3">Galáxias</th>
                <th className="px-4 py-3">Criado em</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className={`transition-opacity duration-200 ${loading && data ? "opacity-50" : "opacity-100"}`}>
              {data === null ? (
                [0, 1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td colSpan={8} className="px-5 py-2">
                      <Skeleton tone="light" className="h-10 w-full rounded-[8px]" />
                    </td>
                  </tr>
                ))
              ) : data.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-[#50545C]">
                    {search || funcao || permissao ? "Nenhum usuário encontrado com esses filtros." : "Nenhum usuário cadastrado."}
                  </td>
                </tr>
              ) : (
                data.items.map((user) => (
                  <tr key={user.id} className="border-b border-[#EEF0F3] transition-colors last:border-b-0 hover:bg-[#FAFBFC]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EFE5FD] text-[11px] font-bold text-[#6B2FD1]">{initials(user.name)}</span>
                        <span className={`text-[14.5px] font-semibold ${user.active ? "text-[#15161A]" : "text-[#9A9EA6]"}`}>
                          {user.name}
                          {user.id === currentUserId && <span className="ml-1.5 text-xs font-normal text-[#6B6F77]">(você)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[14px] text-[#50545C]">{user.email}</td>
                    <td className="px-4 py-3 text-[14px] text-[#1D1F25]">{FUNCAO_LABEL[user.funcao]}</td>
                    <td className="px-4 py-3">
                      <Pill tone={user.permissionLevel === "ADMIN" ? "purple" : "gray"}>{PERMISSION_LABEL[user.permissionLevel]}</Pill>
                    </td>
                    <td className="px-4 py-3 text-[14px] text-[#50545C]" title={user.galaxies.map((g) => g.name).join(", ")}>
                      {user.permissionLevel === "ADMIN" ? "Todas" : user.galaxies.length === 0 ? "Nenhuma" : user.galaxies.length === 1 ? user.galaxies[0].name : `${user.galaxies.length} Galáxias`}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[14px] text-[#50545C]">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Pill tone={user.active ? "green" : "red"}>{user.active ? "Ativo" : "Desativado"}</Pill>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => setFormUser(user)} aria-label={`Editar ${user.name}`} title="Editar" className={ICON_BTN}>
                          <EditIcon className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => setResetUser(user)} aria-label={`Redefinir senha de ${user.name}`} title="Redefinir senha" className={ICON_BTN}>
                          <KeyIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(user)}
                          disabled={toggleBusy === user.id || user.id === currentUserId}
                          aria-label={`${user.active ? "Desativar" : "Reativar"} ${user.name}`}
                          title={user.id === currentUserId ? "Você não pode desativar a própria conta" : user.active ? "Desativar" : "Reativar"}
                          className={user.active ? `${ICON_BTN} hover:!border-[#F2B8BA] hover:!bg-[#FDF1F1] hover:!text-[#C42B2B]` : `${ICON_BTN} hover:!border-[#BFE5CB] hover:!bg-[#EDF9F0] hover:!text-[#1A7A3C]`}
                        >
                          {user.active ? <UserOffIcon className="h-4 w-4" /> : <UserCheckIcon className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6E8EC] bg-[#FAFBFC] px-5 py-3 text-[13px] text-[#50545C]">
            <span>
              Mostrando {first}–{last} de {data.total} usuário(s)
            </span>
            {data.totalPages > 1 && (
              <nav aria-label="Paginação" className="flex items-center gap-1">
                <button type="button" onClick={() => setPage(data.page - 1)} disabled={data.page <= 1} aria-label="Página anterior" className={ICON_BTN}>
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                <span className="grid h-8 min-w-8 place-items-center rounded-lg bg-[#8B40F5] px-2 text-[13px] font-medium text-white">
                  {data.page} / {data.totalPages}
                </span>
                <button type="button" onClick={() => setPage(data.page + 1)} disabled={data.page >= data.totalPages} aria-label="Próxima página" className={ICON_BTN}>
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </nav>
            )}
          </div>
        )}
      </Card>

      {formUser && (
        <UserFormModal
          user={formUser === "new" ? undefined : formUser}
          currentUserId={currentUserId}
          onClose={() => setFormUser(null)}
          onSaved={() => {
            flash(formUser === "new" ? "Usuário criado." : "Alterações salvas.");
            setFormUser(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          onClose={() => setResetUser(null)}
          onDone={() => {
            flash(`Senha de ${resetUser.name} redefinida.`);
            setResetUser(null);
          }}
        />
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 animate-[fadeIn_0.2s_ease-out] rounded-lg bg-[#1D1F25] px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
