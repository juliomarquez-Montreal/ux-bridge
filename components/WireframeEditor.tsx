"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ApiBridge, ApiUserRef, WireframeBlock } from "@/app/bridges/types";
import Avatar from "@/components/Avatar";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  CloseIcon,
  CloudIcon,
  CommentToolIcon,
  ComponentsToolIcon,
  EllipseToolIcon,
  FrameToolIcon,
  GridIcon,
  LayersTabIcon,
  MaximizeIcon,
  MinusIcon,
  PenToolIcon,
  PlusIcon,
  PropertiesTabIcon,
  RedoIcon,
  SelectToolIcon,
  TextToolIcon,
  UndoIcon,
} from "@/components/icons";

// Editor visual completo do Wireframe (Wireframe-1a) — substitui a etapa de
// Sketch. Reproduz fielmente o mockup em _design-assets/ (chrome/cores/
// espaçamentos extraídos ao vivo do bundle renderizado, já que o arquivo usa
// um framework interno de mockup que não existe neste projeto). Só a
// ferramenta "Selecionar" tem função real nesta fase — as outras 6
// ferramentas ficam visuais, sem ação (Wireframe-1b/1c).

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const MIN_BLOCK_SIZE = 24;
const AUTOSAVE_DEBOUNCE_MS = 900;

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";
type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

