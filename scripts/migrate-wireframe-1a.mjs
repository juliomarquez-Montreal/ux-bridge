// Migração ÚNICA da Wireframe-1a — roda depois que o código novo já está no
// ar em produção (mesmo banco compartilhado entre dev/prod, ver .env), pra
// nunca haver uma janela em que o código ANTIGO (ainda no ar) veja um status
// novo que ele não entende.
//
// 1. Backfill: poUserId = createdById em todo Bridge que ainda não tem.
// 2. Converte sketchData (formato antigo de hints) -> wireframeData (pixels
//    absolutos), reaproveitando a MESMA lógica geométrica de
//    lib/bridges/wireframeLayout.ts (duplicada aqui em JS puro só porque
//    este é um script standalone fora do pipeline do Next/TS — script de
//    uso único, não faz sentido montar um bundler só pra isso).
// 3. Remapeia o status dos Bridges que ainda estavam no fluxo antigo de
//    Sketch pro equivalente novo.
// 4. Renomeia os MemoryPattern SKETCH_LAYOUT_CORRECTION -> WIREFRAME_LAYOUT_CORRECTION.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const FRAME_WIDTH = 1440;
const FRAME_HEIGHT = 1024;
const HEADER_HEIGHT = 64;
const SIDEBAR_WIDTH = 240;
const FOOTER_HEIGHT = 48;
const GAP = 16;
const PADDING = 24;
const COMPACT_ROW_HEIGHT = 56;
const AUTO_BLOCK_WIDTH = 160;
const MIN_FILL_HEIGHT = 80;
const MIN_FILL_WIDTH = 80;

let idCounter = 0;
function makeBlockId() {
  idCounter += 1;
  return `wf-migrated-${Date.now()}-${idCounter}`;
}

function layoutRow(blocks, x, y, width, height, out) {
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
    });
    cursorX += blockWidth + GAP;
  }
}

function layoutColumn(blocks, x, y, width, height, out) {
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
    });
    cursorY += blockHeight + GAP;
  }
}

function computeWireframeLayout(blocks) {
  const header = blocks.filter((b) => b.zone === "header");
  const sidebar = blocks.filter((b) => b.zone === "sidebar");
  const footer = blocks.filter((b) => b.zone === "footer");
  const content = blocks.filter((b) => b.zone === "content");

  const headerH = header.length > 0 ? HEADER_HEIGHT : 0;
  const footerH = footer.length > 0 ? FOOTER_HEIGHT : 0;
  const sidebarW = sidebar.length > 0 ? SIDEBAR_WIDTH : 0;

  const out = [];
  layoutRow(header, 0, 0, FRAME_WIDTH, headerH, out);

  const contentAreaY = headerH;
  const contentAreaHeight = FRAME_HEIGHT - headerH - footerH;
  const contentAreaX = sidebarW;
  const contentAreaWidth = FRAME_WIDTH - sidebarW;

  layoutColumn(sidebar, 0, contentAreaY, sidebarW, contentAreaHeight, out);

  const rowsMap = new Map();
  for (const block of content) {
    const arr = rowsMap.get(block.row) ?? [];
    arr.push(block);
    rowsMap.set(block.row, arr);
  }
  const rowKeys = Array.from(rowsMap.keys()).sort((a, b) => a - b);
  const fillRowCount = rowKeys.filter((key) => rowsMap.get(key).some((b) => b.heightHint === "fill")).length;
  const compactRowCount = rowKeys.length - fillRowCount;
  const totalGaps = Math.max(0, rowKeys.length - 1) * GAP;
  const availableHeight = contentAreaHeight - PADDING * 2 - totalGaps - compactRowCount * COMPACT_ROW_HEIGHT;
  const fillRowHeight = fillRowCount > 0 ? Math.max(MIN_FILL_HEIGHT, availableHeight / fillRowCount) : 0;

  let cursorY = contentAreaY + PADDING;
  for (const rowKey of rowKeys) {
    const rowBlocks = rowsMap.get(rowKey);
    const isFillRow = rowBlocks.some((b) => b.heightHint === "fill");
    const rowHeight = isFillRow ? fillRowHeight : COMPACT_ROW_HEIGHT;
    layoutRow(rowBlocks, contentAreaX + PADDING, cursorY, contentAreaWidth - PADDING * 2, rowHeight, out);
    cursorY += rowHeight + GAP;
  }

  layoutRow(footer, 0, FRAME_HEIGHT - footerH, FRAME_WIDTH, footerH, out);

  return { frameWidth: FRAME_WIDTH, frameHeight: FRAME_HEIGHT, blocks: out };
}

const STATUS_MAP = {
  GERANDO_SKETCH: "GERANDO_WIREFRAME",
  AGUARDANDO_APROVACAO_SKETCH: "AGUARDANDO_APROVACAO_WIREFRAME_PO",
  AGUARDANDO_WIREFRAME: "AGUARDANDO_APROVACAO_UX",
};

async function main() {
  const bridges = await db.bridge.findMany();
  let poBackfilled = 0;
  let wireframeConverted = 0;
  let statusRemapped = 0;

  for (const bridge of bridges) {
    const data = {};

    if (!bridge.poUserId) {
      data.poUserId = bridge.createdById;
      poBackfilled += 1;
    }

    if (!bridge.wireframeData && bridge.sketchData?.blocks?.length) {
      data.wireframeData = computeWireframeLayout(bridge.sketchData.blocks);
      wireframeConverted += 1;
    }

    if (STATUS_MAP[bridge.status]) {
      data.status = STATUS_MAP[bridge.status];
      statusRemapped += 1;
    }

    if (Object.keys(data).length > 0) {
      await db.bridge.update({ where: { id: bridge.id }, data });
      console.log(`Bridge ${bridge.id} (${bridge.status} -> ${data.status ?? bridge.status}):`, Object.keys(data));
    }
  }

  const patternsRenamed = await db.memoryPattern.updateMany({
    where: { patternType: "SKETCH_LAYOUT_CORRECTION" },
    data: { patternType: "WIREFRAME_LAYOUT_CORRECTION" },
  });

  console.log(
    JSON.stringify(
      { totalBridges: bridges.length, poBackfilled, wireframeConverted, statusRemapped, patternsRenamed: patternsRenamed.count },
      null,
      2
    )
  );
  await db.$disconnect();
}

main();
