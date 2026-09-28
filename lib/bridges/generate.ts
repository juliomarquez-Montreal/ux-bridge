import { db } from "@/lib/db";
import { getAIProvider } from "@/lib/ai/provider";
import { buildContextPackage } from "@/lib/nova/buildContextPackage";

// Monta o prompt de geração do BDD/PBI. O pacote de contexto completo (posição
// na árvore, padrões de memória, exemplos de treino do mesmo Tipo de Planeta
// e componentes de Design System) vai à parte, via `context`/`memoryPatterns`
// do AIProvider — aqui só o material bruto + instrução + comentário de
// rejeição (quando houver).
function buildPrompt(rawMaterialText: string | null, rawMaterialFileUrl: string | null, lastRejectionComment: string | null): string {
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

// Roda a geração (ou regeração) do BDD/PBI de um Bridge e grava o resultado
// no banco. Chamado de dentro da própria requisição da API (criação, rejeição
// ou nova tentativa) — sem fila assíncrona: o registro já existe no banco
// (status GERANDO_BDD) antes desta função rodar, então fechar a aba no meio
// não perde o Bridge, só atrasa quando o resultado final aparece.
export async function runBridgeGeneration(bridgeId: string): Promise<void> {
  await db.bridge.update({ where: { id: bridgeId }, data: { status: "GERANDO_BDD" } });

  const bridge = await db.bridge.findUniqueOrThrow({ where: { id: bridgeId } });

  try {
    const contextPackage = await buildContextPackage(bridge.planetContextNodeId);
    const provider = await getAIProvider();
    const prompt = buildPrompt(bridge.rawMaterialText, bridge.rawMaterialFileUrl, bridge.lastRejectionComment);

    const { text } = await provider.generate({
      prompt,
      context: contextPackage,
      memoryPatterns: contextPackage.memoryPatterns,
    });

    await db.bridge.update({
      where: { id: bridgeId },
      data: { generatedBddPbi: text, status: "AGUARDANDO_APROVACAO_PO", errorMessage: null },
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
