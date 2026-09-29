export type BridgeStatus =
  | "GERANDO_BDD"
  | "AGUARDANDO_APROVACAO_BDD"
  | "GERANDO_SKETCH"
  | "AGUARDANDO_APROVACAO_SKETCH"
  | "AGUARDANDO_WIREFRAME"
  | "ERRO_GERACAO";

// Modelo genérico de layout do Sketch (Bridge-3a) — espelha
// lib/bridges/generate.ts (SKETCH_ZONES). Só 4 zonas estruturais universais;
// tudo que é específico de uma tela em particular (quantas linhas, o que
// tem em cada uma) é decidido pela IA via row/order/hints, não por um
// vocabulário fixo de nomes de região.
export type SketchZone = "header" | "sidebar" | "footer" | "content";
export type SketchWidthHint = "fill" | "auto";
export type SketchHeightHint = "compact" | "fill";

export interface SketchBlock {
  label: string;
  zone: SketchZone;
  // Só relevante quando zone="content": linha vertical dentro da área de
  // conteúdo (0 = primeira linha, de cima pra baixo).
  row: number;
  // Posição horizontal dentro da mesma zone+row (0 = mais à esquerda).
  order: number;
  // "fill": ocupa o espaço restante da linha, dividido entre os blocos
  // "fill" dela. "auto": largura compacta, do tamanho do próprio conteúdo.
  widthHint: SketchWidthHint;
  // "compact": elemento de controle (botão, campo, título, aba) — baixo.
  // "fill": conteúdo principal (tabela, gráfico, lista) — deve dominar o
  // espaço vertical disponível.
  heightHint: SketchHeightHint;
  // Redimensionamento livre (Bridge-3b) — só existe depois que o PO arrasta
  // a alça de um bloco no editor manual. Quando presente, TEM PRIORIDADE
  // sobre widthHint/heightHint na renderização (editor e visualização
  // normal). A IA nunca gera esses campos — normalizeSketchBlocks
  // (lib/bridges/generate.ts) só os aceita vindos do editor manual.
  manualWidthPercent?: number; // 0-100, % do espaço disponível na linha/coluna
  manualHeightPx?: number; // altura exata em pixels
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
