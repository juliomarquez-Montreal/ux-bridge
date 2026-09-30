import type { MemoryPattern, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { AIImagePart } from "@/lib/ai/types";
import { getAIProvider } from "@/lib/ai/provider";
import { buildContextPackage, type ContextPackage } from "@/lib/nova/buildContextPackage";
import type { WireframeHeightHint, WireframeWidthHint, WireframeZone } from "@/app/bridges/types";
import { computeWireframeLayout } from "@/lib/bridges/wireframeLayout";

// patternType gravado no MemoryPattern quando o PO edita um Wireframe
// manualmente (canto a canto no canvas) — ver runWireframeGeneration (uso no
// prompt) e app/api/bridges/[id]/wireframe-edit/route.ts (gravação).
export const WIREFRAME_LAYOUT_CORRECTION_PATTERN_TYPE = "WIREFRAME_LAYOUT_CORRECTION";

// Modelo genérico de "hints" que a IA usa pra descrever a estrutura de uma
// tela — só 4 zonas estruturais universais, sem lista fixa de "tipos de
// linha" (nada de "toolbar"/"tabs"/etc: isso variava por tela e forçava
// vocabulário novo a cada estrutura diferente). header/sidebar/footer são
// sempre largura-total-no-topo, coluna-estreita-à-esquerda-e-altura-cheia, e
// largura-total-na-base, respectivamente. Tudo o mais é "content", onde a IA
// decide livremente quantas linhas existem (via "row") e a disposição de
// cada uma (via "order"/widthHint/heightHint) observando a imagem de
// referência — nunca um nome de região fixo que não existe na tela real.
// Convertido em posição/tamanho absolutos em pixels uma única vez, logo após
// a geração — ver lib/bridges/wireframeLayout.ts.
const WIREFRAME_ZONES = ["header", "sidebar", "footer", "content"] as const;
const WIREFRAME_WIDTH_HINTS = ["fill", "auto"] as const;
const WIREFRAME_HEIGHT_HINTS = ["compact", "fill"] as const;

interface HintBlock {
  label: string;
  zone: WireframeZone;
  row: number;
  order: number;
  widthHint: WireframeWidthHint;
  heightHint: WireframeHeightHint;
}

// Monta o prompt de geração do BDD/PBI. O pacote de contexto completo (posição
// na árvore, padrões de memória, exemplos de treino do mesmo Tipo de Planeta
// e componentes de Design System) vai à parte, via `context`/`memoryPatterns`
// do AIProvider — aqui só o material bruto + instrução + comentário de
// rejeição (quando houver).
function buildBddPrompt(rawMaterialText: string | null, rawMaterialFileUrl: string | null, lastRejectionComment: string | null): string {
  const parts: string[] = [
    "Você transforma material bruto (transcrição, anotações, rascunho ou qualquer texto de entrada) em um BDD (Behavior-Driven Development) e PBI (Product Backlog Item) completo para um time ágil de produto/UX. Use o contexto fornecido — posição na árvore, padrões de memória, exemplos de treino do mesmo Tipo de Planeta (especialmente pares inicial/final de BDD/PBI já aprovados, que mostram a transformação esperada) e componentes de Design System da Galáxia, quando houver — como referência de padrão e estilo esperado.",
  ];

  if (rawMaterialText) {
    parts.push(`Material de entrada (arquivo de texto):\n"""\n${rawMaterialText}\n"""`);
  } else if (rawMaterialFileUrl) {
    // Upload de arquivo é só armazenado (mesma limitação já existente pros
    // exemplos de treino da NOVA — extração de conteúdo de arquivo não é
    // implementada nesta fase), então a IA é avisada explicitamente disso.
    parts.push(
      "O usuário anexou um arquivo como material de entrada. O conteúdo do arquivo não é extraído automaticamente nesta fase — gere o melhor BDD/PBI possível a partir do contexto disponível e deixe claro, no início do texto gerado, que o material original em arquivo precisa ser conferido manualmente pelo PO."
    );
  }

  if (lastRejectionComment) {
    parts.push(
      `Uma tentativa anterior foi REJEITADA pelo PO com o seguinte comentário — corrija isso especificamente nesta nova versão:\n"""\n${lastRejectionComment}\n"""`
    );
  }

  parts.push(
    "Responda em português, só com o conteúdo do BDD/PBI final (título, contexto, critérios de aceite em formato Gherkin quando fizer sentido, e uma descrição de PBI clara). Não inclua comentários sobre o processo de geração."
  );

  return parts.join("\n\n");
}

// Monta o prompt de geração do Wireframe — pede um JSON estruturado
// descrevendo a disposição da tela em blocos (mesmo modelo genérico
// zone/row/order/widthHint/heightHint de sempre), nunca HTML/SVG livre, pra
// garantir que a conversão pra pixels (computeWireframeLayout) seja sempre
// confiável.
function buildWireframePrompt(
  bddPbiText: string,
  lastWireframeRejectionComment: string | null,
  hasWireframeReference: boolean,
  layoutCorrections: MemoryPattern[]
): string {
  const parts: string[] = [
    `Você projeta a estrutura básica de tela (wireframe) para a interface descrita no BDD/PBI abaixo. NÃO desenhe HTML/SVG — retorne SOMENTE um JSON neste formato exato, sem nenhum texto antes ou depois:\n{"blocks": [{"label": "string", "zone": "header|sidebar|footer|content", "row": 0, "order": 0, "widthHint": "fill|auto", "heightHint": "compact|fill"}]}`,
    `"zone" só tem 4 valores possíveis, sem exceção: "header" (cabeçalho GLOBAL do sistema, topo, largura total), "sidebar" (coluna estreita à esquerda, ex: menu lateral, altura total), "footer" (rodapé/paginação, base, largura total) e "content" (TUDO o resto — título da página, botões, busca, filtros, abas, tabela, formulário, gráfico, cards — qualquer elemento específico dessa tela em particular). A maioria dos blocos vai em "content".`,
    `Dentro de "content", você decide livremente quantas LINHAS existem e o que tem em cada uma, observando a estrutura real da tela (ou da imagem de referência, quando houver) — não existe uma lista fixa de nomes de linha. Use "row" (0, 1, 2, 3... quantas forem necessárias) pra dizer em qual linha vertical o bloco está, de cima pra baixo. Elementos que ficam VISUALMENTE na mesma linha horizontal (ex: título da página + botão de ação ao lado; ou campo de busca + botão de filtro lado a lado) recebem o MESMO "row" e "order" diferentes. Elementos que ficam em linhas diferentes (ex: um botão de ação ABAIXO do título, não ao lado) recebem "row" diferentes — preste muita atenção nisso: só use o mesmo "row" quando os elementos realmente estão emparelhados horizontalmente na tela real, nunca por suposição.`,
    `Cada bloco representa UM ÚNICO elemento de interface real, com um nome SIMPLES e SINGULAR (ex: "Campo de busca", "Botão Filtros", "Dropdown Filtrar por Status", "Botão Novo projeto", "Título da página"). NUNCA combine dois elementos diferentes num nome só usando "+", "e" ou "/" (ex: nunca "Busca+Status" ou "Ações e status") — se uma linha tem busca E filtro, são DOIS blocos separados com o mesmo "row" e "order" diferente. Badges/tags de status coloridos DENTRO das linhas de uma tabela são CONTEÚDO DE DADO da tabela, não elementos de navegação — nunca crie um bloco separado pra eles; se quiser, mencione isso só dentro do label do próprio bloco de tabela (ex: "Tabela de listagem com coluna de status colorido"), nunca como um bloco à parte.`,
    `"order" é um número inteiro indicando a posição HORIZONTAL do bloco dentro da mesma zone+row (0 = mais à esquerda, 1 = o próximo à direita dele, etc.). Observe a imagem de referência (quando houver) com atenção pra preencher "row" e "order" refletindo a disposição visual real — nunca invente, replique o que está na imagem.`,
    `"widthHint": "fill" quando o elemento deve esticar pra ocupar o espaço disponível na linha (ex: um campo de busca, uma tabela); "auto" quando o elemento é compacto, do tamanho do próprio texto/ícone (ex: um botão pequeno, um dropdown, um ícone). "heightHint": IMPORTANTE PRA FINS EDUCATIVOS — o PO precisa aprender a reconhecer proporções reais de componentes, então observe as PROPORÇÕES REAIS da tela (ou imagem de referência) com atenção. Use "compact" pra elementos de controle — botões, campos de texto, títulos, abas — que são sempre baixos/rasos. Use "fill" SÓ pro conteúdo principal — tabela, gráfico, lista, formulário grande — que deve ocupar a MAIOR PARTE do espaço vertical disponível, muito maior que uma linha de botões ou filtros. Tamanhos desproporcionais atrapalham o aprendizado, então nunca marque uma tabela como "compact" nem um botão como "fill".`,
    `Liste os blocos na ordem visual de cima para baixo e da esquerda para a direita. Use o pacote de contexto fornecido — especialmente os componentes do Design System da Galáxia, quando houver — para nomear cada bloco com a terminologia real da equipe (ex: o nome exato de um componente do Figma). Se não houver Design System vinculado, use terminologia genérica de UI (ex: "Campo de busca", "Botão de filtro", "Tabela de listagem", "Coluna de ID").`,
    `BDD/PBI aprovado que este wireframe precisa representar:\n"""\n${bddPbiText}\n"""`,
  ];

  if (hasWireframeReference) {
    parts.push(
      `Uma imagem de wireframe de referência real foi anexada a esta mensagem (arquivo enviado, não apenas mencionado). Use-a como referência da DISPOSIÇÃO REAL dos elementos — replique a estrutura (quantas linhas existem, o que fica emparelhado na mesma linha vs. em linhas separadas, proporção do menu lateral vs. área de conteúdo, proporção de altura entre um controle compacto e o conteúdo principal, ordem horizontal esquerda/direita dentro de cada linha), mas mantenha o resultado como uma estrutura simples de caixas (label/zone/row/order/widthHint/heightHint), nunca uma descrição da aparência visual ou cópia de estilo.`
    );
  }

  if (layoutCorrections.length > 0) {
    // Correção manual do PO no canvas = verdade absoluta, prioridade máxima
    // — sempre veio com confidence 1.0 (ver
    // app/api/bridges/[id]/wireframe-edit/route.ts), então aparece aqui em
    // destaque, separado do resto dos memoryPatterns (que o provider já
    // inclui genericamente via JSON.stringify no context).
    const correctionsText = layoutCorrections
      .map((pattern, index) => {
        const data = pattern.patternData as { before?: unknown; after?: unknown };
        return `Correção ${index + 1} — o wireframe gerado pela IA (ANTES) era:\n${JSON.stringify(data.before)}\ne o PO editou manualmente pra (DEPOIS):\n${JSON.stringify(data.after)}`;
      })
      .join("\n\n");
    parts.push(
      `IMPORTANTE — O PO já CORRIGIU MANUALMENTE wireframes anteriores deste mesmo Tipo de Planeta. Trate isso como a preferência REAL da equipe, com prioridade MÁXIMA sobre qualquer outra inferência sua (inclusive sobre a imagem de referência, se as duas coisas conflitarem):\n\n${correctionsText}\n\nCompare o "antes" e o "depois" de cada correção — o que mudou de posição (zone/row/order), de proporção (widthHint/heightHint) ou de nome (label) é exatamente o que o PO considera certo. Replique esse padrão sempre que a situação for parecida nesta nova geração.`
    );
  }

  if (lastWireframeRejectionComment) {
    parts.push(
      `Uma tentativa anterior de wireframe foi REJEITADA pelo PO com o seguinte comentário — corrija isso especificamente nesta nova versão:\n"""\n${lastWireframeRejectionComment}\n"""`
    );
  }

  parts.push("Responda APENAS com o JSON descrito acima. Sem markdown, sem explicação, sem texto fora do JSON.");

  return parts.join("\n\n");
}

// Extensões que a IA consegue interpretar como arquivo multimodal de verdade
// (Gemini aceita imagem e PDF nativamente via inlineData) — qualquer outra
// extensão (ex: .fig, .sketch) é ignorada e cai de volta pro comportamento
// antigo (só o contexto em texto).
const REFERENCE_MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
};

