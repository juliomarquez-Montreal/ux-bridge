"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { ApiBridge, ApiUserRef, WireframeBlock } from "@/app/bridges/types";
import { normalizeWireframeBlocks } from "@/lib/bridges/wireframeLayout";
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
  EyeOffIcon,
  EyeOpenIcon,
  FolderIcon,
  FrameToolIcon,
  GridIcon,
  HandToolIcon,
  LayersTabIcon,
  LockIcon,
  MaximizeIcon,
  MinimizeIcon,
  MinusIcon,
  PenToolIcon,
  PlusIcon,
  PropertiesTabIcon,
  RedoIcon,
  SelectToolIcon,
  TextToolIcon,
  ThumbsDownIcon,
  TrashIcon,
  UndoIcon,
  UnlockIcon,
} from "@/components/icons";

// Editor visual completo do Wireframe (Wireframe-1a/1a+). Reproduz fielmente
// o mockup em _design-assets/. Só a ferramenta "Selecionar" (e agora "Mão")
// tem função real nesta fase — as outras 5 ficam visuais, sem ação
// (Wireframe-1c: painel de componentes do Design System arrastáveis).

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const MIN_BLOCK_SIZE = 24;
const AUTOSAVE_DEBOUNCE_MS = 900;
// Cursor customizado da ferramenta "Mão" (Ajuste C) — o cursor nativo
// "grab" do sistema operacional fica quase invisível sobre o fundo branco
// do canvas em alguns navegadores/SOs. Uma mão aberta simplificada (palma +
// 4 dedos) com contorno preto E uma sombra escura semitransparente
// desenhada por trás (não um filtro CSS — cursores customizados não
// aplicam drop-shadow de fora, então a sombra precisa já estar "assada" na
// própria imagem) garante contraste em cima de qualquer cor de fundo.
const HAND_CURSOR_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">` +
    `<g fill="rgba(0,0,0,0.35)" transform="translate(1,1.5)">` +
    `<rect x="9" y="11" width="10" height="11" rx="3"/>` +
    `<rect x="8" y="6" width="3.2" height="10" rx="1.5"/>` +
    `<rect x="11.6" y="4" width="3.2" height="12" rx="1.5"/>` +
    `<rect x="15.2" y="4.5" width="3.2" height="11.5" rx="1.5"/>` +
    `<rect x="18.8" y="6" width="3" height="10" rx="1.5"/>` +
    `</g>` +
    `<g fill="#ffffff" stroke="#111111" stroke-width="1.4" stroke-linejoin="round">` +
    `<rect x="9" y="11" width="10" height="11" rx="3"/>` +
    `<rect x="8" y="6" width="3.2" height="10" rx="1.5"/>` +
    `<rect x="11.6" y="4" width="3.2" height="12" rx="1.5"/>` +
    `<rect x="15.2" y="4.5" width="3.2" height="11.5" rx="1.5"/>` +
    `<rect x="18.8" y="6" width="3" height="10" rx="1.5"/>` +
    `</g>` +
    `</svg>`
);
const HAND_CURSOR = `url("data:image/svg+xml,${HAND_CURSOR_SVG}") 14 14, grab`;
// Heurística simples (não um sistema de tipos de verdade — isso fica pra
// quando o editor souber o que cada bloco realmente é, na Wireframe-1c) pra
// decidir se um ELEMENT mostra o ícone de texto nas Camadas.
const TEXT_LABEL_PATTERN = /t[íi]tulo|texto|label|nome|descri[çc][ãa]o/i;

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";
type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type Tool = "select" | "hand" | "other";

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
      block.height === other.height &&
      block.parentBlockId === other.parentBlockId &&
      block.kind === other.kind &&
      block.siblingOrder === other.siblingOrder &&
      block.hidden === other.hidden &&
      block.locked === other.locked
    );
  });
}

// --- Helpers de hierarquia (agrupamento, Ajuste 4) ---

function collectDescendantIds(rootId: string, blocks: WireframeBlock[]): Set<string> {
  const result = new Set<string>();
  const childrenByParent = new Map<string, WireframeBlock[]>();
  for (const b of blocks) {
    if (!b.parentBlockId) continue;
    const arr = childrenByParent.get(b.parentBlockId) ?? [];
    arr.push(b);
    childrenByParent.set(b.parentBlockId, arr);
  }
  function walk(id: string) {
    for (const child of childrenByParent.get(id) ?? []) {
      if (!result.has(child.id)) {
        result.add(child.id);
        walk(child.id);
      }
    }
  }
  walk(rootId);
  return result;
}

// Todos os ids que devem se mover junto quando `draggedId` é arrastado:
// a seleção efetiva (se o bloco arrastado faz parte dela) + todos os
// descendentes de cada bloco movido (pra um GROUP arrastar seus filhos).
function getMoveSet(draggedId: string, blocks: WireframeBlock[], effectiveSelection: Set<string>): Set<string> {
  const base = effectiveSelection.has(draggedId) ? effectiveSelection : new Set([draggedId]);
  const result = new Set(base);
  for (const id of Array.from(base)) {
    for (const descendantId of Array.from(collectDescendantIds(id, blocks))) result.add(descendantId);
  }
  return result;
}

interface TreeNode {
  block: WireframeBlock;
  children: TreeNode[];
}

function buildTree(blocks: WireframeBlock[]): TreeNode[] {
  const byParent = new Map<string | null, WireframeBlock[]>();
  for (const b of blocks) {
    const key = b.parentBlockId;
    const arr = byParent.get(key) ?? [];
    arr.push(b);
    byParent.set(key, arr);
  }
  for (const arr of Array.from(byParent.values())) arr.sort((a, b) => a.siblingOrder - b.siblingOrder);
  function build(parentId: string | null): TreeNode[] {
    return (byParent.get(parentId) ?? []).map((block) => ({ block, children: build(block.id) }));
  }
  return build(null);
}

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `w${Math.random().toString(36).slice(2)}`;
}

