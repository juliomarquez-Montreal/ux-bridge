import type { SketchBlock, SketchBlockSize, SketchData, SketchRegion } from "@/app/bridges/types";

// Renderiza o sketch estrutural gerado pela IA (Bridge-3a) como um layout 2D
// de verdade — não uma lista vertical — usando CSS Grid com áreas nomeadas
// pra posicionar cada bloco na zona real de tela que sua "region" representa
// (header no topo, sidebar à esquerda, toolbar(s) lado a lado, main-table
// como conteúdo principal, footer na base). Caixas cinzas sem estilo de
// design system, cada uma com uma seta vermelha + label vermelho ao lado
// explicando o componente — estilo educativo de pré-visualização.
const HEIGHT_BY_SIZE: Record<SketchBlockSize, string> = { small: "h-12", medium: "h-20", large: "h-36" };

const REGION_LABEL: Record<SketchRegion, string> = {
  header: "Header",
  sidebar: "Sidebar",
  toolbar: "Toolbar",
  "main-table": "Conteúdo",
  footer: "Footer",
};

// Blocos com espaço horizontal generoso (header, main-table, footer): caixa
// à esquerda, seta + label à direita.
function WideBlock({ block }: { block: SketchBlock }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-right font-mono text-[9px] uppercase tracking-wide text-luminous-on-surface-variant/60">
        {REGION_LABEL[block.region] ?? block.region}
      </span>
      <div
        className={`flex-1 rounded-md border-2 border-dashed border-white/25 bg-white/5 ${HEIGHT_BY_SIZE[block.size] ?? "h-20"}`}
      />
      <div className="flex w-[34%] shrink-0 items-center gap-1.5 text-red-400">
        <span aria-hidden className="text-base leading-none">←</span>
        <span className="font-mono text-[11px] leading-snug">{block.label}</span>
      </div>
    </div>
  );
}

// Blocos em colunas/linhas estreitas (sidebar, toolbar): não há espaço
// horizontal pra seta + label ao lado, então o label fica abaixo da caixa.
function CompactBlock({ block }: { block: SketchBlock }) {
  return (
    <div className="flex flex-col items-stretch gap-1.5">
      <div
        className={`w-full rounded-md border-2 border-dashed border-white/25 bg-white/5 ${HEIGHT_BY_SIZE[block.size] ?? "h-20"}`}
      />
      <div className="flex items-start justify-center gap-1 text-center text-red-400">
        <span aria-hidden className="leading-none">↑</span>
        <span className="font-mono text-[10px] leading-snug">{block.label}</span>
      </div>
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
    toolbar: [],
    "main-table": [],
    footer: [],
  };
  for (const block of blocks) {
    (byRegion[block.region] ?? byRegion["main-table"]).push(block);
  }

  const hasHeader = byRegion.header.length > 0;
  const hasSidebar = byRegion.sidebar.length > 0;
  const hasToolbar = byRegion.toolbar.length > 0;
  const hasFooter = byRegion.footer.length > 0;

  // Grade 2D montada dinamicamente: só entram linhas pras regiões realmente
  // presentes nesse sketch, e a coluna "sidebar" (quando existe) se estende
  // por todas as linhas de conteúdo, ficando do tamanho da toolbar+main
  // combinadas.
  const rows: string[] = [];
  if (hasHeader) rows.push('"header header"');
  if (hasToolbar) rows.push(hasSidebar ? '"sidebar toolbar"' : '"toolbar toolbar"');
  rows.push(hasSidebar ? '"sidebar main"' : '"main main"');
  if (hasFooter) rows.push('"footer footer"');

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
      {hasHeader && (
        <div style={{ gridArea: "header" }} className="space-y-3">
          {byRegion.header.map((block, index) => (
            <WideBlock key={index} block={block} />
          ))}
        </div>
      )}

      {hasSidebar && (
        <div style={{ gridArea: "sidebar" }} className="space-y-3">
          {byRegion.sidebar.map((block, index) => (
            <CompactBlock key={index} block={block} />
          ))}
        </div>
      )}

      {hasToolbar && (
        <div style={{ gridArea: "toolbar" }} className="flex items-start gap-3">
          {byRegion.toolbar.map((block, index) => (
            <div key={index} className="flex-1">
              <CompactBlock block={block} />
            </div>
          ))}
        </div>
      )}

      <div style={{ gridArea: "main" }} className="space-y-3">
        {byRegion["main-table"].map((block, index) => (
          <WideBlock key={index} block={block} />
        ))}
      </div>

      {hasFooter && (
        <div style={{ gridArea: "footer" }} className="space-y-3">
          {byRegion.footer.map((block, index) => (
            <WideBlock key={index} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}
