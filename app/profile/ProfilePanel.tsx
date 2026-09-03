"use client";

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import GlassCard from "@/components/GlassCard";
import PillButton from "@/components/PillButton";
import Badge from "@/components/Badge";
import CropModal from "./CropModal";
import { useFieldAutosave, type SaveStatus } from "./useFieldAutosave";

type Funcao = "PO" | "UX" | "GERENTE_PROJETOS" | "OUTROS";
type PermissionLevel = "ADMIN" | "USER";

interface ProfileData {
  id: string;
  name: string;
  email: string;
  funcao: Funcao;
  permissionLevel: PermissionLevel;
  avatarUrl: string | null;
}

const FUNCAO_LABELS: Record<Funcao, string> = {
  PO: "PO",
  UX: "UX",
  GERENTE_PROJETOS: "Gerente de Projetos",
  OUTROS: "Outros",
};

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

function notifyProfileUpdated() {
  window.dispatchEvent(new Event("profile-updated"));
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-luminous-primary";
const labelClass = "mb-1 block text-xs uppercase tracking-[.1em] text-luminous-on-surface-variant";

// Indicador discreto de autosave: "Salvando..." enquanto salva, "✓ Salvo"
// por ~2,5s depois, some sozinho. Erros são mostrados à parte (persistem).
function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return <span className="text-xs text-luminous-on-surface-variant">Salvando...</span>;
  }
  if (status === "saved") {
    return <span className="text-xs text-emerald-300">✓ Salvo</span>;
  }
  return null;
}

function handleEnterBlur(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter") {
    e.preventDefault();
    e.currentTarget.blur();
  }
}

