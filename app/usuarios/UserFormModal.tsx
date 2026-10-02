"use client";

import { useEffect, useState } from "react";
import type { Funcao, PermissionLevel } from "@prisma/client";
import { Btn, fieldClass, labelClass, Modal } from "@/app/projetos/ui";
import { FUNCAO_LABEL, FUNCOES, PERMISSION_LABEL, PERMISSIONS } from "@/lib/users/validation";
import type { ApiUserRow } from "./types";

interface Props {
  // Sem `user` = criar; com `user` = editar.
  user?: ApiUserRow;
  currentUserId: string;
  onClose: () => void;
  onSaved: () => void;
}

// Criar / editar usuário: nome, e-mail, função, permissão e (para quem não é
// administrador) as Galáxias com acesso. Na criação também pede a senha inicial.
export default function UserFormModal({ user, currentUserId, onClose, onSaved }: Props) {
  const editing = !!user;
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [funcao, setFuncao] = useState<Funcao>(user?.funcao ?? "OUTROS");
  const [permissionLevel, setPermissionLevel] = useState<PermissionLevel>(user?.permissionLevel ?? "USER");
  const [galaxyIds, setGalaxyIds] = useState<string[]>(user?.galaxies.map((g) => g.id) ?? []);
  const [galaxies, setGalaxies] = useState<{ id: string; name: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/usuarios/options")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { galaxies: { id: string; name: string }[] }) => setGalaxies(data.galaxies))
      .catch(() => setGalaxies([]));
  }, []);

  const isSelf = user?.id === currentUserId;

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const payload = { name, email, funcao, permissionLevel, galaxyIds, ...(editing ? {} : { password }) };
      const res = await fetch(editing ? `/api/usuarios/${user!.id}` : "/api/usuarios", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
      setBusy(false);
    }
  }

  function toggleGalaxy(id: string) {
    setGalaxyIds((current) => (current.includes(id) ? current.filter((g) => g !== id) : [...current, id]));
  }

  return (
    <Modal title={editing ? "Editar usuário" : "Criar novo usuário"} onClose={onClose} busy={busy} maxWidth="max-w-lg">
      <div className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="user-name">
            Nome
          </label>
          <input id="user-name" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} autoFocus />
        </div>
        <div>
          <label className={labelClass} htmlFor="user-email">
            E-mail
          </label>
          <input id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} />
        </div>
        {!editing && (
          <div>
            <label className={labelClass} htmlFor="user-password">
              Senha inicial
            </label>
            <input
              id="user-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo de 8 caracteres"
              autoComplete="off"
              className={fieldClass}
            />
            <p className="mt-1 text-xs text-[#6B6F77]">A pessoa pode trocar depois em Meu perfil.</p>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="user-funcao">
              Função
            </label>
            <select id="user-funcao" value={funcao} onChange={(e) => setFuncao(e.target.value as Funcao)} className={fieldClass}>
              {FUNCOES.map((f) => (
                <option key={f} value={f}>
                  {FUNCAO_LABEL[f]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="user-permission">
              Permissão
            </label>
            <select
              id="user-permission"
              value={permissionLevel}
              onChange={(e) => setPermissionLevel(e.target.value as PermissionLevel)}
              disabled={isSelf}
              title={isSelf ? "Você não pode mudar a sua própria permissão" : undefined}
              className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {PERMISSIONS.map((p) => (
                <option key={p} value={p}>
                  {PERMISSION_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <p className={labelClass}>Galáxias com acesso</p>
          {permissionLevel === "ADMIN" ? (
            <p className="rounded-lg border border-[#E6E8EC] bg-[#FAFBFC] px-3 py-2 text-sm text-[#50545C]">Administrador tem acesso a todas as Galáxias.</p>
          ) : galaxies === null ? (
            <p className="text-sm text-[#6B6F77]">Carregando Galáxias...</p>
          ) : galaxies.length === 0 ? (
            <p className="text-sm text-[#6B6F77]">Nenhuma Galáxia cadastrada ainda.</p>
          ) : (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[#E6E8EC] p-2">
              {galaxies.map((g) => (
                <label key={g.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition hover:bg-[#F4F5F7]">
                  <input type="checkbox" checked={galaxyIds.includes(g.id)} onChange={() => toggleGalaxy(g.id)} className="h-4 w-4 accent-[#8B40F5]" />
                  {g.name}
                </label>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-[#C42B2B]">{error}</p>}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Btn onClick={onClose} disabled={busy}>
          Cancelar
        </Btn>
        <Btn variant="primary" onClick={submit} disabled={busy || !name.trim() || !email.trim() || (!editing && password.length < 8)}>
          {busy ? "Salvando..." : editing ? "Salvar alterações" : "Criar usuário"}
        </Btn>
      </div>
    </Modal>
  );
}