function extensionOf(url: string): string {
  const withoutQuery = url.split("?")[0];
  return withoutQuery.split(".").pop()?.toLowerCase() ?? "";
}

// Busca correções manuais de layout (canvas do Wireframe) CRUZANDO Planetas
// do mesmo Tipo — mesmo escopo já usado pros WIREFRAME_REFERENCE em
// buildContextPackage.ts. `getRelevantPatterns`/`contextPackage.memoryPatterns`
// (usado pro BDD) só olha o Planeta exato, o que faria uma correção feita
// num Planeta nunca ensinar outro Planeta do mesmo Tipo — exatamente o
// oposto do que uma correção de layout deveria fazer.
async function fetchLayoutCorrectionPatterns(planetContextNodeId: string): Promise<MemoryPattern[]> {
  const planet = await db.contextNode.findUnique({ where: { id: planetContextNodeId }, select: { planetTypeId: true } });
  if (!planet?.planetTypeId) return [];

  return db.memoryPattern.findMany({
    where: {
      patternType: WIREFRAME_LAYOUT_CORRECTION_PATTERN_TYPE,
      contextNode: { type: "PLANETA", planetTypeId: planet.planetTypeId },
    },
    orderBy: { confidence: "desc" },
    take: 2,
  });
}

// Busca a imagem/PDF de referência de wireframe mais relevante pro Planeta
// (prioriza um exemplo do próprio Planeta; senão usa o primeiro exemplo
// cruzado do mesmo Tipo de Planeta — já resolvidos por buildContextPackage)
// e baixa os bytes pra anexar como parte multimodal de verdade na geração do
// Wireframe.
async function fetchWireframeReferenceImage(
  contextPackage: ContextPackage,
  planetId: string
): Promise<AIImagePart | null> {
  const candidates = contextPackage.trainingExamples.WIREFRAME_REFERENCE.filter(
    (example): example is typeof example & { fileUrl: string } => Boolean(example.fileUrl)
  );
  if (candidates.length === 0) return null;

  const chosen = candidates.find((example) => example.origin.planet.id === planetId) ?? candidates[0];
  const mimeType = REFERENCE_MIME_BY_EXTENSION[extensionOf(chosen.fileUrl)];
  if (!mimeType) return null;

  try {
    const response = await fetch(chosen.fileUrl);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return { mimeType, data: buffer.toString("base64") };
  } catch {
    // Falha ao baixar (rede, arquivo removido do Storage etc.) não deve
    // derrubar a geração inteira — só segue sem a imagem de referência.
    return null;
  }
}

