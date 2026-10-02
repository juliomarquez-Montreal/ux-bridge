"use client";

import { useState } from "react";
import { Btn, fieldClass, labelClass, Modal } from "@/app/projetos/ui";
import type { ApiUserRow } from "./types";

// Redefinir senha: o ADMIN digita uma senha temporária e informa à pessoa.
export default function ResetPasswordModal({ user, onClose, onDone }: { user: ApiUserRow; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/usuarios/${user.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível redefinir a senha.");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível redefinir a senha.");
      setBusy(false);
    }
  }

  return (
    <Modal title="Redefinir senha" onClose={onClose} busy={busy}>
      <p className="text-sm text-[#50545C]">
        Defina uma senha temporária para <strong className="text-[#1D1F25]">{user.name}</strong> e avise a pessoa. Ela pode trocá-la depois em Meu perfil.
      </p>
      <div className="mt-4">
        <label className={labelClass} htmlFor="reset-password">
          Nova senha temporária
        </label>
        <input
          id="reset-password"
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo de 8 caracteres"
          autoComplete="off"
          autoFocus
          className={fieldClass}
        />
      </div>
      {error && <p className="mt-3 text-sm text-[#C42B2B]">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Btn onClick={onClose} disabled={busy}>
          Cancelar
        </Btn>
        <Btn variant="primary" onClick={submit} disabled={busy || password.length < 8}>
          {busy ? "Salvando..." : "Redefinir senha"}
        </Btn>
      </div>
    </Modal>
  );
}
