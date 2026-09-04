"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import PillButton from "@/components/PillButton";
import { PlusIcon, TrashIcon } from "@/components/icons";
import type { ApiDesignSystemSource, DesignSystemSyncResult } from "./types";

interface Props {
  galaxyId: string;
  canManage: boolean;
}

function formatDate(iso: string | null): string {
  if (!iso) return "nunca sincronizado";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

// Design System (Fase N5): fontes do Figma vinculadas a ESTA Galáxia
// especificamente — cada Galáxia enxerga só as próprias fontes/componentes,
// nunca uma lista global misturada. Renderizado quando uma linha GALAXIA é
// expandida (ver app/nova/NodeRow.tsx).
export default function GalaxyDesignSystemSection({ galaxyId, canManage }: Props) {
  const [sources, setSources] = useState<ApiDesignSystemSource[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncMessages, setSyncMessages] = useState<Record<string, { text: string; isError: boolean }>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/nova/design-system/sources?galaxyId=${galaxyId}`);
    if (!res.ok) throw new Error("Falha ao carregar Design System.");
    const data = (await res.json()) as { sources: ApiDesignSystemSource[] };
    setSources(data.sources);
    setLoadError(null);
  }, [galaxyId]);

  useEffect(() => {
    refresh().catch(() => setLoadError("Não foi possível carregar o Design System desta Galáxia."));
  }, [refresh]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !figmaUrl.trim() || creating) return;

    setCreating(true);
    setFormError(null);
    try {
      const res = await fetch("/api/nova/design-system/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), figmaUrl: figmaUrl.trim(), galaxyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao criar fonte.");
      setName("");
      setFigmaUrl("");
      setShowForm(false);
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Falha ao criar fonte.");
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
      const data: DesignSystemSyncResult & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao sincronizar.");
      const text = data.warning
        ? data.warning
        : `${data.created} criado(s), ${data.updated} atualizado(s)${
            data.missingFromLastSync > 0 ? ` — ${data.missingFromLastSync} não vieram nesta sincronização` : ""
          }.`;
      setSyncMessages((prev) => ({ ...prev, [sourceId]: { text, isError: Boolean(data.warning) } }));
      await refresh();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Falha ao sincronizar.";
      setSyncMessages((prev) => ({ ...prev, [sourceId]: { text, isError: true } }));
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDelete(sourceId: string) {
    setDeletingId(sourceId);
    try {
      const res = await fetch(`/api/nova/design-system/sources/${sourceId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao remover.");
      await refresh();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Falha ao remover fonte.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3 py-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">
          Design System
        </h4>
        {canManage && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[.05em] hover:bg-white/10"
          >
            <PlusIcon className="h-3 w-3" />
            Novo Design System
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome amigável (ex: Design System - Concessões)"
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-luminous-primary"
          />
          <input
            type="text"
            value={figmaUrl}
            onChange={(event) => setFigmaUrl(event.target.value)}
            placeholder="Link do arquivo do Figma"
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-luminous-primary"
          />
          {formError && <p className="text-xs text-luminous-error">{formError}</p>}
          <div className="flex justify-end gap-2">
            <PillButton
              type="button"
              variant="inactive"
              onClick={() => {
                setShowForm(false);
                setFormError(null);
              }}
            >
              Cancelar
            </PillButton>
            <PillButton type="submit" variant="primary" disabled={creating || !name.trim() || !figmaUrl.trim()}>
              {creating ? "Salvando..." : "Salvar"}
            </PillButton>
          </div>
        </form>
      )}

      {loadError && <p className="text-xs text-luminous-error">{loadError}</p>}

      {!sources ? (
        <p className="text-xs text-luminous-on-surface-variant">Carregando...</p>
      ) : sources.length === 0 ? (
        <p className="text-xs text-luminous-on-surface-variant/70">
          Nenhuma fonte de Design System vinculada a esta Galáxia ainda.
        </p>
      ) : (
        <div className="space-y-3">
          {sources.map((source) => {
            const message = syncMessages[source.id];
            return (
              <div key={source.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-luminous-on-surface">{source.name}</p>
                    <p className="text-[11px] text-luminous-on-surface-variant/70">
                      {formatDate(source.lastSyncedAt)} · {source.components.length} componente(s)
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <PillButton
                        type="button"
                        variant="inactive"
                        className="!px-3 !py-1.5 !text-[10px]"
                        onClick={() => handleSync(source.id)}
                        disabled={syncingId === source.id}
                      >
                        {syncingId === source.id ? "Sincronizando..." : "Sincronizar"}
                      </PillButton>
                      <button
                        type="button"
                        onClick={() => handleDelete(source.id)}
                        disabled={deletingId === source.id}
                        aria-label={`Remover ${source.name}`}
                        title="Remover"
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/10 bg-white/5 text-luminous-error hover:bg-luminous-error/10 disabled:opacity-40"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {message && (
                  <p className={`mt-2 text-xs ${message.isError ? "text-luminous-error" : "text-emerald-300"}`}>
                    {message.text}
                  </p>
                )}

                {source.components.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
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
                        <p className="truncate px-1.5 py-1 text-[10px] text-luminous-on-surface">{component.name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
