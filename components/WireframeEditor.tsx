"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type {
  ApiBridge,
  ApiUserRef,
  ApiWireframeAnnotation,
  ApiWireframeComment,
  ApiWireframeDragComponent,
  WireframeBlock,
} from "@/app/bridges/types";
import { normalizeWireframeBlocks } from "@/lib/bridges/wireframeLayout";
import Avatar from "@/components/Avatar";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  CloseIcon,
  CloudIcon,
  CommentToolIcon,
  ComponentsToolIcon,
  EllipseToolIcon,
  EyeOffIcon,
  EyeOpenIcon,
  FolderIcon,
  FrameToolIcon,
  GridIcon,
  HandToolIcon,
  LayersTabIcon,
  LockIcon,
  MaximizeIcon,
  MinimizeIcon,
  MinusIcon,
  PenToolIcon,
  PlusIcon,
  PropertiesTabIcon,
  RedoIcon,
  SearchIcon,
  SelectToolIcon,
  TextToolIcon,
  ThumbsDownIcon,
  TrashIcon,
  UndoIcon,
  UnlockIcon,
} from "@/components/icons";

// Editor visual completo do Wireframe (Wireframe-1a/1a+). Reproduz fielmente
// o mockup em _design-assets/. Só a ferramenta "Selecionar" (e agora "Mão")
// tem função real nesta fase — as outras 5 ficam visuais, sem ação
// (Wireframe-1c: painel de componentes do Design System arrastáveis).

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const MIN_BLOCK_SIZE = 24;
const AUTOSAVE_DEBOUNCE_MS = 900;
// Tipo de dado customizado do drag-and-drop nativo (Wireframe-1c, ferramenta
// Componentes) — carrega só o id do DesignSystemComponent arrastado do
// painel flutuante até o drop no canvas.
const COMPONENT_DRAG_MIME = "application/x-ux-bridge-component-id";
// Cursor customizado da ferramenta "Mão" (Ajuste C) — o cursor nativo
// "grab" do sistema operacional fica quase invisível sobre o fundo branco
// do canvas em alguns navegadores/SOs. Uma mão aberta simplificada (palma +
// 4 dedos) com contorno preto E uma sombra escura semitransparente
// desenhada por trás (não um filtro CSS — cursores customizados não
// aplicam drop-shadow de fora, então a sombra precisa já estar "assada" na
// própria imagem) garante contraste em cima de qualquer cor de fundo.
const HAND_CURSOR_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">` +
    `<g fill="rgba(0,0,0,0.35)" transform="translate(1,1.5)">` +
    `<rect x="9" y="11" width="10" height="11" rx="3"/>` +
    `<rect x="8" y="6" width="3.2" height="10" rx="1.5"/>` +
    `<rect x="11.6" y="4" width="3.2" height="12" rx="1.5"/>` +
    `<rect x="15.2" y="4.5" width="3.2" height="11.5" rx="1.5"/>` +
    `<rect x="18.8" y="6" width="3" height="10" rx="1.5"/>` +
    `</g>` +
    `<g fill="#ffffff" stroke="#111111" stroke-width="1.4" stroke-linejoin="round">` +
    `<rect x="9" y="11" width="10" height="11" rx="3"/>` +
    `<rect x="8" y="6" width="3.2" height="10" rx="1.5"/>` +
    `<rect x="11.6" y="4" width="3.2" height="12" rx="1.5"/>` +
    `<rect x="15.2" y="4.5" width="3.2" height="11.5" rx="1.5"/>` +
    `<rect x="18.8" y="6" width="3" height="10" rx="1.5"/>` +
    `</g>` +
    `</svg>`
);
const HAND_CURSOR = `url("data:image/svg+xml,${HAND_CURSOR_SVG}") 14 14, grab`;
// Heurística simples (não um sistema de tipos de verdade — isso fica pra
// quando o editor souber o que cada bloco realmente é, na Wireframe-1c) pra
// decidir se um ELEMENT mostra o ícone de texto nas Camadas.
const TEXT_LABEL_PATTERN = /t[íi]tulo|texto|label|nome|descri[çc][ãa]o/i;

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";
type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
// Wireframe-1b: "frame"/"ellipse" desenham um bloco novo por arraste;
// "pen" desenha uma anotação livre; "text" cria um bloco shape="text" por
// clique; "comment" cria um pino de comentário por clique. "components"
// (Wireframe-1c) abre o painel flutuante de componentes do Design System —
// o bloco em si nasce por arrastar um item do painel pro canvas (drag-and-
// drop nativo), não por um gesto direto no canvas como as outras.
type Tool = "select" | "hand" | "frame" | "ellipse" | "pen" | "text" | "comment" | "components";

// Desloca todos os pontos numéricos de um path SVG simples ("M x y L x y
// ...", o único formato que este editor gera) por (dx, dy) — usado pra
// mover uma anotação de Caneta inteira sem precisar parsear/re-serializar
// comandos de path complexos (nunca existem aqui, só M/L com números).
function offsetPathData(pathData: string, dx: number, dy: number): string {
  return pathData.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_match, xStr: string, yStr: string) => {
    const x = Math.round(parseFloat(xStr) + dx);
    const y = Math.round(parseFloat(yStr) + dy);
    return `${x} ${y}`;
  });
}

// Escala todos os pontos de um path SVG simples em torno de um ponto-âncora
// (o canto oposto ao da alça de redimensionamento arrastada) — usado pra
// redimensionar uma anotação de Caneta pelas novas alças (correção do bug da
// Caneta): como o traço é um path livre (não um retângulo regular), não dá
// pra só mudar width/height, então a "caixa delimitadora" é recalculada a
// cada frame a partir do próprio path (ver getAnnotationBoundingBox) e cada
// ponto é escalado proporcionalmente em relação à âncora.
function scalePathData(pathData: string, anchorX: number, anchorY: number, sx: number, sy: number): string {
  return pathData.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_match, xStr: string, yStr: string) => {
    const x = Math.round(anchorX + (parseFloat(xStr) - anchorX) * sx);
    const y = Math.round(anchorY + (parseFloat(yStr) - anchorY) * sy);
    return `${x} ${y}`;
  });
}