export default function ProfilePanel() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [funcao, setFuncao] = useState<Funcao>("OUTROS");
  const [newEmail, setNewEmail] = useState("");

  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const nameAutosave = useFieldAutosave(async (value) => {
    const trimmed = value.trim();
    if (!trimmed) throw new Error("Nome não pode ficar vazio.");
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Falha ao salvar.");
    setProfile(data.user);
    notifyProfileUpdated();
  });

  const funcaoAutosave = useFieldAutosave(async (value) => {
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ funcao: value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Falha ao salvar.");
    setProfile(data.user);
    notifyProfileUpdated();
  });

  const emailAutosave = useFieldAutosave(async (value) => {
    const res = await fetch("/api/settings/email", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail: value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Falha ao salvar.");
    setProfile((prev) => (prev ? { ...prev, email: data.email } : prev));
  });

  useEffect(() => {
    fetch("/api/settings/profile")
      .then((res) => res.json())
      .then((data) => {
        if (!data.user) throw new Error();
        setProfile(data.user);
        setName(data.user.name);
        setFuncao(data.user.funcao);
        setNewEmail(data.user.email);
        nameAutosave.setBaseline(data.user.name);
        funcaoAutosave.setBaseline(data.user.funcao);
        emailAutosave.setBaseline(data.user.email);
      })
      .catch(() => setLoadError("Não foi possível carregar seu perfil."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError(null);
    setPendingImage(URL.createObjectURL(file));
  }

  async function handleCropConfirm(blob: Blob) {
    setPendingImage(null);
    setUploadingAvatar(true);
    setAvatarError(null);
    try {
      const formData = new FormData();
      formData.append("file", blob, "avatar.jpg");
      const res = await fetch("/api/settings/avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao enviar a imagem.");
      setProfile((prev) => (prev ? { ...prev, avatarUrl: data.avatarUrl } : prev));
      notifyProfileUpdated();
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Falha ao enviar a imagem.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSavePassword() {
    setSavingPassword(true);
    setPasswordMessage(null);
    setPasswordError(null);
    try {
      const res = await fetch("/api/settings/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Senha atualizada.");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSavingPassword(false);
    }
  }

  if (loadError) return <p className="text-sm text-luminous-error">{loadError}</p>;
  if (!profile) return <p className="text-sm text-luminous-on-surface-variant">Carregando perfil...</p>;

  return (
    <div className="space-y-6">
      {pendingImage && (
        <CropModal imageSrc={pendingImage} onCancel={() => setPendingImage(null)} onConfirm={handleCropConfirm} />
      )}

      <GlassCard className="flex items-center gap-5">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-white/10 bg-luminous-primary-container">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto vem do Supabase Storage, tamanho já otimizado no recorte
            <img src={profile.avatarUrl} alt={profile.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center font-mono text-lg">{getInitials(profile.name)}</div>
          )}
        </div>
        <div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
          <PillButton
            type="button"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
          >
            {uploadingAvatar ? "Enviando..." : "Trocar foto"}
          </PillButton>
          {avatarError && <p className="mt-2 text-xs text-luminous-error">{avatarError}</p>}
        </div>
      </GlassCard>

      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-sora text-lg font-semibold">Dados do perfil</h3>
          {/* TODO: só um ADMIN pode alterar o permissionLevel de outro usuário — isso vai
              acontecer numa tela de gestão de usuários que ainda não existe. Por enquanto
              esse campo é somente leitura pra todo mundo, inclusive pra si mesmo. */}
          <Badge variant={profile.permissionLevel === "ADMIN" ? "info" : "neutral"}>
            {profile.permissionLevel === "ADMIN" ? "Administrador" : "Usuário"}
          </Badge>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className={labelClass + " mb-0"} htmlFor="profile-name">Nome</label>
            <SaveIndicator status={nameAutosave.status} />
          </div>
          <input
            id="profile-name"
            className={inputClass}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              nameAutosave.onChange(e.target.value);
            }}
            onBlur={(e) => nameAutosave.flush(e.target.value)}
            onKeyDown={handleEnterBlur}
          />
          {nameAutosave.error && <p className="mt-1 text-xs text-luminous-error">{nameAutosave.error}</p>}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className={labelClass + " mb-0"} htmlFor="profile-funcao">Função</label>
            <SaveIndicator status={funcaoAutosave.status} />
          </div>
          <select
            id="profile-funcao"
            className={inputClass}
            value={funcao}
            onChange={(e) => {
              const value = e.target.value as Funcao;
              setFuncao(value);
              funcaoAutosave.flush(value);
            }}
          >
            {Object.entries(FUNCAO_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {funcaoAutosave.error && <p className="mt-1 text-xs text-luminous-error">{funcaoAutosave.error}</p>}
        </div>
      </GlassCard>

      <GlassCard className="space-y-4">
        <h3 className="font-sora text-lg font-semibold">Email</h3>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className={labelClass + " mb-0"} htmlFor="profile-email">Novo email</label>
            <SaveIndicator status={emailAutosave.status} />
          </div>
          <input
            id="profile-email"
            type="email"
            className={inputClass}
            value={newEmail}
            onChange={(e) => {
              setNewEmail(e.target.value);
              emailAutosave.onChange(e.target.value);
            }}
            onBlur={(e) => emailAutosave.flush(e.target.value)}
            onKeyDown={handleEnterBlur}
          />
          {emailAutosave.error && <p className="mt-1 text-xs text-luminous-error">{emailAutosave.error}</p>}
        </div>
      </GlassCard>

      <GlassCard className="space-y-4">
        <h3 className="font-sora text-lg font-semibold">Senha</h3>

        <div>
          <label className={labelClass} htmlFor="current-password">Senha atual</label>
          <input
            id="current-password"
            type="password"
            className={inputClass}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="new-password">Nova senha</label>
          <input
            id="new-password"
            type="password"
            className={inputClass}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="confirm-password">Confirmar nova senha</label>
          <input
            id="confirm-password"
            type="password"
            className={inputClass}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        {passwordError && <p className="text-sm text-luminous-error">{passwordError}</p>}
        {passwordMessage && <p className="text-sm text-emerald-300">{passwordMessage}</p>}

        <PillButton
          type="button"
          onClick={handleSavePassword}
          disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
        >
          {savingPassword ? "Salvando..." : "Salvar senha"}
        </PillButton>
      </GlassCard>
    </div>
  );
}