// Extrai e valida uma lista de blocos no formato de hints a partir de um
// valor bruto (a resposta em JSON da IA). Lança erro se não houver pelo
// menos um bloco.
export function normalizeWireframeHintBlocks(blocksRaw: unknown): HintBlock[] {
  if (!Array.isArray(blocksRaw) || blocksRaw.length === 0) {
    throw new Error("O wireframe precisa ter pelo menos um bloco.");
  }

  return blocksRaw.map((item, index) => {
    const raw = item as {
      label?: unknown;
      zone?: unknown;
      row?: unknown;
      order?: unknown;
      widthHint?: unknown;
      heightHint?: unknown;
    };
    const label = typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : "Componente";
    const zone = WIREFRAME_ZONES.includes(raw.zone as (typeof WIREFRAME_ZONES)[number])
      ? (raw.zone as (typeof WIREFRAME_ZONES)[number])
      : "content";
    const row = zone === "content" && typeof raw.row === "number" && Number.isFinite(raw.row) ? raw.row : 0;
    // Índice no array como fallback — mantém a ordem visual "de cima pra
    // baixo / esquerda pra direita" que a IA já lista mesmo se "order" vier
    // ausente ou inválido.
    const order = typeof raw.order === "number" && Number.isFinite(raw.order) ? raw.order : index;
    const widthHint = WIREFRAME_WIDTH_HINTS.includes(raw.widthHint as (typeof WIREFRAME_WIDTH_HINTS)[number])
      ? (raw.widthHint as (typeof WIREFRAME_WIDTH_HINTS)[number])
      : "fill";
    // header/footer são sempre compactos por definição (linha fixa, largura
    // total) — mesmo que a IA sugira "fill" por engano, ignora e força
    // "compact" pra essas duas zonas.
    const heightHint =
      zone === "header" || zone === "footer"
        ? "compact"
        : WIREFRAME_HEIGHT_HINTS.includes(raw.heightHint as (typeof WIREFRAME_HEIGHT_HINTS)[number])
          ? (raw.heightHint as (typeof WIREFRAME_HEIGHT_HINTS)[number])
          : "compact";
    return { label, zone, row, order, widthHint, heightHint };
  });
}

