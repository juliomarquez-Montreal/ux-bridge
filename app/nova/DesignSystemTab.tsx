"use client";

import { useState, type FormEvent } from "react";
import Badge from "@/components/Badge";
import GlassCard from "@/components/GlassCard";
import PillButton from "@/components/PillButton";
import { CloseIcon, LinkIcon, TrashIcon } from "@/components/icons";
import DesignSystemLinkModal from "./DesignSystemLinkModal";
import type { ApiContextNode, ApiDesignSystemSource, NovaUser } from "./types";

interface Props {
  user: NovaUser;
  sources: ApiDesignSystemSource[] | null;
  galaxies: ApiContextNode[];
  userGalaxyId: string | null;
  search: string;
  showCreateForm: boolean;
  onCreateFormClose: () => void;
  onChanged: () => Promise<void>;
}

function formatDate(iso: string | null): string {
  if (!iso) return "nunca sincronizado";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

// Aba "Design System" — catálogo global de fontes do Figma (Fase N5).
// Gerenciar o catálogo (criar/sincronizar/remover/vincular a Galáxias) é
// ADMIN-only; qualquer usuário logado pode ver as fontes e os componentes.
export default function DesignSystemTab({
  user,
  sources,
  galaxies,
  userGalaxyId,
  search,
  showCreateForm,
  onCreateFormClose,
  onChanged,
}: Props) {
  const isAdmin = user.permissionLevel === "ADMIN";

  const [name, setName] = useState("");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncMessages, setSyncMessages] = useState<Record<string, { text: string; isError: boolean }>>({});
  const [deleteTarget, setDeleteTarget] = useState<ApiDesignSystemSource | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [linkingSourceId, setLinkingSourceId] = useState<string | null>(null);

  const q = search.trim().toLowerCase();
  const filtered = (sources ?? []).filter((source) => !q || source.name.toLowerCase().includes(q));
  const linkingSource = sources?.find((source) => source.id === linkingSourceId) ?? null;

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !figmaUrl.trim() || creating) return;

    setCreating(true);
    setCreateError(null);
    setCreateMessage(null);
    try {
      const res = await fetch("/api/nova/design-system/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), figmaUrl: figmaUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao criar fonte.");

      setName("");
      setFigmaUrl("");
      onCreateFormClose();
      await onChanged();

      if (data.syncError) {
        setCreateMessage({
          text: `Fonte criada, mas a sincronização inicial falhou: ${data.syncError} Tente sincronizar de novo abaixo.`,
          isError: true,
        });
      } else if (data.sync?.warning) {
        setCreateMessage({ text: `Fonte criada. ${data.sync.warning}`, isError: true });
      } else if (data.sync) {
        setCreateMessage({
          text: `Fonte criada e sincronizada: ${data.sync.created} componente(s) importado(s).`,
          isError: false,
        });
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Falha ao criar fonte.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSync(sourceId: string) {
    setSyncingId(sourceId);
    setSyncMessages((prev) => {
      const next = { ...prev };
      delete next[sourceId];
      return next;
    });
    try {
      const res = await fetch(`/api/nova/design-system/sources/${sourceId}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao sincronizar.");
      const text = data.warning
        ? data.warning
        : `${data.created} criado(s), ${data.updated} atualizado(s)${
            data.missingFromLastSync > 0 ? ` — ${data.missingFromLastSync} não vieram nesta sincronização` : ""
          }.`;
      setSyncMessages((prev) => ({ ...prev, [sourceId]: { text, isError: Boolean(data.warning) } }));
      await onChanged();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Falha ao sincronizar.";
      setSyncMessages((prev) => ({ ...prev, [sourceId]: { text, isError: true } }));
    } finally {
      setSyncingId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/nova/design-system/sources/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível remover.");
      setDeleteTarget(null);
      await onChanged();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Não foi possível remover.");
    } finally {
      setDeleting(false);
    }
  }

  if (!sources) {
    return <p className="text-sm text-luminous-on-surface-variant">Carregando...</p>;
  }

  return (
    <div>
      {createMessage && (
        <p className={`mb-4 text-sm ${createMessage.isError ? "text-luminous-error" : "text-emerald-300"}`}>
          {createMessage.text}
        </p>
      )}

      {filtered.length === 0 ? (
        <GlassCard className="text-center text-sm text-luminous-on-surface-variant">
          {sources.length === 0
            ? isAdmin
              ? 'Nenhum Design System cadastrado ainda. Clique em "Novo Design System" acima.'
              : "Nenhum Design System cadastrado ainda."
            : "Nenhum resultado para essa busca."}
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {filtered.map((source) => {
            const message = syncMessages[source.id];
            return (
              <GlassCard key={source.id} className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-sora text-base font-semibold">{source.name}</h3>
                    <a
                      href={source.figmaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block truncate text-xs text-luminous-primary-fixed-dim underline underline-offset-2 hover:text-luminous-primary-fixed"
                    >
                      {source.figmaUrl}
                    </a>
                    <p className="mt-1 text-xs text-luminous-on-surface-variant">
                      {formatDate(source.lastSyncedAt)} · {source.components.length} componente(s)
                    </p>
                    {source.galaxyLinks.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {source.galaxyLinks.map((link) => (
                          <Badge key={link.galaxyId} variant="info">
                            {link.galaxyName}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-luminous-on-surface-variant/60">
                        Não vinculado a nenhuma Galáxia ainda.
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {isAdmin && (
                      <>
                        <PillButton
                          type="button"
                          variant="inactive"
                          className="!px-3 !py-1.5 !text-[10px]"
                          onClick={() => handleSync(source.id)}
                          disabled={syncingId === source.id}
                        >
                          {syncingId === source.id ? "Sincronizando..." : "Sincronizar"}
                        </PillButton>
                        <PillButton
                          type="button"
                          variant="inactive"
                          className="!px-3 !py-1.5 !text-[10px]"
                          onClick={() => setLinkingSourceId(source.id)}
                        >
                          Vincular a Galáxias
                        </PillButton>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(source);
                          }}
                          aria-label={`Remover ${source.name}`}
                          title="Remover"
                          className="grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-white/5 text-luminous-error hover:bg-luminous-error/10"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <PillButton
                      type="button"
                      variant="inactive"
                      className="!px-3 !py-1.5 !text-[10px]"
                      onClick={() => setExpandedId((prev) => (prev === source.id ? null : source.id))}
                    >
                      {expandedId === source.id ? "Ocultar componentes" : "Ver componentes"}
                    </PillButton>
                  </div>
                </div>

                {message && (
                  <p className={`text-xs ${message.isError ? "text-luminous-error" : "text-emerald-300"}`}>
                    {message.text}
                  </p>
                )}

                {expandedId === source.id &&
                  (source.components.length === 0 ? (
                    <p className="text-xs text-luminous-on-surface-variant/70">Nenhum componente sincronizado ainda.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                      {source.components.map((component) => (
                        <div
                          key={component.id}
                          className="overflow-hidden rounded-md border border-white/10 bg-black/20"
                          title={component.description || component.name}
                        >
                          <div className="flex aspect-square items-center justify-center bg-black/30">
                            {component.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element -- thumbnail vem de URL assinada do Figma
                              <img
                                src={component.thumbnailUrl}
                                alt={component.name}
                                className="h-full w-full object-contain"
                                loading="lazy"
                              />
                            ) : (
                              <span className="text-[9px] text-luminous-on-surface-variant">Sem preview</span>
                            )}
                          </div>
                          <p className="truncate px-1.5 py-1 text-[10px] text-luminous-on-surface">
                            {component.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  ))}
              </GlassCard>
            );
          })}
        </div>
      )}

      {showCreateForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onCreateFormClose}>
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-xl border border-white/10 bg-luminous-surface-container p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-sora text-lg font-semibold">Novo Design System</h2>
              <button
                type="button"
                onClick={onCreateFormClose}
                aria-label="Fechar"
                className="text-luminous-on-surface-variant hover:text-luminous-on-surface"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">
                  Nome amigável
                </label>
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ex: Design System - Concessões"
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-luminous-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">
                  Link do arquivo do Figma
                </label>
                <input
                  type="text"
                  value={figmaUrl}
                  onChange={(event) => setFigmaUrl(event.target.value)}
                  placeholder="https://www.figma.com/design/..."
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-luminous-primary"
                />
              </div>

              {createError && <p className="text-sm text-luminous-error">{createError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <PillButton type="button" variant="inactive" onClick={onCreateFormClose}>
                  Cancelar
                </PillButton>
                <PillButton type="submit" variant="primary" disabled={creating || !name.trim() || !figmaUrl.trim()}>
                  {creating ? "Criando e sincronizando..." : "Criar"}
                </PillButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-luminous-surface-container p-6 shadow-2xl">
            <h2 className="mb-4 font-sora text-lg font-semibold">Remover Design System</h2>
            <p className="text-sm text-luminous-on-surface-variant">
              Tem certeza que deseja remover{" "}
              <span className="font-medium text-luminous-on-surface">{deleteTarget.name}</span>? Os componentes
              sincronizados e os vínculos com Galáxias vão junto. Esta ação não pode ser desfeita.
            </p>
            {deleteError && <p className="mt-3 text-sm text-luminous-error">{deleteError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <PillButton type="button" variant="inactive" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </PillButton>
              <PillButton
                type="button"
                variant="primary"
                className="!bg-luminous-error !text-luminous-on-error hover:!bg-luminous-error/90"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? "Removendo..." : "Remover"}
              </PillButton>
            </div>
          </div>
        </div>
      )}

      {linkingSource && (
        <DesignSystemLinkModal
          title={`Vincular "${linkingSource.name}" a Galáxias`}
          emptyMessage="Nenhuma Galáxia cadastrada ainda."
          items={galaxies.map((galaxy) => ({
            id: galaxy.id,
            label: galaxy.name,
            linked: linkingSource.galaxyLinks.some((link) => link.galaxyId === galaxy.id),
            disabled: !isAdmin && galaxy.id !== userGalaxyId,
          }))}
          onToggle={async (galaxyId, nextLinked) => {
            const res = nextLinked
              ? await fetch(`/api/nova/design-system/sources/${linkingSource.id}/galaxies`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ galaxyId }),
                })
              : await fetch(`/api/nova/design-system/sources/${linkingSource.id}/galaxies/${galaxyId}`, {
                  method: "DELETE",
                });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error ?? "Falha ao salvar.");
            await onChanged();
          }}
          onClose={() => setLinkingSourceId(null)}
        />
      )}
    </div>
  );
}
