import type { WireframeBlock, WireframeData, WireframeZone, WireframeWidthHint, WireframeHeightHint } from "@/app/bridges/types";

// Converte o modelo de "hints" que a IA gera (zone/row/order/widthHint/
// heightHint — o mesmo modelo genérico já usado no antigo Sketch, Bridge-3a)
// em posições/tamanhos absolutos em pixels dentro de um frame fixo, uma
// única vez, logo depois da geração (ver runWireframeGeneration). A partir
// daí o PO edita livremente x/y/width/height no canvas — zone/row/order/
// widthHint/heightHint ficam congelados como metadado (usados só pro
// aprendizado de MemoryPattern), não são recalculados nunca mais.
export const WIREFRAME_FRAME_WIDTH = 1440;
export const WIREFRAME_FRAME_HEIGHT = 1024;

const HEADER_HEIGHT = 64;
const SIDEBAR_WIDTH = 240;
const FOOTER_HEIGHT = 48;
const GAP = 16;
const PADDING = 24;
const COMPACT_ROW_HEIGHT = 56;
const AUTO_BLOCK_WIDTH = 160;
const MIN_FILL_HEIGHT = 80;
const MIN_FILL_WIDTH = 80;

interface HintBlock {
  label: string;
  zone: WireframeZone;
  row: number;
  order: number;
  widthHint: WireframeWidthHint;
  heightHint: WireframeHeightHint;
}

function makeBlockId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `w${Math.random().toString(36).slice(2)}`;
}

function layoutRow(blocks: HintBlock[], x: number, y: number, width: number, height: number, out: WireframeBlock[]): void {
  const sorted = [...blocks].sort((a, b) => a.order - b.order);
  if (sorted.length === 0) return;
  const gaps = Math.max(0, sorted.length - 1) * GAP;
  const autoCount = sorted.filter((b) => b.widthHint === "auto").length;
  const fillCount = sorted.length - autoCount;
  const autoWidth = Math.min(AUTO_BLOCK_WIDTH, Math.max(40, (width - gaps) / sorted.length));
  const remainingForFill = width - gaps - autoCount * autoWidth;
  const fillWidth = fillCount > 0 ? Math.max(MIN_FILL_WIDTH, remainingForFill / fillCount) : 0;

  let cursorX = x;
  for (const block of sorted) {
    const blockWidth = block.widthHint === "auto" ? autoWidth : fillWidth;
    out.push({
      id: makeBlockId(),
      label: block.label,
      zone: block.zone,
      row: block.row,
      order: block.order,
      widthHint: block.widthHint,
      heightHint: block.heightHint,
      x: Math.round(cursorX),
      y: Math.round(y),
      width: Math.round(blockWidth),
      height: Math.round(height),
      parentBlockId: null,
      kind: "ELEMENT",
      siblingOrder: out.length,
      hidden: false,
      locked: false,
      shape: "rectangle",
    });
    cursorX += blockWidth + GAP;
  }
}

function layoutColumn(blocks: HintBlock[], x: number, y: number, width: number, height: number, out: WireframeBlock[]): void {
  const sorted = [...blocks].sort((a, b) => a.order - b.order);
  if (sorted.length === 0) return;
  const gaps = Math.max(0, sorted.length - 1) * GAP;
  const compactCount = sorted.filter((b) => b.heightHint !== "fill").length;
  const fillCount = sorted.length - compactCount;
  const remainingForFill = height - gaps - compactCount * COMPACT_ROW_HEIGHT;
  const fillHeight = fillCount > 0 ? Math.max(MIN_FILL_HEIGHT, remainingForFill / fillCount) : 0;

  let cursorY = y;
  for (const block of sorted) {
    const blockHeight = block.heightHint === "fill" ? fillHeight : COMPACT_ROW_HEIGHT;
    out.push({
      id: makeBlockId(),
      label: block.label,
      zone: block.zone,
      row: block.row,
      order: block.order,
      widthHint: block.widthHint,
      heightHint: block.heightHint,
      x: Math.round(x),
      y: Math.round(cursorY),
      width: Math.round(width),
      height: Math.round(blockHeight),
      parentBlockId: null,
      kind: "ELEMENT",
      siblingOrder: out.length,
      hidden: false,
      locked: false,
      shape: "rectangle",
    });
    cursorY += blockHeight + GAP;
  }
}

const WIREFRAME_ZONES = ["header", "sidebar", "footer", "content"] as const;
const WIREFRAME_WIDTH_HINTS = ["fill", "auto"] as const;
const WIREFRAME_HEIGHT_HINTS = ["compact", "fill"] as const;

