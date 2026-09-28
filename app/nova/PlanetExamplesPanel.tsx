"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type RefObject } from "react";
import PillButton from "@/components/PillButton";
import { TrashIcon } from "@/components/icons";
import CreatableCombobox from "./CreatableCombobox";
import type { ApiContextNode, ApiPlanetExample } from "./types";

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

// Exemplos de treino de um Planeta: 3 categorias fixas. RAW_TRANSCRIPT é um
// anexo simples (arquivo ou texto); FINAL_BDD_PBI é um PAR inicial/final
// (cada lado independentemente opcional); WIREFRAME_REFERENCE é um arquivo +
// um tipo livre (combobox criável). Só renderizado quando o usuário expande
// um nó PLANETA.
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

  async function handleDelete(exampleId: string) {
    const res = await fetch(`/api/nova/examples/${exampleId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Falha ao excluir.");
    await refresh();
  }

  if (loadError) return <p className="py-2 text-xs text-luminous-error">{loadError}</p>;
  if (!examples) return <p className="py-2 text-xs text-luminous-on-surface-variant">Carregando exemplos...</p>;

  return (
    <div className="space-y-4 py-2">
      <h4 className="text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">
        Exemplos de treino
      </h4>

      <RawTranscriptSection
        nodeId={node.id}
        examples={examples.filter((e) => e.kind === "RAW_TRANSCRIPT")}
        canManage={canManage}
        onChanged={refresh}
        onDelete={handleDelete}
      />
      <BddPbiPairSection
        nodeId={node.id}
        examples={examples.filter((e) => e.kind === "FINAL_BDD_PBI")}
        canManage={canManage}
        onChanged={refresh}
        onDelete={handleDelete}
      />
      <WireframeReferenceSection
        nodeId={node.id}
        examples={examples.filter((e) => e.kind === "WIREFRAME_REFERENCE")}
        canManage={canManage}
        onChanged={refresh}
        onDelete={handleDelete}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transcrição bruta — arquivo OU texto, simples (comportamento original).
// ---------------------------------------------------------------------------

interface SimpleSectionProps {
  nodeId: string;
  examples: ApiPlanetExample[];
  canManage: boolean;
  onChanged: () => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function RawTranscriptSection({ nodeId, examples, canManage, onChanged, onDelete }: SimpleSectionProps) {
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
    formData.append("kind", "RAW_TRANSCRIPT");
    formData.append("file", file);
    upload(formData);
  }

  async function handleSubmitText() {
    const trimmed = textDraft.trim();
    if (!trimmed) return;
    const formData = new FormData();
    formData.append("kind", "RAW_TRANSCRIPT");
    formData.append("textContent", trimmed);
    await upload(formData);
    setTextDraft("");
    setShowTextArea(false);
  }

  async function handleDeleteClick(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      await onDelete(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-luminous-on-surface">Arquivo de texto</p>
        {canManage && (
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".txt,.docx" className="hidden" onChange={handleFileSelected} />
            <PillButton
              type="button"
              variant="inactive"
              className="!px-3 !py-1.5 !text-[10px]"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Enviando..." : "Anexar arquivo"}
            </PillButton>
            <PillButton
              type="button"
              variant="inactive"
              className="!px-3 !py-1.5 !text-[10px]"
              onClick={() => setShowTextArea((v) => !v)}
              disabled={uploading}
            >
              Colar texto
            </PillButton>
          </div>
        )}
      </div>

      <p className="mt-0.5 text-[11px] text-luminous-on-surface-variant/70">
        Arquivo .txt ou .docx, ou cole o texto direto — pode ser uma transcrição, anotações, rascunho ou qualquer material de texto bruto.
      </p>

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
                  onClick={() => handleDeleteClick(example.id)}
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

// ---------------------------------------------------------------------------
// BDD/PBI final — par inicial/final, cada lado independentemente opcional.
// ---------------------------------------------------------------------------

type SideMode = "none" | "file" | "text";

function BddPbiPairSection({ nodeId, examples, canManage, onChanged, onDelete }: SimpleSectionProps) {
  const initialFileRef = useRef<HTMLInputElement>(null);
  const finalFileRef = useRef<HTMLInputElement>(null);

  const [initialMode, setInitialMode] = useState<SideMode>("none");
  const [initialFile, setInitialFile] = useState<File | null>(null);
  const [initialText, setInitialText] = useState("");

  const [finalMode, setFinalMode] = useState<SideMode>("none");
  const [finalFile, setFinalFile] = useState<File | null>(null);
  const [finalText, setFinalText] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function resetForm() {
    setInitialMode("none");
    setInitialFile(null);
    setInitialText("");
    setFinalMode("none");
    setFinalFile(null);
    setFinalText("");
  }

  const hasInitial = (initialMode === "file" && initialFile) || (initialMode === "text" && initialText.trim());
  const hasFinal = (finalMode === "file" && finalFile) || (finalMode === "text" && finalText.trim());
  const canSubmit = Boolean(hasInitial || hasFinal);

  async function handleSubmit() {
    if (!canSubmit || saving) return;
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("kind", "FINAL_BDD_PBI");
      if (initialMode === "file" && initialFile) formData.append("initialFile", initialFile);
      if (initialMode === "text" && initialText.trim()) formData.append("initialTextContent", initialText.trim());
      if (finalMode === "file" && finalFile) formData.append("finalFile", finalFile);
      if (finalMode === "text" && finalText.trim()) formData.append("finalTextContent", finalText.trim());

      const res = await fetch(`/api/nova/nodes/${nodeId}/examples`, { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao enviar.");
      resetForm();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteClick(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      await onDelete(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <p className="text-sm font-medium text-luminous-on-surface">BDD/PBI final</p>
      <p className="mt-0.5 text-[11px] text-luminous-on-surface-variant/70">
        Versão inicial e final, cada uma opcional — ajuda o sistema a aprender a transformação.
      </p>

      {canManage && (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <PairSideForm
            label="Versão inicial (opcional)"
            mode={initialMode}
            file={initialFile}
            text={initialText}
            onModeChange={setInitialMode}
            onFileChange={setInitialFile}
            onTextChange={setInitialText}
            fileInputRef={initialFileRef}
            disabled={saving}
          />
          <PairSideForm
            label="Versão final (opcional)"
            mode={finalMode}
            file={finalFile}
            text={finalText}
            onModeChange={setFinalMode}
            onFileChange={setFinalFile}
            onTextChange={setFinalText}
            fileInputRef={finalFileRef}
            disabled={saving}
          />
        </div>
      )}

      {canManage && (
        <div className="mt-2 flex justify-end">
          <PillButton type="button" variant="primary" onClick={handleSubmit} disabled={!canSubmit || saving}>
            {saving ? "Salvando..." : "Adicionar exemplo"}
          </PillButton>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-luminous-error">{error}</p>}

      {examples.length === 0 ? (
        <p className="mt-2 text-xs text-luminous-on-surface-variant/60">Nenhum exemplo anexado.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {examples.map((example) => (
            <li key={example.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <PairSideSummary label="Inicial" fileUrl={example.initialFileUrl} text={example.initialTextContent} />
                  <PairSideSummary label="Final" fileUrl={example.finalFileUrl} text={example.finalTextContent} />
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(example.id)}
                    aria-label="Excluir exemplo"
                    disabled={deletingId === example.id}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-luminous-error hover:bg-luminous-error/10 disabled:opacity-40"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PairSideSummary({ label, fileUrl, text }: { label: string; fileUrl: string | null; text: string | null }) {
  return (
    <p className="truncate text-xs text-luminous-on-surface-variant">
      <span className="font-medium text-luminous-on-surface">{label}:</span>{" "}
      {fileUrl ? (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-luminous-primary-fixed-dim underline underline-offset-2 hover:text-luminous-primary-fixed"
        >
          {fileNameFromUrl(fileUrl)}
        </a>
      ) : text ? (
        <span title={text}>{text}</span>
      ) : (
        <span className="text-luminous-on-surface-variant/50">não informado</span>
      )}
    </p>
  );
}

interface PairSideFormProps {
  label: string;
  mode: SideMode;
  file: File | null;
  text: string;
  onModeChange: (mode: SideMode) => void;
  onFileChange: (file: File | null) => void;
  onTextChange: (text: string) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  disabled: boolean;
}

function PairSideForm({
  label,
  mode,
  file,
  text,
  onModeChange,
  onFileChange,
  onTextChange,
  fileInputRef,
  disabled,
}: PairSideFormProps) {
  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    onFileChange(selected);
    onModeChange("file");
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="mb-2 text-xs font-medium text-luminous-on-surface">{label}</p>

      {mode === "file" && file ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5">
          <span className="truncate text-xs text-luminous-on-surface-variant">{file.name}</span>
          <button
            type="button"
            onClick={() => {
              onFileChange(null);
              onModeChange("none");
            }}
            aria-label="Remover arquivo"
            className="shrink-0 text-luminous-error hover:underline"
          >
            <TrashIcon className="h-3 w-3" />
          </button>
        </div>
      ) : mode === "text" ? (
        <div className="space-y-1.5">
          <textarea
            rows={3}
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder="Cole o texto aqui..."
            className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none focus:border-luminous-primary"
          />
          <button
            type="button"
            onClick={() => {
              onTextChange("");
              onModeChange("none");
            }}
            className="text-[11px] text-luminous-on-surface-variant hover:underline"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".txt,.docx" className="hidden" onChange={handleFileSelected} />
          <PillButton
            type="button"
            variant="inactive"
            className="!px-2.5 !py-1 !text-[10px]"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            Anexar arquivo
          </PillButton>
          <PillButton
            type="button"
            variant="inactive"
            className="!px-2.5 !py-1 !text-[10px]"
            onClick={() => onModeChange("text")}
            disabled={disabled}
          >
            Colar texto
          </PillButton>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wireframe de referência — arquivo obrigatório + tipo livre (combobox).
// ---------------------------------------------------------------------------

function WireframeReferenceSection({ nodeId, examples, canManage, onChanged, onDelete }: SimpleSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [referenceType, setReferenceType] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/nova/examples/reference-types")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { referenceTypes: string[] }) => setSuggestions(data.referenceTypes))
      .catch(() => {});
  }, []);

  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPendingFile(file);
  }

  async function handleSubmit() {
    if (!pendingFile || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("kind", "WIREFRAME_REFERENCE");
      formData.append("file", pendingFile);
      if (referenceType.trim()) formData.append("referenceType", referenceType.trim());

      const res = await fetch(`/api/nova/nodes/${nodeId}/examples`, { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao enviar.");

      if (referenceType.trim() && !suggestions.includes(referenceType.trim())) {
        setSuggestions((prev) => [...prev, referenceType.trim()].sort((a, b) => a.localeCompare(b, "pt-BR")));
      }
      setPendingFile(null);
      setReferenceType("");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteClick(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      await onDelete(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <p className="text-sm font-medium text-luminous-on-surface">Wireframe de referência</p>
      <p className="mt-0.5 text-[11px] text-luminous-on-surface-variant/70">PDF ou imagem (.png, .jpg).</p>

      {canManage && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
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
              {pendingFile ? pendingFile.name : "Escolher arquivo"}
            </PillButton>
            <div className="w-full max-w-[220px] sm:w-56">
              <CreatableCombobox
                value={referenceType}
                onChange={setReferenceType}
                suggestions={suggestions}
                placeholder="Tipo (opcional)"
                disabled={uploading}
              />
            </div>
            {pendingFile && (
              <PillButton type="button" variant="primary" onClick={handleSubmit} disabled={uploading}>
                {uploading ? "Enviando..." : "Enviar"}
              </PillButton>
            )}
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
                {example.fileUrl && (
                  <a
                    href={example.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-xs text-luminous-primary-fixed-dim underline underline-offset-2 hover:text-luminous-primary-fixed"
                  >
                    {fileNameFromUrl(example.fileUrl)}
                  </a>
                )}
                {example.referenceType && (
                  <span className="mt-1 inline-block rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-luminous-on-surface-variant">
                    {example.referenceType}
                  </span>
                )}
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => handleDeleteClick(example.id)}
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
