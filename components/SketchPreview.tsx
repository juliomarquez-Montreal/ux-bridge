import type { SketchBlock, SketchBlockSize, SketchData, SketchRegion } from "@/app/bridges/types";

// Renderiza o sketch estrutural gerado pela IA (Bridge-3a) como um layout 2D
// de verdade — não uma lista vertical — usando CSS Grid com áreas nomeadas
// pra posicionar cada bloco na zona/linha real de tela que sua "region"
// representa: header (topo, largura total), sidebar (coluna estreita à
// esquerda, altura cheia) e page-header/toolbar/tabs/footer (linhas
// horizontais — cada uma pode ter vários blocos lado a lado, ordenados por
// "order"), com main-table como conteúdo principal. Caixas cinzas sem estilo
// de design system, cada uma com uma seta vermelha + label vermelho embaixo
// — estilo educativo de pré-visualização.
const HEIGHT_BY_SIZE: Record<SketchBlockSize, string> = { small: "h-12", medium: "h-20", large: "h-36" };

// Um único componente de bloco pra TODAS as regiões — garante que toda
// caixa numa mesma coluna de conteúdo tem exatamente a mesma largura
// disponível, então uma linha alinha perfeitamente com a linha abaixo dela.
function Block({ block, fill }: { block: SketchBlock; fill?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 ${fill ? "flex-1" : ""}`}>
      <div
        className={`w-full rounded-md border-2 border-dashed border-white/25 bg-white/5 ${
          fill ? "flex-1" : (HEIGHT_BY_SIZE[block.size] ?? "h-20")
        }`}
      />
      <div className="flex items-start justify-center gap-1 text-center text-red-400">
        <span aria-hidden className="leading-none">↑</span>
        <span className="font-mono text-[10px] leading-snug">{block.label}</span>
      </div>
    </div>
  );
}

// Linha horizontal de blocos (page-header/toolbar/tabs) — ordenados por
// "order" (0 = mais à esquerda) antes de desenhar, e dividindo a largura
// total da linha entre si.
function BlockRow({ blocks }: { blocks: SketchBlock[] }) {
  const sorted = [...blocks].sort((a, b) => a.order - b.order);
  return (
    <div className="flex items-start gap-3">
      {sorted.map((block, index) => (
        <div key={index} className="flex-1">
          <Block block={block} />
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

  const byRegion: Record<SketchRegion, SketchBlock[]> = {
    header: [],
    sidebar: [],
    "page-header": [],
    toolbar: [],
    tabs: [],
    "main-table": [],
    footer: [],
  };
  for (const block of blocks) {
    (byRegion[block.region] ?? byRegion["main-table"]).push(block);
  }

  const hasHeader = byRegion.header.length > 0;
  const hasSidebar = byRegion.sidebar.length > 0;
  const hasPageHeader = byRegion["page-header"].length > 0;
  const hasToolbar = byRegion.toolbar.length > 0;
  const hasTabs = byRegion.tabs.length > 0;
  const hasFooter = byRegion.footer.length > 0;
  const columns = hasSidebar ? 2 : 1;

  // header/footer sempre ocupam a largura TOTAL da tela (não só a área de
  // conteúdo) — por isso não entram na coluna da sidebar.
  function fullWidthRow(area: string): string {
    return columns === 2 ? `"${area} ${area}"` : `"${area}"`;
  }
  // page-header/toolbar/tabs/main ficam dentro da área de conteúdo, ao lado
  // da sidebar quando ela existe.
  function contentRow(area: string): string {
    return hasSidebar ? `"sidebar ${area}"` : `"${area}"`;
  }

  // Grade 2D montada dinamicamente: só entram linhas pras regiões realmente
  // presentes nesse sketch, na ordem real de uma tela (header → page-header
  // → toolbar → tabs → main-table → footer), e a coluna "sidebar" (quando
  // existe) se estende por todas as linhas de conteúdo, ficando do tamanho
  // delas combinadas.
  const rows: string[] = [];
  if (hasHeader) rows.push(fullWidthRow("header"));
  if (hasPageHeader) rows.push(contentRow("page-header"));
  if (hasToolbar) rows.push(contentRow("toolbar"));
  if (hasTabs) rows.push(contentRow("tabs"));
  rows.push(contentRow("main"));
  if (hasFooter) rows.push(fullWidthRow("footer"));

  return (
    <div
      className="rounded-xl border border-white/10 bg-black/20 p-5"
      style={{
        display: "grid",
        gridTemplateAreas: rows.join(" "),
        gridTemplateColumns: hasSidebar ? "200px 1fr" : "1fr",
        gap: "1rem",
      }}
    >
      {/* header pode ter mais de um bloco lado a lado (ex: logo à esquerda,
          notificações/avatar à direita) — mesma linha horizontal do
          page-header/toolbar/tabs, não empilhado. */}
      {hasHeader && (
        <div style={{ gridArea: "header" }}>
          <BlockRow blocks={byRegion.header} />
        </div>
      )}

      {/* fill=true: a(s) caixa(s) da sidebar esticam pra preencher 100% da
          altura reservada (todas as linhas de conteúdo combinadas), sem
          sobrar espaço vazio embaixo mesmo quando a IA sugere só um bloco
          de menu. */}
      {hasSidebar && (
        <div style={{ gridArea: "sidebar" }} className="flex h-full flex-col gap-3">
          {byRegion.sidebar.map((block, index) => (
            <Block key={index} block={block} fill />
          ))}
        </div>
      )}

      {hasPageHeader && (
        <div style={{ gridArea: "page-header" }}>
          <BlockRow blocks={byRegion["page-header"]} />
        </div>
      )}

      {hasToolbar && (
        <div style={{ gridArea: "toolbar" }}>
          <BlockRow blocks={byRegion.toolbar} />
        </div>
      )}

      {hasTabs && (
        <div style={{ gridArea: "tabs" }}>
          <BlockRow blocks={byRegion.tabs} />
        </div>
      )}

      <div style={{ gridArea: "main" }} className="space-y-3">
        {byRegion["main-table"].map((block, index) => (
          <Block key={index} block={block} />
        ))}
      </div>

      {/* footer também pode ter mais de um bloco lado a lado (ex: seletor de
          itens por página + contador + paginação numa linha só). */}
      {hasFooter && (
        <div style={{ gridArea: "footer" }}>
          <BlockRow blocks={byRegion.footer} />
        </div>
      )}
    </div>
  );
}