// Extrai e valida uma lista de WireframeBlock completos (com id/x/y/width/
// height) a partir do corpo enviado pelo editor manual (drag/resize/rename
// no canvas) — ver app/api/bridges/[id]/wireframe-edit/route.ts. Diferente
// de normalizeWireframeHintBlocks (lib/bridges/generate.ts), que só valida o
// formato de hints que a IA gera (sem posição em pixels).
export function normalizeWireframeBlocks(blocksRaw: unknown): WireframeBlock[] {
  if (!Array.isArray(blocksRaw) || blocksRaw.length === 0) {
    throw new Error("O wireframe precisa ter pelo menos um bloco.");
  }

  const normalized = blocksRaw.map((item, index) => {
    const raw = item as {
      id?: unknown;
      label?: unknown;
      zone?: unknown;
      row?: unknown;
      order?: unknown;
      widthHint?: unknown;
      heightHint?: unknown;
      x?: unknown;
      y?: unknown;
      width?: unknown;
      height?: unknown;
      parentBlockId?: unknown;
      kind?: unknown;
      siblingOrder?: unknown;
      hidden?: unknown;
      locked?: unknown;
      shape?: unknown;
    };
    const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : makeBlockId();
    const label = typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : "Componente";
    const zone = WIREFRAME_ZONES.includes(raw.zone as (typeof WIREFRAME_ZONES)[number])
      ? (raw.zone as (typeof WIREFRAME_ZONES)[number])
      : "content";
    const row = typeof raw.row === "number" && Number.isFinite(raw.row) ? raw.row : 0;
    const order = typeof raw.order === "number" && Number.isFinite(raw.order) ? raw.order : 0;
    const widthHint = WIREFRAME_WIDTH_HINTS.includes(raw.widthHint as (typeof WIREFRAME_WIDTH_HINTS)[number])
      ? (raw.widthHint as (typeof WIREFRAME_WIDTH_HINTS)[number])
      : "fill";
    const heightHint = WIREFRAME_HEIGHT_HINTS.includes(raw.heightHint as (typeof WIREFRAME_HEIGHT_HINTS)[number])
      ? (raw.heightHint as (typeof WIREFRAME_HEIGHT_HINTS)[number])
      : "compact";
    const x = typeof raw.x === "number" && Number.isFinite(raw.x) ? raw.x : 0;
    const y = typeof raw.y === "number" && Number.isFinite(raw.y) ? raw.y : 0;
    const width = typeof raw.width === "number" && Number.isFinite(raw.width) && raw.width > 0 ? raw.width : 40;
    const height = typeof raw.height === "number" && Number.isFinite(raw.height) && raw.height > 0 ? raw.height : 24;
    const parentBlockId = typeof raw.parentBlockId === "string" && raw.parentBlockId.trim() ? raw.parentBlockId.trim() : null;
    const kind = raw.kind === "GROUP" ? "GROUP" : "ELEMENT";
    const siblingOrder = typeof raw.siblingOrder === "number" && Number.isFinite(raw.siblingOrder) ? raw.siblingOrder : index;
    const hidden = raw.hidden === true;
    const locked = raw.locked === true;
    const shape = raw.shape === "ellipse" || raw.shape === "text" ? raw.shape : "rectangle";

    return { id, label, zone, row, order, widthHint, heightHint, x, y, width, height, parentBlockId, kind, siblingOrder, hidden, locked, shape } as WireframeBlock;
  });

  // Nunca deixa um parentBlockId apontar pra um id que não existe nesta
  // mesma lista (bloco removido, payload malformado etc.) — cai pra
  // nível raiz em vez de sumir da árvore de Camadas silenciosamente.
  const validIds = new Set(normalized.map((b) => b.id));
  for (const block of normalized) {
    if (block.parentBlockId && !validIds.has(block.parentBlockId)) block.parentBlockId = null;
  }

  return normalized;
}

// Recebe os blocos no formato de hints (já normalizados — ver
// normalizeWireframeHintBlocks) e devolve o WireframeData completo, pronto
// pra salvar em Bridge.wireframeData e renderizar no WireframeEditor/canvas.
export function computeWireframeLayout(blocks: HintBlock[]): WireframeData {
  const header = blocks.filter((b) => b.zone === "header");
  const sidebar = blocks.filter((b) => b.zone === "sidebar");
  const footer = blocks.filter((b) => b.zone === "footer");
  const content = blocks.filter((b) => b.zone === "content");

  const headerH = header.length > 0 ? HEADER_HEIGHT : 0;
  const footerH = footer.length > 0 ? FOOTER_HEIGHT : 0;
  const sidebarW = sidebar.length > 0 ? SIDEBAR_WIDTH : 0;

  const out: WireframeBlock[] = [];

  layoutRow(header, 0, 0, WIREFRAME_FRAME_WIDTH, headerH, out);

  const contentAreaY = headerH;
  const contentAreaHeight = WIREFRAME_FRAME_HEIGHT - headerH - footerH;
  const contentAreaX = sidebarW;
  const contentAreaWidth = WIREFRAME_FRAME_WIDTH - sidebarW;

  layoutColumn(sidebar, 0, contentAreaY, sidebarW, contentAreaHeight, out);

  const rowsMap = new Map<number, HintBlock[]>();
  for (const block of content) {
    const arr = rowsMap.get(block.row) ?? [];
    arr.push(block);
    rowsMap.set(block.row, arr);
  }
  const rowKeys = Array.from(rowsMap.keys()).sort((a, b) => a - b);
  const fillRowCount = rowKeys.filter((key) => rowsMap.get(key)!.some((b) => b.heightHint === "fill")).length;
  const compactRowCount = rowKeys.length - fillRowCount;
  const totalGaps = Math.max(0, rowKeys.length - 1) * GAP;
  const availableHeight = contentAreaHeight - PADDING * 2 - totalGaps - compactRowCount * COMPACT_ROW_HEIGHT;
  const fillRowHeight = fillRowCount > 0 ? Math.max(MIN_FILL_HEIGHT, availableHeight / fillRowCount) : 0;

  let cursorY = contentAreaY + PADDING;
  for (const rowKey of rowKeys) {
    const rowBlocks = rowsMap.get(rowKey)!;
    const isFillRow = rowBlocks.some((b) => b.heightHint === "fill");
    const rowHeight = isFillRow ? fillRowHeight : COMPACT_ROW_HEIGHT;
    layoutRow(rowBlocks, contentAreaX + PADDING, cursorY, contentAreaWidth - PADDING * 2, rowHeight, out);
    cursorY += rowHeight + GAP;
  }

  layoutRow(footer, 0, WIREFRAME_FRAME_HEIGHT - footerH, WIREFRAME_FRAME_WIDTH, footerH, out);

  return { frameWidth: WIREFRAME_FRAME_WIDTH, frameHeight: WIREFRAME_FRAME_HEIGHT, blocks: out };
}
