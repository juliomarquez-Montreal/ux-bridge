export type BridgeStatus =
  | "GERANDO_BDD"
  | "AGUARDANDO_APROVACAO_BDD"
  | "GERANDO_SKETCH"
  | "AGUARDANDO_APROVACAO_SKETCH"
  | "AGUARDANDO_WIREFRAME"
  | "ERRO_GERACAO";

// Vocabulário fixo de regiões do Sketch (Bridge-3a) — espelha
// lib/bridges/generate.ts (SKETCH_REGIONS). Cada uma mapeia pra uma linha ou
// zona fixa da grade 2D desenhada pelo SketchPreview.
export type SketchRegion = "header" | "sidebar" | "page-header" | "toolbar" | "tabs" | "main-table" | "footer";
export type SketchBlockSize = "small" | "medium" | "large";

export interface SketchBlock {
  label: string;
  region: SketchRegion;
  size: SketchBlockSize;
  // Posição horizontal dentro da mesma region (0 = mais à esquerda) — usado
  // pra ordenar blocos de uma mesma linha (page-header/toolbar/tabs).
  order: number;
}

export interface SketchData {
  blocks: SketchBlock[];
}

export interface ApiBridgeListItem {
  id: string;
  status: BridgeStatus;
  createdAt: string;
  attemptCount: number;
  bddApprovedAt: string | null;
  createdBy: string;
  planeta: { id: string; name: string };
  estrela: { id: string; name: string } | null;
  galaxia: { id: string; name: string } | null;
}

export interface ApiBridge {
  id: string;
  planetContextNodeId: string;
  createdById: string;
  status: BridgeStatus;
  rawMaterialText: string | null;
  rawMaterialFileUrl: string | null;
  generatedBddPbi: string | null;
  bddApprovedAt: string | null;
  sketchData: SketchData | null;
  sketchAttemptCount: number;
  lastSketchRejectionComment: string | null;
  errorMessage: string | null;
  attemptCount: number;
  lastRejectionComment: string | null;
  createdAt: string;
  updatedAt: string;
  planet: {
    id: string;
    name: string;
    parent: { id: string; name: string; parent: { id: string; name: string } | null } | null;
  };
}
