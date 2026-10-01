export type BridgeStatus =
  | "GERANDO_BDD"
  | "AGUARDANDO_APROVACAO_BDD"
  | "GERANDO_WIREFRAME"
  | "AGUARDANDO_APROVACAO_WIREFRAME_PO"
  | "AGUARDANDO_APROVACAO_UX"
  | "FINALIZADO"
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

// Aparência visual do bloco (Wireframe-1b, ferramentas Frame/Elipse/Texto) —
// "rectangle" é o default (todo bloco gerado pela IA, e todo bloco antigo
// sem esse campo). Não afeta o modelo de dados de posição (x/y/width/height
// continuam sempre um retângulo delimitador, mesmo pra "ellipse").
export type WireframeBlockShape = "rectangle" | "ellipse" | "text";

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
  shape: WireframeBlockShape;
  // Preenchido quando o bloco nasceu de um arraste da ferramenta Componentes
  // (Wireframe-1c) — referencia DesignSystemComponent.id. Puramente
  // informativo/rastreável (aprendizado futuro, envio ao Figma na
  // Wireframe-2): o bloco em si continua sendo um retângulo de wireframe
  // padrão, sem renderizar nada do componente real.
  sourceComponentId: string | null;
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

// Wireframe-1b: anotações à mão livre (ferramenta Caneta) e comentários de
// colaboração (ferramenta Comentário) — entidades separadas dos blocos,
// carregadas/salvas por rotas próprias (ver app/api/bridges/[id]/annotations
// e .../comments), não fazem parte de Bridge.wireframeData.
export interface ApiWireframeAnnotation {
  id: string;
  pathData: string;
  color: string;
  hidden: boolean;
  locked: boolean;
  createdAt: string;
}

export interface ApiWireframeCommentReply {
  id: string;
  text: string;
  authorId: string;
  author: ApiUserRef;
  createdAt: string;
}

export interface ApiWireframeComment {
  id: string;
  x: number;
  y: number;
  text: string;
  authorId: string;
  author: ApiUserRef;
  resolved: boolean;
  createdAt: string;
  replies: ApiWireframeCommentReply[];
}

// Wireframe-1c: componente do Design System disponível pra arrastar pro
// canvas (ferramenta Componentes) — ver app/api/bridges/[id]/design-system-
// components. Só o necessário pro painel (grade com busca); nada de
// metadata/figmaComponentKey, que não são usados no editor.
export interface ApiWireframeDragComponent {
  id: string;
  name: string;
  thumbnailUrl: string | null;
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
  wireframeExportUrl: string | null;
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
