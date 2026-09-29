import type { SketchBlock, SketchBlockSize, SketchData, SketchRegion } from "@/app/bridges/types";

// Renderiza o sketch estrutural gerado pela IA (Bridge-3a) como um layout 2D
// de verdade — não uma lista vertical — usando CSS Grid com áreas nomeadas
// pra posicionar cada bloco na zona real de tela que sua "region" representa
// (header no topo, sidebar à esquerda, toolbar(s) lado a lado, main-table
// como conteúdo principal, footer na base). Caixas cinzas sem estilo de
// design system, cada uma com uma seta vermelha + label vermelho embaixo —
// estilo educativo de pré-visualização.
const HEIGHT_BY_SIZE: Record<SketchBlockSize, string> = { small: "h-12", medium: "h-20", large: "h-36" };

// Um único componente de bloco pra TODAS as regiões (antes header/main-table/
// footer usavam um estilo "caixa + label ao lado" com largura menor que o
// estilo "caixa + label embaixo" da sidebar/toolbar — o que fazia a caixa do
// conteúdo principal ficar visivelmente mais estreita e desalinhada da
// toolbar acima dela, mesmo as duas ocupando a mesma coluna da grade). Com
// um só estilo, a caixa sempre ocupa 100% da largura disponível, garantindo
// alinhamento entre toolbar e conteúdo principal.
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
            <Block key={index} block={block} />
          ))}
        </div>
      )}

      {/* fill=true: a(s) caixa(s) da sidebar esticam pra preencher 100% da
          altura reservada (linha(s) da toolbar + linha do conteúdo
          principal), sem sobrar espaço vazio embaixo mesmo quando a IA
          sugere só um bloco de menu. */}
      {hasSidebar && (
        <div style={{ gridArea: "sidebar" }} className="flex h-full flex-col gap-3">
          {byRegion.sidebar.map((block, index) => (
            <Block key={index} block={block} fill />
          ))}
        </div>
      )}

      {/* Toolbars dividem a largura total da área de conteúdo entre si —
          uma só ocupa 100%, duas ficam 50%/50%, etc. */}
      {hasToolbar && (
        <div style={{ gridArea: "toolbar" }} className="flex items-start gap-3">
          {byRegion.toolbar.map((block, index) => (
            <div key={index} className="flex-1">
              <Block block={block} />
            </div>
          ))}
        </div>
      )}

      <div style={{ gridArea: "main" }} className="space-y-3">
        {byRegion["main-table"].map((block, index) => (
          <Block key={index} block={block} />
        ))}
      </div>

      {hasFooter && (
        <div style={{ gridArea: "footer" }} className="space-y-3">
          {byRegion.footer.map((block, index) => (
            <Block key={index} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}
