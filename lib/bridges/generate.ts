import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { AIImagePart } from "@/lib/ai/types";
import { getAIProvider } from "@/lib/ai/provider";
import { buildContextPackage, type ContextPackage } from "@/lib/nova/buildContextPackage";

// Vocabulário fixo de regiões pro Sketch (Bridge-3a) — cada uma mapeia pra
// uma linha ou zona fixa da grade 2D desenhada pelo SketchPreview (nunca uma
// lista vertical simples): header (cabeçalho global, topo, largura total),
// sidebar (coluna estreita à esquerda), page-header (linha do título da
// página + botão de ação principal), toolbar (linha de busca/filtros),
// tabs (linha de abas de navegação/visualização, quando houver), main-table
// (conteúdo principal) e footer (rodapé/paginação, largura total).
// page-header/toolbar/tabs são linhas SEPARADAS mesmo quando próximas na
// tela real — antes só existia "toolbar" pra isso, o que forçava a IA a
// espremer 3 conceitos diferentes numa única linha.
const SKETCH_REGIONS = ["header", "sidebar", "page-header", "toolbar", "tabs", "main-table", "footer"] as const;
const SKETCH_SIZES = ["small", "medium", "large"] as const;

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

// Monta o prompt de geração do Sketch (Bridge-3a) — pede um JSON estruturado
// descrevendo a disposição da tela em blocos, nunca HTML/SVG livre, pra
// garantir que a renderização (SketchPreview) seja sempre confiável.
function buildSketchPrompt(bddPbiText: string, lastSketchRejectionComment: string | null, hasWireframeReference: boolean): string {
  const parts: string[] = [
    `Você projeta a estrutura básica de tela (sketch) para a interface descrita no BDD/PBI abaixo. NÃO desenhe HTML/SVG — retorne SOMENTE um JSON neste formato exato, sem nenhum texto antes ou depois:\n{"blocks": [{"label": "string", "region": "header|sidebar|page-header|toolbar|tabs|main-table|footer", "size": "small|medium|large", "order": 0}]}`,
    `"region" precisa vir EXATAMENTE deste vocabulário fixo, sem inventar outros nomes — cada um mapeia pra uma linha ou zona fixa do layout, de cima pra baixo: "header" (cabeçalho GLOBAL do sistema — logo, notificações, perfil do usuário — topo, largura total), "sidebar" (coluna estreita à esquerda, ex: menu lateral), "page-header" (a linha do TÍTULO da página + o botão de ação principal, ex: "Listagem de Projetos" + botão "Novo projeto"), "toolbar" (a linha de busca e filtros), "tabs" (a linha de abas de navegação/visualização, SÓ se a tela realmente tiver abas), "main-table" (o conteúdo principal — tabela, gráfico, cards, formulário) e "footer" (rodapé/paginação, largura total). "page-header", "toolbar" e "tabs" são linhas DIFERENTES E SEPARADAS mesmo quando aparecem próximas ou coladas na tela real — NUNCA junte o título da página com os filtros de busca, ou as abas com a busca, numa linha só.`,
    `Cada bloco representa UM ÚNICO elemento de interface real, com um nome SIMPLES e SINGULAR (ex: "Campo de busca", "Botão Filtros", "Dropdown Filtrar por Status", "Botão Novo projeto", "Título da página"). NUNCA combine dois elementos diferentes num nome só usando "+", "e" ou "/" (ex: nunca "Busca+Status" ou "Ações e status") — se uma linha tem busca E filtro, são DOIS blocos separados na mesma region (ex: os dois com region "toolbar", "order" diferente cada um). Badges/tags de status coloridos DENTRO das linhas de uma tabela são CONTEÚDO DE DADO da tabela, não elementos de navegação — nunca crie um bloco separado pra eles; se quiser, mencione isso só dentro do label do próprio bloco "main-table" (ex: "Tabela de listagem com coluna de status colorido"), nunca como bloco da toolbar.`,
    `"order" é um número inteiro indicando a posição HORIZONTAL do bloco dentro da mesma "region" (0 = mais à esquerda, 1 = o próximo à direita dele, etc.) — blocos de regions diferentes podem repetir o mesmo "order" sem problema, isso não importa entre regions diferentes. Observe a imagem de referência (quando houver) com atenção pra preencher esse campo refletindo a ordem visual real da esquerda pra direita — nunca invente uma ordem, replique a que está na imagem.`,
    `Liste os blocos na ordem visual de cima para baixo e da esquerda para a direita. Use o pacote de contexto fornecido — especialmente os componentes do Design System da Galáxia, quando houver — para nomear cada bloco com a terminologia real da equipe (ex: o nome exato de um componente do Figma). Se não houver Design System vinculado, use terminologia genérica de UI (ex: "Campo de busca", "Botão de filtro", "Tabela de listagem", "Coluna de ID").`,
    `BDD/PBI aprovado que este sketch precisa representar:\n"""\n${bddPbiText}\n"""`,
  ];

  if (hasWireframeReference) {
    parts.push(
      `Uma imagem de wireframe de referência real foi anexada a esta mensagem (arquivo enviado, não apenas mencionado). Use-a como referência da DISPOSIÇÃO REAL dos elementos — replique a estrutura (posições, proporção do menu lateral vs. área de conteúdo, alinhamento entre os blocos, ordem horizontal esquerda/direita dentro de cada linha), mas mantenha o resultado como um sketch simples de caixas (label/region/size/order), nunca uma descrição da aparência visual ou cópia de estilo.`
    );
  }

  if (lastSketchRejectionComment) {
    parts.push(
      `Uma tentativa anterior de sketch foi REJEITADA pelo PO com o seguinte comentário — corrija isso especificamente nesta nova versão:\n"""\n${lastSketchRejectionComment}\n"""`
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

// Busca a imagem/PDF de referência de wireframe mais relevante pro Planeta
// (prioriza um exemplo do próprio Planeta; senão usa o primeiro exemplo
// cruzado do mesmo Tipo de Planeta — já resolvidos por buildContextPackage)
// e baixa os bytes pra anexar como parte multimodal de verdade na geração do
// Sketch. Antes desta função, o Sketch só via a URL do arquivo como texto
// dentro do `context` (JSON.stringify) — nunca os pixels da imagem —, então
// a disposição gerada não tinha como refletir o wireframe real.
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

// Extrai e valida o JSON de blocos retornado pela IA. Tolerante a cercas de
// código markdown (```json ... ```) que alguns providers ainda incluem mesmo
// quando instruídos a não fazê-lo. Lança erro (-> ERRO_GERACAO) se o
// resultado não puder ser interpretado como um sketch válido.
function parseSketchResponse(rawText: string): Prisma.InputJsonValue {
  const stripped = rawText.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) throw new Error("A IA não retornou um JSON válido para o sketch.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped.slice(firstBrace, lastBrace + 1));
  } catch {
    throw new Error("A IA retornou um JSON inválido para o sketch.");
  }

  const blocksRaw = (parsed as { blocks?: unknown })?.blocks;
  if (!Array.isArray(blocksRaw) || blocksRaw.length === 0) {
    throw new Error("O JSON do sketch não contém nenhum bloco.");
  }

  const blocks = blocksRaw.map((item, index) => {
    const raw = item as { label?: unknown; region?: unknown; size?: unknown; order?: unknown };
    const label = typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : "Componente";
    const region = SKETCH_REGIONS.includes(raw.region as (typeof SKETCH_REGIONS)[number])
      ? (raw.region as (typeof SKETCH_REGIONS)[number])
      : "main-table";
    const size = SKETCH_SIZES.includes(raw.size as (typeof SKETCH_SIZES)[number])
      ? (raw.size as (typeof SKETCH_SIZES)[number])
      : "medium";
    // Índice no array como fallback — mantém a ordem visual "de cima pra
    // baixo / esquerda pra direita" que a IA já lista mesmo se "order" vier
    // ausente ou inválido.
    const order = typeof raw.order === "number" && Number.isFinite(raw.order) ? raw.order : index;
    return { label, region, size, order };
  });

  return { blocks } as Prisma.InputJsonValue;
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

// Roda a geração (ou regeração) do Sketch de um Bridge — só pode ser chamada
// depois do BDD/PBI aprovado (generatedBddPbi precisa existir). Mesma lógica
// de execução síncrona-dentro-da-requisição do runBddGeneration acima.
export async function runSketchGeneration(bridgeId: string): Promise<void> {
  await db.bridge.update({ where: { id: bridgeId }, data: { status: "GERANDO_SKETCH" } });

  const bridge = await db.bridge.findUniqueOrThrow({ where: { id: bridgeId } });

  try {
    if (!bridge.generatedBddPbi) throw new Error("Este Bridge ainda não tem um BDD/PBI aprovado para gerar o sketch.");

    const contextPackage = await buildContextPackage(bridge.planetContextNodeId);
    const provider = await getAIProvider();
    const wireframeImage = await fetchWireframeReferenceImage(contextPackage, bridge.planetContextNodeId);
    const prompt = buildSketchPrompt(bridge.generatedBddPbi, bridge.lastSketchRejectionComment, wireframeImage !== null);

    const { text } = await provider.generate({
      prompt,
      context: contextPackage,
      memoryPatterns: contextPackage.memoryPatterns,
      images: wireframeImage ? [wireframeImage] : undefined,
    });

    const sketchData = parseSketchResponse(text);

    await db.bridge.update({
      where: { id: bridgeId },
      data: { sketchData, status: "AGUARDANDO_APROVACAO_SKETCH", errorMessage: null },
    });
  } catch (error) {
    await db.bridge.update({
      where: { id: bridgeId },
      data: {
        status: "ERRO_GERACAO",
        errorMessage: error instanceof Error ? error.message : "Falha desconhecida ao gerar o sketch.",
      },
    });
  }
}
