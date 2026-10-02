import type { ContextPackage } from "@/lib/nova/buildContextPackage";

// Otimização de tokens (FIX5-4b). O pacote de contexto completo
// (buildContextPackage) continua sendo montado inteiro, mas o que de fato vai
// pra IA é uma versão ENXUTA e SEM DUPLICAÇÃO, específica de cada geração:
// - Bridge Spec: posição + exemplos de treino (limitados e truncados). NÃO leva
//   Design System (não gera UI) nem padrões de memória (só existem correções de
//   layout de Wireframe).
// - Wireframe: posição + lista de nomes dos componentes do Design System. As
//   correções manuais do PO vão no texto do prompt, em forma de RESUMO.
// Cada conteúdo vai em UM lugar só (ou no contexto, ou no texto do prompt).

// Exemplos de treino por Tipo de Planeta: os N mais recentes de cada tipo.
export const TRAINING_EXAMPLES_PER_KIND = 5;
// Cada lado de um exemplo (rascunho inicial / versão final) é cortado aqui
// (~650 tokens) — o par inicial/final continua mostrando a transformação.
export const EXAMPLE_TEXT_MAX_CHARS = 1800;
// PBIs de estilo da Galáxia: os N mais recentes, cada um cortado em ~3 mil chars.
export const PBI_STYLE_EXAMPLES_LIMIT = 4;
export const PBI_STYLE_TEXT_MAX_CHARS = 3000;
// Componentes do Design System enviados ao Wireframe (depois de remover
// nomes sem informação e repetidos).
export const DESIGN_SYSTEM_COMPONENT_LIMIT = 80;
// Correções manuais do PO resumidas no prompt do Wireframe.
export const LAYOUT_CORRECTION_SUMMARY_LIMIT = 8;

// Corta num limite de caracteres, preferindo terminar numa quebra de linha.
export function truncateText(text: string | null | undefined, maxChars: number): string {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastBreak = cut.lastIndexOf("\n");
  const base = lastBreak > maxChars * 0.6 ? cut.slice(0, lastBreak) : cut;
  return `${base.trimEnd()}\n[… trecho cortado para economizar espaço]`;
}

function leanPosition(pkg: ContextPackage) {
  const { universo, galaxia, estrela, planeta } = pkg.position;
  return { universo: universo.name, galaxia: galaxia.name, estrela: estrela.name, planeta: planeta.name };
}

// Contexto do Bridge Spec: texto puro, sem ids/URLs/datas.
export function buildBridgeSpecContext(pkg: ContextPackage) {
  const finalPairs = pkg.trainingExamples.FINAL_BDD_PBI.slice(-TRAINING_EXAMPLES_PER_KIND)
    .map((example) => ({
      planeta: example.origin.planet.name,
      rascunhoInicial: truncateText(example.initialTextContent, EXAMPLE_TEXT_MAX_CHARS),
      versaoFinalAprovada: truncateText(example.finalTextContent, EXAMPLE_TEXT_MAX_CHARS),
    }))
    .filter((example) => example.rascunhoInicial || example.versaoFinalAprovada);
  const transcripts = pkg.trainingExamples.RAW_TRANSCRIPT.slice(-TRAINING_EXAMPLES_PER_KIND)
    .map((example) => ({ planeta: example.origin.planet.name, transcricao: truncateText(example.textContent, EXAMPLE_TEXT_MAX_CHARS) }))
    .filter((example) => example.transcricao);
  return {
    posicao: leanPosition(pkg),
    exemplosDeTreino: { paresInicialFinalDeBridgeSpec: finalPairs, transcricoesBrutas: transcripts },
  };
}

