import type { WireframeBlock } from "@/app/bridges/types";

export interface WireframeSvgAnnotation {
  pathData: string;
  color: string;
  hidden: boolean;
}

export interface WireframeSvgInput {
  frameWidth: number;
  frameHeight: number;
  blocks: WireframeBlock[];
  annotations: WireframeSvgAnnotation[];
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// Gera o SVG final de entrega (Wireframe-2, botão "Aprovar e Exportar") — a
// mesma aparência visual do editor (caixa cinza/contorno tracejado pra
// GROUP, sem preenchimento pra shape="text", elipse pra shape="ellipse"),
// mas como ENTREGA LIMPA: sem pinos de comentário (nem recebidos como
// parâmetro), sem guias/alças de seleção, sem nada que só existe como UI do
// editor. Blocos e anotações com hidden=true não entram — "oculto" no editor
// significa "não faz parte do resultado final", não só "escondido da vista".
export function renderWireframeSvg(input: WireframeSvgInput): string {
  const { frameWidth, frameHeight, blocks, annotations } = input;
  const groups = blocks.filter((b) => b.kind === "GROUP" && !b.hidden);
  const elements = blocks.filter((b) => b.kind === "ELEMENT" && !b.hidden);
  const visibleAnnotations = annotations.filter((a) => !a.hidden);

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${frameWidth}" height="${frameHeight}" viewBox="0 0 ${frameWidth} ${frameHeight}" font-family="Arial, Helvetica, sans-serif">`
  );
  parts.push(`<rect x="0" y="0" width="${frameWidth}" height="${frameHeight}" fill="#ffffff" />`);

  for (const group of groups) {
    parts.push(
      `<rect x="${group.x}" y="${group.y}" width="${group.width}" height="${group.height}" fill="none" stroke="#c4b5fd" stroke-width="2" stroke-dasharray="5 4" />`
    );
    const label = group.label.trim();
    if (label) {
      const labelWidth = Math.max(36, label.length * 6.2 + 14);
      parts.push(`<rect x="${group.x}" y="${group.y - 20}" width="${labelWidth}" height="17" rx="3" fill="#7c3aed" />`);
      parts.push(
        `<text x="${group.x + 7}" y="${group.y - 11}" font-size="10" font-weight="600" fill="#ffffff" dominant-baseline="middle">${escapeXml(label)}</text>`
      );
    }
  }

  for (const block of elements) {
    if (block.shape === "ellipse") {
      const cx = block.x + block.width / 2;
      const cy = block.y + block.height / 2;
      parts.push(
        `<ellipse cx="${cx}" cy="${cy}" rx="${block.width / 2}" ry="${block.height / 2}" fill="#ffffff" stroke="#dcdce0" stroke-width="1" />`
      );
    } else if (block.shape !== "text") {
      parts.push(`<rect x="${block.x}" y="${block.y}" width="${block.width}" height="${block.height}" fill="#ffffff" stroke="#dcdce0" stroke-width="1" />`);
    }
    const label = block.label.trim();
    if (label) {
      const textX = block.x + 8;
      const textY = block.y + block.height / 2;
      parts.push(
        `<text x="${textX}" y="${textY}" font-size="12" font-weight="500" fill="#333336" dominant-baseline="middle">${escapeXml(label)}</text>`
      );
    }
  }

  for (const annotation of visibleAnnotations) {
    parts.push(
      `<path d="${annotation.pathData}" fill="none" stroke="${escapeXml(annotation.color)}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`
    );
  }

  parts.push(`</svg>`);
  return parts.join("\n");
}