// Caixa delimitadora mínima de um path "M x y L x y ..." — base tanto pras
// alças de redimensionamento (posição dos cantos) quanto pro cálculo de
// escala acima (a âncora é sempre um dos 4 cantos desta caixa).
function getAnnotationBoundingBox(pathData: string): { minX: number; minY: number; maxX: number; maxY: number } {
  const nums = pathData.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i];
    const y = nums[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (minX === Infinity) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

function blocksEqual(a: WireframeBlock[], b: WireframeBlock[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((block, index) => {
    const other = b[index];
    return (
      block.id === other.id &&
      block.label === other.label &&
      block.x === other.x &&
      block.y === other.y &&
      block.width === other.width &&
      block.height === other.height &&
      block.parentBlockId === other.parentBlockId &&
      block.kind === other.kind &&
      block.siblingOrder === other.siblingOrder &&
      block.hidden === other.hidden &&
      block.locked === other.locked
    );
  });
}

// --- Helpers de hierarquia (agrupamento, Ajuste 4) ---

function collectDescendantIds(rootId: string, blocks: WireframeBlock[]): Set<string> {
  const result = new Set<string>();
  const childrenByParent = new Map<string, WireframeBlock[]>();
  for (const b of blocks) {
    if (!b.parentBlockId) continue;
    const arr = childrenByParent.get(b.parentBlockId) ?? [];
    arr.push(b);
    childrenByParent.set(b.parentBlockId, arr);
  }
  function walk(id: string) {
    for (const child of childrenByParent.get(id) ?? []) {
      if (!result.has(child.id)) {
        result.add(child.id);
        walk(child.id);
      }
    }
  }
  walk(rootId);
  return result;
}

// Todos os ids que devem se mover junto quando `draggedId` é arrastado:
// a seleção efetiva (se o bloco arrastado faz parte dela) + todos os
// descendentes de cada bloco movido (pra um GROUP arrastar seus filhos).
function getMoveSet(draggedId: string, blocks: WireframeBlock[], effectiveSelection: Set<string>): Set<string> {
  const base = effectiveSelection.has(draggedId) ? effectiveSelection : new Set([draggedId]);
  const result = new Set(base);
  for (const id of Array.from(base)) {
    for (const descendantId of Array.from(collectDescendantIds(id, blocks))) result.add(descendantId);
  }
  return result;
}

interface TreeNode {
  block: WireframeBlock;
  children: TreeNode[];
}

function buildTree(blocks: WireframeBlock[]): TreeNode[] {
  const byParent = new Map<string | null, WireframeBlock[]>();
  for (const b of blocks) {
    const key = b.parentBlockId;
    const arr = byParent.get(key) ?? [];
    arr.push(b);
    byParent.set(key, arr);
  }
  for (const arr of Array.from(byParent.values())) arr.sort((a, b) => a.siblingOrder - b.siblingOrder);
  function build(parentId: string | null): TreeNode[] {
    return (byParent.get(parentId) ?? []).map((block) => ({ block, children: build(block.id) }));
  }
  return build(null);
}

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `w${Math.random().toString(36).slice(2)}`;
}

export default function WireframeEditor({
  bridge,
  onUpdate,
  readOnly = false,
}: {
  bridge: ApiBridge;
  onUpdate: (bridge: ApiBridge) => void;
  // Wireframe-2: true quando o Bridge está em AGUARDANDO_APROVACAO_UX e quem
  // está vendo NÃO é o uxUserId atribuído (nem ADMIN) — o PO passa a só
  // visualizar nessa fase. Default false preserva o comportamento de sempre
  // (fase do PO, sempre editável) sem exigir que todo caller passe a prop.
  readOnly?: boolean;
}) {
  const router = useRouter();
  const frameWidth = bridge.wireframeData?.frameWidth ?? 1440;
  const frameHeight = bridge.wireframeData?.frameHeight ?? 1024;
  // normalizeWireframeBlocks preenche kind/parentBlockId/siblingOrder com
  // defaults sensatos (ELEMENT/null/índice) quando ausentes — essencial pra
  // blocos gravados ANTES desses campos existirem (ex: o Bridge real
  // migrado da Wireframe-1a via script standalone, que nunca os teve).
  // Sem isso, um bloco com kind=undefined não bate em nenhum dos filtros
  // "GROUP"/"ELEMENT" do canvas e simplesmente some da tela, e a árvore de
  // Camadas (que agrupa por parentBlockId) some junto, já que undefined !==
  // null como chave do Map. Ver scripts/fix-real-bridge-wireframe-kind.mjs
  // pro backfill único que corrigiu o dado já salvo do Bridge real.
  const initialBlocks = useMemo(() => {
    const raw = bridge.wireframeData?.blocks;
    if (!raw || raw.length === 0) return [];
    return normalizeWireframeBlocks(raw);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só recalcula quando o Bridge muda de verdade (id), não a cada update local de wireframeData vindo do próprio autosave.
  }, [bridge.id]);

  const [blocks, setBlocks] = useState<WireframeBlock[]>(initialBlocks);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [zoom, setZoom] = useState(0.8);
  const [showGrid, setShowGrid] = useState(false);
  // Painel lateral único (Camadas + Propriedades + Comentários em
  // acordeão) — substitui as antigas abas "Camadas"/"Propriedades"
  // separadas. "Propriedades" não entra em expandedSections: não tem
  // estado de aberto/fechado próprio, é sempre mostrada (com conteúdo
  // condicional à seleção).
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<"camadas" | "comentarios">>(new Set<"camadas" | "comentarios">(["camadas"]));
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regenerateComment, setRegenerateComment] = useState("");
  const [regenerateBusy, setRegenerateBusy] = useState(false);
  const [approveBusy, setApproveBusy] = useState(false);
  // Wireframe-2: "Aprovar e Exportar" (fase do UX) — exportResult guarda a
  // URL do SVG recém-gerado pro modal de confirmação ("Salvar" + explicação
  // do Figma); null fecha o modal.
  const [exportBusy, setExportBusy] = useState(false);
  const [exportResult, setExportResult] = useState<{ svgUrl: string } | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<ApiUserRef[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());
  // Alvo do menu de contexto: um bloco OU uma anotação (correção do bug da
  // Caneta, que reaproveita a mesma lógica de menu de contexto dos blocos
  // com um subconjunto de ações).
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; target: { type: "block" | "annotation"; id: string } } | null>(null);
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [layerDropTargetId, setLayerDropTargetId] = useState<string | null | "root">(null);
  // Posição do drop relativa ao item sobrevoado nas Camadas (Ajuste 3): não
  // se aplica ao drop em "root" (fundo do painel), só entre linhas.
  const [layerDropPosition, setLayerDropPosition] = useState<"before" | "after" | "inside">("inside");
  // Tamanho real da área visível do canvas (Ajuste 1) — usado pra calcular
  // o padding-esquerdo/topo dinâmico que centraliza o frame quando ele é
  // MENOR que a área disponível (telas largas). clientWidth/clientHeight já
  // incluem o próprio padding do elemento e não mudam quando o padding é
  // redistribuído (o container não tem largura própria fixa, ela vem do
  // flex-1 do pai), então não há dependência circular em usá-los aqui.
  const [canvasViewport, setCanvasViewport] = useState({ width: 0, height: 0 });
  // Posição de rolagem do canvas (Ajuste B) — precisa estar em estado (não só
  // lida direto do DOM) pra o retângulo indicador do minimapa re-renderizar
  // seguindo o scroll/pan/zoom em tempo real.
  const [scrollPos, setScrollPos] = useState({ left: 0, top: 0 });

  // --- Wireframe-1b: ferramentas de desenho (Frame/Elipse/Caneta/Texto) e
  // comentários de colaboração ---
  const [annotations, setAnnotations] = useState<ApiWireframeAnnotation[]>([]);
  const [comments, setComments] = useState<ApiWireframeComment[]>([]);
  // Retângulo sendo desenhado ao vivo (ferramentas Frame/Elipse, enquanto o
  // botão do mouse está pressionado) — em coordenadas do frame (não de tela).
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  // Pontos do traço de Caneta sendo desenhado ao vivo, em coordenadas do frame.
  const [penPoints, setPenPoints] = useState<{ x: number; y: number }[] | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  // Bloco recém-criado por Frame/Elipse/Texto entra direto em modo de edição
  // inline do nome (input sobreposto no lugar do label).
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingLabelDraft, setEditingLabelDraft] = useState("");
  // Comentário sendo composto (pino já posicionado, campo de texto aberto,
  // ainda não salvo) e a thread aberta pra leitura/resposta (só uma por vez).
  const [pendingCommentPos, setPendingCommentPos] = useState<{ x: number; y: number } | null>(null);
  const [pendingCommentText, setPendingCommentText] = useState("");
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [commentFilter, setCommentFilter] = useState<"all" | "open" | "resolved">("all");

  // --- Wireframe-1c: painel flutuante de componentes do Design System
  // (ferramenta Componentes). `designSystemLinked` distingue "Galáxia sem
  // nenhum Design System vinculado" de "vinculado, só não tem componentes" —
  // null enquanto a busca inicial ainda não voltou (evita piscar o estado
  // vazio errado por uma fração de segundo). ---
  const [dragComponents, setDragComponents] = useState<ApiWireframeDragComponent[]>([]);
  const [designSystemLinked, setDesignSystemLinked] = useState<boolean | null>(null);
  const [componentSearch, setComponentSearch] = useState("");

  const historyRef = useRef<WireframeBlock[][]>([initialBlocks]);
  const historyIndexRef = useRef(0);
  const [historyTick, setHistoryTick] = useState(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasScrollRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  // Wireframe-1c: painel flutuante de Componentes — refs usadas só pra
  // detectar clique-fora (fecha o painel revertendo a ferramenta pra
  // "select"), excluindo o próprio painel e o botão que o abre/fecha.
  const componentsPanelRef = useRef<HTMLDivElement>(null);
  const componentsButtonRef = useRef<HTMLDivElement>(null);
  const editorRootRef = useRef<HTMLDivElement>(null);
  const pendingScrollAdjustRef = useRef<{ dx: number; dy: number } | null>(null);
  // Ajuste 1: quando true, o próximo efeito disparado por mudança de `zoom`
  // deve CENTRALIZAR o frame (em vez de aplicar o ajuste de scroll do zoom
  // centrado no cursor, que usa pendingScrollAdjustRef acima) — usado ao
  // escolher um preset no menu de zoom, que "reseta" o zoom pra um valor
  // conhecido.
  const centerPendingRef = useRef(false);
  const panStateRef = useRef<{ startX: number; startY: number; startScrollLeft: number; startScrollTop: number } | null>(null);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;
  const activeToolRef = useRef<Tool>(activeTool);
  activeToolRef.current = activeTool;

  useEffect(() => {
    setBlocks(initialBlocks);
    historyRef.current = [initialBlocks];
    historyIndexRef.current = 0;
    setHistoryTick((t) => t + 1);
    setSelectedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge.id]);

  // Wireframe-1b: anotações e comentários vivem em tabelas à parte (não em
  // Bridge.wireframeData), carregadas uma vez por Bridge.
  useEffect(() => {
    fetch(`/api/bridges/${bridge.id}/annotations`)
      .then((res) => (res.ok ? res.json() : { annotations: [] }))
      .then((data: { annotations?: ApiWireframeAnnotation[] }) => setAnnotations(data.annotations ?? []))
      .catch(() => setAnnotations([]));
    fetch(`/api/bridges/${bridge.id}/comments`)
      .then((res) => (res.ok ? res.json() : { comments: [] }))
      .then((data: { comments?: ApiWireframeComment[] }) => setComments(data.comments ?? []))
      .catch(() => setComments([]));
  }, [bridge.id]);

  // Wireframe-1c: componentes do Design System vinculados à Galáxia do
  // Bridge — carregados uma vez por Bridge (igual anotações/comentários),
  // não só quando o painel abre, pra já estarem prontos na primeira vez que
  // o usuário clicar em "Componentes".
  useEffect(() => {
    fetch(`/api/bridges/${bridge.id}/design-system-components`)
      .then((res) => (res.ok ? res.json() : { linked: false, components: [] }))
      .then((data: { linked?: boolean; components?: ApiWireframeDragComponent[] }) => {
        setDesignSystemLinked(data.linked ?? false);
        setDragComponents(data.components ?? []);
      })
      .catch(() => {
        setDesignSystemLinked(false);
        setDragComponents([]);
      });
  }, [bridge.id]);

  // Ajuste 1: mede continuamente a área visível do canvas (ver
  // canvasViewport acima) — o padding-esquerdo/topo dinâmico calculado a
  // partir disso é o que de fato centraliza o frame quando ele é menor que
  // a área disponível (telas largas). Continua observando (não só na
  // montagem) porque isso também mantém o frame centralizado se a janela
  // for redimensionada depois — sem custo extra, já que só produz padding
  // acima do mínimo quando sobra espaço de verdade (não há nada pra
  // "desfazer" de uma rolagem manual do usuário nesse caso, pois só entra
  // em jogo quando NÃO há overflow/scroll possível).
  useLayoutEffect(() => {
    const container = canvasScrollRef.current;
    if (!container) return;
    function measure() {
      setCanvasViewport({ width: container!.clientWidth, height: container!.clientHeight });
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Quando o frame TRANSBORDA a área visível (zoom alto / tela pequena), o
  // padding fica no mínimo e sobra overflow de verdade pra rolar — nesse
  // caso, dá pra começar com a rolagem centralizada no meio do frame (em
  // vez de cair no canto superior-esquerdo). Só ajuda a posição inicial;
  // não é crítico se ficar levemente impreciso.
  function centerScrollIfOverflowing() {
    const container = canvasScrollRef.current;
    const frame = frameRef.current;
    if (!container || !frame) return;
    container.scrollLeft = Math.max(0, frame.offsetLeft + frame.offsetWidth / 2 - container.clientWidth / 2);
    container.scrollTop = Math.max(0, frame.offsetTop + frame.offsetHeight / 2 - container.clientHeight / 2);
  }

  useEffect(() => {
    centerScrollIfOverflowing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge.id]);

  // Acompanha scrollLeft/scrollTop do canvas (Ajuste B) — inclui os ajustes
  // programáticos de pan/zoom/centralização, já que setar container.scrollLeft
  // via JS também dispara o evento nativo "scroll".
  useEffect(() => {
    const container = canvasScrollRef.current;
    if (!container) return;
    function onScroll() {
      setScrollPos({ left: container!.scrollLeft, top: container!.scrollTop });
    }
    onScroll();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  // --- Minimapa: clicar ou arrastar dentro da área do frame em miniatura faz
  // pan do canvas principal, centralizando a área visível no ponto do cursor
  // e seguindo o arraste em tempo real (Ajuste B — antes o minimapa só
  // mostrava os blocos, sem nenhum listener de clique/arraste: nem clicar
  // nem arrastar o retângulo indicador faziam qualquer coisa). Um único
  // handler cobre as duas interações pedidas (clicar em qualquer ponto E
  // arrastar o retângulo indicador), já que visualmente o efeito esperado é
  // o mesmo: o retângulo (e o canvas atrás dele) segue o cursor. ---
  function handleMinimapPointerDown(event: ReactPointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    const box = event.currentTarget.getBoundingClientRect();
    const container = canvasScrollRef.current;
    const frame = frameRef.current;
    if (!container || !frame) return;

    function moveTo(clientX: number, clientY: number) {
      const ratioX = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
      const ratioY = Math.min(1, Math.max(0, (clientY - box.top) / box.height));
      const frameX = ratioX * frameWidth;
      const frameY = ratioY * frameHeight;
      container!.scrollLeft = Math.max(0, frame!.offsetLeft + frameX * zoomRef.current - container!.clientWidth / 2);
      container!.scrollTop = Math.max(0, frame!.offsetTop + frameY * zoomRef.current - container!.clientHeight / 2);
    }
    moveTo(event.clientX, event.clientY);

    function onMove(moveEvent: PointerEvent) {
      moveTo(moveEvent.clientX, moveEvent.clientY);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  async function doSave(next: WireframeBlock[]) {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/bridges/${bridge.id}/wireframe-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar.");
      onUpdate(data.bridge);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  function scheduleSave(next: WireframeBlock[]) {
    setSaveState("pending");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doSave(next), AUTOSAVE_DEBOUNCE_MS);
  }

  function pushHistory(next: WireframeBlock[]) {
    const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1);
    trimmed.push(next);
    historyRef.current = trimmed;
    historyIndexRef.current = trimmed.length - 1;
    setHistoryTick((t) => t + 1);
  }

  // Chamado ao FINAL de um drag/resize/rename/agrupar (mouseup, blur) — só
  // entra no histórico e agenda o autosave se algo realmente mudou (evita
  // poluir o undo/redo e disparar saves à toa por um clique sem arrasto).
  function commitBlocks(next: WireframeBlock[]) {
    setBlocks(next);
    if (blocksEqual(next, historyRef.current[historyIndexRef.current])) return;
    pushHistory(next);
    scheduleSave(next);
  }

  function undo() {
    if (historyIndexRef.current <= 0 || readOnly) return;
    historyIndexRef.current -= 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    setBlocks(snapshot);
    setHistoryTick((t) => t + 1);
    scheduleSave(snapshot);
  }

  function redo() {
    if (historyIndexRef.current >= historyRef.current.length - 1 || readOnly) return;
    historyIndexRef.current += 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    setBlocks(snapshot);
    setHistoryTick((t) => t + 1);
    scheduleSave(snapshot);
  }

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;
  const selectedBlock = selectedIds.size === 1 ? blocks.find((b) => selectedIds.has(b.id)) ?? null : null;

  function updateBlockLive(id: string, patch: Partial<WireframeBlock>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function selectOnly(id: string) {
    setSelectedIds(new Set([id]));
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // --- Drag pra mover um bloco (ferramenta Selecionar) — Pointer Events (não
  // Mouse Events) pra cobrir mouse, caneta E trackpad/touch com a mesma
  // API; alguns gestos de arrastar no trackpad não disparam
  // mousemove/mouseup de forma confiável neste app, mas sempre disparam
  // pointermove/pointerup. ---
  function handleBlockMouseDown(event: ReactPointerEvent, block: WireframeBlock) {
    if (activeTool !== "select" || event.button !== 0) return;
    event.stopPropagation();
    // Bloco bloqueado (Ajuste 3): não seleciona nem arrasta por clique
    // direto no canvas — só desbloqueável via Camadas, que tem seu próprio
    // caminho de seleção (LayerRow.onSelect) que não passa por aqui.
    if (block.locked) return;
    setSelectedAnnotationId(null);

    if (event.shiftKey) {
      toggleSelection(block.id);
      return;
    }

    const effectiveSelection = selectedIds.has(block.id) && selectedIds.size > 1 ? selectedIds : new Set([block.id]);
    setSelectedIds(effectiveSelection);
    // Modo leitura (Wireframe-2, PO vendo a fase do UX): pode selecionar pra
    // inspecionar propriedades, não arrastar.
    if (readOnly) return;

    const moveSet = getMoveSet(block.id, blocks, effectiveSelection);
    const startX = event.clientX;
    const startY = event.clientY;
    const startPositions = new Map(blocks.filter((b) => moveSet.has(b.id)).map((b) => [b.id, { x: b.x, y: b.y }]));
    let current = blocks;
    let moved = false;

    function onMove(moveEvent: PointerEvent) {
      moved = true;
      const dx = (moveEvent.clientX - startX) / zoomRef.current;
      const dy = (moveEvent.clientY - startY) / zoomRef.current;
      current = current.map((b) => {
        const start = startPositions.get(b.id);
        if (!start) return b;
        return { ...b, x: Math.round(start.x + dx), y: Math.round(start.y + dy) };
      });
      setBlocks(current);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (moved) commitBlocks(current);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // --- Redimensionar por uma das 8 alças (Pointer Events, mesmo motivo acima) ---
  function handleResizeMouseDown(event: ReactPointerEvent, block: WireframeBlock, direction: ResizeDirection) {
    event.stopPropagation();
    event.preventDefault();
    if (block.locked || readOnly) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const start = { x: block.x, y: block.y, width: block.width, height: block.height };
    let current = blocks;

    function onMove(moveEvent: PointerEvent) {
      const dx = (moveEvent.clientX - startX) / zoomRef.current;
      const dy = (moveEvent.clientY - startY) / zoomRef.current;
      let { x, y, width, height } = start;

      if (direction.includes("e")) width = Math.max(MIN_BLOCK_SIZE, start.width + dx);
      if (direction.includes("s")) height = Math.max(MIN_BLOCK_SIZE, start.height + dy);
      if (direction.includes("w")) {
        width = Math.max(MIN_BLOCK_SIZE, start.width - dx);
        x = start.x + (start.width - width);
      }
      if (direction.includes("n")) {
        height = Math.max(MIN_BLOCK_SIZE, start.height - dy);
        y = start.y + (start.height - height);
      }

      current = current.map((b) => (b.id === block.id ? { ...b, x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) } : b));
      setBlocks(current);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      commitBlocks(current);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Converte um ponto em coordenadas de tela (clientX/clientY, como vem de
  // qualquer PointerEvent) pra coordenadas do FRAME (as mesmas usadas por
  // x/y/width/height de blocos e pelo pathData de anotações) — usa
  // getBoundingClientRect() do frame, que já reflete a rolagem/zoom atuais,
  // em vez de offsetLeft/offsetTop (que não descontam scroll). Base de todas
  // as ferramentas de desenho do Wireframe-1b.
  function clientToFrame(clientX: number, clientY: number): { x: number; y: number } {
    const frame = frameRef.current;
    if (!frame) return { x: 0, y: 0 };
    const rect = frame.getBoundingClientRect();
    return { x: (clientX - rect.left) / zoomRef.current, y: (clientY - rect.top) / zoomRef.current };
  }

  function nextRootSiblingOrder(): number {
    const siblingsAtLevel = blocksRef.current.filter((b) => b.parentBlockId === null);
    return siblingsAtLevel.length > 0 ? Math.max(...siblingsAtLevel.map((b) => b.siblingOrder)) + 1 : 0;
  }

  // --- Ferramentas "Frame"/"Elipse" (Wireframe-1b): clicar e arrastar
  // desenha um bloco novo do tamanho arrastado. Ao soltar, a ferramenta
  // volta pra "Selecionar" automaticamente (comportamento padrão de
  // ferramentas de desenho) e o bloco nasce em modo de edição inline do
  // nome. ---
  function startDrawingBlock(event: ReactPointerEvent, shape: "rectangle" | "ellipse") {
    event.preventDefault();
    const start = clientToFrame(event.clientX, event.clientY);
    setDrawRect({ x: start.x, y: start.y, width: 0, height: 0 });

    function onMove(moveEvent: PointerEvent) {
      const current = clientToFrame(moveEvent.clientX, moveEvent.clientY);
      setDrawRect({
        x: Math.min(start.x, current.x),
        y: Math.min(start.y, current.y),
        width: Math.abs(current.x - start.x),
        height: Math.abs(current.y - start.y),
      });
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDrawRect((rect) => {
        if (rect) finishDrawingBlock(rect, shape);
        return null;
      });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function finishDrawingBlock(rect: { x: number; y: number; width: number; height: number }, shape: "rectangle" | "ellipse") {
    const width = Math.max(MIN_BLOCK_SIZE, Math.round(rect.width));
    const height = Math.max(MIN_BLOCK_SIZE, Math.round(rect.height));
    const newBlock: WireframeBlock = {
      id: makeId(),
      label: "Novo elemento",
      zone: "content",
      row: 0,
      order: 0,
      widthHint: "auto",
      heightHint: "compact",
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width,
      height,
      parentBlockId: null,
      kind: "ELEMENT",
      siblingOrder: nextRootSiblingOrder(),
      hidden: false,
      locked: false,
      shape,
      sourceComponentId: null,
    };
    commitBlocks([...blocksRef.current, newBlock]);
    setSelectedIds(new Set([newBlock.id]));
    setEditingBlockId(newBlock.id);
    setEditingLabelDraft(newBlock.label);
    setActiveTool("select");
  }

  // --- Ferramenta "Texto" (Wireframe-1b): clicar (sem arrastar) cria um
  // bloco leve shape="text" (sem borda/preenchimento), editável na hora. ---
  function createTextBlock(event: ReactPointerEvent) {
    event.preventDefault();
    const pos = clientToFrame(event.clientX, event.clientY);
    const width = 160;
    const height = 32;
    const newBlock: WireframeBlock = {
      id: makeId(),
      label: "Texto",
      zone: "content",
      row: 0,
      order: 0,
      widthHint: "auto",
      heightHint: "compact",
      x: Math.round(pos.x),
      y: Math.round(pos.y - height / 2),
      width,
      height,
      parentBlockId: null,
      kind: "ELEMENT",
      siblingOrder: nextRootSiblingOrder(),
      hidden: false,
      locked: false,
      shape: "text",
      sourceComponentId: null,
    };
    commitBlocks([...blocksRef.current, newBlock]);
    setSelectedIds(new Set([newBlock.id]));
    setEditingBlockId(newBlock.id);
    setEditingLabelDraft(newBlock.label);
    setActiveTool("select");
  }

  function commitEditingLabel() {
    const id = editingBlockId;
    if (!id || readOnly) return;
    const next = blocksRef.current.map((b) => (b.id === id ? { ...b, label: editingLabelDraft.trim() || b.label } : b));
    commitBlocks(next);
    setEditingBlockId(null);
  }

  // --- Ferramenta "Componentes" (Wireframe-1c): soltar um item arrastado do
  // painel flutuante cria um bloco de wireframe padrão (mesmo estilo visual
  // de qualquer outro bloco — sem renderizar a thumbnail real, de propósito)
  // com o NOME do componente como label e sourceComponentId preenchido pra
  // rastreabilidade. Tamanho fixo (não tenta herdar dimensões do Figma nesta
  // fase), centralizado no ponto onde foi solto. ---
  function createComponentBlock(componentId: string, clientX: number, clientY: number) {
    if (readOnly) return;
    const component = dragComponents.find((c) => c.id === componentId);
    if (!component) return;
    const pos = clientToFrame(clientX, clientY);
    const width = 200;
    const height = 48;
    const newBlock: WireframeBlock = {
      id: makeId(),
      label: component.name,
      zone: "content",
      row: 0,
      order: 0,
      widthHint: "auto",
      heightHint: "compact",
      x: Math.round(pos.x - width / 2),
      y: Math.round(pos.y - height / 2),
      width,
      height,
      parentBlockId: null,
      kind: "ELEMENT",
      siblingOrder: nextRootSiblingOrder(),
      hidden: false,
      locked: false,
      shape: "rectangle",
      sourceComponentId: component.id,
    };
    commitBlocks([...blocksRef.current, newBlock]);
    setSelectedIds(new Set([newBlock.id]));
    setActiveTool("select");
  }

  // --- Ferramenta "Caneta" (Wireframe-1b): clicar e arrastar desenha um
  // traço livre, capturando os pontos do movimento e convertendo em um path
  // SVG simples ("M x y L x y ..."). Cria uma WireframeAnnotation (tabela à
  // parte, não um bloco estruturado) — não entra no histórico de undo/redo
  // dos blocos nem na árvore de Camadas dos blocos. ---
  function startDrawingAnnotation(event: ReactPointerEvent) {
    event.preventDefault();
    const start = clientToFrame(event.clientX, event.clientY);
    const points: { x: number; y: number }[] = [start];
    setPenPoints(points);

    function onMove(moveEvent: PointerEvent) {
      points.push(clientToFrame(moveEvent.clientX, moveEvent.clientY));
      setPenPoints([...points]);
    }
    async function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setPenPoints(null);
      setActiveTool("select");
      if (points.length < 2) return;
      const pathData = `M ${points.map((p) => `${Math.round(p.x)} ${Math.round(p.y)}`).join(" L ")}`;
      try {
        const res = await fetch(`/api/bridges/${bridge.id}/annotations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pathData }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) setAnnotations((prev) => [...prev, data.annotation]);
      } catch {
        // silencioso — perder um traço de anotação não trava o fluxo principal
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Arrastar um traço já existente (ferramenta Selecionar) move todos os
  // pontos juntos via offsetPathData — atualiza ao vivo no state e só grava
  // no servidor (PATCH) quando soltar o botão.
  function handleAnnotationPointerDown(event: ReactPointerEvent, annotation: ApiWireframeAnnotation) {
    if (activeToolRef.current !== "select") return;
    event.stopPropagation();
    setSelectedAnnotationId(annotation.id);
    setSelectedIds(new Set());
    // Anotação bloqueada (correção do bug da Caneta): seleciona (pra
    // permitir desbloquear via menu de contexto/Camadas) mas não arrasta.
    // Modo leitura (Wireframe-2): mesma ideia, seleciona pra inspecionar.
    if (annotation.locked || readOnly) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const originalPathData = annotation.pathData;
    let dx = 0;
    let dy = 0;

    function onMove(moveEvent: PointerEvent) {
      dx = (moveEvent.clientX - startX) / zoomRef.current;
      dy = (moveEvent.clientY - startY) / zoomRef.current;
      const shifted = offsetPathData(originalPathData, dx, dy);
      setAnnotations((prev) => prev.map((a) => (a.id === annotation.id ? { ...a, pathData: shifted } : a)));
    }
    async function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (dx === 0 && dy === 0) return;
      const moved = annotationsRef.current.find((a) => a.id === annotation.id);
      if (!moved) return;
      try {
        await fetch(`/api/bridges/${bridge.id}/annotations/${annotation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pathData: moved.pathData }),
        });
      } catch {
        // silencioso — a posição já está correta no state local
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  async function deleteAnnotationById(id: string) {
    if (readOnly) return;
    setSelectedAnnotationId((current) => (current === id ? null : current));
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    setContextMenu(null);
    try {
      await fetch(`/api/bridges/${bridge.id}/annotations/${id}`, { method: "DELETE" });
    } catch {
      // silencioso
    }
  }

  function deleteSelectedAnnotation() {
    if (selectedAnnotationId) deleteAnnotationById(selectedAnnotationId);
  }

  async function toggleAnnotationHidden(id: string) {
    if (readOnly) return;
    const current = annotationsRef.current.find((a) => a.id === id);
    if (!current) return;
    const nextHidden = !current.hidden;
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, hidden: nextHidden } : a)));
    setContextMenu(null);
    try {
      await fetch(`/api/bridges/${bridge.id}/annotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: nextHidden }),
      });
    } catch {
      // silencioso
    }
  }

  async function toggleAnnotationLocked(id: string) {
    if (readOnly) return;
    const current = annotationsRef.current.find((a) => a.id === id);
    if (!current) return;
    const nextLocked = !current.locked;
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, locked: nextLocked } : a)));
    setContextMenu(null);
    try {
      await fetch(`/api/bridges/${bridge.id}/annotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: nextLocked }),
      });
    } catch {
      // silencioso
    }
  }

  // --- Redimensionar uma anotação de Caneta pelas alças dos cantos
  // (correção do bug da Caneta): como o path é livre (não um retângulo),
  // redimensionar ESCALA todos os pontos proporcionalmente a partir da
  // caixa delimitadora atual, ancorada no canto OPOSTO ao arrastado — mesmo
  // padrão de dx/dy dividido pelo zoom usado no resize de blocos, só que
  // aplicado via scalePathData em vez de width/height diretos. ---
  function handleAnnotationResizePointerDown(event: ReactPointerEvent, annotation: ApiWireframeAnnotation, corner: "nw" | "ne" | "se" | "sw") {
    event.stopPropagation();
    event.preventDefault();
    if (readOnly) return;
    const box = getAnnotationBoundingBox(annotation.pathData);
    const startWidth = Math.max(1, box.maxX - box.minX);
    const startHeight = Math.max(1, box.maxY - box.minY);
    const anchorX = corner.includes("w") ? box.maxX : box.minX;
    const anchorY = corner.includes("n") ? box.maxY : box.minY;
    const originalPathData = annotation.pathData;
    const startX = event.clientX;
    const startY = event.clientY;

    function onMove(moveEvent: PointerEvent) {
      const dx = (moveEvent.clientX - startX) / zoomRef.current;
      const dy = (moveEvent.clientY - startY) / zoomRef.current;
      let newWidth = startWidth;
      let newHeight = startHeight;
      if (corner.includes("e")) newWidth = Math.max(4, startWidth + dx);
      if (corner.includes("w")) newWidth = Math.max(4, startWidth - dx);
      if (corner.includes("s")) newHeight = Math.max(4, startHeight + dy);
      if (corner.includes("n")) newHeight = Math.max(4, startHeight - dy);
      const sx = newWidth / startWidth;
      const sy = newHeight / startHeight;
      const scaled = scalePathData(originalPathData, anchorX, anchorY, sx, sy);
      setAnnotations((prev) => prev.map((a) => (a.id === annotation.id ? { ...a, pathData: scaled } : a)));
    }
    async function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const current = annotationsRef.current.find((a) => a.id === annotation.id);
      if (!current || current.pathData === originalPathData) return;
      try {
        await fetch(`/api/bridges/${bridge.id}/annotations/${annotation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pathData: current.pathData }),
        });
      } catch {
        // silencioso — a forma já está correta no state local
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function handleAnnotationContextMenu(event: ReactMouseEvent, annotation: ApiWireframeAnnotation) {
    event.preventDefault();
    event.stopPropagation();
    if (readOnly) return;
    setSelectedAnnotationId(annotation.id);
    setSelectedIds(new Set());
    setContextMenu({ x: event.clientX, y: event.clientY, target: { type: "annotation", id: annotation.id } });
  }

  // Tecla Delete/Backspace apaga o traço de anotação selecionado (não
  // interfere com blocos — esses já têm sua própria exclusão via menu de
  // contexto/Propriedades, e não reage se o foco estiver num campo de texto).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if ((event.key === "Delete" || event.key === "Backspace") && selectedAnnotationId) {
        event.preventDefault();
        deleteSelectedAnnotation();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAnnotationId]);

  // --- Painel lateral único (Camadas/Propriedades/Comentários em
  // acordeão): abrir/fechar o painel inteiro, expandir/recolher uma seção,
  // e o gatilho específico de criar/abrir um comentário (que força
  // Comentários expandida + Camadas recolhida, mesmo que já estivesse
  // expandida antes). ---
  function toggleSidePanel() {
    if (sidePanelOpen) {
      setSidePanelOpen(false);
    } else {
      setSidePanelOpen(true);
      setExpandedSections(new Set<"camadas" | "comentarios">(["camadas"]));
    }
  }

  function toggleSection(section: "camadas" | "comentarios") {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  function openCommentsPanel() {
    setSidePanelOpen(true);
    setExpandedSections(new Set<"camadas" | "comentarios">(["comentarios"]));
  }

  // Clicar numa thread na lista da seção Comentários "volta" o foco pro
  // pino correspondente no canvas: abre a thread E centraliza a rolagem do
  // canvas nele (mesma matemática de pan usada pelo minimapa).
  function focusComment(comment: ApiWireframeComment) {
    setActiveCommentId(comment.id);
    const container = canvasScrollRef.current;
    const frame = frameRef.current;
    if (!container || !frame) return;
    container.scrollLeft = Math.max(0, frame.offsetLeft + comment.x * zoomRef.current - container.clientWidth / 2);
    container.scrollTop = Math.max(0, frame.offsetTop + comment.y * zoomRef.current - container.clientHeight / 2);
  }

  // --- Ferramenta "Comentário" (Wireframe-1b): clicar posiciona um pino e
  // abre o campo de texto do comentário inicial. ---
  function startNewComment(event: ReactPointerEvent) {
    event.preventDefault();
    if (readOnly) return;
    const pos = clientToFrame(event.clientX, event.clientY);
    setActiveCommentId(null);
    setPendingCommentPos(pos);
    setPendingCommentText("");
    setActiveTool("select");
    openCommentsPanel();
  }

  async function submitNewComment() {
    if (!pendingCommentPos || !pendingCommentText.trim() || readOnly) return;
    try {
      const res = await fetch(`/api/bridges/${bridge.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: pendingCommentPos.x, y: pendingCommentPos.y, text: pendingCommentText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setComments((prev) => [...prev, data.comment]);
        setActiveCommentId(data.comment.id);
      }
    } catch {
      // silencioso
    }
    setPendingCommentPos(null);
    setPendingCommentText("");
  }

  async function submitReply(commentId: string) {
    if (!replyDraft.trim() || readOnly) return;
    const text = replyDraft.trim();
    setReplyDraft("");
    try {
      const res = await fetch(`/api/bridges/${bridge.id}/comments/${commentId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, replies: [...c.replies, data.reply] } : c)));
    } catch {
      // silencioso
    }
  }

  async function toggleCommentResolved(comment: ApiWireframeComment) {
    if (readOnly) return;
    try {
      const res = await fetch(`/api/bridges/${bridge.id}/comments/${comment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: !comment.resolved }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setComments((prev) => prev.map((c) => (c.id === comment.id ? data.comment : c)));
    } catch {
      // silencioso
    }
  }

  function handlePropertyChange(patch: Partial<WireframeBlock>) {
    if (!selectedBlock || readOnly) return;
    updateBlockLive(selectedBlock.id, patch);
  }
  function commitPropertyChange() {
    if (!selectedBlock || readOnly) return;
    commitBlocks(blocksRef.current);
  }

  // --- Agrupar seleção (Ajuste 4 — Ctrl+G / menu de contexto) ---
  function groupSelection() {
    if (readOnly) return;
    const ids = selectedIdsRef.current;
    if (ids.size < 2) return;
    const current = blocksRef.current;
    const selected = current.filter((b) => ids.has(b.id));
    const minX = Math.min(...selected.map((b) => b.x));
    const minY = Math.min(...selected.map((b) => b.y));
    const maxX = Math.max(...selected.map((b) => b.x + b.width));
    const maxY = Math.max(...selected.map((b) => b.y + b.height));

    const parentBlockId = selected[0].parentBlockId ?? null;
    const siblingsAtLevel = current.filter((b) => b.parentBlockId === parentBlockId);
    const nextSiblingOrder = siblingsAtLevel.length > 0 ? Math.max(...siblingsAtLevel.map((b) => b.siblingOrder)) + 1 : 0;

    const groupBlock: WireframeBlock = {
      id: makeId(),
      label: "Grupo",
      zone: selected[0].zone,
      row: selected[0].row,
      order: selected[0].order,
      widthHint: "auto",
      heightHint: "compact",
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      parentBlockId,
      kind: "GROUP",
      siblingOrder: nextSiblingOrder,
      hidden: false,
      locked: false,
      shape: "rectangle",
      sourceComponentId: null,
    };

    let childOrder = 0;
    const next = current.map((b) => (ids.has(b.id) ? { ...b, parentBlockId: groupBlock.id, siblingOrder: childOrder++ } : b));
    next.push(groupBlock);

    commitBlocks(next);
    setSelectedIds(new Set([groupBlock.id]));
    setContextMenu(null);
  }

  // Desfaz um agrupamento: os filhos diretos do GROUP sobem pro nível do
  // próprio GROUP (seu parentBlockId), o bloco GROUP é removido. Contrário
  // de groupSelection — usado pelo menu de contexto quando o item clicado é
  // um GROUP (Ajuste 2).
  function ungroupBlock(groupId: string) {
    if (readOnly) return;
    const current = blocksRef.current;
    const group = current.find((b) => b.id === groupId);
    if (!group || group.kind !== "GROUP") return;

    const grandParentId = group.parentBlockId;
    const siblingsAtLevel = current.filter((b) => b.parentBlockId === grandParentId && b.id !== groupId);
    let nextOrder = siblingsAtLevel.length > 0 ? Math.max(...siblingsAtLevel.map((b) => b.siblingOrder)) + 1 : 0;

    const freedIds: string[] = [];
    const next = current
      .filter((b) => b.id !== groupId)
      .map((b) => {
        if (b.parentBlockId !== groupId) return b;
        freedIds.push(b.id);
        return { ...b, parentBlockId: grandParentId, siblingOrder: nextOrder++ };
      });

    commitBlocks(next);
    setSelectedIds(new Set(freedIds));
    setContextMenu(null);
  }

  // Adiciona um texto livre/anotação (Ajuste 2) posicionado dentro dos
  // limites do bloco/grupo clicado. Vira filho do alvo se o alvo for um
  // GROUP (organização hierárquica de verdade); senão vira irmão do alvo
  // (mesmo parentBlockId), já que um ELEMENT não pode ter filhos.
  function addTextAnnotation(targetId: string) {
    if (readOnly) return;
    const current = blocksRef.current;
    const target = current.find((b) => b.id === targetId);
    if (!target) return;

    const parentBlockId = target.kind === "GROUP" ? target.id : target.parentBlockId;
    const siblingsAtLevel = current.filter((b) => b.parentBlockId === parentBlockId);
    const nextOrder = siblingsAtLevel.length > 0 ? Math.max(...siblingsAtLevel.map((b) => b.siblingOrder)) + 1 : 0;
    const width = Math.min(160, Math.max(MIN_BLOCK_SIZE, target.width));
    const height = 32;

    const newBlock: WireframeBlock = {
      id: makeId(),
      label: "Texto",
      zone: target.zone,
      row: target.row,
      order: target.order,
      widthHint: "auto",
      heightHint: "compact",
      x: Math.round(target.x + (target.width - width) / 2),
      y: Math.round(target.y + (target.height - height) / 2),
      width,
      height,
      parentBlockId,
      kind: "ELEMENT",
      siblingOrder: nextOrder,
      hidden: false,
      locked: false,
      shape: "text",
      sourceComponentId: null,
    };

    commitBlocks([...current, newBlock]);
    setSelectedIds(new Set([newBlock.id]));
    setContextMenu(null);
  }

  // Ocultar/Mostrar e Bloquear/Desbloquear (Ajuste 2 + 3): alterna com base
  // em "algum dos selecionados está no estado oposto" — se qualquer um
  // estiver visível/destravado, a ação vira "ocultar/bloquear todos"; só
  // quando TODOS já estão ocultos/bloqueados é que a ação reverte.
  function toggleHidden(ids: Set<string>) {
    if (readOnly) return;
    const current = blocksRef.current;
    const nextHidden = current.some((b) => ids.has(b.id) && !b.hidden);
    commitBlocks(current.map((b) => (ids.has(b.id) ? { ...b, hidden: nextHidden } : b)));
    setContextMenu(null);
  }

  function toggleLocked(ids: Set<string>) {
    if (readOnly) return;
    const current = blocksRef.current;
    const nextLocked = current.some((b) => ids.has(b.id) && !b.locked);
    commitBlocks(current.map((b) => (ids.has(b.id) ? { ...b, locked: nextLocked } : b)));
    setContextMenu(null);
  }

  // Apaga os blocos selecionados + todos os descendentes (se algum for GROUP).
  function deleteBlocks(ids: Set<string>) {
    if (readOnly) return;
    const current = blocksRef.current;
    const allIds = new Set(ids);
    for (const id of Array.from(ids)) {
      for (const descendantId of Array.from(collectDescendantIds(id, current))) allIds.add(descendantId);
    }
    commitBlocks(current.filter((b) => !allIds.has(b.id)));
    setSelectedIds(new Set());
    setContextMenu(null);
  }

  // Atalho Ctrl+G / Cmd+G pra agrupar.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "g") {
        event.preventDefault();
        groupSelection();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- groupSelection só lê blocksRef/selectedIdsRef (refs, sempre atuais) e setters estáveis, então o listener nunca fica desatualizado mesmo registrado uma única vez.
  }, []);

  // Fecha o menu de contexto ao clicar fora ou apertar Escape.
  useEffect(() => {
    if (!contextMenu) return;
    function close() {
      setContextMenu(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  // Painel de Componentes (Wireframe-1c): fecha sozinho (volta a ferramenta
  // pra "select") ao clicar fora dele — exceto no próprio botão que o abre/
  // fecha, cujo onClick já cuida do toggle; sem essa exclusão, o clique pra
  // FECHAR pelo botão reabriria o painel (pointerdown já teria revertido pra
  // "select" antes do onClick do botão rodar e alternar de novo).
  useEffect(() => {
    if (activeTool !== "components") return;
    function onPointerDownOutside(event: PointerEvent) {
      const target = event.target as Node;
      if (componentsPanelRef.current?.contains(target)) return;
      if (componentsButtonRef.current?.contains(target)) return;
      setActiveTool("select");
    }
    window.addEventListener("pointerdown", onPointerDownOutside);
    return () => window.removeEventListener("pointerdown", onPointerDownOutside);
  }, [activeTool]);

  function handleBlockContextMenu(event: ReactMouseEvent, block: WireframeBlock) {
    event.preventDefault();
    event.stopPropagation();
    if (readOnly) return;
    if (!selectedIds.has(block.id)) setSelectedIds(new Set([block.id]));
    setSelectedAnnotationId(null);
    setContextMenu({ x: event.clientX, y: event.clientY, target: { type: "block", id: block.id } });
  }

  // --- Ctrl+scroll = zoom centralizado no cursor (Ajuste 1). Precisa de um
  // listener NATIVO (não o onWheel do React) porque o React anexa o wheel
  // como passivo por padrão — preventDefault() dentro de um onWheel comum
  // não impede o scroll/zoom nativo do navegador de forma confiável.
  useEffect(() => {
    const container = canvasScrollRef.current;
    if (!container) return;

    function onWheel(event: WheelEvent) {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const frame = frameRef.current;
      if (!frame) return;

      const frameRect = frame.getBoundingClientRect();
      const cursorFrameX = event.clientX - frameRect.left;
      const cursorFrameY = event.clientY - frameRect.top;
      const currentZoom = zoomRef.current;
      const trueX = cursorFrameX / currentZoom;
      const trueY = cursorFrameY / currentZoom;

      const factor = Math.exp(-event.deltaY * 0.001);
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom * factor));

      const newCursorFrameX = trueX * nextZoom;
      const newCursorFrameY = trueY * nextZoom;
      pendingScrollAdjustRef.current = { dx: newCursorFrameX - cursorFrameX, dy: newCursorFrameY - cursorFrameY };

      setZoom(nextZoom);
    }

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (centerPendingRef.current) {
      centerPendingRef.current = false;
      centerScrollIfOverflowing();
      return;
    }
    const adjust = pendingScrollAdjustRef.current;
    const container = canvasScrollRef.current;
    if (adjust && container) {
      container.scrollLeft += adjust.dx;
      container.scrollTop += adjust.dy;
      pendingScrollAdjustRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- centerFrame só lê refs estáveis (canvasScrollRef/frameRef), não precisa entrar nas deps.
  }, [zoom]);

  // --- Pan: botão do meio (qualquer ferramenta) ou botão esquerdo com a
  // ferramenta "Mão" ativa (Ajuste 2). Pointer Events (não Mouse Events) —
  // arrastar com gesto de trackpad (sem botão físico de mouse) nem sempre
  // dispara mousedown/mousemove/mouseup de forma confiável, mas sempre
  // dispara pointerdown/pointermove/pointerup, que cobre mouse/caneta/touch
  // com a mesma API. ---
  function startPan(event: ReactPointerEvent) {
    const container = canvasScrollRef.current;
    if (!container) return;
    panStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: container.scrollLeft,
      startScrollTop: container.scrollTop,
    };
    function onMove(moveEvent: PointerEvent) {
      const pan = panStateRef.current;
      if (!pan || !container) return;
      container.scrollLeft = pan.startScrollLeft - (moveEvent.clientX - pan.startX);
      container.scrollTop = pan.startScrollTop - (moveEvent.clientY - pan.startY);
    }
    function onUp() {
      panStateRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function handleCanvasMouseDown(event: ReactPointerEvent) {
    if (event.button === 1 || (event.button === 0 && activeTool === "hand")) {
      event.preventDefault();
      startPan(event);
      return;
    }
    if (event.button !== 0) return;

    // Wireframe-1b: ferramentas de desenho/comentário — cada uma trata seu
    // próprio gesto de clique/arraste (ver funções startDrawingBlock,
    // startDrawingAnnotation, createTextBlock, startNewComment acima). Modo
    // leitura (Wireframe-2): nenhuma delas é alcançável de verdade (os
    // botões dessas ferramentas ficam desabilitados), mas a checagem fica
    // aqui também em defesa — pan e limpar seleção continuam liberados, são
    // só navegação/inspeção, não edição.
    if (!readOnly) {
      if (activeTool === "frame" || activeTool === "ellipse") {
        startDrawingBlock(event, activeTool === "ellipse" ? "ellipse" : "rectangle");
        return;
      }
      if (activeTool === "pen") {
        startDrawingAnnotation(event);
        return;
      }
      if (activeTool === "text") {
        createTextBlock(event);
        return;
      }
      if (activeTool === "comment") {
        startNewComment(event);
        return;
      }
    }

    setSelectedIds(new Set());
    setSelectedAnnotationId(null);
    setContextMenu(null);
    setActiveCommentId(null);
  }

  // --- Tela cheia (Ajuste 3) — chamado DIRETO no clique (gesto síncrono do
  // usuário; navegadores recusam requestFullscreen fora disso), com o erro
  // da Promise tratado em vez de ignorado silenciosamente. ---
  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === editorRootRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      editorRootRef.current?.requestFullscreen().catch(() => {
        setActionError("Não foi possível entrar em tela cheia neste navegador.");
      });
    }
  }

  async function handleApprove() {
    setApproveBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/bridges/${bridge.id}/approve-wireframe`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao aprovar o wireframe.");
      onUpdate(data.bridge);
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Falha ao aprovar o wireframe.");
    } finally {
      setApproveBusy(false);
    }
  }

  // Wireframe-2: botão "Aprovar e Exportar" (fase do UX, substitui "Tentar
  // de novo"/"Aprovar Wireframe" da fase do PO) — gera o SVG final no
  // servidor, muda o status pra FINALIZADO, e abre o modal de confirmação
  // com o link pra baixar (ver exportResult). Não navega pra fora do editor
  // sozinho: bridge.status já reflete FINALIZADO depois do onUpdate, então o
  // header some de botões de ação, mas o canvas continua visível (modo
  // leitura) até o usuário clicar em "Concluir" no modal.
  async function handleApproveAndExport() {
    if (readOnly) return;
    setExportBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/bridges/${bridge.id}/approve-ux`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao aprovar e exportar.");
      onUpdate(data.bridge);
      setExportResult({ svgUrl: data.bridge.wireframeExportUrl });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Falha ao aprovar e exportar.");
    } finally {
      setExportBusy(false);
    }
  }

  async function handleRegenerate() {
    if (!regenerateComment.trim()) return;
    setRegenerateBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/bridges/${bridge.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: regenerateComment.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao gerar de novo.");
      onUpdate(data.bridge);
      setRegenerateOpen(false);
      setRegenerateComment("");
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Falha ao gerar de novo.");
    } finally {
      setRegenerateBusy(false);
    }
  }

  async function openAssignMenu() {
    setAssignOpen((v) => !v);
    if (!assignableUsers) {
      try {
        const res = await fetch(`/api/bridges/${bridge.id}/assignable-users`);
        const data = await res.json().catch(() => ({}));
        if (res.ok) setAssignableUsers(data.users ?? []);
      } catch {
        setAssignableUsers([]);
      }
    }
  }

  async function assignUx(userId: string | null) {
    setAssignOpen(false);
    try {
      const res = await fetch(`/api/bridges/${bridge.id}/assign-ux`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) onUpdate(data.bridge);
    } catch {
      // silencioso — não é uma ação crítica pro fluxo de aprovação
    }
  }

  function zoomTo(next: number) {
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next)));
  }

  // --- Reatribuir pai OU reordenar entre irmãos na árvore de Camadas via
  // drag-and-drop (Ajuste 3, item 5). "inside" reparenta pra dentro de um
  // GROUP (comportamento original); "before"/"after" reordena o item como
  // irmão do alvo no MESMO nível do alvo (pode ser um reparenting também,
  // se o alvo estiver em outro nível — só não entra "dentro" dele). ---
  function handleLayerDrop(targetId: string | "root", position: "before" | "after" | "inside" = "inside") {
    const draggedId = draggedLayerId;
    setDraggedLayerId(null);
    setLayerDropTargetId(null);
    if (!draggedId || targetId === draggedId || readOnly) return;

    const current = blocksRef.current;

    if (targetId === "root") {
      const siblings = current.filter((b) => b.parentBlockId === null && b.id !== draggedId);
      const nextOrder = siblings.length > 0 ? Math.max(...siblings.map((b) => b.siblingOrder)) + 1 : 0;
      commitBlocks(current.map((b) => (b.id === draggedId ? { ...b, parentBlockId: null, siblingOrder: nextOrder } : b)));
      return;
    }

    // nunca deixa um bloco virar filho/irmão dentro da própria subárvore (ciclo).
    const descendants = collectDescendantIds(draggedId, current);
    if (descendants.has(targetId)) return;
    const targetBlock = current.find((b) => b.id === targetId);
    if (!targetBlock) return;

    if (position === "inside") {
      if (targetBlock.kind !== "GROUP") return;
      const siblings = current.filter((b) => b.parentBlockId === targetId && b.id !== draggedId);
      const nextOrder = siblings.length > 0 ? Math.max(...siblings.map((b) => b.siblingOrder)) + 1 : 0;
      commitBlocks(current.map((b) => (b.id === draggedId ? { ...b, parentBlockId: targetId, siblingOrder: nextOrder } : b)));
      return;
    }

    // "before"/"after": vira irmão do alvo no nível do alvo — reordena a
    // pilha de empilhamento (z-index visual) entre os irmãos existentes,
    // renumerando siblingOrder de todos consecutivamente (0..n) pra nunca
    // colidir com a ordem antiga.
    const newParentId = targetBlock.parentBlockId;
    const siblingIds = current
      .filter((b) => b.parentBlockId === newParentId && b.id !== draggedId)
      .sort((a, b) => a.siblingOrder - b.siblingOrder)
      .map((b) => b.id);
    const targetIndex = siblingIds.indexOf(targetId);
    const insertIndex = position === "before" ? targetIndex : targetIndex + 1;
    const reorderedIds = [...siblingIds.slice(0, insertIndex), draggedId, ...siblingIds.slice(insertIndex)];
    const orderById = new Map(reorderedIds.map((id, index) => [id, index]));

    const next = current.map((b) => {
      if (b.id === draggedId) return { ...b, parentBlockId: newParentId, siblingOrder: orderById.get(draggedId)! };
      if (orderById.has(b.id)) return { ...b, siblingOrder: orderById.get(b.id)! };
      return b;
    });
    commitBlocks(next);
  }

  const saveLabel =
    saveState === "saving" ? "Salvando..." : saveState === "error" ? "Falha ao salvar" : saveState === "pending" ? "Editando..." : "Salvo agora";

  const tree = useMemo(() => buildTree(blocks), [blocks]);
  const canGroup = selectedIds.size >= 2;
  const selectedBlocksList = blocks.filter((b) => selectedIds.has(b.id));
  const allSelectedHidden = selectedBlocksList.length > 0 && selectedBlocksList.every((b) => b.hidden);
  const allSelectedLocked = selectedBlocksList.length > 0 && selectedBlocksList.every((b) => b.locked);
  const contextMenuBlock = contextMenu && contextMenu.target.type === "block" ? blocks.find((b) => b.id === contextMenu.target.id) ?? null : null;
  const contextMenuAnnotation =
    contextMenu && contextMenu.target.type === "annotation" ? annotations.find((a) => a.id === contextMenu.target.id) ?? null : null;
  // Correção do bug da Caneta: alças de redimensionamento da anotação
  // selecionada — só faz sentido mostrar quando ela está visível e
  // destravada (igual ao tratamento de blocos selecionados/bloqueados).
  const selectedAnnotation = selectedAnnotationId ? annotations.find((a) => a.id === selectedAnnotationId) ?? null : null;
  const selectedAnnotationBox = selectedAnnotation ? getAnnotationBoundingBox(selectedAnnotation.pathData) : null;
  const SIDE_PANEL_WIDTH = 320;

  // Wireframe-1c: componentes filtrados pelo campo de busca do painel de
  // Componentes (substring case-insensitive no nome).
  const filteredDragComponents = componentSearch.trim()
    ? dragComponents.filter((c) => c.name.toLowerCase().includes(componentSearch.trim().toLowerCase()))
    : dragComponents;

  // Ajuste 1: padding-esquerdo/topo dinâmico — cresce além do mínimo
  // (clearance pro painel de ferramentas flutuante / toolbar) só quando
  // sobra espaço de verdade, centralizando o frame em telas largas em vez
  // de deixar toda a folga acumulada de um lado só.
  const MIN_CANVAS_PAD_X = 130;
  const MIN_CANVAS_PAD_Y = 64;
  const canvasPadLeft = Math.max(MIN_CANVAS_PAD_X, (canvasViewport.width - frameWidth * zoom) / 2);
  const canvasPadTop = Math.max(MIN_CANVAS_PAD_Y, (canvasViewport.height - frameHeight * zoom) / 2);

  // Wireframe-1b: comentários filtrados pelo modo ativo (todos/abertos/
  // resolvidos) e a thread atualmente aberta pra leitura/resposta.
  const visibleComments = comments.filter((c) => (commentFilter === "all" ? true : commentFilter === "open" ? !c.resolved : c.resolved));
  const activeComment = activeCommentId ? (comments.find((c) => c.id === activeCommentId) ?? null) : null;
  const openCommentCount = comments.filter((c) => !c.resolved).length;

  // Ajuste B: retângulo indicador da área visível dentro do minimapa —
  // converte scrollPos/zoom/canvasViewport (área visível de verdade do
  // canvas) pra coordenadas do frame, depois pra porcentagem (mesmo sistema
  // usado pra posicionar os blocos em miniatura logo abaixo).
  const frameOffsetLeft = frameRef.current?.offsetLeft ?? canvasPadLeft;
  const frameOffsetTop = frameRef.current?.offsetTop ?? canvasPadTop;
  const visibleLeftFrame = Math.max(0, (scrollPos.left - frameOffsetLeft) / zoom);
  const visibleTopFrame = Math.max(0, (scrollPos.top - frameOffsetTop) / zoom);
  const visibleWidthFrame = Math.min(frameWidth - visibleLeftFrame, canvasViewport.width / zoom);
  const visibleHeightFrame = Math.min(frameHeight - visibleTopFrame, canvasViewport.height / zoom);

  return (
    <div ref={editorRootRef} className="flex h-full flex-col overflow-hidden bg-[#f3f3f4] text-[#1d1d1f]">
      {/* Subheader */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e4e4e7] bg-white px-6 py-3.5">
        <a
          href="/bridges"
          aria-label="Voltar"
          className="grid h-[37px] w-[37px] shrink-0 place-items-center rounded-lg border border-[#dcdce0] bg-white text-[#1d1d1f] hover:bg-[#f7f7f8]"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </a>
        <h1 className="text-lg font-semibold text-[#141416]">{bridge.planet.name}</h1>
        <span className="rounded-2xl bg-[#f0f0f1] px-3.5 py-1.5 text-[13.5px] text-[#55555b]">Wireframe</span>
        <span className={`flex items-center gap-1.5 text-[13.5px] ${saveState === "error" ? "text-luminous-error" : "text-[#55555b]"}`}>
          <CloudIcon className="h-4 w-4" />
          {saveLabel}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {actionError && <p className="mr-2 text-sm text-luminous-error">{actionError}</p>}
          <div className="flex items-center -space-x-1.5">
            <Avatar name={bridge.poUser?.name ?? "PO"} avatarUrl={bridge.poUser?.avatarUrl} size={35} />
            <Avatar name={bridge.uxUser?.name ?? "UX"} avatarUrl={bridge.uxUser?.avatarUrl} size={35} />
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={openAssignMenu}
              aria-label="Atribuir UX"
              className="grid h-[35px] w-[35px] place-items-center rounded-full border border-[#e0e0e3] bg-white text-[#1d1d1f] hover:bg-[#f7f7f8]"
            >
              <PlusIcon className="h-3.5 w-3.5" />
            </button>
            {assignOpen && (
              <div className="absolute right-0 top-10 z-30 w-56 overflow-hidden rounded-lg border border-[#e4e4e7] bg-white py-1 shadow-lg">
                <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93]">Atribuir UX</p>
                {assignableUsers === null ? (
                  <p className="px-3 py-2 text-sm text-[#8e8e93]">Carregando...</p>
                ) : assignableUsers.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-[#8e8e93]">Nenhum usuário encontrado.</p>
                ) : (
                  assignableUsers.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => assignUx(candidate.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#1d1d1f] hover:bg-[#f7f7f8]"
                    >
                      <Avatar name={candidate.name} avatarUrl={candidate.avatarUrl} size={24} />
                      {candidate.name}
                    </button>
                  ))
                )}
                {bridge.uxUserId && (
                  <button
                    type="button"
                    onClick={() => assignUx(null)}
                    className="mt-1 flex w-full items-center gap-2 border-t border-[#eee] px-3 py-2 text-left text-sm text-[#8e8e93] hover:bg-[#f7f7f8]"
                  >
                    Remover atribuição
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mx-1 h-[30px] w-px bg-[#e4e4e7]" />

          {bridge.status === "AGUARDANDO_APROVACAO_WIREFRAME_PO" && (
            <>
              <button
                type="button"
                onClick={() => setRegenerateOpen(true)}
                aria-label="Tentar de novo"
                className="flex items-center gap-2 rounded-lg border border-[#e6e6e9] bg-white px-4 py-2.5 text-[14.5px] text-[#0077ff] hover:bg-[#f7f7f8]"
              >
                <ThumbsDownIcon className="h-4 w-4" />
                Tentar de novo
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={approveBusy}
                className="flex items-center gap-2 rounded-lg bg-[#7c3aed] px-6 py-2.5 text-[14.5px] font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-60"
              >
                <CheckIcon className="h-3.5 w-3.5" />
                {approveBusy ? "Aprovando..." : "Aprovar Wireframe"}
              </button>
            </>
          )}

          {/* Wireframe-2: fase do UX — só quem pode editar (uxUserId/ADMIN)
              vê o botão de aprovar e exportar; o PO em modo leitura vê só um
              aviso explicando por que não há ações pra ele aqui. */}
          {bridge.status === "AGUARDANDO_APROVACAO_UX" &&
            (readOnly ? (
              <span className="text-[13.5px] text-[#8e8e93]">Modo leitura — aguardando aprovação do UX</span>
            ) : (
              <button
                type="button"
                onClick={handleApproveAndExport}
                disabled={exportBusy}
                className="flex items-center gap-2 rounded-lg bg-[#7c3aed] px-6 py-2.5 text-[14.5px] font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-60"
              >
                <CheckIcon className="h-3.5 w-3.5" />
                {exportBusy ? "Exportando..." : "Aprovar e Exportar"}
              </button>
            ))}
        </div>
      </div>

      {/* Corpo: toolbar flutuante + painéis + canvas */}
      <div className="relative min-h-0 flex-1 bg-[#f3f3f4]">
        {/* Toolbar flutuante centralizada */}
        <div className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-1 rounded-[14px] bg-white py-0 pl-3 pr-2.5 shadow-[0_1px_2px_rgba(0,0,0,.06),0_4px_14px_rgba(0,0,0,.06)]">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo || readOnly}
            aria-label="Desfazer"
            className="grid h-[34px] w-[38px] place-items-center rounded-lg text-[#1d1d1f] hover:bg-[#f2f2f3] disabled:text-[#b4b4b9] disabled:hover:bg-transparent"
          >
            <UndoIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo || readOnly}
            aria-label="Refazer"
            className="grid h-[34px] w-[38px] place-items-center rounded-lg text-[#1d1d1f] hover:bg-[#f2f2f3] disabled:text-[#b4b4b9] disabled:hover:bg-transparent"
          >
            <RedoIcon className="h-4 w-4" />
          </button>
          <div className="mx-1 h-[26px] w-px bg-[#e7e7ea]" />
          <div className="relative">
            <button
              type="button"
              onClick={() => setZoomMenuOpen((v) => !v)}
              className="flex h-[34px] items-center gap-3 rounded-full border border-[#e6e6e9] px-3.5 text-[13.5px] font-medium text-[#1d1d1f] hover:bg-[#f7f7f8]"
            >
              {Math.round(zoom * 100)}%
              <ChevronDownIcon className="h-3 w-3" />
            </button>
            {zoomMenuOpen && (
              <div className="absolute left-1/2 top-10 z-30 w-24 -translate-x-1/2 overflow-hidden rounded-lg border border-[#e4e4e7] bg-white py-1 shadow-lg">
                {ZOOM_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      centerPendingRef.current = true;
                      zoomTo(preset);
                      setZoomMenuOpen(false);
                    }}
                    className="block w-full px-3 py-1.5 text-left text-sm text-[#1d1d1f] hover:bg-[#f7f7f8]"
                  >
                    {Math.round(preset * 100)}%
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mx-1 h-[26px] w-px bg-[#e7e7ea]" />
          <button
            type="button"
            onClick={() => setShowGrid((v) => !v)}
            aria-label="Alternar grade"
            aria-pressed={showGrid}
            className={`grid h-[34px] w-[34px] place-items-center rounded-lg ${showGrid ? "bg-[#f1ebfe] text-[#7c3aed]" : "text-[#1d1d1f] hover:bg-[#f2f2f3]"}`}
          >
            <GridIcon className="h-4 w-4" />
          </button>
          {comments.length > 0 && (
            <>
              <div className="mx-1 h-[26px] w-px bg-[#e7e7ea]" />
              <button
                type="button"
                onClick={() => setCommentFilter((f) => (f === "all" ? "open" : f === "open" ? "resolved" : "all"))}
                title="Alternar filtro de comentários (todos / abertos / resolvidos)"
                className="flex h-[34px] items-center gap-1.5 rounded-full border border-[#e6e6e9] px-3 text-[13px] font-medium text-[#1d1d1f] hover:bg-[#f7f7f8]"
              >
                <CommentToolIcon className="h-3.5 w-3.5" />
                {commentFilter === "all"
                  ? `${comments.length} comentários (${openCommentCount} abertos)`
                  : commentFilter === "open"
                    ? `${openCommentCount} abertos`
                    : `${comments.length - openCommentCount} resolvidos`}
              </button>
            </>
          )}
        </div>

        {/* Painel de ferramentas à esquerda */}
        <div className="absolute left-[30px] top-[30px] z-20 flex w-[63px] flex-col items-center gap-2 rounded-[10px] bg-white pt-[13px] pb-[13px] shadow-[0_1px_2px_rgba(0,0,0,.05),0_2px_10px rgba(0,0,0,.04)]">
          <ToolButton active={activeTool === "select"} onClick={() => setActiveTool("select")} label="Selecionar">
            <SelectToolIcon className="h-[18px] w-[18px]" />
          </ToolButton>
          <ToolButton active={activeTool === "hand"} onClick={() => setActiveTool("hand")} label="Mão (arrastar tela)">
            <HandToolIcon className="h-[18px] w-[18px]" />
          </ToolButton>
          <ToolButton active={activeTool === "frame"} onClick={() => setActiveTool("frame")} label="Frame" disabled={readOnly}>
            <FrameToolIcon className="h-[18px] w-[18px]" />
          </ToolButton>
          <ToolButton active={activeTool === "ellipse"} onClick={() => setActiveTool("ellipse")} label="Elipse" disabled={readOnly}>
            <EllipseToolIcon className="h-[18px] w-[18px]" />
          </ToolButton>
          <div ref={componentsButtonRef}>
            <ToolButton
              active={activeTool === "components"}
              onClick={() => setActiveTool((t) => (t === "components" ? "select" : "components"))}
              label="Componentes"
              disabled={readOnly}
            >
              <ComponentsToolIcon className="h-[18px] w-[18px]" />
            </ToolButton>
          </div>
          <ToolButton active={activeTool === "pen"} onClick={() => setActiveTool("pen")} label="Caneta" disabled={readOnly}>
            <PenToolIcon className="h-[18px] w-[18px]" />
          </ToolButton>
          <ToolButton active={activeTool === "text"} onClick={() => setActiveTool("text")} label="Texto" disabled={readOnly}>
            <TextToolIcon className="h-[18px] w-[18px]" />
          </ToolButton>
          <ToolButton active={activeTool === "comment"} onClick={() => setActiveTool("comment")} label="Comentário" disabled={readOnly}>
            <CommentToolIcon className="h-[18px] w-[18px]" />
          </ToolButton>
        </div>

        {/* Painel flutuante de Componentes (Wireframe-1c) — aberto enquanto
            activeTool === "components"; fecha sozinho ao trocar de
            ferramenta ou clicar fora (ver efeito de pointerdown acima). Fica
            ao lado da coluna de ferramentas, nunca sobre o canvas/painel
            lateral direito. */}
        {activeTool === "components" && (
          <div
            ref={componentsPanelRef}
            className="absolute left-[105px] top-[30px] z-30 flex max-h-[min(70vh,560px)] w-72 flex-col rounded-[10px] bg-white shadow-[0_1px_2px_rgba(0,0,0,.05),0_2px_10px_rgba(0,0,0,.04)]"
          >
            <div className="border-b border-[#f0f0f1] p-3">
              <p className="mb-2 text-[13px] font-semibold text-[#141416]">Componentes</p>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8e8e93]" />
                <input
                  type="text"
                  value={componentSearch}
                  onChange={(event) => setComponentSearch(event.target.value)}
                  placeholder="Buscar componente..."
                  className="w-full rounded-md border border-[#e4e4e7] py-1.5 pl-8 pr-2.5 text-[13px] text-[#1d1d1f] outline-none focus:border-[#7c3aed]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {designSystemLinked === null ? (
                <p className="px-1 text-sm text-[#8e8e93]">Carregando componentes...</p>
              ) : designSystemLinked === false ? (
                <div className="px-1">
                  <p className="mb-2 text-sm text-[#55555b]">Nenhum Design System vinculado a esta Galáxia.</p>
                  <a href="/nova" target="_blank" rel="noreferrer" className="text-sm font-medium text-[#7c3aed] hover:underline">
                    Vincular um Design System em /nova →
                  </a>
                </div>
              ) : filteredDragComponents.length === 0 ? (
                <p className="px-1 text-sm text-[#8e8e93]">
                  {dragComponents.length === 0 ? "Nenhum componente sincronizado ainda." : `Nenhum componente encontrado para "${componentSearch}".`}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {filteredDragComponents.map((component) => (
                    <div
                      key={component.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData(COMPONENT_DRAG_MIME, component.id);
                        event.dataTransfer.effectAllowed = "copy";
                      }}
                      title={component.name}
                      className="cursor-grab rounded-lg border border-[#e4e4e7] bg-white p-1.5 hover:border-[#7c3aed] active:cursor-grabbing"
                    >
                      <div className="mb-1 flex h-14 items-center justify-center overflow-hidden rounded-md bg-[#f3f3f4]">
                        {component.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- thumbnail externa do Figma, fora dos domínios do next/image
                          <img src={component.thumbnailUrl} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <ComponentsToolIcon className="h-5 w-5 text-[#b4b4b9]" />
                        )}
                      </div>
                      <p className="truncate text-[11px] text-[#333336]">{component.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Aba/seta fixa na borda direita da tela (fora do painel, sempre
            visível): abre/fecha o painel lateral único inteiro. Desloca
            junto com a borda esquerda do painel (dynamic `right`, mesmo
            padrão usado antes pro minimapa) pra parecer uma alça presa nele,
            mas continua acessível mesmo com o painel fechado/fora da tela. */}
        <button
          type="button"
          onClick={toggleSidePanel}
          aria-label={sidePanelOpen ? "Fechar painel" : "Abrir painel"}
          title={sidePanelOpen ? "Fechar painel" : "Abrir painel"}
          className="absolute top-1/2 z-[70] -translate-y-1/2 rounded-l-lg bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,.05),0_2px_10px_rgba(0,0,0,.04)] transition-[right] duration-200"
          style={{ right: sidePanelOpen ? SIDE_PANEL_WIDTH : 0 }}
        >
          <ChevronLeftIcon className={`h-4 w-4 text-[#2a2a2e] transition-transform duration-200 ${sidePanelOpen ? "rotate-180" : ""}`} />
        </button>

        {/* Painel lateral único — Camadas/Propriedades/Comentários em
            acordeão, substitui as antigas abas separadas. Sempre montado
            (não só quando aberto) pra ter a transição de slide suave;
            translateX(100%) o joga fora da tela quando fechado. */}
        <div
          className="absolute right-0 top-0 z-[60] flex h-full w-80 flex-col border-l border-[#e4e4e7] bg-white shadow-[-6px_0_24px_rgba(0,0,0,.10)] transition-transform duration-200 ease-out"
          style={{ transform: sidePanelOpen ? "translateX(0)" : "translateX(100%)" }}
        >
          <div className="flex items-center justify-between border-b border-[#e4e4e7] px-4 py-3">
            <h2 className="text-sm font-semibold text-[#141416]">Painel</h2>
            <button type="button" onClick={() => setSidePanelOpen(false)} aria-label="Fechar painel" className="text-[#8e8e93] hover:text-[#1d1d1f]">
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Seção Camadas — árvore de blocos + anotações de Caneta */}
            <AccordionSection
              title={`Camadas (${blocks.length})`}
              icon={<LayersTabIcon className="h-4 w-4" />}
              expanded={expandedSections.has("camadas")}
              onToggle={() => toggleSection("camadas")}
            >
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setLayerDropTargetId("root");
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleLayerDrop("root");
                }}
              >
                {tree.map((node) => (
                  <LayerRow
                    key={node.block.id}
                    node={node}
                    depth={0}
                    selectedIds={selectedIds}
                    collapsedGroupIds={collapsedGroupIds}
                    onToggleCollapse={(id) =>
                      setCollapsedGroupIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      })
                    }
                    onSelect={(id, shift) => (shift ? toggleSelection(id) : selectOnly(id))}
                    onContextMenu={handleBlockContextMenu}
                    onToggleHidden={(id) => toggleHidden(new Set([id]))}
                    onToggleLocked={(id) => toggleLocked(new Set([id]))}
                    draggedLayerId={draggedLayerId}
                    layerDropTargetId={layerDropTargetId}
                    layerDropPosition={layerDropPosition}
                    onDragStartLayer={setDraggedLayerId}
                    onDragOverLayer={(id, position) => {
                      setLayerDropTargetId(id);
                      setLayerDropPosition(position);
                    }}
                    onDropLayer={handleLayerDrop}
                    readOnly={readOnly}
                  />
                ))}

                {/* Anotações de Caneta numa seção separada — não fazem parte
                    da árvore hierárquica dos blocos (sem agrupar/reordenar),
                    mas agora com olho/cadeado + menu de contexto igual aos
                    blocos (correção do bug da Caneta). */}
                {annotations.length > 0 && (
                  <>
                    <p className="mt-2 border-t border-[#f0f0f1] px-2 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93]">
                      Anotações ({annotations.length})
                    </p>
                    {annotations.map((annotation, index) => (
                      <div
                        key={annotation.id}
                        onClick={() => {
                          setSelectedAnnotationId(annotation.id);
                          setSelectedIds(new Set());
                        }}
                        onContextMenu={(event) => handleAnnotationContextMenu(event, annotation)}
                        className={`flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1.5 pl-2 pr-1.5 text-left text-sm ${
                          selectedAnnotationId === annotation.id ? "bg-[#f1ebfe] text-[#7c3aed]" : "text-[#1d1d1f] hover:bg-[#f7f7f8]"
                        }`}
                      >
                        <PenToolIcon className="h-3.5 w-3.5 shrink-0" />
                        <span className={`min-w-0 flex-1 truncate ${annotation.hidden ? "text-[#b4b4b9]" : ""}`}>Traço {index + 1}</span>
                        {!readOnly && (
                          <>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleAnnotationHidden(annotation.id);
                              }}
                              aria-label={annotation.hidden ? "Mostrar" : "Ocultar"}
                              title={annotation.hidden ? "Mostrar" : "Ocultar"}
                              className="shrink-0 text-[#8e8e93] hover:text-[#1d1d1f]"
                            >
                              {annotation.hidden ? <EyeOffIcon className="h-3.5 w-3.5" /> : <EyeOpenIcon className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleAnnotationLocked(annotation.id);
                              }}
                              aria-label={annotation.locked ? "Desbloquear" : "Bloquear"}
                              title={annotation.locked ? "Desbloquear" : "Bloquear"}
                              className={`shrink-0 hover:text-[#1d1d1f] ${annotation.locked ? "text-[#7c3aed]" : "text-[#8e8e93]"}`}
                            >
                              {annotation.locked ? <LockIcon className="h-3.5 w-3.5" /> : <UnlockIcon className="h-3.5 w-3.5" />}
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </AccordionSection>

            {/* Seção Propriedades — sem estado de aberto/fechado próprio,
                sempre expandida como seção; o conteúdo é que muda conforme a
                seleção no canvas. */}
            <AccordionSection title="Propriedades" icon={<PropertiesTabIcon className="h-4 w-4" />} expanded>
              {selectedIds.size === 0 ? (
                <p className="px-2 text-sm text-[#8e8e93]">Selecione um elemento para ver suas propriedades.</p>
              ) : selectedIds.size > 1 ? (
                <div className="space-y-3 px-2">
                  <p className="text-sm text-[#1d1d1f]">{selectedIds.size} blocos selecionados.</p>
                  {!readOnly && (
                    <>
                      <button
                        type="button"
                        onClick={groupSelection}
                        className="w-full rounded-md bg-[#7c3aed] px-3 py-2 text-sm font-medium text-white hover:bg-[#6d28d9]"
                      >
                        Agrupar seleção (Ctrl+G)
                      </button>
                      <div className="flex gap-1.5">
                        <PropertyActionButton label={allSelectedHidden ? "Mostrar" : "Ocultar"} onClick={() => toggleHidden(selectedIds)}>
                          {allSelectedHidden ? <EyeOffIcon className="h-4 w-4" /> : <EyeOpenIcon className="h-4 w-4" />}
                        </PropertyActionButton>
                        <PropertyActionButton label={allSelectedLocked ? "Desbloquear" : "Bloquear"} onClick={() => toggleLocked(selectedIds)}>
                          {allSelectedLocked ? <UnlockIcon className="h-4 w-4" /> : <LockIcon className="h-4 w-4" />}
                        </PropertyActionButton>
                        <PropertyActionButton label="Apagar" onClick={() => deleteBlocks(selectedIds)} danger>
                          <TrashIcon className="h-4 w-4" />
                        </PropertyActionButton>
                      </div>
                    </>
                  )}
                </div>
              ) : !selectedBlock ? (
                <p className="px-2 text-sm text-[#8e8e93]">Selecione um elemento para ver suas propriedades.</p>
              ) : (
                <div className="space-y-3 px-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93]">Nome</label>
                    <input
                      type="text"
                      value={selectedBlock.label}
                      onChange={(event) => handlePropertyChange({ label: event.target.value })}
                      onBlur={commitPropertyChange}
                      onKeyDown={(event) => event.key === "Enter" && commitPropertyChange()}
                      readOnly={readOnly}
                      className="w-full rounded-md border border-[#e4e4e7] px-2.5 py-1.5 text-sm text-[#1d1d1f] outline-none focus:border-[#7c3aed] read-only:bg-[#f7f7f8] read-only:text-[#8e8e93]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField
                      label="X"
                      value={selectedBlock.x}
                      onChange={(v) => handlePropertyChange({ x: v })}
                      onCommit={commitPropertyChange}
                      readOnly={readOnly}
                    />
                    <NumberField
                      label="Y"
                      value={selectedBlock.y}
                      onChange={(v) => handlePropertyChange({ y: v })}
                      onCommit={commitPropertyChange}
                      readOnly={readOnly}
                    />
                    <NumberField
                      label="Largura"
                      value={selectedBlock.width}
                      onChange={(v) => handlePropertyChange({ width: Math.max(MIN_BLOCK_SIZE, v) })}
                      onCommit={commitPropertyChange}
                      readOnly={readOnly}
                    />
                    <NumberField
                      label="Altura"
                      value={selectedBlock.height}
                      onChange={(v) => handlePropertyChange({ height: Math.max(MIN_BLOCK_SIZE, v) })}
                      onCommit={commitPropertyChange}
                      readOnly={readOnly}
                    />
                  </div>
                  {!readOnly && (
                    <div className="flex gap-1.5">
                      <PropertyActionButton label={selectedBlock.hidden ? "Mostrar" : "Ocultar"} onClick={() => toggleHidden(new Set([selectedBlock.id]))}>
                        {selectedBlock.hidden ? <EyeOffIcon className="h-4 w-4" /> : <EyeOpenIcon className="h-4 w-4" />}
                      </PropertyActionButton>
                      <PropertyActionButton label={selectedBlock.locked ? "Desbloquear" : "Bloquear"} onClick={() => toggleLocked(new Set([selectedBlock.id]))}>
                        {selectedBlock.locked ? <UnlockIcon className="h-4 w-4" /> : <LockIcon className="h-4 w-4" />}
                      </PropertyActionButton>
                      {selectedBlock.kind === "GROUP" ? (
                        <PropertyActionButton label="Desagrupar" onClick={() => ungroupBlock(selectedBlock.id)}>
                          <FolderIcon className="h-4 w-4" />
                        </PropertyActionButton>
                      ) : (
                        <PropertyActionButton label="Adicionar texto" onClick={() => addTextAnnotation(selectedBlock.id)}>
                          <TextToolIcon className="h-4 w-4" />
                        </PropertyActionButton>
                      )}
                      <PropertyActionButton label="Apagar" onClick={() => deleteBlocks(new Set([selectedBlock.id]))} danger>
                        <TrashIcon className="h-4 w-4" />
                      </PropertyActionButton>
                    </div>
                  )}
                </div>
              )}
            </AccordionSection>

            {/* Seção Comentários — todas as threads do Wireframe atual;
                clicar numa thread volta o foco pro pino correspondente no
                canvas (focusComment: abre a thread + centraliza a rolagem). */}
            <AccordionSection
              title={`Comentários${comments.length > 0 ? ` (${comments.length})` : ""}`}
              icon={<CommentToolIcon className="h-4 w-4" />}
              expanded={expandedSections.has("comentarios")}
              onToggle={() => toggleSection("comentarios")}
            >
              {comments.length === 0 ? (
                <p className="px-2 text-sm text-[#8e8e93]">Nenhum comentário ainda neste Wireframe.</p>
              ) : (
                <div className="space-y-1">
                  {comments.map((comment) => (
                    <button
                      key={comment.id}
                      type="button"
                      onClick={() => focusComment(comment)}
                      className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-[#f7f7f8] ${
                        activeCommentId === comment.id ? "bg-[#f1ebfe]" : ""
                      }`}
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${comment.resolved ? "bg-[#9ca3af]" : "bg-[#f59e0b]"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-[#1d1d1f]">{comment.author.name}</span>
                        <span className="block truncate text-sm text-[#333336]">{comment.text}</span>
                        <span className="block text-[11px] text-[#8e8e93]">
                          {comment.replies.length} resposta{comment.replies.length === 1 ? "" : "s"} · {comment.resolved ? "Resolvido" : "Aberto"}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </AccordionSection>
          </div>
        </div>

        {/* Minimapa */}
        <div className="absolute bottom-[30px] left-[86px] z-20 hidden h-[126px] w-[206px] overflow-hidden rounded-[10px] bg-white shadow-[0_1px_2px_rgba(0,0,0,.05),0_2px_10px_rgba(0,0,0,.04)] sm:block">
          <div className="relative h-full w-full p-2">
            <div
              className="relative h-full w-full cursor-grab border border-[#3b82f6] active:cursor-grabbing"
              onPointerDown={handleMinimapPointerDown}
            >
              {blocks.map((block) => (
                <div
                  key={block.id}
                  className="pointer-events-none absolute bg-[#d8d8db]"
                  style={{
                    left: `${(block.x / frameWidth) * 100}%`,
                    top: `${(block.y / frameHeight) * 100}%`,
                    width: `${(block.width / frameWidth) * 100}%`,
                    height: `${(block.height / frameHeight) * 100}%`,
                    opacity: block.hidden ? 0.25 : 1,
                  }}
                />
              ))}
              {/* Retângulo indicador da área visível (Ajuste B) — clicar ou
                  arrastar aqui (ou em qualquer ponto do minimapa) faz pan do
                  canvas principal, ver handleMinimapPointerDown. */}
              <div
                className="pointer-events-none absolute border-2 border-[#7c3aed] bg-[#7c3aed]/10"
                style={{
                  left: `${(visibleLeftFrame / frameWidth) * 100}%`,
                  top: `${(visibleTopFrame / frameHeight) * 100}%`,
                  width: `${(visibleWidthFrame / frameWidth) * 100}%`,
                  height: `${(visibleHeightFrame / frameHeight) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Controles de zoom — desloca pra esquerda quando o painel lateral
            está aberto, senão ficaria coberto por ele (mesmo padrão de
            offset dinâmico usado antes pro minimapa). */}
        <div
          className="absolute bottom-[30px] z-20 flex items-center gap-2 transition-[right] duration-200"
          style={{ right: sidePanelOpen ? SIDE_PANEL_WIDTH + 30 : 30 }}
        >
          <div className="flex h-10 items-center rounded-lg bg-white px-1 shadow-[0_1px_2px_rgba(0,0,0,.05),0_2px_10px_rgba(0,0,0,.04)]">
            <button type="button" onClick={() => zoomTo(zoom - 0.1)} aria-label="Diminuir zoom" className="grid h-8 w-8 place-items-center rounded-md text-[#1d1d1f] hover:bg-[#f2f2f3]">
              <MinusIcon className="h-3.5 w-3.5" />
            </button>
            <span className="w-10 text-center text-[13.5px] text-[#1d1d1f]">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => zoomTo(zoom + 0.1)} aria-label="Aumentar zoom" className="grid h-8 w-8 place-items-center rounded-md text-[#1d1d1f] hover:bg-[#f2f2f3]">
              <PlusIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            aria-pressed={isFullscreen}
            className={`grid h-10 w-10 place-items-center rounded-lg shadow-[0_1px_2px_rgba(0,0,0,.05),0_2px_10px_rgba(0,0,0,.04)] hover:bg-[#f7f7f8] ${isFullscreen ? "bg-[#f1ebfe] text-[#7c3aed]" : "bg-white text-[#1d1d1f]"}`}
          >
            {isFullscreen ? <MinimizeIcon className="h-4 w-4" /> : <MaximizeIcon className="h-4 w-4" />}
          </button>
        </div>

        {/* Canvas */}
        <div
          ref={canvasScrollRef}
          className="h-full overflow-auto"
          style={{
            cursor:
              activeTool === "hand"
                ? HAND_CURSOR
                : activeTool === "frame" || activeTool === "ellipse" || activeTool === "pen" || activeTool === "text" || activeTool === "comment"
                  ? "crosshair"
                  : undefined,
            paddingLeft: canvasPadLeft,
            paddingRight: 32,
            paddingTop: canvasPadTop,
            paddingBottom: MIN_CANVAS_PAD_Y,
          }}
          onPointerDown={handleCanvasMouseDown}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes(COMPONENT_DRAG_MIME)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(event) => {
            const componentId = event.dataTransfer.getData(COMPONENT_DRAG_MIME);
            if (!componentId) return;
            event.preventDefault();
            createComponentBlock(componentId, event.clientX, event.clientY);
          }}
        >
          <p className="mb-2 pl-1 text-[13.5px] text-[#4b4b52]" style={{ width: frameWidth * zoom }}>
            Desktop - {frameWidth} × {frameHeight}
          </p>
          <div
            ref={frameRef}
            className="relative select-none bg-white"
            style={{
              width: frameWidth * zoom,
              height: frameHeight * zoom,
              border: "1px solid #e2e2e4",
              backgroundImage: showGrid
                ? `linear-gradient(to right, #eee 1px, transparent 1px), linear-gradient(to bottom, #eee 1px, transparent 1px)`
                : undefined,
              backgroundSize: showGrid ? `${8 * zoom}px ${8 * zoom}px` : undefined,
            }}
          >
            {blocks
              .filter((b) => b.kind === "GROUP" && !b.hidden)
              .map((block) => (
                <GroupOutline key={block.id} block={block} zoom={zoom} selected={selectedIds.has(block.id)} onPointerDown={(e) => handleBlockMouseDown(e, block)} onContextMenu={(e) => handleBlockContextMenu(e, block)} />
              ))}
            {blocks
              .filter((b) => b.kind === "ELEMENT" && !b.hidden)
              .map((block) => (
                <CanvasBlock
                  key={block.id}
                  block={block}
                  zoom={zoom}
                  frameWidth={frameWidth}
                  frameHeight={frameHeight}
                  selected={selectedIds.has(block.id)}
                  isEditing={editingBlockId === block.id}
                  editingLabel={editingLabelDraft}
                  onEditingLabelChange={setEditingLabelDraft}
                  onEditingLabelCommit={commitEditingLabel}
                  onPointerDown={(event) => handleBlockMouseDown(event, block)}
                  onContextMenu={(event) => handleBlockContextMenu(event, block)}
                  onResizePointerDown={(event, direction) => handleResizeMouseDown(event, block, direction)}
                />
              ))}

            {/* Wireframe-1b: anotações de Caneta — um único SVG cobrindo o
                frame inteiro, com viewBox em unidades do frame (não de
                tela), pra cada <path> escalar junto com o zoom sem precisar
                multiplicar cada ponto manualmente. */}
            <svg
              className="pointer-events-none absolute left-0 top-0"
              width={frameWidth * zoom}
              height={frameHeight * zoom}
              viewBox={`0 0 ${frameWidth} ${frameHeight}`}
            >
              {annotations
                .filter((a) => !a.hidden)
                .map((annotation) => (
                  <path
                    key={annotation.id}
                    d={annotation.pathData}
                    fill="none"
                    stroke={annotation.color}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    style={{
                      pointerEvents: activeTool === "select" ? "stroke" : "none",
                      cursor: annotation.locked || readOnly ? "default" : "move",
                    }}
                    className={selectedAnnotationId === annotation.id ? "drop-shadow-[0_0_0_2px_rgba(124,58,237,0.5)]" : undefined}
                    onPointerDown={(event) => handleAnnotationPointerDown(event, annotation)}
                    onContextMenu={(event) => handleAnnotationContextMenu(event, annotation)}
                  />
                ))}
              {penPoints && penPoints.length > 1 && (
                <path
                  d={`M ${penPoints.map((p) => `${p.x} ${p.y}`).join(" L ")}`}
                  fill="none"
                  stroke="#7c3aed"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>

            {/* Alças de redimensionamento da anotação selecionada (correção
                do bug da Caneta): escalam o path inteiro a partir da caixa
                delimitadora atual — só aparecem se a anotação estiver
                visível e destravada. */}
            {selectedAnnotation && selectedAnnotationBox && !selectedAnnotation.hidden && !selectedAnnotation.locked && (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: selectedAnnotationBox.minX * zoom,
                  top: selectedAnnotationBox.minY * zoom,
                  width: Math.max(1, selectedAnnotationBox.maxX - selectedAnnotationBox.minX) * zoom,
                  height: Math.max(1, selectedAnnotationBox.maxY - selectedAnnotationBox.minY) * zoom,
                  zIndex: 50,
                }}
              >
                <div className="pointer-events-none h-full w-full rounded-sm border border-dashed border-[#7c3aed]/60" />
                {ANNOTATION_RESIZE_HANDLES.map((handle) => (
                  <div
                    key={handle.corner}
                    onPointerDown={(event) => handleAnnotationResizePointerDown(event, selectedAnnotation, handle.corner)}
                    style={{ cursor: handle.cursor }}
                    className={`pointer-events-auto absolute h-2.5 w-2.5 rounded-full border border-[#7c3aed] bg-white ${handle.className}`}
                  />
                ))}
              </div>
            )}

            {/* Retângulo de pré-visualização ao vivo (ferramentas Frame/Elipse) */}
            {drawRect && (
              <div
                className="pointer-events-none absolute border-2 border-dashed border-[#7c3aed] bg-[#7c3aed]/10"
                style={{
                  left: drawRect.x * zoom,
                  top: drawRect.y * zoom,
                  width: drawRect.width * zoom,
                  height: drawRect.height * zoom,
                  borderRadius: activeTool === "ellipse" ? "9999px" : undefined,
                }}
              />
            )}

            {/* Wireframe-1b: pinos de comentário — sempre visíveis, independente
                da ferramenta ativa. */}
            {visibleComments.map((comment) => {
              const nearbyCount = visibleComments.filter(
                (other) => other.id !== comment.id && Math.hypot((other.x - comment.x) * zoom, (other.y - comment.y) * zoom) < 24
              ).length;
              return (
                <button
                  key={comment.id}
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    setPendingCommentPos(null);
                    setActiveCommentId(comment.id);
                    openCommentsPanel();
                  }}
                  title={comment.text}
                  className={`absolute z-40 grid h-6 w-6 -translate-x-1/2 -translate-y-full place-items-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow ${
                    comment.resolved ? "bg-[#9ca3af]" : "bg-[#f59e0b]"
                  }`}
                  style={{ left: comment.x * zoom, top: comment.y * zoom }}
                >
                  {nearbyCount > 0 ? `+${nearbyCount}` : <CommentToolIcon className="h-3 w-3" />}
                </button>
              );
            })}

            {/* Composer de um comentário novo, ainda não salvo */}
            {pendingCommentPos && (
              <div
                className="absolute z-50 w-64 -translate-y-full rounded-lg border border-[#e4e4e7] bg-white p-3 shadow-lg"
                style={{ left: pendingCommentPos.x * zoom, top: pendingCommentPos.y * zoom }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <textarea
                  autoFocus
                  rows={2}
                  value={pendingCommentText}
                  onChange={(event) => setPendingCommentText(event.target.value)}
                  placeholder="Escreva um comentário..."
                  className="w-full resize-none rounded-md border border-[#e4e4e7] px-2 py-1.5 text-sm text-[#1d1d1f] outline-none focus:border-[#7c3aed]"
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingCommentPos(null);
                      setPendingCommentText("");
                    }}
                    className="rounded-md border border-[#e4e4e7] bg-white px-3 py-1.5 text-xs text-[#2a2a2e] hover:bg-[#f7f7f8]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={submitNewComment}
                    disabled={!pendingCommentText.trim()}
                    className="rounded-md bg-[#7c3aed] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#6d28d9] disabled:opacity-50"
                  >
                    Comentar
                  </button>
                </div>
              </div>
            )}

            {/* Thread de um comentário existente (comentário inicial + respostas) */}
            {activeComment && (
              <div
                className="absolute z-50 w-72 -translate-y-full rounded-lg border border-[#e4e4e7] bg-white p-3 shadow-lg"
                style={{ left: activeComment.x * zoom, top: activeComment.y * zoom }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93]">
                    {activeComment.resolved ? "Resolvido" : "Comentário"}
                  </span>
                  <button type="button" onClick={() => setActiveCommentId(null)} className="text-[#8e8e93] hover:text-[#1d1d1f]">
                    <CloseIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mb-2 max-h-48 space-y-2 overflow-y-auto">
                  <div>
                    <p className="text-xs font-medium text-[#1d1d1f]">{activeComment.author.name}</p>
                    <p className="text-sm text-[#333336]">{activeComment.text}</p>
                  </div>
                  {activeComment.replies.map((reply) => (
                    <div key={reply.id} className="border-t border-[#f0f0f1] pt-2">
                      <p className="text-xs font-medium text-[#1d1d1f]">{reply.author.name}</p>
                      <p className="text-sm text-[#333336]">{reply.text}</p>
                    </div>
                  ))}
                </div>
                {!readOnly && (
                  <>
                    <textarea
                      rows={2}
                      value={replyDraft}
                      onChange={(event) => setReplyDraft(event.target.value)}
                      placeholder="Responder..."
                      className="w-full resize-none rounded-md border border-[#e4e4e7] px-2 py-1.5 text-sm text-[#1d1d1f] outline-none focus:border-[#7c3aed]"
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCommentResolved(activeComment)}
                        className="rounded-md border border-[#e4e4e7] bg-white px-3 py-1.5 text-xs text-[#2a2a2e] hover:bg-[#f7f7f8]"
                      >
                        {activeComment.resolved ? "Reabrir" : "Marcar como resolvido"}
                      </button>
                      <button
                        type="button"
                        onClick={() => submitReply(activeComment.id)}
                        disabled={!replyDraft.trim()}
                        className="rounded-md bg-[#7c3aed] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#6d28d9] disabled:opacity-50"
                      >
                        Responder
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {contextMenu && contextMenuBlock && (
        <div
          className="fixed z-[80] w-60 overflow-hidden rounded-lg border border-[#e4e4e7] bg-white py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {contextMenuBlock.kind === "GROUP" ? (
            <button
              type="button"
              onClick={() => ungroupBlock(contextMenuBlock.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#1d1d1f] hover:bg-[#f7f7f8]"
            >
              <FolderIcon className="h-4 w-4" />
              Desagrupar
            </button>
          ) : (
            <button
              type="button"
              disabled={!canGroup}
              onClick={groupSelection}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-[#1d1d1f] hover:bg-[#f7f7f8] disabled:cursor-not-allowed disabled:text-[#b4b4b9] disabled:hover:bg-transparent"
            >
              <span className="flex items-center gap-2">
                <FolderIcon className="h-4 w-4" />
                Agrupar seleção
              </span>
              <span className="text-xs text-[#8e8e93]">Ctrl+G</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => addTextAnnotation(contextMenuBlock.id)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#1d1d1f] hover:bg-[#f7f7f8]"
          >
            <TextToolIcon className="h-4 w-4" />
            Adicionar texto
          </button>
          <button
            type="button"
            onClick={() => toggleHidden(selectedIds)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#1d1d1f] hover:bg-[#f7f7f8]"
          >
            {contextMenuBlock.hidden ? <EyeOffIcon className="h-4 w-4" /> : <EyeOpenIcon className="h-4 w-4" />}
            {contextMenuBlock.hidden ? "Mostrar" : "Ocultar"}
          </button>
          <button
            type="button"
            onClick={() => toggleLocked(selectedIds)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#1d1d1f] hover:bg-[#f7f7f8]"
          >
            {contextMenuBlock.locked ? <UnlockIcon className="h-4 w-4" /> : <LockIcon className="h-4 w-4" />}
            {contextMenuBlock.locked ? "Desbloquear" : "Bloquear"}
          </button>
          <div className="my-1 h-px bg-[#eee]" />
          <button
            type="button"
            onClick={() => deleteBlocks(selectedIds)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-luminous-error hover:bg-red-50"
          >
            <TrashIcon className="h-4 w-4" />
            Apagar
          </button>
        </div>
      )}

      {/* Menu de contexto de uma anotação de Caneta (correção do bug da
          Caneta): subconjunto de ações que fazem sentido pra um traço livre
          — sem Agrupar/Adicionar texto, que são específicos de blocos. */}
      {contextMenu && contextMenuAnnotation && (
        <div
          className="fixed z-[80] w-56 overflow-hidden rounded-lg border border-[#e4e4e7] bg-white py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => toggleAnnotationHidden(contextMenuAnnotation.id)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#1d1d1f] hover:bg-[#f7f7f8]"
          >
            {contextMenuAnnotation.hidden ? <EyeOffIcon className="h-4 w-4" /> : <EyeOpenIcon className="h-4 w-4" />}
            {contextMenuAnnotation.hidden ? "Mostrar" : "Ocultar"}
          </button>
          <button
            type="button"
            onClick={() => toggleAnnotationLocked(contextMenuAnnotation.id)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#1d1d1f] hover:bg-[#f7f7f8]"
          >
            {contextMenuAnnotation.locked ? <UnlockIcon className="h-4 w-4" /> : <LockIcon className="h-4 w-4" />}
            {contextMenuAnnotation.locked ? "Desbloquear" : "Bloquear"}
          </button>
          <div className="my-1 h-px bg-[#eee]" />
          <button
            type="button"
            onClick={() => deleteAnnotationById(contextMenuAnnotation.id)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-luminous-error hover:bg-red-50"
          >
            <TrashIcon className="h-4 w-4" />
            Apagar
          </button>
        </div>
      )}

      {regenerateOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setRegenerateOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#141416]">Gerar wireframe de novo</h2>
              <button type="button" onClick={() => setRegenerateOpen(false)} className="text-[#8e8e93] hover:text-[#1d1d1f]">
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-sm text-[#55555b]">
              Isso descarta o wireframe atual e gera um novo do zero a partir do seu comentário. Se for só um ajuste pontual, considere editar
              direto no canvas em vez disso.
            </p>
            <textarea
              rows={4}
              autoFocus
              value={regenerateComment}
              onChange={(event) => setRegenerateComment(event.target.value)}
              placeholder="O que está errado na estrutura atual?"
              className="w-full resize-none rounded-lg border border-[#e4e4e7] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#7c3aed]"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRegenerateOpen(false)}
                disabled={regenerateBusy}
                className="rounded-lg border border-[#e4e4e7] bg-white px-4 py-2 text-sm text-[#2a2a2e] hover:bg-[#f7f7f8]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={regenerateBusy || !regenerateComment.trim()}
                className="rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-60"
              >
                {regenerateBusy ? "Gerando..." : "Gerar de novo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wireframe-2: confirmação após "Aprovar e Exportar" — sem botão de
          fechar/cancelar (a ação já aconteceu, status já virou FINALIZADO);
          só "Salvar" (baixa o SVG) e "Concluir" (sai do editor pra tela de
          detalhe, que também vai mostrar o botão de baixar de novo). */}
      {exportResult && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="mb-3 text-base font-semibold text-[#141416]">Wireframe exportado!</h2>
            <p className="mb-5 text-sm text-[#55555b]">
              O arquivo está pronto para ser importado dentro do Figma — arraste o SVG baixado para dentro de qualquer arquivo do Figma para
              continuar o trabalho visual lá.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => router.push(`/bridges/${bridge.id}`)}
                className="rounded-lg border border-[#e4e4e7] bg-white px-4 py-2 text-sm text-[#2a2a2e] hover:bg-[#f7f7f8]"
              >
                Concluir
              </button>
              <a
                href={exportResult.svgUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6d28d9]"
              >
                Salvar
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  label,
  children,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-[41px] w-[41px] place-items-center rounded-lg ${
        disabled
          ? "cursor-not-allowed text-[#c4c4c8]"
          : active
            ? "bg-[#f1ebfe] text-[#7c3aed]"
            : "text-[#2a2a2e] hover:bg-[#f2f2f3]"
      }`}
    >
      {children}
    </button>
  );
}

// Uma seção do painel lateral único (Camadas/Propriedades/Comentários em
// acordeão). Sem `onToggle`, a seção fica sempre expandida e sem cabeçalho
// clicável (caso da Propriedades, que não tem estado de aberto/fechado
// próprio — só conteúdo condicional à seleção).
function AccordionSection({
  title,
  icon,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: ReactNode;
  expanded: boolean;
  onToggle?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-[#f0f0f1]">
      <button
        type="button"
        onClick={onToggle}
        disabled={!onToggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#55555b] hover:bg-[#f7f7f8] disabled:cursor-default disabled:hover:bg-transparent"
      >
        {icon}
        <span className="flex-1">{title}</span>
        {onToggle && <ChevronDownIcon className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />}
      </button>
      {expanded && <div className="px-2 pb-3">{children}</div>}
    </div>
  );
}

// Botão de ícone reaproveitando as ações do menu de contexto no painel de
// Propriedades (Ajuste 2): ocultar/mostrar, bloquear/desbloquear, adicionar
// texto, desagrupar, apagar.
function PropertyActionButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex flex-1 items-center justify-center rounded-md border border-[#e4e4e7] py-1.5 ${
        danger ? "text-luminous-error hover:bg-red-50" : "text-[#1d1d1f] hover:bg-[#f7f7f8]"
      }`}
    >
      {children}
    </button>
  );
}

function NumberField({
  label,
  value,
  onChange,
  onCommit,
  readOnly,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onCommit: () => void;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93]">{label}</label>
      <input
        type="number"
        value={Math.round(value)}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        onBlur={onCommit}
        onKeyDown={(event) => event.key === "Enter" && onCommit()}
        // input[type=number] ignora readOnly pros botões de incrementar/
        // decrementar e pro scroll — disabled é o único jeito de bloquear de
        // verdade (modo leitura, Wireframe-2).
        disabled={readOnly}
        className="w-full rounded-md border border-[#e4e4e7] px-2.5 py-1.5 text-sm text-[#1d1d1f] outline-none focus:border-[#7c3aed] disabled:bg-[#f7f7f8] disabled:text-[#8e8e93]"
      />
    </div>
  );
}

// --- Árvore de Camadas (Ajuste 4) ---

type LayerDropPosition = "before" | "after" | "inside";

// Calcula se o drop deve reordenar (antes/depois, entre irmãos) ou
// reparentar (dentro, só quando o alvo é um GROUP) com base em onde
// exatamente o ponteiro está dentro da linha (Ajuste 3, item 5): terço de
// cima = "before", terço de baixo = "after", terço do meio = "inside" (só
// se o alvo puder ter filhos — senão vira "before"/"after" pelo ponto médio).
function computeDropPosition(event: { clientY: number }, rect: DOMRect, canGoInside: boolean): LayerDropPosition {
  const ratio = (event.clientY - rect.top) / rect.height;
  if (!canGoInside) return ratio < 0.5 ? "before" : "after";
  if (ratio < 0.25) return "before";
  if (ratio > 0.75) return "after";
  return "inside";
}

function LayerRow({
  node,
  depth,
  selectedIds,
  collapsedGroupIds,
  onToggleCollapse,
  onSelect,
  onContextMenu,
  onToggleHidden,
  onToggleLocked,
  draggedLayerId,
  layerDropTargetId,
  layerDropPosition,
  onDragStartLayer,
  onDragOverLayer,
  onDropLayer,
  readOnly,
}: {
  node: TreeNode;
  depth: number;
  selectedIds: Set<string>;
  collapsedGroupIds: Set<string>;
  onToggleCollapse: (id: string) => void;
  onSelect: (id: string, shift: boolean) => void;
  onContextMenu: (event: ReactMouseEvent, block: WireframeBlock) => void;
  onToggleHidden: (id: string) => void;
  onToggleLocked: (id: string) => void;
  draggedLayerId: string | null;
  layerDropTargetId: string | null | "root";
  layerDropPosition: LayerDropPosition;
  onDragStartLayer: (id: string) => void;
  onDragOverLayer: (id: string | null | "root", position: LayerDropPosition) => void;
  onDropLayer: (id: string | "root", position: LayerDropPosition) => void;
  readOnly?: boolean;
}) {
  const { block, children } = node;
  const isGroup = block.kind === "GROUP";
  const isCollapsed = collapsedGroupIds.has(block.id);
  const isSelected = selectedIds.has(block.id);
  const isDropTarget = layerDropTargetId === block.id && draggedLayerId !== block.id;
  const isTextLike = block.shape === "text" || TEXT_LABEL_PATTERN.test(block.label);
  const Icon = isGroup ? FolderIcon : block.shape === "ellipse" ? EllipseToolIcon : isTextLike ? TextToolIcon : FrameToolIcon;

  const dropClass = !isDropTarget
    ? ""
    : layerDropPosition === "before"
      ? "shadow-[inset_0_2px_0_0_#7c3aed]"
      : layerDropPosition === "after"
        ? "shadow-[inset_0_-2px_0_0_#7c3aed]"
        : "outline outline-2 outline-[#7c3aed]";

  return (
    <div>
      <div
        draggable={!readOnly}
        onDragStart={(event) => {
          event.stopPropagation();
          onDragStartLayer(block.id);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          onDragOverLayer(block.id, computeDropPosition(event, rect, isGroup));
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          onDropLayer(block.id, computeDropPosition(event, rect, isGroup));
        }}
        onClick={(event) => onSelect(block.id, event.shiftKey)}
        onContextMenu={(event) => onContextMenu(event, block)}
        style={{ paddingLeft: 8 + depth * 16 }}
        className={`flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1.5 pr-1.5 text-left text-sm ${
          isSelected ? "bg-[#f1ebfe] text-[#7c3aed]" : "text-[#1d1d1f] hover:bg-[#f7f7f8]"
        } ${dropClass}`}
      >
        {isGroup ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleCollapse(block.id);
            }}
            className="shrink-0 text-[#8e8e93] hover:text-[#1d1d1f]"
          >
            <ChevronDownIcon className={`h-3 w-3 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="relative shrink-0">
          <Icon className="h-3.5 w-3.5" />
          {/* Indicador discreto de bloco nascido de um componente do Design
              System (Wireframe-1c) — só um pontinho no canto, sem badge de
              texto, pra não poluir a lista. */}
          {block.sourceComponentId && (
            <span
              title="Baseado em um componente do Design System"
              className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full border border-white bg-[#7c3aed]"
            />
          )}
        </span>
        <span className={`min-w-0 flex-1 truncate ${block.hidden ? "text-[#b4b4b9]" : ""}`}>{block.label}</span>
        {!readOnly && (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleHidden(block.id);
              }}
              aria-label={block.hidden ? "Mostrar" : "Ocultar"}
              title={block.hidden ? "Mostrar" : "Ocultar"}
              className="shrink-0 text-[#8e8e93] hover:text-[#1d1d1f]"
            >
              {block.hidden ? <EyeOffIcon className="h-3.5 w-3.5" /> : <EyeOpenIcon className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleLocked(block.id);
              }}
              aria-label={block.locked ? "Desbloquear" : "Bloquear"}
              title={block.locked ? "Desbloquear" : "Bloquear"}
              className={`shrink-0 hover:text-[#1d1d1f] ${block.locked ? "text-[#7c3aed]" : "text-[#8e8e93]"}`}
            >
              {block.locked ? <LockIcon className="h-3.5 w-3.5" /> : <UnlockIcon className="h-3.5 w-3.5" />}
            </button>
          </>
        )}
      </div>
      {isGroup && !isCollapsed && children.length > 0 && (
        <div>
          {children.map((child) => (
            <LayerRow
              key={child.block.id}
              node={child}
              depth={depth + 1}
              selectedIds={selectedIds}
              collapsedGroupIds={collapsedGroupIds}
              onToggleCollapse={onToggleCollapse}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              onToggleHidden={onToggleHidden}
              onToggleLocked={onToggleLocked}
              draggedLayerId={draggedLayerId}
              layerDropTargetId={layerDropTargetId}
              layerDropPosition={layerDropPosition}
              onDragStartLayer={onDragStartLayer}
              onDragOverLayer={onDragOverLayer}
              onDropLayer={onDropLayer}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Contorno visual de um GROUP no canvas: pointer-events-none no retângulo
// (deixa os cliques passarem pros filhos por cima), só a etiqueta do nome no
// canto é clicável/arrastável pra selecionar/mover o grupo inteiro. ---
function GroupOutline({
  block,
  zoom,
  selected,
  onPointerDown,
  onContextMenu,
}: {
  block: WireframeBlock;
  zoom: number;
  selected: boolean;
  onPointerDown: (event: ReactPointerEvent) => void;
  onContextMenu: (event: ReactMouseEvent) => void;
}) {
  return (
    <div
      className="absolute"
      style={{
        left: block.x * zoom,
        top: block.y * zoom,
        width: block.width * zoom,
        height: block.height * zoom,
        zIndex: selected ? 50 : undefined,
      }}
    >
      <div className={`pointer-events-none h-full w-full rounded-sm border-2 border-dashed ${selected ? "border-[#7c3aed]" : "border-[#c4b5fd]"}`} />
      <span
        onPointerDown={onPointerDown}
        onContextMenu={onContextMenu}
        className="absolute -top-6 left-0 cursor-move whitespace-nowrap rounded bg-[#7c3aed] px-1.5 py-0.5 text-[10px] font-medium text-white"
      >
        {block.locked && <LockIcon className="mr-1 inline h-2.5 w-2.5" />}
        {block.label}
      </span>
    </div>
  );
}

// Alças de redimensionamento de uma anotação de Caneta (correção do bug da
// Caneta) — só os 4 cantos da caixa delimitadora (não os 8 pontos dos
// blocos), já que o path livre não tem bordas retas pra justificar alças no
// meio de cada lado.
const ANNOTATION_RESIZE_HANDLES: { corner: "nw" | "ne" | "se" | "sw"; className: string; cursor: string }[] = [
  { corner: "nw", className: "-left-1 -top-1", cursor: "nwse-resize" },
  { corner: "ne", className: "-right-1 -top-1", cursor: "nesw-resize" },
  { corner: "se", className: "-right-1 -bottom-1", cursor: "nwse-resize" },
  { corner: "sw", className: "-left-1 -bottom-1", cursor: "nesw-resize" },
];

const RESIZE_HANDLES: { direction: ResizeDirection; className: string; cursor: string }[] = [
  { direction: "nw", className: "-left-1 -top-1", cursor: "nwse-resize" },
  { direction: "n", className: "left-1/2 -top-1 -translate-x-1/2", cursor: "ns-resize" },
  { direction: "ne", className: "-right-1 -top-1", cursor: "nesw-resize" },
  { direction: "e", className: "-right-1 top-1/2 -translate-y-1/2", cursor: "ew-resize" },
  { direction: "se", className: "-right-1 -bottom-1", cursor: "nwse-resize" },
  { direction: "s", className: "left-1/2 -bottom-1 -translate-x-1/2", cursor: "ns-resize" },
  { direction: "sw", className: "-left-1 -bottom-1", cursor: "nesw-resize" },
  { direction: "w", className: "-left-1 top-1/2 -translate-y-1/2", cursor: "ew-resize" },
];

function CanvasBlock({
  block,
  zoom,
  frameWidth,
  frameHeight,
  selected,
  isEditing,
  editingLabel,
  onEditingLabelChange,
  onEditingLabelCommit,
  onPointerDown,
  onContextMenu,
  onResizePointerDown,
}: {
  block: WireframeBlock;
  zoom: number;
  frameWidth: number;
  frameHeight: number;
  selected: boolean;
  isEditing: boolean;
  editingLabel: string;
  onEditingLabelChange: (value: string) => void;
  onEditingLabelCommit: () => void;
  onPointerDown: (event: ReactPointerEvent) => void;
  onContextMenu: (event: ReactMouseEvent) => void;
  onResizePointerDown: (event: ReactPointerEvent, direction: ResizeDirection) => void;
}) {
  // Guias de medição pontilhadas: comprimento exato até a borda do frame em
  // cada direção (não um valor arbitrário), pra nunca transbordar o canvas.
  const topExtent = block.y * zoom;
  const bottomExtent = (frameHeight - block.y - block.height) * zoom;
  const leftExtent = block.x * zoom;
  const rightExtent = (frameWidth - block.x - block.width) * zoom;
  // Wireframe-1b: aparência varia por shape — "text" não tem borda/
  // preenchimento visível (só o texto em si), "ellipse" usa border-radius
  // 50% sobre o mesmo retângulo delimitador (x/y/width/height continuam
  // sendo um retângulo, só a aparência muda).
  const isText = block.shape === "text";

  return (
    <div
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      className={`absolute ${isText ? "bg-transparent" : "border bg-white"} ${block.locked ? "cursor-default" : "cursor-move"} ${
        isText ? "" : selected ? "border-[#3b82f6]" : "border-[#dcdce0] hover:border-[#b4b4b9]"
      }`}
      style={{
        left: block.x * zoom,
        top: block.y * zoom,
        width: block.width * zoom,
        height: block.height * zoom,
        borderRadius: block.shape === "ellipse" ? "9999px" : undefined,
        outline: isText && selected ? "1px solid #3b82f6" : undefined,
        // Ajuste A: sem isso, o rótulo de dimensão (WxH) e as guias de
        // medição — que estouram pra FORA dos limites do bloco (bottom-6,
        // etc.) — ficavam atrás de blocos vizinhos "depois" dele na ordem
        // do DOM (pilha de empilhamento por ordem de renderização, já que
        // nenhum bloco tinha z-index próprio). Selecionado sempre vem pra
        // frente de tudo mais no canvas.
        zIndex: selected ? 50 : undefined,
      }}
    >
      {isEditing ? (
        <input
          type="text"
          autoFocus
          value={editingLabel}
          onChange={(event) => onEditingLabelChange(event.target.value)}
          onFocus={(event) => event.target.select()}
          onBlur={onEditingLabelCommit}
          onKeyDown={(event) => {
            if (event.key === "Enter") onEditingLabelCommit();
            if (event.key === "Escape") onEditingLabelCommit();
          }}
          onPointerDown={(event) => event.stopPropagation()}
          className="h-full w-full bg-transparent px-2 py-1.5 text-[12px] font-medium text-[#333336] outline-none"
        />
      ) : (
        <span className="pointer-events-none flex items-center gap-1 truncate px-2 py-1.5 text-[12px] font-medium text-[#333336]">
          {block.locked && <LockIcon className="h-3 w-3 shrink-0 text-[#7c3aed]" />}
          {block.label}
        </span>
      )}

      {selected && !block.locked && (
        <>
          {/* Guias de medição pontilhadas, estendendo até a borda do frame */}
          <div
            className="pointer-events-none absolute left-1/2 top-full w-px border-l border-dashed border-[#3b82f6]/50"
            style={{ height: bottomExtent }}
          />
          <div
            className="pointer-events-none absolute bottom-full left-1/2 w-px border-l border-dashed border-[#3b82f6]/50"
            style={{ height: topExtent }}
          />
          <div
            className="pointer-events-none absolute right-full top-1/2 h-px border-t border-dashed border-[#3b82f6]/50"
            style={{ width: leftExtent }}
          />
          <div
            className="pointer-events-none absolute left-full top-1/2 h-px border-t border-dashed border-[#3b82f6]/50"
            style={{ width: rightExtent }}
          />

          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#3b82f6] px-1.5 py-0.5 text-[10px] font-medium text-white">
            {block.width} × {block.height}
          </span>

          {RESIZE_HANDLES.map((handle) => (
            <div
              key={handle.direction}
              onPointerDown={(event) => onResizePointerDown(event, handle.direction)}
              style={{ cursor: handle.cursor }}
              className={`absolute h-2.5 w-2.5 rounded-full border border-[#3b82f6] bg-white ${handle.className}`}
            />
          ))}
        </>
      )}
      {selected && block.locked && (
        <div className="pointer-events-none absolute inset-0 rounded-[1px] ring-2 ring-[#7c3aed]" />
      )}
    </div>
  );
}
