"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import GlassCard from "@/components/GlassCard";
import PillButton from "@/components/PillButton";
import { DocumentIcon, TrashIcon, UploadIcon } from "@/components/icons";
import type { ApiContextNode, ApiPbiStyleSource, NovaUser } from "./types";

interface Props {
  user: NovaUser;
  galaxies: ApiContextNode[];
  userGalaxyIds: Set<string>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function previewOf(text: string): string {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  return lines.slice(0, 3).join("\n");
}

// Seção "PBIs de exemplo" — parte da aba "Ajustes Design System e PBIs" da
// NOVA (Fase N8). Independente da seção de Design System do Figma acima
// (próprio fetch, próprio estado): aqui o usuário escolhe uma Galáxia e
// envia PBIs já aprovados (PDF/DOCX/MD) pra o sistema aprender SÓ o padrão
// de escrita do Acceptance Criteria em Gherkin daquela equipe — ver
// PbiStyleSource no schema e buildContextPackage.ts/generate.ts no backend.
export default function PbiStyleSourcesSection({ user, galaxies, userGalaxyIds }: Props) {
  const isAdmin = user.permissionLevel === "ADMIN";
  const manageableGalaxies = isAdmin ? galaxies : galaxies.filter((g) => userGalaxyIds.has(g.id));

  const [selectedGalaxyId, setSelectedGalaxyId] = useState<string>("");
  const [sources, setSources] = useState<ApiPbiStyleSource[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessages, setUploadMessages] = useState<Array<{ fileName: string; text: string; isError: boolean }>>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiPbiStyleSource | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedGalaxyId && manageableGalaxies.length > 0) {
      setSelectedGalaxyId(manageableGalaxies[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só define o valor inicial uma vez, quando as Galáxias chegam.
  }, [manageableGalaxies.length]);

  const refreshSources = useCallback(async (galaxyId: string) => {
    if (!galaxyId) {
      setSources([]);
      return;
    }
    try {
      const res = await fetch(`/api/nova/pbi-style-sources?galaxyId=${galaxyId}`);
      if (!res.ok) throw new Error("Falha ao carregar PBIs de exemplo.");
      const data = (await res.json()) as { sources: ApiPbiStyleSource[] };
      setSources(data.sources);
      setLoadError(null);
    } catch {
      setSources([]);
      setLoadError("Não foi possível carregar os PBIs de exemplo desta Galáxia.");
    }
  }, []);

  useEffect(() => {
    refreshSources(selectedGalaxyId).catch(() => {});
  }, [selectedGalaxyId, refreshSources]);

  async function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0 || !selectedGalaxyId) return;

    setUploading(true);
    setUploadMessages([]);
    try {
      const formData = new FormData();
      formData.set("galaxyId", selectedGalaxyId);
      for (const file of files) formData.append("files", file);

      const res = await fetch("/api/nova/pbi-style-sources", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao enviar os arquivos.");

      const results = (data.results ?? []) as Array<{ fileName: string; error?: string }>;
      setUploadMessages(
        results.map((result) => ({
          fileName: result.fileName,
          text: result.error ?? "Enviado e processado com sucesso.",
          isError: Boolean(result.error),
        }))
      );
      await refreshSources(selectedGalaxyId);
    } catch (err) {
      setUploadMessages([{ fileName: "", text: err instanceof Error ? err.message : "Falha ao enviar os arquivos.", isError: true }]);
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/nova/pbi-style-sources/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível remover.");
      setDeleteTarget(null);
      await refreshSources(selectedGalaxyId);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Não foi possível remover.");
    } finally {
      setDeleting(false);
    }
  }

  const canManageSelected = isAdmin || userGalaxyIds.has(selectedGalaxyId);