// Nomes úteis do Design System: tira os sem informação ("Property 1=Variant2",
// "State=Default, ..." — nomes automáticos de variantes do Figma) e agrupa
// repetidos ("Alert/Modal (×2)"). A "categoria" já está no próprio nome
// (prefixo antes de "/", ex: "Alert/Modal").
export function designSystemComponentNames(components: ContextPackage["designSystemComponents"]): string[] {
  const counts = new Map<string, number>();
  for (const component of components) {
    const name = component.name.trim();
    if (!name || /^(Property \d+|State)=/i.test(name)) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .slice(0, DESIGN_SYSTEM_COMPONENT_LIMIT)
    .map(([name, count]) => (count > 1 ? `${name} (×${count})` : name));
}

// Contexto do Wireframe: posição + nomes dos componentes do Design System.
export function buildWireframeContext(pkg: ContextPackage) {
  const names = designSystemComponentNames(pkg.designSystemComponents);
  return {
    posicao: leanPosition(pkg),
    designSystem: names.length > 0 ? { componentesDisponiveis: names } : "nenhum Design System vinculado a esta Galáxia",
  };
}

interface SummaryBlock {
  id: string;
  label?: string;
  zone?: string;
  row?: number;
  order?: number;
  widthHint?: string;
  heightHint?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  hidden?: boolean;
  locked?: boolean;
  shape?: string;
  parentBlockId?: string | null;
}

function blocksOf(data: unknown): SummaryBlock[] {
  const blocks = (data as { blocks?: unknown } | null)?.blocks;
  return Array.isArray(blocks) ? (blocks.filter((b) => b && typeof (b as SummaryBlock).id === "string") as SummaryBlock[]) : [];
}

// Wireframes antigos não tinham alguns campos: ausente = valor padrão (não é mudança).
const withDefaults = (b: SummaryBlock) => ({ hidden: b.hidden ?? false, locked: b.locked ?? false, shape: b.shape ?? "rectangle", parentBlockId: b.parentBlockId ?? null });

const place = (b: SummaryBlock) => `${b.zone ?? "content"}, linha ${b.row ?? 0}, posição ${b.order ?? 0}`;

// Resume, em linhas curtas, o que o PO mudou numa correção manual (antes ->
// depois do wireframe inteiro). Calculado na hora, de forma determinística
// (sem IA, sem custo) — substitui o JSON completo antes/depois (2 a 5 mil
// tokens cada) por ~30 a 80 tokens.
export function summarizeLayoutCorrection(patternData: unknown): string[] {
  const data = patternData as { before?: unknown; after?: unknown } | null;
  const before = new Map(blocksOf(data?.before).map((b) => [b.id, b]));
  const after = new Map(blocksOf(data?.after).map((b) => [b.id, b]));
  const lines: string[] = [];

  after.forEach((a, id) => {
    const b = before.get(id);
    const name = a.label ?? "bloco";
    if (!b) {
      lines.push(`adicionou "${name}" (${place(a)})`);
      return;
    }
    if (b.label !== a.label) lines.push(`renomeou "${b.label}" para "${a.label}"`);
    if (b.zone !== a.zone || b.row !== a.row || b.order !== a.order) lines.push(`moveu "${name}" de (${place(b)}) para (${place(a)})`);
    if (b.widthHint !== a.widthHint || b.heightHint !== a.heightHint) {
      lines.push(`"${name}" agora tem largura ${a.widthHint} e altura ${a.heightHint}`);
    }
    const geometryChanged = (["x", "y", "width", "height"] as const).some((k) => Math.abs((a[k] ?? 0) - (b[k] ?? 0)) >= 8);
    if (geometryChanged) lines.push(`ajustou tamanho/posição de "${name}" (agora ${Math.round(a.width ?? 0)}×${Math.round(a.height ?? 0)} px)`);
    const flags = (["hidden", "locked", "shape", "parentBlockId"] as const).filter((k) => withDefaults(b)[k] !== withDefaults(a)[k]);
    if (flags.length > 0) lines.push(`alterou ${flags.join("/")} de "${name}"`);
  });
  before.forEach((b, id) => {
    if (!after.has(id)) lines.push(`removeu "${b.label ?? "bloco"}"`);
  });

  const unique = Array.from(new Set(lines));
  if (unique.length > 5) return [...unique.slice(0, 5), `(+${unique.length - 5} outras mudanças)`];
  return unique;
}

// Uma linha de resumo por correção, sem repetidas e sem as vazias (edição que
// não mudou nada de relevante), na ordem recebida (mais relevantes primeiro).
export function buildLayoutCorrectionSummaries(patterns: Array<{ patternData: unknown }>, limit = LAYOUT_CORRECTION_SUMMARY_LIMIT): string[] {
  const seen = new Set<string>();
  const structural: string[] = [];
  const geometryOnly: string[] = [];
  for (const pattern of patterns) {
    const lines = summarizeLayoutCorrection(pattern.patternData);
    if (lines.length === 0) continue;
    const text = lines.join("; ");
    if (seen.has(text)) continue;
    seen.add(text);
    // Ajuste só de tamanho/posição em pixels ensina menos que renomear, mover
    // de linha/zona ou adicionar/remover blocos — esses vêm primeiro.
    (lines.every((line) => line.startsWith("ajustou tamanho/posição")) ? geometryOnly : structural).push(text);
  }
  return [...structural, ...geometryOnly].slice(0, limit);
}