// Extrai e valida o JSON de blocos retornado pela IA, converte pro layout em
// pixels (computeWireframeLayout) e devolve o WireframeData pronto pra
// salvar. Tolerante a cercas de código markdown (```json ... ```) que alguns
// providers ainda incluem mesmo quando instruídos a não fazê-lo. Lança erro
// (-> ERRO_GERACAO) se o resultado não puder ser interpretado.
function parseWireframeResponse(rawText: string): Prisma.InputJsonValue {
  const stripped = rawText.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) throw new Error("A IA não retornou um JSON válido para o wireframe.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped.slice(firstBrace, lastBrace + 1));
  } catch {
    throw new Error("A IA retornou um JSON inválido para o wireframe.");
  }

  const hintBlocks = normalizeWireframeHintBlocks((parsed as { blocks?: unknown })?.blocks);
  const wireframeData = computeWireframeLayout(hintBlocks);
  return wireframeData as unknown as Prisma.InputJsonValue;
}

// Roda a geração (ou regeração) do BDD/PBI de um Bridge e grava o resultado
// no banco. Chamado de dentro da própria requisição da API (criação, rejeição
// ou nova tentativa) — sem fila assíncrona: o registro já existe no banco
// (status GERANDO_BDD) antes desta função rodar, então fechar a aba no meio
// não perde o Bridge, só atrasa quando o resultado final aparece.
export async function runBddGeneration(bridgeId: string): Promise<void> {
  await db.bridge.update({ where: { id: bridgeId }, data: { status: "GERANDO_BDD" } });

  const bridge = await db.bridge.findUniqueOrThrow({ where: { id: bridgeId } });

  try {
    const contextPackage = await buildContextPackage(bridge.planetContextNodeId);
    const provider = await getAIProvider();
    const prompt = buildBddPrompt(bridge.rawMaterialText, bridge.rawMaterialFileUrl, bridge.lastRejectionComment);

    const { text } = await provider.generate({
      prompt,
      context: contextPackage,
      memoryPatterns: contextPackage.memoryPatterns,
    });

    await db.bridge.update({
      where: { id: bridgeId },
      data: {
        generatedBddPbi: text,
        // Só grava na primeira vez — versões seguintes (após rejeição) não
        // sobrescrevem a versão inicial, usada no PlanetExample quando aprovado.
        firstGeneratedBddPbi: bridge.firstGeneratedBddPbi ?? text,
        status: "AGUARDANDO_APROVACAO_BDD",
        errorMessage: null,
      },
    });
  } catch (error) {
    await db.bridge.update({
      where: { id: bridgeId },
      data: {
        status: "ERRO_GERACAO",
        errorMessage: error instanceof Error ? error.message : "Falha desconhecida ao gerar o BDD/PBI.",
      },
    });
  }
}