function blocksEqual(a: WireframeBlock[], b: WireframeBlock[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((block, index) => {
    const other = b[index];
    return (
      block.id === other.id &&
      block.label === other.label &&
      block.x === other.x &&
      block.y === other.y &&
      block.width === other.width &&
      block.height === other.height
    );
  });
}

export default function WireframeEditor({ bridge, onUpdate }: { bridge: ApiBridge; onUpdate: (bridge: ApiBridge) => void }) {
  const router = useRouter();
  const frameWidth = bridge.wireframeData?.frameWidth ?? 1440;
  const frameHeight = bridge.wireframeData?.frameHeight ?? 1024;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- só recalcula quando o Bridge muda de verdade (id), não a cada update local de wireframeData vindo do próprio autosave.
  const initialBlocks = useMemo(() => bridge.wireframeData?.blocks ?? [], [bridge.id]);

  const [blocks, setBlocks] = useState<WireframeBlock[]>(initialBlocks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<"select" | "other">("select");
  const [zoom, setZoom] = useState(0.8);
  const [showGrid, setShowGrid] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regenerateComment, setRegenerateComment] = useState("");
  const [regenerateBusy, setRegenerateBusy] = useState(false);
  const [approveBusy, setApproveBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<ApiUserRef[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const historyRef = useRef<WireframeBlock[][]>([initialBlocks]);
  const historyIndexRef = useRef(0);
  const [historyTick, setHistoryTick] = useState(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBlocks(initialBlocks);
    historyRef.current = [initialBlocks];
    historyIndexRef.current = 0;
    setHistoryTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge.id]);

  async function doSave(next: WireframeBlock[]) {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/bridges/${bridge.id}/wireframe-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar.");
      onUpdate(data.bridge);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  function scheduleSave(next: WireframeBlock[]) {
    setSaveState("pending");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doSave(next), AUTOSAVE_DEBOUNCE_MS);
  }

  function pushHistory(next: WireframeBlock[]) {
    const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1);
    trimmed.push(next);
    historyRef.current = trimmed;
    historyIndexRef.current = trimmed.length - 1;
    setHistoryTick((t) => t + 1);
  }

  // Chamado ao FINAL de um drag/resize/rename (mouseup, blur) — só entra no
  // histórico e agenda o autosave se algo realmente mudou (evita poluir o
  // undo/redo e disparar saves à toa por um clique sem arrasto).
  function commitBlocks(next: WireframeBlock[]) {
    setBlocks(next);
    if (blocksEqual(next, historyRef.current[historyIndexRef.current])) return;
    pushHistory(next);
    scheduleSave(next);
  }

  function undo() {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    setBlocks(snapshot);
    setHistoryTick((t) => t + 1);
    scheduleSave(snapshot);
  }

  function redo() {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    setBlocks(snapshot);
    setHistoryTick((t) => t + 1);
    scheduleSave(snapshot);
  }

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;
  const selectedBlock = blocks.find((b) => b.id === selectedId) ?? null;

  function updateBlockLive(id: string, patch: Partial<WireframeBlock>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  // --- Drag pra mover um bloco (ferramenta Selecionar) ---
  function handleBlockMouseDown(event: ReactMouseEvent, block: WireframeBlock) {
    if (activeTool !== "select") return;
    event.stopPropagation();
    setSelectedId(block.id);
    setPropertiesOpen(true);
    const startX = event.clientX;
    const startY = event.clientY;
    const startBlockX = block.x;
    const startBlockY = block.y;
    let current = blocks;

    function onMove(moveEvent: MouseEvent) {
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;
      const nextX = Math.round(startBlockX + dx);
      const nextY = Math.round(startBlockY + dy);
      current = current.map((b) => (b.id === block.id ? { ...b, x: nextX, y: nextY } : b));
      setBlocks(current);
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      commitBlocks(current);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // --- Redimensionar por uma das 8 alças ---
  function handleResizeMouseDown(event: ReactMouseEvent, block: WireframeBlock, direction: ResizeDirection) {
    event.stopPropagation();
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = { x: block.x, y: block.y, width: block.width, height: block.height };
    let current = blocks;

    function onMove(moveEvent: MouseEvent) {
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;
      let { x, y, width, height } = start;

      if (direction.includes("e")) width = Math.max(MIN_BLOCK_SIZE, start.width + dx);
      if (direction.includes("s")) height = Math.max(MIN_BLOCK_SIZE, start.height + dy);
      if (direction.includes("w")) {
        width = Math.max(MIN_BLOCK_SIZE, start.width - dx);
        x = start.x + (start.width - width);
      }
      if (direction.includes("n")) {
        height = Math.max(MIN_BLOCK_SIZE, start.height - dy);
        y = start.y + (start.height - height);
      }

      current = current.map((b) => (b.id === block.id ? { ...b, x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) } : b));
      setBlocks(current);
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      commitBlocks(current);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handlePropertyChange(patch: Partial<WireframeBlock>) {
    if (!selectedBlock) return;
    updateBlockLive(selectedBlock.id, patch);
  }
  function commitPropertyChange() {
    if (!selectedBlock) return;
    const current = blocks;
    commitBlocks(current);
  }

  async function handleApprove() {
    setApproveBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/bridges/${bridge.id}/approve-wireframe`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao aprovar o wireframe.");
      onUpdate(data.bridge);
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Falha ao aprovar o wireframe.");
    } finally {
      setApproveBusy(false);
    }
  }

  async function handleRegenerate() {
    if (!regenerateComment.trim()) return;
    setRegenerateBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/bridges/${bridge.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: regenerateComment.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao gerar de novo.");
      onUpdate(data.bridge);
      setRegenerateOpen(false);
      setRegenerateComment("");
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Falha ao gerar de novo.");
    } finally {
      setRegenerateBusy(false);
    }
  }

  async function openAssignMenu() {
    setAssignOpen((v) => !v);
    if (!assignableUsers) {
      try {
        const res = await fetch(`/api/bridges/${bridge.id}/assignable-users`);
        const data = await res.json().catch(() => ({}));
        if (res.ok) setAssignableUsers(data.users ?? []);
      } catch {
        setAssignableUsers([]);
      }
    }
  }

  async function assignUx(userId: string | null) {
    setAssignOpen(false);
    try {
      const res = await fetch(`/api/bridges/${bridge.id}/assign-ux`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) onUpdate(data.bridge);
    } catch {
      // silencioso — não é uma ação crítica pro fluxo de aprovação
    }
  }

  function zoomTo(next: number) {
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next)));
  }

  const saveLabel =
    saveState === "saving" ? "Salvando..." : saveState === "error" ? "Falha ao salvar" : saveState === "pending" ? "Editando..." : "Salvo agora";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f3f3f4] text-[#1d1d1f]">
      {/* Subheader */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e4e4e7] bg-white px-6 py-3.5">
        <a
          href="/bridges"
          aria-label="Voltar"
          className="grid h-[37px] w-[37px] shrink-0 place-items-center rounded-lg border border-[#dcdce0] bg-white text-[#1d1d1f] hover:bg-[#f7f7f8]"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </a>
        <h1 className="text-lg font-semibold text-[#141416]">{bridge.planet.name}</h1>
        <span className="rounded-2xl bg-[#f0f0f1] px-3.5 py-1.5 text-[13.5px] text-[#55555b]">Wireframe</span>
        <span className={`flex items-center gap-1.5 text-[13.5px] ${saveState === "error" ? "text-luminous-error" : "text-[#55555b]"}`}>
          <CloudIcon className="h-4 w-4" />
          {saveLabel}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {actionError && <p className="mr-2 text-sm text-luminous-error">{actionError}</p>}
          <div className="flex items-center -space-x-1.5">
            <Avatar name={bridge.poUser?.name ?? "PO"} avatarUrl={bridge.poUser?.avatarUrl} size={35} />
            <Avatar name={bridge.uxUser?.name ?? "UX"} avatarUrl={bridge.uxUser?.avatarUrl} size={35} />
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={openAssignMenu}
              aria-label="Atribuir UX"
              className="grid h-[35px] w-[35px] place-items-center rounded-full border border-[#e0e0e3] bg-white text-[#1d1d1f] hover:bg-[#f7f7f8]"
            >
              <PlusIcon className="h-3.5 w-3.5" />
            </button>
            {assignOpen && (
              <div className="absolute right-0 top-10 z-30 w-56 overflow-hidden rounded-lg border border-[#e4e4e7] bg-white py-1 shadow-lg">
                <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93]">Atribuir UX</p>
                {assignableUsers === null ? (
                  <p className="px-3 py-2 text-sm text-[#8e8e93]">Carregando...</p>
                ) : assignableUsers.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-[#8e8e93]">Nenhum usuário encontrado.</p>
                ) : (
                  assignableUsers.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => assignUx(candidate.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#1d1d1f] hover:bg-[#f7f7f8]"
                    >
                      <Avatar name={candidate.name} avatarUrl={candidate.avatarUrl} size={24} />
                      {candidate.name}
                    </button>
                  ))
                )}
                {bridge.uxUserId && (
                  <button
                    type="button"
                    onClick={() => assignUx(null)}
                    className="mt-1 flex w-full items-center gap-2 border-t border-[#eee] px-3 py-2 text-left text-sm text-[#8e8e93] hover:bg-[#f7f7f8]"
                  >
                    Remover atribuição
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mx-1 h-[30px] w-px bg-[#e4e4e7]" />

          <button
            type="button"
            onClick={() => setRegenerateOpen(true)}
            className="rounded-lg border border-[#e6e6e9] bg-white px-4 py-2.5 text-[14.5px] text-[#2a2a2e] hover:bg-[#f7f7f8]"
          >
            Eu não gostei, gerar de novo
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={approveBusy}
            className="flex items-center gap-2 rounded-lg bg-[#7c3aed] px-6 py-2.5 text-[14.5px] font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-60"
          >
            <CheckIcon className="h-3.5 w-3.5" />
            {approveBusy ? "Aprovando..." : "Aprovar Wireframe"}
          </button>
        </div>
      </div>

      {/* Corpo: toolbar flutuante + painéis + canvas */}
      <div className="relative min-h-0 flex-1 bg-[#f3f3f4]">
        {/* Toolbar flutuante centralizada */}
        <div className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-1 rounded-[14px] bg-white py-0 pl-3 pr-2.5 shadow-[0_1px_2px_rgba(0,0,0,.06),0_4px_14px_rgba(0,0,0,.06)]">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Desfazer"
            className="grid h-[34px] w-[38px] place-items-center rounded-lg text-[#1d1d1f] hover:bg-[#f2f2f3] disabled:text-[#b4b4b9] disabled:hover:bg-transparent"
          >
            <UndoIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Refazer"
            className="grid h-[34px] w-[38px] place-items-center rounded-lg text-[#1d1d1f] hover:bg-[#f2f2f3] disabled:text-[#b4b4b9] disabled:hover:bg-transparent"
          >
            <RedoIcon className="h-4 w-4" />
          </button>
          <div className="mx-1 h-[26px] w-px bg-[#e7e7ea]" />
          <div className="relative">
            <button
              type="button"
              onClick={() => setZoomMenuOpen((v) => !v)}
              className="flex h-[34px] items-center gap-3 rounded-full border border-[#e6e6e9] px-3.5 text-[13.5px] font-medium text-[#1d1d1f] hover:bg-[#f7f7f8]"
            >
              {Math.round(zoom * 100)}%
              <ChevronDownIcon className="h-3 w-3" />
            </button>
            {zoomMenuOpen && (
              <div className="absolute left-1/2 top-10 z-30 w-24 -translate-x-1/2 overflow-hidden rounded-lg border border-[#e4e4e7] bg-white py-1 shadow-lg">
                {ZOOM_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      zoomTo(preset);
                      setZoomMenuOpen(false);
                    }}
                    className="block w-full px-3 py-1.5 text-left text-sm text-[#1d1d1f] hover:bg-[#f7f7f8]"
                  >
                    {Math.round(preset * 100)}%
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mx-1 h-[26px] w-px bg-[#e7e7ea]" />
          <button
            type="button"
            onClick={() => setShowGrid((v) => !v)}
            aria-label="Alternar grade"
            aria-pressed={showGrid}
            className={`grid h-[34px] w-[34px] place-items-center rounded-lg ${showGrid ? "bg-[#f1ebfe] text-[#7c3aed]" : "text-[#1d1d1f] hover:bg-[#f2f2f3]"}`}
          >
            <GridIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Painel de ferramentas à esquerda */}
        <div className="absolute left-[30px] top-[30px] z-20 flex w-[63px] flex-col items-center gap-2 rounded-[10px] bg-white pt-[13px] pb-[13px] shadow-[0_1px_2px_rgba(0,0,0,.05),0_2px_10px rgba(0,0,0,.04)]">
          <ToolButton active={activeTool === "select"} onClick={() => setActiveTool("select")} label="Selecionar">
            <SelectToolIcon className="h-[18px] w-[18px]" />
          </ToolButton>
          <ToolButton onClick={() => {}} label="Frame (em breve)">
            <FrameToolIcon className="h-[18px] w-[18px]" />
          </ToolButton>
          <ToolButton onClick={() => {}} label="Elipse (em breve)">
            <EllipseToolIcon className="h-[18px] w-[18px]" />
          </ToolButton>
          <ToolButton onClick={() => {}} label="Componentes (em breve)">
            <ComponentsToolIcon className="h-[18px] w-[18px]" />
          </ToolButton>
          <ToolButton onClick={() => {}} label="Caneta (em breve)">
            <PenToolIcon className="h-[18px] w-[18px]" />
          </ToolButton>
          <ToolButton onClick={() => {}} label="Texto (em breve)">
            <TextToolIcon className="h-[18px] w-[18px]" />
          </ToolButton>
          <ToolButton onClick={() => {}} label="Comentário (em breve)">
            <CommentToolIcon className="h-[18px] w-[18px]" />
          </ToolButton>
        </div>

        {/* Aba Camadas */}
        <button
          type="button"
          onClick={() => setLayersOpen((v) => !v)}
          className={`absolute bottom-[30px] left-1 z-20 flex w-[43px] flex-col items-center gap-2 rounded-lg bg-white py-3.5 shadow-[0_1px_2px_rgba(0,0,0,.05),0_2px_10px_rgba(0,0,0,.04)] ${layersOpen ? "text-[#7c3aed]" : "text-[#2a2a2e]"}`}
          style={{ height: 158 }}
        >
          <LayersTabIcon className="h-[17px] w-[17px]" />
          <span className="[writing-mode:vertical-rl] text-[13.5px]">Camadas</span>
          <ChevronDownIcon className={`h-[11px] w-[11px] transition-transform ${layersOpen ? "rotate-180" : ""}`} />
        </button>

        {layersOpen && (
          <div className="absolute bottom-[30px] left-[52px] z-20 max-h-[420px] w-56 overflow-y-auto rounded-lg border border-[#e4e4e7] bg-white p-2 shadow-lg">
            <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93]">Camadas ({blocks.length})</p>
            {blocks.map((block) => (
              <button
                key={block.id}
                type="button"
                onClick={() => {
                  setSelectedId(block.id);
                  setPropertiesOpen(true);
                }}
                className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-sm ${
                  selectedId === block.id ? "bg-[#f1ebfe] text-[#7c3aed]" : "text-[#1d1d1f] hover:bg-[#f7f7f8]"
                }`}
              >
                {block.label}
              </button>
            ))}
          </div>
        )}

        {/* Aba Propriedades */}
        <button
          type="button"
          onClick={() => setPropertiesOpen((v) => !v)}
          className={`absolute right-1 top-1/2 z-20 flex w-[43px] -translate-y-1/2 flex-col items-center gap-2 rounded-lg bg-white py-3.5 shadow-[0_1px_2px_rgba(0,0,0,.05),0_2px_10px_rgba(0,0,0,.04)] ${propertiesOpen ? "text-[#7c3aed]" : "text-[#2a2a2e]"}`}
          style={{ height: 183 }}
        >
          <PropertiesTabIcon className="h-[17px] w-[17px]" />
          <span className="[writing-mode:vertical-rl] text-[13.5px]">Propriedades</span>
          <ChevronDownIcon className={`h-[11px] w-[11px] transition-transform ${propertiesOpen ? "rotate-180" : ""}`} />
        </button>

        {propertiesOpen && (
          <div className="absolute right-[52px] top-1/2 z-20 w-72 -translate-y-1/2 rounded-lg border border-[#e4e4e7] bg-white p-4 shadow-lg">
            {!selectedBlock ? (
              <p className="text-sm text-[#8e8e93]">Selecione um bloco no canvas pra ver e editar suas propriedades.</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93]">Nome</label>
                  <input
                    type="text"
                    value={selectedBlock.label}
                    onChange={(event) => handlePropertyChange({ label: event.target.value })}
                    onBlur={commitPropertyChange}
                    onKeyDown={(event) => event.key === "Enter" && commitPropertyChange()}
                    className="w-full rounded-md border border-[#e4e4e7] px-2.5 py-1.5 text-sm text-[#1d1d1f] outline-none focus:border-[#7c3aed]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField label="X" value={selectedBlock.x} onChange={(v) => handlePropertyChange({ x: v })} onCommit={commitPropertyChange} />
                  <NumberField label="Y" value={selectedBlock.y} onChange={(v) => handlePropertyChange({ y: v })} onCommit={commitPropertyChange} />
                  <NumberField
                    label="Largura"
                    value={selectedBlock.width}
                    onChange={(v) => handlePropertyChange({ width: Math.max(MIN_BLOCK_SIZE, v) })}
                    onCommit={commitPropertyChange}
                  />
                  <NumberField
                    label="Altura"
                    value={selectedBlock.height}
                    onChange={(v) => handlePropertyChange({ height: Math.max(MIN_BLOCK_SIZE, v) })}
                    onCommit={commitPropertyChange}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Minimapa */}
        <div className="absolute bottom-[30px] left-[86px] z-10 hidden h-[126px] w-[206px] overflow-hidden rounded-[10px] bg-white shadow-[0_1px_2px_rgba(0,0,0,.05),0_2px_10px_rgba(0,0,0,.04)] sm:block">
          <div className="relative h-full w-full p-2">
            <div className="relative h-full w-full border border-[#3b82f6]">
              {blocks.map((block) => (
                <div
                  key={block.id}
                  className="absolute bg-[#d8d8db]"
                  style={{
                    left: `${(block.x / frameWidth) * 100}%`,
                    top: `${(block.y / frameHeight) * 100}%`,
                    width: `${(block.width / frameWidth) * 100}%`,
                    height: `${(block.height / frameHeight) * 100}%`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Controles de zoom */}
        <div className="absolute bottom-[30px] right-[30px] z-20 flex items-center gap-2">
          <div className="flex h-10 items-center rounded-lg bg-white px-1 shadow-[0_1px_2px_rgba(0,0,0,.05),0_2px_10px_rgba(0,0,0,.04)]">
            <button type="button" onClick={() => zoomTo(zoom - 0.1)} aria-label="Diminuir zoom" className="grid h-8 w-8 place-items-center rounded-md text-[#1d1d1f] hover:bg-[#f2f2f3]">
              <MinusIcon className="h-3.5 w-3.5" />
            </button>
            <span className="w-10 text-center text-[13.5px] text-[#1d1d1f]">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => zoomTo(zoom + 0.1)} aria-label="Aumentar zoom" className="grid h-8 w-8 place-items-center rounded-md text-[#1d1d1f] hover:bg-[#f2f2f3]">
              <PlusIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => zoomTo(1)}
            aria-label="Ajustar à tela"
            className="grid h-10 w-10 place-items-center rounded-lg bg-white text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,.05),0_2px_10px_rgba(0,0,0,.04)] hover:bg-[#f7f7f8]"
          >
            <MaximizeIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Canvas */}
        <div ref={canvasScrollRef} className="h-full overflow-auto py-16 pl-[130px] pr-8" onMouseDown={() => setSelectedId(null)}>
          <p className="mb-2 pl-1 text-[13.5px] text-[#4b4b52]" style={{ width: frameWidth * zoom }}>
            Desktop - {frameWidth} × {frameHeight}
          </p>
          <div
            className="relative select-none bg-white"
            style={{
              width: frameWidth * zoom,
              height: frameHeight * zoom,
              border: "1px solid #e2e2e4",
              backgroundImage: showGrid
                ? `linear-gradient(to right, #eee 1px, transparent 1px), linear-gradient(to bottom, #eee 1px, transparent 1px)`
                : undefined,
              backgroundSize: showGrid ? `${8 * zoom}px ${8 * zoom}px` : undefined,
            }}
          >
            {blocks.map((block) => (
              <CanvasBlock
                key={block.id}
                block={block}
                zoom={zoom}
                frameWidth={frameWidth}
                frameHeight={frameHeight}
                selected={selectedId === block.id}
                onMouseDown={(event) => handleBlockMouseDown(event, block)}
                onResizeMouseDown={(event, direction) => handleResizeMouseDown(event, block, direction)}
              />
            ))}
          </div>
        </div>
      </div>

      {regenerateOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setRegenerateOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#141416]">Gerar wireframe de novo</h2>
              <button type="button" onClick={() => setRegenerateOpen(false)} className="text-[#8e8e93] hover:text-[#1d1d1f]">
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-sm text-[#55555b]">
              Isso descarta o wireframe atual e gera um novo do zero a partir do seu comentário. Se for só um ajuste pontual, considere editar
              direto no canvas em vez disso.
            </p>
            <textarea
              rows={4}
              autoFocus
              value={regenerateComment}
              onChange={(event) => setRegenerateComment(event.target.value)}
              placeholder="O que está errado na estrutura atual?"
              className="w-full resize-none rounded-lg border border-[#e4e4e7] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#7c3aed]"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRegenerateOpen(false)}
                disabled={regenerateBusy}
                className="rounded-lg border border-[#e4e4e7] bg-white px-4 py-2 text-sm text-[#2a2a2e] hover:bg-[#f7f7f8]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={regenerateBusy || !regenerateComment.trim()}
                className="rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-60"
              >
                {regenerateBusy ? "Gerando..." : "Gerar de novo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolButton({ active, onClick, label, children }: { active?: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-[41px] w-[41px] place-items-center rounded-lg ${active ? "bg-[#f1ebfe] text-[#7c3aed]" : "text-[#2a2a2e] hover:bg-[#f2f2f3]"}`}
    >
      {children}
    </button>
  );
}

function NumberField({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onCommit: () => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93]">{label}</label>
      <input
        type="number"
        value={Math.round(value)}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        onBlur={onCommit}
        onKeyDown={(event) => event.key === "Enter" && onCommit()}
        className="w-full rounded-md border border-[#e4e4e7] px-2.5 py-1.5 text-sm text-[#1d1d1f] outline-none focus:border-[#7c3aed]"
      />
    </div>
  );
}

const RESIZE_HANDLES: { direction: ResizeDirection; className: string; cursor: string }[] = [
  { direction: "nw", className: "-left-1 -top-1", cursor: "nwse-resize" },
  { direction: "n", className: "left-1/2 -top-1 -translate-x-1/2", cursor: "ns-resize" },
  { direction: "ne", className: "-right-1 -top-1", cursor: "nesw-resize" },
  { direction: "e", className: "-right-1 top-1/2 -translate-y-1/2", cursor: "ew-resize" },
  { direction: "se", className: "-right-1 -bottom-1", cursor: "nwse-resize" },
  { direction: "s", className: "left-1/2 -bottom-1 -translate-x-1/2", cursor: "ns-resize" },
  { direction: "sw", className: "-left-1 -bottom-1", cursor: "nesw-resize" },
  { direction: "w", className: "-left-1 top-1/2 -translate-y-1/2", cursor: "ew-resize" },
];

function CanvasBlock({
  block,
  zoom,
  frameWidth,
  frameHeight,
  selected,
  onMouseDown,
  onResizeMouseDown,
}: {
  block: WireframeBlock;
  zoom: number;
  frameWidth: number;
  frameHeight: number;
  selected: boolean;
  onMouseDown: (event: ReactMouseEvent) => void;
  onResizeMouseDown: (event: ReactMouseEvent, direction: ResizeDirection) => void;
}) {
  // Guias de medição pontilhadas: comprimento exato até a borda do frame em
  // cada direção (não um valor arbitrário), pra nunca transbordar o canvas.
  const topExtent = block.y * zoom;
  const bottomExtent = (frameHeight - block.y - block.height) * zoom;
  const leftExtent = block.x * zoom;
  const rightExtent = (frameWidth - block.x - block.width) * zoom;

  return (
    <div
      onMouseDown={onMouseDown}
      className={`absolute cursor-move border bg-white ${selected ? "border-[#3b82f6]" : "border-[#dcdce0] hover:border-[#b4b4b9]"}`}
      style={{ left: block.x * zoom, top: block.y * zoom, width: block.width * zoom, height: block.height * zoom }}
    >
      <span className="pointer-events-none block truncate px-2 py-1.5 text-[12px] font-medium text-[#333336]">{block.label}</span>

      {selected && (
        <>
          {/* Guias de medição pontilhadas, estendendo até a borda do frame */}
          <div
            className="pointer-events-none absolute left-1/2 top-full w-px border-l border-dashed border-[#3b82f6]/50"
            style={{ height: bottomExtent }}
          />
          <div
            className="pointer-events-none absolute bottom-full left-1/2 w-px border-l border-dashed border-[#3b82f6]/50"
            style={{ height: topExtent }}
          />
          <div
            className="pointer-events-none absolute right-full top-1/2 h-px border-t border-dashed border-[#3b82f6]/50"
            style={{ width: leftExtent }}
          />
          <div
            className="pointer-events-none absolute left-full top-1/2 h-px border-t border-dashed border-[#3b82f6]/50"
            style={{ width: rightExtent }}
          />

          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#3b82f6] px-1.5 py-0.5 text-[10px] font-medium text-white">
            {block.width} × {block.height}
          </span>

          {RESIZE_HANDLES.map((handle) => (
            <div
              key={handle.direction}
              onMouseDown={(event) => onResizeMouseDown(event, handle.direction)}
              style={{ cursor: handle.cursor }}
              className={`absolute h-2.5 w-2.5 rounded-full border border-[#3b82f6] bg-white ${handle.className}`}
            />
          ))}
        </>
      )}
    </div>
  );
}
