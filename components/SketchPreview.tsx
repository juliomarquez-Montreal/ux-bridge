import type { SketchBlockSize, SketchData, SketchRegion } from "@/app/bridges/types";

// Renderiza o sketch estrutural gerado pela IA (Bridge-3a): caixas cinzas
// sem estilo de design system, cada uma com uma seta vermelha + label
// vermelho ao lado explicando o componente — estilo educativo de
// pré-visualização, nunca um mockup de alta fidelidade.
const HEIGHT_BY_SIZE: Record<SketchBlockSize, string> = { small: "h-12", medium: "h-20", large: "h-36" };

const REGION_LABEL: Record<SketchRegion, string> = {
  header: "Header",
  toolbar: "Toolbar",
  sidebar: "Sidebar",
  "main-content": "Conteúdo",
  "main-table": "Tabela",
  footer: "Footer",
};

export default function SketchPreview({ sketchData }: { sketchData: SketchData | null }) {
  const blocks = Array.isArray(sketchData?.blocks) ? sketchData.blocks : [];

  if (blocks.length === 0) {
    return <p className="text-sm text-luminous-on-surface-variant">Sketch sem blocos.</p>;
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-5">
      {blocks.map((block, index) => (
        <div key={index} className="flex items-start gap-3">
          <span className="w-20 shrink-0 pt-2 text-right font-mono text-[9px] uppercase tracking-wide text-luminous-on-surface-variant/60">
            {REGION_LABEL[block.region] ?? block.region}
          </span>
          <div
            className={`flex-1 rounded-md border-2 border-dashed border-white/25 bg-white/5 ${HEIGHT_BY_SIZE[block.size] ?? "h-20"}`}
          />
          <div className="flex w-[42%] shrink-0 items-center gap-1.5 text-red-400">
            <span aria-hidden className="text-base leading-none">←</span>
            <span className="font-mono text-[11px] leading-snug">{block.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