  return (
    <div className="mt-10 border-t border-[#252231] pt-8">
      <h2 className="font-sora text-lg font-semibold text-white">PBIs de exemplo</h2>
      <p className="mt-1 text-sm text-luminous-on-surface-variant">
        Envie PBIs já aprovados para o sistema aprender o padrão de escrita do Acceptance Criteria desta Galáxia,
        independente do tipo de tela.
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px]">
          <label
            htmlFor="pbi-style-galaxy"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant"
          >
            Galáxia
          </label>
          {galaxies.length === 0 ? (
            <p className="text-xs text-luminous-on-surface-variant">Nenhuma Galáxia cadastrada ainda.</p>
          ) : (
            <select
              id="pbi-style-galaxy"
              value={selectedGalaxyId}
              onChange={(event) => setSelectedGalaxyId(event.target.value)}
              style={{ colorScheme: "dark" }}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-luminous-primary"
            >
              <option value="" disabled className="bg-luminous-surface-container text-luminous-on-surface-variant">
                Selecione uma Galáxia...
              </option>
              {galaxies.map((galaxy) => (
                <option key={galaxy.id} value={galaxy.id} className="bg-luminous-surface-container text-luminous-on-surface">
                  {galaxy.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <PillButton
          type="button"
          variant="primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={!selectedGalaxyId || !canManageSelected || uploading}
          className="!normal-case"
        >
          <span className="flex items-center gap-2">
            <UploadIcon className="h-3.5 w-3.5" />
            {uploading ? "Enviando..." : "Enviar PBI de exemplo"}
          </span>
        </PillButton>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.md"
          onChange={handleFilesSelected}
          className="hidden"
        />
      </div>

      {selectedGalaxyId && !canManageSelected && (
        <p className="mt-3 text-xs text-luminous-on-surface-variant/70">
          Você só pode enviar PBIs de exemplo em Galáxias às quais tem acesso.
        </p>
      )}

      {uploadMessages.length > 0 && (
        <div className="mt-3 space-y-1">
          {uploadMessages.map((message, index) => (
            <p key={index} className={`text-xs ${message.isError ? "text-luminous-error" : "text-emerald-300"}`}>
              {message.fileName ? `${message.fileName}: ` : ""}
              {message.text}
            </p>
          ))}
        </div>
      )}

      {loadError && <p className="mt-3 text-sm text-luminous-error">{loadError}</p>}

      <div className="mt-5 space-y-3">
        {sources === null ? (
          <p className="text-sm text-luminous-on-surface-variant">Carregando...</p>
        ) : sources.length === 0 ? (
          <GlassCard className="text-center text-sm text-luminous-on-surface-variant">
            {selectedGalaxyId ? "Nenhum PBI de exemplo enviado ainda para esta Galáxia." : "Selecione uma Galáxia para ver os PBIs de exemplo."}
          </GlassCard>
        ) : (
          sources.map((source) => (
            <GlassCard key={source.id} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <DocumentIcon className="mt-0.5 h-5 w-5 shrink-0 text-luminous-on-surface-variant" />
                  <div className="min-w-0">
                    <h3 className="truncate font-sora text-sm font-semibold">{source.fileName}</h3>
                    <p className="mt-0.5 text-xs text-luminous-on-surface-variant">Enviado em {formatDate(source.createdAt)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <PillButton
                    type="button"
                    variant="inactive"
                    className="!px-3 !py-1.5 !text-[10px]"
                    onClick={() => setExpandedId((prev) => (prev === source.id ? null : source.id))}
                  >
                    {expandedId === source.id ? "Ocultar" : "Expandir"}
                  </PillButton>
                  {canManageSelected && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(source);
                      }}
                      aria-label={`Remover ${source.fileName}`}
                      title="Remover"
                      className="grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-white/5 text-luminous-error hover:bg-luminous-error/10"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <pre className="whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-luminous-on-surface-variant">
                {expandedId === source.id ? source.extractedAcceptanceCriteria : previewOf(source.extractedAcceptanceCriteria)}
              </pre>
            </GlassCard>
          ))
        )}
      </div>

      {deleteTarget && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-luminous-surface-container p-6 shadow-2xl">
            <h2 className="mb-4 font-sora text-lg font-semibold">Remover PBI de exemplo</h2>
            <p className="text-sm text-luminous-on-surface-variant">
              Tem certeza que deseja remover <span className="font-medium text-luminous-on-surface">{deleteTarget.fileName}</span>?
              Esta ação não pode ser desfeita.
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
    </div>
  );
}