// Roda a geração (ou regeração) do Wireframe de um Bridge — só pode ser
// chamada depois do BDD/PBI aprovado (generatedBddPbi precisa existir).
// Dispara DIRETO ao aprovar o BDD (Wireframe-1a substitui a etapa de Sketch
// que existia antes). Mesma lógica de execução síncrona-dentro-da-requisição
// do runBddGeneration acima.
export async function runWireframeGeneration(bridgeId: string): Promise<void> {
  await db.bridge.update({ where: { id: bridgeId }, data: { status: "GERANDO_WIREFRAME" } });

  const bridge = await db.bridge.findUniqueOrThrow({ where: { id: bridgeId } });

  try {
    if (!bridge.generatedBddPbi) throw new Error("Este Bridge ainda não tem um BDD/PBI aprovado para gerar o wireframe.");

    const contextPackage = await buildContextPackage(bridge.planetContextNodeId);
    const provider = await getAIProvider();
    const wireframeImage = await fetchWireframeReferenceImage(contextPackage, bridge.planetContextNodeId);
    // Cruza Planetas do mesmo Tipo (não só o Planeta exato deste Bridge) —
    // ver fetchLayoutCorrectionPatterns.
    const layoutCorrections = await fetchLayoutCorrectionPatterns(bridge.planetContextNodeId);
    const prompt = buildWireframePrompt(
      bridge.generatedBddPbi,
      bridge.lastWireframeRejectionComment,
      wireframeImage !== null,
      layoutCorrections
    );

    const { text } = await provider.generate({
      prompt,
      context: contextPackage,
      memoryPatterns: contextPackage.memoryPatterns,
      images: wireframeImage ? [wireframeImage] : undefined,
    });

    const wireframeData = parseWireframeResponse(text);

    await db.bridge.update({
      where: { id: bridgeId },
      data: {
        wireframeData,
        poUserId: bridge.poUserId ?? bridge.createdById,
        status: "AGUARDANDO_APROVACAO_WIREFRAME_PO",
        errorMessage: null,
      },
    });
  } catch (error) {
    await db.bridge.update({
      where: { id: bridgeId },
      data: {
        status: "ERRO_GERACAO",
        errorMessage: error instanceof Error ? error.message : "Falha desconhecida ao gerar o wireframe.",
      },
    });
  }
}
