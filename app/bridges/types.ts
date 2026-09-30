export type BridgeStatus =
  | "GERANDO_BDD"
  | "AGUARDANDO_APROVACAO_BDD"
  | "GERANDO_WIREFRAME"
  | "AGUARDANDO_APROVACAO_WIREFRAME_PO"
  | "AGUARDANDO_APROVACAO_UX"
  | "ERRO_GERACAO";

// Modelo genérico de "hints" que a IA usa pra descrever a estrutura de uma
// tela (Wireframe-1a, herdado do antigo Sketch/Bridge-3a) — só 4 zonas
// estruturais universais; tudo que é específico de uma tela em particular
// (quantas linhas, o que tem em cada uma) é decidido pela IA via
// row/order/hints, não por um vocabulário fixo de nomes de região. Esses
// campos ficam CONGELADOS em cada WireframeBlock como metadado da geração
// (usado pro aprendizado de MemoryPattern) — a posição/tamanho de verdade,
// editável no canvas, é x/y/width/height.
export type WireframeZone = "header" | "sidebar" | "footer" | "content";
export type WireframeWidthHint = "fill" | "auto";
export type WireframeHeightHint = "compact" | "fill";

// GROUP é um container sem conteúdo próprio, só agrupa outros blocos
// (ver "Agrupar seleção", Ctrl+G, no editor) — ELEMENT é um bloco de
// verdade (o que a IA sempre gera; ela nunca cria GROUP).
export type WireframeBlockKind = "GROUP" | "ELEMENT";

// Um bloco do Wireframe, já convertido pra coordenadas absolutas em pixels
// dentro do frame (ver lib/bridges/wireframeLayout.ts) — a partir da geração,
// é isso que o editor (components/WireframeEditor.tsx) lê e escreve. x/y são
// SEMPRE absolutos em relação ao frame, mesmo pra blocos dentro de um GROUP
// (não há sistema de coordenadas relativas ao pai) — agrupar é uma relação
// hierárquica (pro painel de Camadas e pra mover em conjunto), não afeta como
// a posição é armazenada.
export interface WireframeBlock {
  id: string;
  label: string;
  zone: WireframeZone;
  row: number;
  order: number;
  widthHint: WireframeWidthHint;
  heightHint: WireframeHeightHint;
  x: number;
  y: number;
  width: number;
  height: number;
  // Id de outro bloco do mesmo Wireframe, ou null se for de nível raiz.
  parentBlockId: string | null;
  kind: WireframeBlockKind;
  // Ordem entre os irmãos do mesmo pai (ou entre os blocos de nível raiz,
  // se parentBlockId for null) — usado pra renderizar a árvore de Camadas
  // na ordem certa.
  siblingOrder: number;
  // Oculto: não renderiza no canvas, mas continua na lista de Camadas (ícone
  // de olho fechado) e no banco — diferente de excluir.
  hidden: boolean;
  // Bloqueado: não pode ser movido/redimensionado/selecionado por clique
  // direto no canvas — só desbloqueável via Camadas (que continua permitindo
  // seleção mesmo bloqueado).
  locked: boolean;
}

export interface WireframeData {
  frameWidth: number;
  frameHeight: number;
  blocks: WireframeBlock[];
}

export interface ApiUserRef {
  id: string;
  name: string;
  avatarUrl: string | null;
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
  poUserId: string | null;
  poUser: ApiUserRef | null;
  uxUserId: string | null;
  uxUser: ApiUserRef | null;
  status: BridgeStatus;
  rawMaterialText: string | null;
  rawMaterialFileUrl: string | null;
  generatedBddPbi: string | null;
  bddApprovedAt: string | null;
  wireframeData: WireframeData | null;
  wireframeAttemptCount: number;
  lastWireframeRejectionComment: string | null;
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
