import type { SketchBlock, SketchData } from "@/app/bridges/types";

// Renderiza o sketch estrutural gerado pela IA (Bridge-3a) como um layout 2D
// de verdade — não uma lista vertical, nem um vocabulário fixo de "tipos de
// linha" (isso variava por tela). Só 4 zonas estruturais universais: header
// (topo, largura total), sidebar (coluna estreita à esquerda, altura
// total), footer (base, largura total) e content (tudo o mais). Dentro de
// content, cada bloco tem "row" (linha vertical) e "order" (posição
// horizontal na linha) livremente decididos pela IA — sem limite de linhas
// nem nomes fixos — e "widthHint"/"heightHint" controlam a proporção visual
// (um controle compacto vs. o conteúdo principal, que deve dominar o
// espaço). Caixas cinzas sem estilo de design system, cada uma com uma seta
// vermelha + label vermelho embaixo — estilo educativo de pré-visualização.

// Altura de uma caixa "heightHint: fill" — bem maior que a compacta (h-14 =
// 56px), pra deixar claro que domina o espaço vertical (fins educativos: o
// PO precisa reconhecer que uma tabela/gráfico não tem a altura de um botão).
const FILL_MIN_HEIGHT = "min-h-56";

function BlockContent({ block }: { block: SketchBlock }) {
  return (
    <>
      <div
        className={`w-full rounded-md border-2 border-dashed border-white/25 bg-white/5 ${
          block.heightHint === "fill" ? `flex-1 ${FILL_MIN_HEIGHT}` : "h-14 shrink-0"
        }`}
      />
      <div className="flex items-start justify-center gap-1 text-center text-red-400">
        <span aria-hidden className="leading-none">↑</span>
        <span className="font-mono text-[10px] leading-snug">{block.label}</span>
      </div>
    </>
  );
}

// Linha horizontal de blocos — ordenados por "order" (0 = mais à esquerda).
// "fill" divide a largura restante entre si; "auto" fica com largura
// compacta fixa, do tamanho típico de um botão/dropdown pequeno.
function Row({ blocks }: { blocks: SketchBlock[] }) {
  const sorted = [...blocks].sort((a, b) => a.order - b.order);
  const hasFillHeight = sorted.some((block) => block.heightHint === "fill");
  return (
    <div className={`flex items-stretch gap-3 ${hasFillHeight ? "h-full" : ""}`}>
      {sorted.map((block, index) => (
        <div
          key={index}
          className={`flex flex-col gap-1.5 ${block.widthHint === "fill" ? "flex-1" : "w-40 shrink-0"} ${
            block.heightHint === "fill" ? "h-full" : ""
          }`}
        >
          <BlockContent block={block} />
        </div>
      ))}
    </div>
  );
}

// Coluna vertical de blocos (sidebar) — ordenados por "order" (0 = mais
// acima). "fill" estica pra dividir a altura total disponível.
function Column({ blocks }: { blocks: SketchBlock[] }) {
  const sorted = [...blocks].sort((a, b) => a.order - b.order);
  return (
    <div className="flex h-full flex-col gap-3">
      {sorted.map((block, index) => (
        <div key={index} className={`flex flex-col gap-1.5 ${block.heightHint === "fill" ? "flex-1" : "shrink-0"}`}>
          <BlockContent block={block} />
        </div>
      ))}
    </div>
  );
}

export default function SketchPreview({ sketchData }: { sketchData: SketchData | null }) {
  const blocks = Array.isArray(sketchData?.blocks) ? sketchData.blocks : [];

  if (blocks.length === 0) {
    return <p className="text-sm text-luminous-on-surface-variant">Sketch sem blocos.</p>;
  }

  const header = blocks.filter((block) => block.zone === "header");
  const sidebar = blocks.filter((block) => block.zone === "sidebar");
  const footer = blocks.filter((block) => block.zone === "footer");
  const content = blocks.filter((block) => block.zone !== "header" && block.zone !== "sidebar" && block.zone !== "footer");

  const hasHeader = header.length > 0;
  const hasSidebar = sidebar.length > 0;
  const hasFooter = footer.length > 0;

  const contentByRow = new Map<number, SketchBlock[]>();
  for (const block of content) {
    const rowBlocks = contentByRow.get(block.row) ?? [];
    rowBlocks.push(block);
    contentByRow.set(block.row, rowBlocks);
  }
  const rowKeys = Array.from(contentByRow.keys()).sort((a, b) => a - b);
  // Só reserva uma altura mínima pro miolo (sidebar + content) quando tem
  // alguma linha "fill" de verdade pra crescer — senão deixa a altura
  // natural do conteúdo, sem espaço vazio sobrando embaixo à toa.
  const hasAnyFillRow = rowKeys.some((rowKey) => contentByRow.get(rowKey)!.some((block) => block.heightHint === "fill"));

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-5">
      {hasHeader && (
        <div className="mb-3">
          <Row blocks={header} />
        </div>
      )}

      <div className="flex gap-4" style={hasAnyFillRow ? { minHeight: "480px" } : undefined}>
        {hasSidebar && (
          <div className="w-[200px] shrink-0">
            <Column blocks={sidebar} />
          </div>
        )}

        <div className="flex flex-1 flex-col gap-3">
          {rowKeys.length === 0 ? (
            <p className="text-sm text-luminous-on-surface-variant">Sketch sem blocos de conteúdo.</p>
          ) : (
            rowKeys.map((rowKey) => {
              const rowBlocks = contentByRow.get(rowKey)!;
              const isFillRow = rowBlocks.some((block) => block.heightHint === "fill");
              return (
                <div key={rowKey} className={isFillRow ? "flex-1" : "shrink-0"}>
                  <Row blocks={rowBlocks} />
                </div>
              );
            })
          )}
        </div>
      </div>

      {hasFooter && (
        <div className="mt-3">
          <Row blocks={footer} />
        </div>
      )}
    </div>
  );
}
