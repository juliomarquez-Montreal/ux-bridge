"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import PillButton from "@/components/PillButton";
import { TrashIcon } from "@/components/icons";
import type { ApiContextNode, ApiPlanetExample, ExampleKind } from "./types";

const KIND_ORDER: ExampleKind[] = ["RAW_TRANSCRIPT", "FINAL_BDD_PBI", "WIREFRAME_REFERENCE"];

const KIND_CONFIG: Record<ExampleKind, { label: string; accept: string; allowText: boolean; hint: string }> = {
  RAW_TRANSCRIPT: {
    label: "Transcrição bruta",
    accept: ".txt,.docx",
    allowText: true,
    hint: "Arquivo .txt ou .docx, ou cole o texto direto.",
  },
  FINAL_BDD_PBI: {
    label: "BDD/PBI final",
    accept: ".txt,.docx",
    allowText: true,
    hint: "Arquivo .txt ou .docx, ou cole o texto direto.",
  },
  WIREFRAME_REFERENCE: {
    label: "Wireframe de referência",
    accept: ".pdf,.png,.jpg,.jpeg",
    allowText: false,
    hint: "PDF ou imagem (.png, .jpg).",
  },
};

function fileNameFromUrl(fileUrl: string): string {
  const last = fileUrl.split("/").pop() ?? "arquivo";
  const decoded = decodeURIComponent(last);
  // Path é "<timestamp>-<nome-original>" — corta o prefixo de timestamp pra exibir só o nome.
  return decoded.replace(/^\d+-/, "");
}

interface PanelProps {
  node: ApiContextNode;
  canManage: boolean;
}

// Exemplos de treino de um Planeta (Fase N4): 3 categorias fixas, cada uma
// aceitando múltiplos anexos (arquivo ou texto colado, dependendo da
// categoria). Só renderizado quando o usuário expande um nó PLANETA.
export default function PlanetExamplesPanel({ node, canManage }: PanelProps) {
  const [examples, setExamples] = useState<ApiPlanetExample[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/nova/nodes/${node.id}/examples`);
    if (!res.ok) throw new Error("Falha ao carregar exemplos.");
    const data = (await res.json()) as { examples: ApiPlanetExample[] };
    setExamples(data.examples);
    setLoadError(null);
  }, [node.id]);

  useEffect(() => {
    refresh().catch(() => setLoadError("Não foi possível carregar os exemplos de treino."));
  }, [refresh]);

  if (loadError) return <p className="py-2 text-xs text-luminous-error">{loadError}</p>;
  if (!examples) return <p className="py-2 text-xs text-luminous-on-surface-variant">Carregando exemplos...</p>;

  return (
    <div className="space-y-4 py-2">
      <h4 className="text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">
        Exemplos de treino
      </h4>
      {KIND_ORDER.map((kind) => (
        <ExampleKindSection
          key={kind}
          kind={kind}
          nodeId={node.id}
          examples={examples.filter((example) => example.kind === kind)}
          canManage={canManage}
          onChanged={refresh}
        />
      ))}
    </div>
  );
}

interface SectionProps {
  kind: ExampleKind;
  nodeId: string;
  examples: ApiPlanetExample[];
  canManage: boolean;
  onChanged: () => Promise<void>;
}

function ExampleKindSection({ kind, nodeId, examples, canManage, onChanged }: SectionProps) {
  const config = KIND_CONFIG[kind];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTextArea, setShowTextArea] = useState(false);
  const [textDraft, setTextDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function upload(formData: FormData) {
    setUploading(true);
    setError(null);
    try {
      const res = await fetch(`/api/nova/nodes/${nodeId}/examples`, { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao enviar.");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar.");
    } finally {
      setUploading(false);
    }
  }

  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const formData = new FormData();
    formData.append("kind", kind);
    formData.append("file", file);
    upload(formData);
  }

  async function handleSubmitText() {
    const trimmed = textDraft.trim();
    if (!trimmed) return;
    const formData = new FormData();
    formData.append("kind", kind);
    formData.append("textContent", trimmed);
    await upload(formData);
    setTextDraft("");
    setShowTextArea(false);
  }

  async function handleDelete(exampleId: string) {
    setDeletingId(exampleId);
    setError(null);
    try {
      const res = await fetch(`/api/nova/examples/${exampleId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao excluir.");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-luminous-on-surface">{config.label}</p>
        {canManage && (
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={config.accept}
              className="hidden"
              onChange={handleFileSelected}
            />
            <PillButton
              type="button"
              variant="inactive"
              className="!px-3 !py-1.5 !text-[10px]"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Enviando..." : "Anexar arquivo"}
            </PillButton>
            {config.allowText && (
              <PillButton
                type="button"
                variant="inactive"
                className="!px-3 !py-1.5 !text-[10px]"
                onClick={() => setShowTextArea((v) => !v)}
                disabled={uploading}
              >
                Colar texto
              </PillButton>
            )}
          </div>
        )}
      </div>

      <p className="mt-0.5 text-[11px] text-luminous-on-surface-variant/70">{config.hint}</p>

      {showTextArea && (
        <div className="mt-2 space-y-2">
          <textarea
            rows={4}
            value={textDraft}
            onChange={(event) => setTextDraft(event.target.value)}
            placeholder="Cole o texto aqui..."
            className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-luminous-primary"
          />
          <div className="flex justify-end gap-2">
            <PillButton
              type="button"
              variant="inactive"
              onClick={() => {
                setShowTextArea(false);
                setTextDraft("");
              }}
            >
              Cancelar
            </PillButton>
            <PillButton type="button" variant="primary" onClick={handleSubmitText} disabled={uploading || !textDraft.trim()}>
              {uploading ? "Enviando..." : "Enviar"}
            </PillButton>
          </div>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-luminous-error">{error}</p>}

      {examples.length === 0 ? (
        <p className="mt-2 text-xs text-luminous-on-surface-variant/60">Nenhum exemplo anexado.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {examples.map((example) => (
            <li
              key={example.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                {example.fileUrl ? (
                  <a
                    href={example.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-xs text-luminous-primary-fixed-dim underline underline-offset-2 hover:text-luminous-primary-fixed"
                  >
                    {fileNameFromUrl(example.fileUrl)}
                  </a>
                ) : (
                  <p className="truncate text-xs text-luminous-on-surface-variant" title={example.textContent ?? ""}>
                    {example.textContent}
                  </p>
                )}
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => handleDelete(example.id)}
                  aria-label="Excluir exemplo"
                  disabled={deletingId === example.id}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-luminous-error hover:bg-luminous-error/10 disabled:opacity-40"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
