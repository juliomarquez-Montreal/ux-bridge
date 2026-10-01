import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { Resvg } from "@resvg/resvg-js";

const PAGE_WIDTH = 595.28; // A4 retrato, em pontos
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Quebra um texto em linhas que cabem em `maxWidth`, preservando quebras de
// linha já existentes no texto original (parágrafos) — pdf-lib não faz
// word-wrap sozinho, então isso precisa ser calculado manualmente a partir
// da largura real de cada palavra na fonte escolhida.
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

export interface BridgePdfInput {
  planetName: string;
  generatedBddPbi: string | null;
  bddApprovedAt: string | null;
  // SVG já renderizado (lib/bridges/wireframeSvg.ts) — null se o Wireframe
  // ainda nem foi gerado (ex: BDD aprovado, Wireframe ainda gerando/com erro).
  wireframeSvg: string | null;
  // true quando o Wireframe ainda não foi aprovado pelo UX (status !==
  // FINALIZADO) — rotula a seção como "Rascunho" em vez de esconder o
  // conteúdo (o PO/UX pode compartilhar o estado atual mesmo inacabado).
  wireframeIsDraft: boolean;
}

// Gera um PDF único combinando o BDD/PBI aprovado + uma imagem do estado
// atual do Wireframe (rasteriza o SVG via resvg, já que pdf-lib só embute
// PNG/JPEG, não SVG). Usado tanto pelo ícone de download em /bridges quanto
// reaproveitável por qualquer outra tela que precise do mesmo PDF.
export async function generateBridgePdf(input: BridgePdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function ensureSpace(lineHeight: number) {
    if (y - lineHeight < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  function drawHeading(text: string) {
    ensureSpace(28);
    page.drawText(text, { x: MARGIN, y, size: 16, font: boldFont, color: rgb(0.08, 0.08, 0.09) });
    y -= 28;
  }

  function drawParagraphLines(lines: string[], size: number, lineHeight: number, useFont: PDFFont) {
    for (const line of lines) {
      ensureSpace(lineHeight);
      if (line) page.drawText(line, { x: MARGIN, y, size, font: useFont, color: rgb(0.2, 0.2, 0.22) });
      y -= lineHeight;
    }
  }

  drawHeading(input.planetName);
  y -= 6;

  if (input.generatedBddPbi && input.bddApprovedAt) {
    drawHeading("Bridge Spec (BS) aprovado");
    const lines = wrapText(input.generatedBddPbi, font, 10.5, CONTENT_WIDTH);
    drawParagraphLines(lines, 10.5, 14, font);
    y -= 16;
  }

  if (input.wireframeSvg) {
    drawHeading(input.wireframeIsDraft ? "Wireframe (Rascunho — ainda em revisão)" : "Wireframe");

    const png = new Resvg(input.wireframeSvg, { fitTo: { mode: "width", value: 1600 }, background: "#ffffff" }).render().asPng();
    const pngImage = await pdfDoc.embedPng(png);
    const scale = Math.min(1, CONTENT_WIDTH / pngImage.width);
    const drawWidth = pngImage.width * scale;
    const drawHeight = pngImage.height * scale;

    ensureSpace(drawHeight);
    page.drawRectangle({ x: MARGIN, y: y - drawHeight, width: drawWidth, height: drawHeight, borderColor: rgb(0.86, 0.86, 0.88), borderWidth: 1 });
    page.drawImage(pngImage, { x: MARGIN, y: y - drawHeight, width: drawWidth, height: drawHeight });
    y -= drawHeight + 16;
  } else {
    drawHeading("Wireframe");
    drawParagraphLines(["Wireframe ainda não gerado."], 10.5, 14, font);
  }

  return pdfDoc.save();
}
