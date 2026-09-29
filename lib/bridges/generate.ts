import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getAIProvider } from "@/lib/ai/provider";
import { buildContextPackage } from "@/lib/nova/buildContextPackage";

// Vocabulário fixo de regiões pro Sketch (Bridge-3a) — cada uma mapeia pra
// uma zona fixa da grade 2D desenhada pelo SketchPreview (nunca uma lista
// vertical simples): header (topo, largura total), sidebar (coluna estreita
// à esquerda), toolbar (barra de controles no topo da área de conteúdo —
// pode haver mais de um bloco, lado a lado), main-table (conteúdo principal,
// abaixo da toolbar) e footer (rodapé, largura total).
const SKETCH_REGIONS = ["header", "sidebar", "toolbar", "main-table", "footer"] as const;
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
function buildSketchPrompt(bddPbiText: string, lastSketchRejectionComment: string | null): string {
  const parts: string[] = [
    `Você projeta a estrutura básica de tela (sketch) para a interface descrita no BDD/PBI abaixo. NÃO desenhe HTML/SVG — retorne SOMENTE um JSON neste formato exato, sem nenhum texto antes ou depois:\n{"blocks": [{"label": "string", "region": "header|sidebar|toolbar|main-table|footer", "size": "small|medium|large"}]}`,
    `"region" precisa vir EXATAMENTE deste vocabulário fixo, sem inventar outros nomes — cada um mapeia pra uma zona fixa do layout: "header" (cabeçalho, topo, largura total), "sidebar" (coluna estreita à esquerda, ex: menu lateral), "toolbar" (barra de controles/filtros/ações no topo da área de conteúdo — se houver mais de um bloco de toolbar, eles ficam lado a lado na mesma linha), "main-table" (o conteúdo principal da tela — tabela, gráfico, cards, formulário, qualquer coisa que não seja header/sidebar/toolbar/footer) e "footer" (rodapé, largura total).`,
    `Liste os blocos na ordem visual de cima para baixo e da esquerda para a direita. Use o pacote de contexto fornecido — especialmente os componentes do Design System da Galáxia, quando houver — para nomear cada bloco com a terminologia real da equipe (ex: o nome exato de um componente do Figma). Se não houver Design System vinculado, use terminologia genérica de UI (ex: "Campo de busca", "Botão de filtro", "Tabela de listagem", "Coluna de ID").`,
    `BDD/PBI aprovado que este sketch precisa representar:\n"""\n${bddPbiText}\n"""`,
  ];

  if (lastSketchRejectionComment) {
    parts.push(
      `Uma tentativa anterior de sketch foi REJEITADA pelo PO com o seguinte comentário — corrija isso especificamente nesta nova versão:\n"""\n${lastSketchRejectionComment}\n"""`
    );
  }

  parts.push("Responda APENAS com o JSON descrito acima. Sem markdown, sem explicação, sem texto fora do JSON.");

  return parts.join("\n\n");
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

  const blocks = blocksRaw.map((item) => {
    const raw = item as { label?: unknown; region?: unknown; size?: unknown };
    const label = typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : "Componente";
    const region = SKETCH_REGIONS.includes(raw.region as (typeof SKETCH_REGIONS)[number])
      ? (raw.region as (typeof SKETCH_REGIONS)[number])
      : "main-table";
    const size = SKETCH_SIZES.includes(raw.size as (typeof SKETCH_SIZES)[number])
      ? (raw.size as (typeof SKETCH_SIZES)[number])
      : "medium";
    return { label, region, size };
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
    const prompt = buildSketchPrompt(bridge.generatedBddPbi, bridge.lastSketchRejectionComment);

    const { text } = await provider.generate({
      prompt,
      context: contextPackage,
      memoryPatterns: contextPackage.memoryPatterns,
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