export default function WireframeEditor({ bridge, onUpdate }: { bridge: ApiBridge; onUpdate: (bridge: ApiBridge) => void }) {
  const router = useRouter();
  const frameWidth = bridge.wireframeData?.frameWidth ?? 1440;
  const frameHeight = bridge.wireframeData?.frameHeight ?? 1024;
  // normalizeWireframeBlocks preenche kind/parentBlockId/siblingOrder com
  // defaults sensatos (ELEMENT/null/índice) quando ausentes — essencial pra
  // blocos gravados ANTES desses campos existirem (ex: o Bridge real
  // migrado da Wireframe-1a via script standalone, que nunca os teve).
  // Sem isso, um bloco com kind=undefined não bate em nenhum dos filtros
  // "GROUP"/"ELEMENT" do canvas e simplesmente some da tela, e a árvore de
  // Camadas (que agrupa por parentBlockId) some junto, já que undefined !==
  // null como chave do Map. Ver scripts/fix-real-bridge-wireframe-kind.mjs
  // pro backfill único que corrigiu o dado já salvo do Bridge real.
  const initialBlocks = useMemo(() => {
    const raw = bridge.wireframeData?.blocks;
    if (!raw || raw.length === 0) return [];
    return normalizeWireframeBlocks(raw);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só recalcula quando o Bridge muda de verdade (id), não a cada update local de wireframeData vindo do próprio autosave.
  }, [bridge.id]);

  const [blocks, setBlocks] = useState<WireframeBlock[]>(initialBlocks);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTool, setActiveTool] = useState<Tool>("select");
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; blockId: string } | null>(null);
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [layerDropTargetId, setLayerDropTargetId] = useState<string | null | "root">(null);
  // Posição do drop relativa ao item sobrevoado nas Camadas (Ajuste 3): não
  // se aplica ao drop em "root" (fundo do painel), só entre linhas.
  const [layerDropPosition, setLayerDropPosition] = useState<"before" | "after" | "inside">("inside");
  // Tamanho real da área visível do canvas (Ajuste 1) — usado pra calcular
  // o padding-esquerdo/topo dinâmico que centraliza o frame quando ele é
  // MENOR que a área disponível (telas largas). clientWidth/clientHeight já
  // incluem o próprio padding do elemento e não mudam quando o padding é
  // redistribuído (o container não tem largura própria fixa, ela vem do
  // flex-1 do pai), então não há dependência circular em usá-los aqui.
  const [canvasViewport, setCanvasViewport] = useState({ width: 0, height: 0 });

  const historyRef = useRef<WireframeBlock[][]>([initialBlocks]);
  const historyIndexRef = useRef(0);
  const [historyTick, setHistoryTick] = useState(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasScrollRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const editorRootRef = useRef<HTMLDivElement>(null);
  const pendingScrollAdjustRef = useRef<{ dx: number; dy: number } | null>(null);
  // Ajuste 1: quando true, o próximo efeito disparado por mudança de `zoom`
  // deve CENTRALIZAR o frame (em vez de aplicar o ajuste de scroll do zoom
  // centrado no cursor, que usa pendingScrollAdjustRef acima) — usado ao
  // escolher um preset no menu de zoom, que "reseta" o zoom pra um valor
  // conhecido.
  const centerPendingRef = useRef(false);
  const panStateRef = useRef<{ startX: number; startY: number; startScrollLeft: number; startScrollTop: number } | null>(null);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  useEffect(() => {
    setBlocks(initialBlocks);
    historyRef.current = [initialBlocks];
    historyIndexRef.current = 0;
    setHistoryTick((t) => t + 1);
    setSelectedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge.id]);

  // Ajuste 1: mede continuamente a área visível do canvas (ver
  // canvasViewport acima) — o padding-esquerdo/topo dinâmico calculado a
  // partir disso é o que de fato centraliza o frame quando ele é menor que
  // a área disponível (telas largas). Continua observando (não só na
  // montagem) porque isso também mantém o frame centralizado se a janela
  // for redimensionada depois — sem custo extra, já que só produz padding
  // acima do mínimo quando sobra espaço de verdade (não há nada pra
  // "desfazer" de uma rolagem manual do usuário nesse caso, pois só entra
  // em jogo quando NÃO há overflow/scroll possível).
  useLayoutEffect(() => {
    const container = canvasScrollRef.current;
    if (!container) return;
    function measure() {
      setCanvasViewport({ width: container!.clientWidth, height: container!.clientHeight });
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Quando o frame TRANSBORDA a área visível (zoom alto / tela pequena), o
  // padding fica no mínimo e sobra overflow de verdade pra rolar — nesse
  // caso, dá pra começar com a rolagem centralizada no meio do frame (em
  // vez de cair no canto superior-esquerdo). Só ajuda a posição inicial;
  // não é crítico se ficar levemente impreciso.
  function centerScrollIfOverflowing() {
    const container = canvasScrollRef.current;
    const frame = frameRef.current;
    if (!container || !frame) return;
    container.scrollLeft = Math.max(0, frame.offsetLeft + frame.offsetWidth / 2 - container.clientWidth / 2);
    container.scrollTop = Math.max(0, frame.offsetTop + frame.offsetHeight / 2 - container.clientHeight / 2);
  }

  useEffect(() => {
    centerScrollIfOverflowing();
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

  // Chamado ao FINAL de um drag/resize/rename/agrupar (mouseup, blur) — só
  // entra no histórico e agenda o autosave se algo realmente mudou (evita
  // poluir o undo/redo e disparar saves à toa por um clique sem arrasto).
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
  const selectedBlock = selectedIds.size === 1 ? blocks.find((b) => selectedIds.has(b.id)) ?? null : null;

  function updateBlockLive(id: string, patch: Partial<WireframeBlock>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function selectOnly(id: string) {
    setSelectedIds(new Set([id]));
    setPropertiesOpen(true);
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // --- Drag pra mover um bloco (ferramenta Selecionar) — Pointer Events (não
  // Mouse Events) pra cobrir mouse, caneta E trackpad/touch com a mesma
  // API; alguns gestos de arrastar no trackpad não disparam
  // mousemove/mouseup de forma confiável neste app, mas sempre disparam
  // pointermove/pointerup. ---
  function handleBlockMouseDown(event: ReactPointerEvent, block: WireframeBlock) {
    if (activeTool !== "select" || event.button !== 0) return;
    event.stopPropagation();
    // Bloco bloqueado (Ajuste 3): não seleciona nem arrasta por clique
    // direto no canvas — só desbloqueável via Camadas, que tem seu próprio
    // caminho de seleção (LayerRow.onSelect) que não passa por aqui.
    if (block.locked) return;

    if (event.shiftKey) {
      toggleSelection(block.id);
      return;
    }

    const effectiveSelection = selectedIds.has(block.id) && selectedIds.size > 1 ? selectedIds : new Set([block.id]);
    setSelectedIds(effectiveSelection);
    setPropertiesOpen(true);

    const moveSet = getMoveSet(block.id, blocks, effectiveSelection);
    const startX = event.clientX;
    const startY = event.clientY;
    const startPositions = new Map(blocks.filter((b) => moveSet.has(b.id)).map((b) => [b.id, { x: b.x, y: b.y }]));
    let current = blocks;
    let moved = false;

    function onMove(moveEvent: PointerEvent) {
      moved = true;
      const dx = (moveEvent.clientX - startX) / zoomRef.current;
      const dy = (moveEvent.clientY - startY) / zoomRef.current;
      current = current.map((b) => {
        const start = startPositions.get(b.id);
        if (!start) return b;
        return { ...b, x: Math.round(start.x + dx), y: Math.round(start.y + dy) };
      });
      setBlocks(current);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (moved) commitBlocks(current);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // --- Redimensionar por uma das 8 alças (Pointer Events, mesmo motivo acima) ---
  function handleResizeMouseDown(event: ReactPointerEvent, block: WireframeBlock, direction: ResizeDirection) {
    event.stopPropagation();
    event.preventDefault();
    if (block.locked) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const start = { x: block.x, y: block.y, width: block.width, height: block.height };
    let current = blocks;

    function onMove(moveEvent: PointerEvent) {
      const dx = (moveEvent.clientX - startX) / zoomRef.current;
      const dy = (moveEvent.clientY - startY) / zoomRef.current;
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
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      commitBlocks(current);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function handlePropertyChange(patch: Partial<WireframeBlock>) {
    if (!selectedBlock) return;
    updateBlockLive(selectedBlock.id, patch);
  }
  function commitPropertyChange() {
    if (!selectedBlock) return;
    commitBlocks(blocksRef.current);
  }

  // --- Agrupar seleção (Ajuste 4 — Ctrl+G / menu de contexto) ---
  function groupSelection() {
    const ids = selectedIdsRef.current;
    if (ids.size < 2) return;
    const current = blocksRef.current;
    const selected = current.filter((b) => ids.has(b.id));
    const minX = Math.min(...selected.map((b) => b.x));
    const minY = Math.min(...selected.map((b) => b.y));
    const maxX = Math.max(...selected.map((b) => b.x + b.width));
    const maxY = Math.max(...selected.map((b) => b.y + b.height));

    const parentBlockId = selected[0].parentBlockId ?? null;
    const siblingsAtLevel = current.filter((b) => b.parentBlockId === parentBlockId);
    const nextSiblingOrder = siblingsAtLevel.length > 0 ? Math.max(...siblingsAtLevel.map((b) => b.siblingOrder)) + 1 : 0;

    const groupBlock: WireframeBlock = {
      id: makeId(),
      label: "Grupo",
      zone: selected[0].zone,
      row: selected[0].row,
      order: selected[0].order,
      widthHint: "auto",
      heightHint: "compact",
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      parentBlockId,
      kind: "GROUP",
      siblingOrder: nextSiblingOrder,
      hidden: false,
      locked: false,
    };

    let childOrder = 0;
    const next = current.map((b) => (ids.has(b.id) ? { ...b, parentBlockId: groupBlock.id, siblingOrder: childOrder++ } : b));
    next.push(groupBlock);

    commitBlocks(next);
    setSelectedIds(new Set([groupBlock.id]));
    setContextMenu(null);
  }

  // Desfaz um agrupamento: os filhos diretos do GROUP sobem pro nível do
  // próprio GROUP (seu parentBlockId), o bloco GROUP é removido. Contrário
  // de groupSelection — usado pelo menu de contexto quando o item clicado é
  // um GROUP (Ajuste 2).
  function ungroupBlock(groupId: string) {
    const current = blocksRef.current;
    const group = current.find((b) => b.id === groupId);
    if (!group || group.kind !== "GROUP") return;

    const grandParentId = group.parentBlockId;
    const siblingsAtLevel = current.filter((b) => b.parentBlockId === grandParentId && b.id !== groupId);
    let nextOrder = siblingsAtLevel.length > 0 ? Math.max(...siblingsAtLevel.map((b) => b.siblingOrder)) + 1 : 0;

    const freedIds: string[] = [];
    const next = current
      .filter((b) => b.id !== groupId)
      .map((b) => {
        if (b.parentBlockId !== groupId) return b;
        freedIds.push(b.id);
        return { ...b, parentBlockId: grandParentId, siblingOrder: nextOrder++ };
      });

    commitBlocks(next);
    setSelectedIds(new Set(freedIds));
    setContextMenu(null);
  }

  // Adiciona um texto livre/anotação (Ajuste 2) posicionado dentro dos
  // limites do bloco/grupo clicado. Vira filho do alvo se o alvo for um
  // GROUP (organização hierárquica de verdade); senão vira irmão do alvo
  // (mesmo parentBlockId), já que um ELEMENT não pode ter filhos.
  function addTextAnnotation(targetId: string) {
    const current = blocksRef.current;
    const target = current.find((b) => b.id === targetId);
    if (!target) return;

    const parentBlockId = target.kind === "GROUP" ? target.id : target.parentBlockId;
    const siblingsAtLevel = current.filter((b) => b.parentBlockId === parentBlockId);
    const nextOrder = siblingsAtLevel.length > 0 ? Math.max(...siblingsAtLevel.map((b) => b.siblingOrder)) + 1 : 0;
    const width = Math.min(160, Math.max(MIN_BLOCK_SIZE, target.width));
    const height = 32;

    const newBlock: WireframeBlock = {
      id: makeId(),
      label: "Texto",
      zone: target.zone,
      row: target.row,
      order: target.order,
      widthHint: "auto",
      heightHint: "compact",
      x: Math.round(target.x + (target.width - width) / 2),
      y: Math.round(target.y + (target.height - height) / 2),
      width,
      height,
      parentBlockId,
      kind: "ELEMENT",
      siblingOrder: nextOrder,
      hidden: false,
      locked: false,
    };

    commitBlocks([...current, newBlock]);
    setSelectedIds(new Set([newBlock.id]));
    setPropertiesOpen(true);
    setContextMenu(null);
  }

  // Ocultar/Mostrar e Bloquear/Desbloquear (Ajuste 2 + 3): alterna com base
  // em "algum dos selecionados está no estado oposto" — se qualquer um
  // estiver visível/destravado, a ação vira "ocultar/bloquear todos"; só
  // quando TODOS já estão ocultos/bloqueados é que a ação reverte.
  function toggleHidden(ids: Set<string>) {
    const current = blocksRef.current;
    const nextHidden = current.some((b) => ids.has(b.id) && !b.hidden);
    commitBlocks(current.map((b) => (ids.has(b.id) ? { ...b, hidden: nextHidden } : b)));
    setContextMenu(null);
  }

  function toggleLocked(ids: Set<string>) {
    const current = blocksRef.current;
    const nextLocked = current.some((b) => ids.has(b.id) && !b.locked);
    commitBlocks(current.map((b) => (ids.has(b.id) ? { ...b, locked: nextLocked } : b)));
    setContextMenu(null);
  }

  // Apaga os blocos selecionados + todos os descendentes (se algum for GROUP).
  function deleteBlocks(ids: Set<string>) {
    const current = blocksRef.current;
    const allIds = new Set(ids);
    for (const id of Array.from(ids)) {
      for (const descendantId of Array.from(collectDescendantIds(id, current))) allIds.add(descendantId);
    }
    commitBlocks(current.filter((b) => !allIds.has(b.id)));
    setSelectedIds(new Set());
    setContextMenu(null);
  }

  // Atalho Ctrl+G / Cmd+G pra agrupar.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "g") {
        event.preventDefault();
        groupSelection();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- groupSelection só lê blocksRef/selectedIdsRef (refs, sempre atuais) e setters estáveis, então o listener nunca fica desatualizado mesmo registrado uma única vez.
  }, []);

  // Fecha o menu de contexto ao clicar fora ou apertar Escape.
  useEffect(() => {
    if (!contextMenu) return;
    function close() {
      setContextMenu(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  function handleBlockContextMenu(event: ReactMouseEvent, block: WireframeBlock) {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedIds.has(block.id)) setSelectedIds(new Set([block.id]));
    setContextMenu({ x: event.clientX, y: event.clientY, blockId: block.id });
  }

  // --- Ctrl+scroll = zoom centralizado no cursor (Ajuste 1). Precisa de um
  // listener NATIVO (não o onWheel do React) porque o React anexa o wheel
  // como passivo por padrão — preventDefault() dentro de um onWheel comum
  // não impede o scroll/zoom nativo do navegador de forma confiável.
  useEffect(() => {
    const container = canvasScrollRef.current;
    if (!container) return;

    function onWheel(event: WheelEvent) {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const frame = frameRef.current;
      if (!frame) return;

      const frameRect = frame.getBoundingClientRect();
      const cursorFrameX = event.clientX - frameRect.left;
      const cursorFrameY = event.clientY - frameRect.top;
      const currentZoom = zoomRef.current;
      const trueX = cursorFrameX / currentZoom;
      const trueY = cursorFrameY / currentZoom;

      const factor = Math.exp(-event.deltaY * 0.001);
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom * factor));

      const newCursorFrameX = trueX * nextZoom;
      const newCursorFrameY = trueY * nextZoom;
      pendingScrollAdjustRef.current = { dx: newCursorFrameX - cursorFrameX, dy: newCursorFrameY - cursorFrameY };

      setZoom(nextZoom);
    }

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (centerPendingRef.current) {
      centerPendingRef.current = false;
      centerScrollIfOverflowing();
      return;
    }
    const adjust = pendingScrollAdjustRef.current;
    const container = canvasScrollRef.current;
    if (adjust && container) {
      container.scrollLeft += adjust.dx;
      container.scrollTop += adjust.dy;
      pendingScrollAdjustRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- centerFrame só lê refs estáveis (canvasScrollRef/frameRef), não precisa entrar nas deps.
  }, [zoom]);

  // --- Pan: botão do meio (qualquer ferramenta) ou botão esquerdo com a
  // ferramenta "Mão" ativa (Ajuste 2). Pointer Events (não Mouse Events) —
  // arrastar com gesto de trackpad (sem botão físico de mouse) nem sempre
  // dispara mousedown/mousemove/mouseup de forma confiável, mas sempre
  // dispara pointerdown/pointermove/pointerup, que cobre mouse/caneta/touch
  // com a mesma API. ---
  function startPan(event: ReactPointerEvent) {
    const container = canvasScrollRef.current;
    if (!container) return;
    panStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: container.scrollLeft,
      startScrollTop: container.scrollTop,
    };
    function onMove(moveEvent: PointerEvent) {
      const pan = panStateRef.current;
      if (!pan || !container) return;
      container.scrollLeft = pan.startScrollLeft - (moveEvent.clientX - pan.startX);
      container.scrollTop = pan.startScrollTop - (moveEvent.clientY - pan.startY);
    }
    function onUp() {
      panStateRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function handleCanvasMouseDown(event: ReactPointerEvent) {
    if (event.button === 1 || (event.button === 0 && activeTool === "hand")) {
      event.preventDefault();
      startPan(event);
      return;
    }
    if (event.button === 0) {
      setSelectedIds(new Set());
      setContextMenu(null);
    }
  }

  // --- Tela cheia (Ajuste 3) — chamado DIRETO no clique (gesto síncrono do
  // usuário; navegadores recusam requestFullscreen fora disso), com o erro
  // da Promise tratado em vez de ignorado silenciosamente. ---
  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === editorRootRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      editorRootRef.current?.requestFullscreen().catch(() => {
        setActionError("Não foi possível entrar em tela cheia neste navegador.");
      });
    }
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

  // --- Reatribuir pai OU reordenar entre irmãos na árvore de Camadas via
  // drag-and-drop (Ajuste 3, item 5). "inside" reparenta pra dentro de um
  // GROUP (comportamento original); "before"/"after" reordena o item como
  // irmão do alvo no MESMO nível do alvo (pode ser um reparenting também,
  // se o alvo estiver em outro nível — só não entra "dentro" dele). ---
  function handleLayerDrop(targetId: string | "root", position: "before" | "after" | "inside" = "inside") {
    const draggedId = draggedLayerId;
    setDraggedLayerId(null);
    setLayerDropTargetId(null);
    if (!draggedId || targetId === draggedId) return;

    const current = blocksRef.current;

    if (targetId === "root") {
      const siblings = current.filter((b) => b.parentBlockId === null && b.id !== draggedId);
      const nextOrder = siblings.length > 0 ? Math.max(...siblings.map((b) => b.siblingOrder)) + 1 : 0;
      commitBlocks(current.map((b) => (b.id === draggedId ? { ...b, parentBlockId: null, siblingOrder: nextOrder } : b)));
      return;
    }

    // nunca deixa um bloco virar filho/irmão dentro da própria subárvore (ciclo).
    const descendants = collectDescendantIds(draggedId, current);
    if (descendants.has(targetId)) return;
    const targetBlock = current.find((b) => b.id === targetId);
    if (!targetBlock) return;

    if (position === "inside") {
      if (targetBlock.kind !== "GROUP") return;
      const siblings = current.filter((b) => b.parentBlockId === targetId && b.id !== draggedId);
      const nextOrder = siblings.length > 0 ? Math.max(...siblings.map((b) => b.siblingOrder)) + 1 : 0;
      commitBlocks(current.map((b) => (b.id === draggedId ? { ...b, parentBlockId: targetId, siblingOrder: nextOrder } : b)));
      return;
    }

    // "before"/"after": vira irmão do alvo no nível do alvo — reordena a
    // pilha de empilhamento (z-index visual) entre os irmãos existentes,
    // renumerando siblingOrder de todos consecutivamente (0..n) pra nunca
    // colidir com a ordem antiga.
    const newParentId = targetBlock.parentBlockId;
    const siblingIds = current
      .filter((b) => b.parentBlockId === newParentId && b.id !== draggedId)
      .sort((a, b) => a.siblingOrder - b.siblingOrder)
      .map((b) => b.id);
    const targetIndex = siblingIds.indexOf(targetId);
    const insertIndex = position === "before" ? targetIndex : targetIndex + 1;
    const reorderedIds = [...siblingIds.slice(0, insertIndex), draggedId, ...siblingIds.slice(insertIndex)];
    const orderById = new Map(reorderedIds.map((id, index) => [id, index]));

    const next = current.map((b) => {
      if (b.id === draggedId) return { ...b, parentBlockId: newParentId, siblingOrder: orderById.get(draggedId)! };
      if (orderById.has(b.id)) return { ...b, siblingOrder: orderById.get(b.id)! };
      return b;
    });
    commitBlocks(next);
  }

  const saveLabel =
    saveState === "saving" ? "Salvando..." : saveState === "error" ? "Falha ao salvar" : saveState === "pending" ? "Editando..." : "Salvo agora";

  const tree = useMemo(() => buildTree(blocks), [blocks]);
  const canGroup = selectedIds.size >= 2;
  const selectedBlocksList = blocks.filter((b) => selectedIds.has(b.id));
  const allSelectedHidden = selectedBlocksList.length > 0 && selectedBlocksList.every((b) => b.hidden);
  const allSelectedLocked = selectedBlocksList.length > 0 && selectedBlocksList.every((b) => b.locked);
  const contextMenuBlock = contextMenu ? blocks.find((b) => b.id === contextMenu.blockId) ?? null : null;

  // Ajuste 1: padding-esquerdo/topo dinâmico — cresce além do mínimo
  // (clearance pro painel de ferramentas flutuante / toolbar) só quando
  // sobra espaço de verdade, centralizando o frame em telas largas em vez
  // de deixar toda a folga acumulada de um lado só.
  const MIN_CANVAS_PAD_X = 130;
  const MIN_CANVAS_PAD_Y = 64;
  const canvasPadLeft = Math.max(MIN_CANVAS_PAD_X, (canvasViewport.width - frameWidth * zoom) / 2);
  const canvasPadTop = Math.max(MIN_CANVAS_PAD_Y, (canvasViewport.height - frameHeight * zoom) / 2);

  return (
    <div ref={editorRootRef} className="flex h-full flex-col overflow-hidden bg-[#f3f3f4] text-[#1d1d1f]">
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
            aria-label="Tentar de novo"
            className="flex items-center gap-2 rounded-lg border border-[#e6e6e9] bg-white px-4 py-2.5 text-[14.5px] text-[#0077ff] hover:bg-[#f7f7f8]"
          >
            <ThumbsDownIcon className="h-4 w-4" />
            Tentar de novo
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
                      centerPendingRef.current = true;
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
          <ToolButton active={activeTool === "hand"} onClick={() => setActiveTool("hand")} label="Mão (arrastar tela)">
            <HandToolIcon className="h-[18px] w-[18px]" />
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

        {/* Aba Camadas — árvore de verdade (Ajuste 4) */}
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
          <div
            className="absolute bottom-[30px] left-[52px] z-20 max-h-[420px] w-64 overflow-y-auto rounded-lg border border-[#e4e4e7] bg-white p-2 shadow-lg"
            onDragOver={(event) => {
              event.preventDefault();
              setLayerDropTargetId("root");
            }}
            onDrop={(event) => {
              event.preventDefault();
              handleLayerDrop("root");
            }}
          >
            <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93]">Camadas ({blocks.length})</p>
            {tree.map((node) => (
              <LayerRow
                key={node.block.id}
                node={node}
                depth={0}
                selectedIds={selectedIds}
                collapsedGroupIds={collapsedGroupIds}
                onToggleCollapse={(id) =>
                  setCollapsedGroupIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                onSelect={(id, shift) => (shift ? toggleSelection(id) : selectOnly(id))}
                onContextMenu={handleBlockContextMenu}
                onToggleHidden={(id) => toggleHidden(new Set([id]))}
                onToggleLocked={(id) => toggleLocked(new Set([id]))}
                draggedLayerId={draggedLayerId}
                layerDropTargetId={layerDropTargetId}
                layerDropPosition={layerDropPosition}
                onDragStartLayer={setDraggedLayerId}
                onDragOverLayer={(id, position) => {
                  setLayerDropTargetId(id);
                  setLayerDropPosition(position);
                }}
                onDropLayer={handleLayerDrop}
              />
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
            {selectedIds.size === 0 ? (
              <p className="text-sm text-[#8e8e93]">Selecione um bloco no canvas pra ver e editar suas propriedades.</p>
            ) : selectedIds.size > 1 ? (
              <div className="space-y-3">
                <p className="text-sm text-[#1d1d1f]">{selectedIds.size} blocos selecionados.</p>
                <button
                  type="button"
                  onClick={groupSelection}
                  className="w-full rounded-md bg-[#7c3aed] px-3 py-2 text-sm font-medium text-white hover:bg-[#6d28d9]"
                >
                  Agrupar seleção (Ctrl+G)
                </button>
                <div className="flex gap-1.5">
                  <PropertyActionButton label={allSelectedHidden ? "Mostrar" : "Ocultar"} onClick={() => toggleHidden(selectedIds)}>
                    {allSelectedHidden ? <EyeOffIcon className="h-4 w-4" /> : <EyeOpenIcon className="h-4 w-4" />}
                  </PropertyActionButton>
                  <PropertyActionButton label={allSelectedLocked ? "Desbloquear" : "Bloquear"} onClick={() => toggleLocked(selectedIds)}>
                    {allSelectedLocked ? <UnlockIcon className="h-4 w-4" /> : <LockIcon className="h-4 w-4" />}
                  </PropertyActionButton>
                  <PropertyActionButton label="Apagar" onClick={() => deleteBlocks(selectedIds)} danger>
                    <TrashIcon className="h-4 w-4" />
                  </PropertyActionButton>
                </div>
              </div>
            ) : !selectedBlock ? (
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
                <div className="flex gap-1.5">
                  <PropertyActionButton label={selectedBlock.hidden ? "Mostrar" : "Ocultar"} onClick={() => toggleHidden(new Set([selectedBlock.id]))}>
                    {selectedBlock.hidden ? <EyeOffIcon className="h-4 w-4" /> : <EyeOpenIcon className="h-4 w-4" />}
                  </PropertyActionButton>
                  <PropertyActionButton label={selectedBlock.locked ? "Desbloquear" : "Bloquear"} onClick={() => toggleLocked(new Set([selectedBlock.id]))}>
                    {selectedBlock.locked ? <UnlockIcon className="h-4 w-4" /> : <LockIcon className="h-4 w-4" />}
                  </PropertyActionButton>
                  {selectedBlock.kind === "GROUP" ? (
                    <PropertyActionButton label="Desagrupar" onClick={() => ungroupBlock(selectedBlock.id)}>
                      <FolderIcon className="h-4 w-4" />
                    </PropertyActionButton>
                  ) : (
                    <PropertyActionButton label="Adicionar texto" onClick={() => addTextAnnotation(selectedBlock.id)}>
                      <TextToolIcon className="h-4 w-4" />
                    </PropertyActionButton>
                  )}
                  <PropertyActionButton label="Apagar" onClick={() => deleteBlocks(new Set([selectedBlock.id]))} danger>
                    <TrashIcon className="h-4 w-4" />
                  </PropertyActionButton>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Minimapa — Ajuste 4: quando o painel de Camadas está aberto, ele
            ocupa exatamente a faixa (left-[52px], largura 256px) onde o
            minimapa ficava (left-[86px]), e por ter z-index maior cobria o
            minimapa por completo. Em vez de brigar por z-index (o que só
            deixaria um dos dois inacessível), desloca o minimapa pra depois
            da borda direita do painel aberto — os dois convivem lado a lado
            sempre, em qualquer zoom. */}
        <div
          className="absolute bottom-[30px] z-20 hidden h-[126px] w-[206px] overflow-hidden rounded-[10px] bg-white shadow-[0_1px_2px_rgba(0,0,0,.05),0_2px_10px_rgba(0,0,0,.04)] transition-[left] sm:block"
          style={{ left: layersOpen ? 324 : 86 }}
        >
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
                    opacity: block.hidden ? 0.25 : 1,
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
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            aria-pressed={isFullscreen}
            className={`grid h-10 w-10 place-items-center rounded-lg shadow-[0_1px_2px_rgba(0,0,0,.05),0_2px_10px_rgba(0,0,0,.04)] hover:bg-[#f7f7f8] ${isFullscreen ? "bg-[#f1ebfe] text-[#7c3aed]" : "bg-white text-[#1d1d1f]"}`}
          >
            {isFullscreen ? <MinimizeIcon className="h-4 w-4" /> : <MaximizeIcon className="h-4 w-4" />}
          </button>
        </div>

        {/* Canvas */}
        <div
          ref={canvasScrollRef}
          className="h-full overflow-auto"
          style={{
            cursor: activeTool === "hand" ? HAND_CURSOR : undefined,
            paddingLeft: canvasPadLeft,
            paddingRight: 32,
            paddingTop: canvasPadTop,
            paddingBottom: MIN_CANVAS_PAD_Y,
          }}
          onPointerDown={handleCanvasMouseDown}
        >
          <p className="mb-2 pl-1 text-[13.5px] text-[#4b4b52]" style={{ width: frameWidth * zoom }}>
            Desktop - {frameWidth} × {frameHeight}
          </p>
          <div
            ref={frameRef}
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
            {blocks
              .filter((b) => b.kind === "GROUP" && !b.hidden)
              .map((block) => (
                <GroupOutline key={block.id} block={block} zoom={zoom} selected={selectedIds.has(block.id)} onPointerDown={(e) => handleBlockMouseDown(e, block)} onContextMenu={(e) => handleBlockContextMenu(e, block)} />
              ))}
            {blocks
              .filter((b) => b.kind === "ELEMENT" && !b.hidden)
              .map((block) => (
                <CanvasBlock
                  key={block.id}
                  block={block}
                  zoom={zoom}
                  frameWidth={frameWidth}
                  frameHeight={frameHeight}
                  selected={selectedIds.has(block.id)}
                  onPointerDown={(event) => handleBlockMouseDown(event, block)}
                  onContextMenu={(event) => handleBlockContextMenu(event, block)}
                  onResizePointerDown={(event, direction) => handleResizeMouseDown(event, block, direction)}
                />
              ))}
          </div>
        </div>
      </div>

      {contextMenu && contextMenuBlock && (
        <div
          className="fixed z-50 w-60 overflow-hidden rounded-lg border border-[#e4e4e7] bg-white py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {contextMenuBlock.kind === "GROUP" ? (
            <button
              type="button"
              onClick={() => ungroupBlock(contextMenuBlock.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#1d1d1f] hover:bg-[#f7f7f8]"
            >
              <FolderIcon className="h-4 w-4" />
              Desagrupar
            </button>
          ) : (
            <button
              type="button"
              disabled={!canGroup}
              onClick={groupSelection}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-[#1d1d1f] hover:bg-[#f7f7f8] disabled:cursor-not-allowed disabled:text-[#b4b4b9] disabled:hover:bg-transparent"
            >
              <span className="flex items-center gap-2">
                <FolderIcon className="h-4 w-4" />
                Agrupar seleção
              </span>
              <span className="text-xs text-[#8e8e93]">Ctrl+G</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => addTextAnnotation(contextMenuBlock.id)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#1d1d1f] hover:bg-[#f7f7f8]"
          >
            <TextToolIcon className="h-4 w-4" />
            Adicionar texto
          </button>
          <button
            type="button"
            onClick={() => toggleHidden(selectedIds)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#1d1d1f] hover:bg-[#f7f7f8]"
          >
            {contextMenuBlock.hidden ? <EyeOffIcon className="h-4 w-4" /> : <EyeOpenIcon className="h-4 w-4" />}
            {contextMenuBlock.hidden ? "Mostrar" : "Ocultar"}
          </button>
          <button
            type="button"
            onClick={() => toggleLocked(selectedIds)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#1d1d1f] hover:bg-[#f7f7f8]"
          >
            {contextMenuBlock.locked ? <UnlockIcon className="h-4 w-4" /> : <LockIcon className="h-4 w-4" />}
            {contextMenuBlock.locked ? "Desbloquear" : "Bloquear"}
          </button>
          <div className="my-1 h-px bg-[#eee]" />
          <button
            type="button"
            onClick={() => deleteBlocks(selectedIds)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-luminous-error hover:bg-red-50"
          >
            <TrashIcon className="h-4 w-4" />
            Apagar
          </button>
        </div>
      )}

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

// Botão de ícone reaproveitando as ações do menu de contexto no painel de
// Propriedades (Ajuste 2): ocultar/mostrar, bloquear/desbloquear, adicionar
// texto, desagrupar, apagar.
function PropertyActionButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex flex-1 items-center justify-center rounded-md border border-[#e4e4e7] py-1.5 ${
        danger ? "text-luminous-error hover:bg-red-50" : "text-[#1d1d1f] hover:bg-[#f7f7f8]"
      }`}
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

// --- Árvore de Camadas (Ajuste 4) ---

type LayerDropPosition = "before" | "after" | "inside";

// Calcula se o drop deve reordenar (antes/depois, entre irmãos) ou
// reparentar (dentro, só quando o alvo é um GROUP) com base em onde
// exatamente o ponteiro está dentro da linha (Ajuste 3, item 5): terço de
// cima = "before", terço de baixo = "after", terço do meio = "inside" (só
// se o alvo puder ter filhos — senão vira "before"/"after" pelo ponto médio).
function computeDropPosition(event: { clientY: number }, rect: DOMRect, canGoInside: boolean): LayerDropPosition {
  const ratio = (event.clientY - rect.top) / rect.height;
  if (!canGoInside) return ratio < 0.5 ? "before" : "after";
  if (ratio < 0.25) return "before";
  if (ratio > 0.75) return "after";
  return "inside";
}

function LayerRow({
  node,
  depth,
  selectedIds,
  collapsedGroupIds,
  onToggleCollapse,
  onSelect,
  onContextMenu,
  onToggleHidden,
  onToggleLocked,
  draggedLayerId,
  layerDropTargetId,
  layerDropPosition,
  onDragStartLayer,
  onDragOverLayer,
  onDropLayer,
}: {
  node: TreeNode;
  depth: number;
  selectedIds: Set<string>;
  collapsedGroupIds: Set<string>;
  onToggleCollapse: (id: string) => void;
  onSelect: (id: string, shift: boolean) => void;
  onContextMenu: (event: ReactMouseEvent, block: WireframeBlock) => void;
  onToggleHidden: (id: string) => void;
  onToggleLocked: (id: string) => void;
  draggedLayerId: string | null;
  layerDropTargetId: string | null | "root";
  layerDropPosition: LayerDropPosition;
  onDragStartLayer: (id: string) => void;
  onDragOverLayer: (id: string | null | "root", position: LayerDropPosition) => void;
  onDropLayer: (id: string | "root", position: LayerDropPosition) => void;
}) {
  const { block, children } = node;
  const isGroup = block.kind === "GROUP";
  const isCollapsed = collapsedGroupIds.has(block.id);
  const isSelected = selectedIds.has(block.id);
  const isDropTarget = layerDropTargetId === block.id && draggedLayerId !== block.id;
  const isTextLike = TEXT_LABEL_PATTERN.test(block.label);
  const Icon = isGroup ? FolderIcon : isTextLike ? TextToolIcon : FrameToolIcon;

  const dropClass = !isDropTarget
    ? ""
    : layerDropPosition === "before"
      ? "shadow-[inset_0_2px_0_0_#7c3aed]"
      : layerDropPosition === "after"
        ? "shadow-[inset_0_-2px_0_0_#7c3aed]"
        : "outline outline-2 outline-[#7c3aed]";

  return (
    <div>
      <div
        draggable
        onDragStart={(event) => {
          event.stopPropagation();
          onDragStartLayer(block.id);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          onDragOverLayer(block.id, computeDropPosition(event, rect, isGroup));
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          onDropLayer(block.id, computeDropPosition(event, rect, isGroup));
        }}
        onClick={(event) => onSelect(block.id, event.shiftKey)}
        onContextMenu={(event) => onContextMenu(event, block)}
        style={{ paddingLeft: 8 + depth * 16 }}
        className={`flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1.5 pr-1.5 text-left text-sm ${
          isSelected ? "bg-[#f1ebfe] text-[#7c3aed]" : "text-[#1d1d1f] hover:bg-[#f7f7f8]"
        } ${dropClass}`}
      >
        {isGroup ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleCollapse(block.id);
            }}
            className="shrink-0 text-[#8e8e93] hover:text-[#1d1d1f]"
          >
            <ChevronDownIcon className={`h-3 w-3 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className={`min-w-0 flex-1 truncate ${block.hidden ? "text-[#b4b4b9]" : ""}`}>{block.label}</span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleHidden(block.id);
          }}
          aria-label={block.hidden ? "Mostrar" : "Ocultar"}
          title={block.hidden ? "Mostrar" : "Ocultar"}
          className="shrink-0 text-[#8e8e93] hover:text-[#1d1d1f]"
        >
          {block.hidden ? <EyeOffIcon className="h-3.5 w-3.5" /> : <EyeOpenIcon className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleLocked(block.id);
          }}
          aria-label={block.locked ? "Desbloquear" : "Bloquear"}
          title={block.locked ? "Desbloquear" : "Bloquear"}
          className={`shrink-0 hover:text-[#1d1d1f] ${block.locked ? "text-[#7c3aed]" : "text-[#8e8e93]"}`}
        >
          {block.locked ? <LockIcon className="h-3.5 w-3.5" /> : <UnlockIcon className="h-3.5 w-3.5" />}
        </button>
      </div>
      {isGroup && !isCollapsed && children.length > 0 && (
        <div>
          {children.map((child) => (
            <LayerRow
              key={child.block.id}
              node={child}
              depth={depth + 1}
              selectedIds={selectedIds}
              collapsedGroupIds={collapsedGroupIds}
              onToggleCollapse={onToggleCollapse}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              onToggleHidden={onToggleHidden}
              onToggleLocked={onToggleLocked}
              draggedLayerId={draggedLayerId}
              layerDropTargetId={layerDropTargetId}
              layerDropPosition={layerDropPosition}
              onDragStartLayer={onDragStartLayer}
              onDragOverLayer={onDragOverLayer}
              onDropLayer={onDropLayer}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Contorno visual de um GROUP no canvas: pointer-events-none no retângulo
// (deixa os cliques passarem pros filhos por cima), só a etiqueta do nome no
// canto é clicável/arrastável pra selecionar/mover o grupo inteiro. ---
function GroupOutline({
  block,
  zoom,
  selected,
  onPointerDown,
  onContextMenu,
}: {
  block: WireframeBlock;
  zoom: number;
  selected: boolean;
  onPointerDown: (event: ReactPointerEvent) => void;
  onContextMenu: (event: ReactMouseEvent) => void;
}) {
  return (
    <div
      className="absolute"
      style={{ left: block.x * zoom, top: block.y * zoom, width: block.width * zoom, height: block.height * zoom }}
    >
      <div className={`pointer-events-none h-full w-full rounded-sm border-2 border-dashed ${selected ? "border-[#7c3aed]" : "border-[#c4b5fd]"}`} />
      <span
        onPointerDown={onPointerDown}
        onContextMenu={onContextMenu}
        className="absolute -top-6 left-0 cursor-move whitespace-nowrap rounded bg-[#7c3aed] px-1.5 py-0.5 text-[10px] font-medium text-white"
      >
        {block.locked && <LockIcon className="mr-1 inline h-2.5 w-2.5" />}
        {block.label}
      </span>
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
  onPointerDown,
  onContextMenu,
  onResizePointerDown,
}: {
  block: WireframeBlock;
  zoom: number;
  frameWidth: number;
  frameHeight: number;
  selected: boolean;
  onPointerDown: (event: ReactPointerEvent) => void;
  onContextMenu: (event: ReactMouseEvent) => void;
  onResizePointerDown: (event: ReactPointerEvent, direction: ResizeDirection) => void;
}) {
  // Guias de medição pontilhadas: comprimento exato até a borda do frame em
  // cada direção (não um valor arbitrário), pra nunca transbordar o canvas.
  const topExtent = block.y * zoom;
  const bottomExtent = (frameHeight - block.y - block.height) * zoom;
  const leftExtent = block.x * zoom;
  const rightExtent = (frameWidth - block.x - block.width) * zoom;

  return (
    <div
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      className={`absolute border bg-white ${block.locked ? "cursor-default" : "cursor-move"} ${selected ? "border-[#3b82f6]" : "border-[#dcdce0] hover:border-[#b4b4b9]"}`}
      style={{ left: block.x * zoom, top: block.y * zoom, width: block.width * zoom, height: block.height * zoom }}
    >
      <span className="pointer-events-none flex items-center gap-1 truncate px-2 py-1.5 text-[12px] font-medium text-[#333336]">
        {block.locked && <LockIcon className="h-3 w-3 shrink-0 text-[#7c3aed]" />}
        {block.label}
      </span>

      {selected && !block.locked && (
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
              onPointerDown={(event) => onResizePointerDown(event, handle.direction)}
              style={{ cursor: handle.cursor }}
              className={`absolute h-2.5 w-2.5 rounded-full border border-[#3b82f6] bg-white ${handle.className}`}
            />
          ))}
        </>
      )}
      {selected && block.locked && (
        <div className="pointer-events-none absolute inset-0 rounded-[1px] ring-2 ring-[#7c3aed]" />
      )}
    </div>
  );
}
