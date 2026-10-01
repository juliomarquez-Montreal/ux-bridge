// Isola o bloco de Acceptance Criteria em Gherkin de um PBI real enviado como
// exemplo — o resto do documento (ID da tarefa, tipo, criado por, story
// points, iteration path, related work, commits, branches, pull requests
// etc.) é ruído que nunca deve chegar ao PbiStyleSource.extractedAcceptanceCriteria.
import { getAIProvider } from "@/lib/ai/provider";

const EXTRACTION_INSTRUCTION =
  "Extraia APENAS o bloco de Acceptance Criteria em formato Gherkin deste documento de PBI (o texto que começa com \"Funcionalidade:\" e contém \"Cenário:\", \"Dado\", \"Quando\", \"Então\"). Ignore completamente qualquer metadado como ID, tipo, criado por, atribuído a, story points, iteration path, related work, commits, branches, pull requests, ou qualquer outro texto que não seja parte do Acceptance Criteria em si. Retorne APENAS o texto limpo do Acceptance Criteria, sem comentários adicionais.";

export async function extractAcceptanceCriteria(rawText: string): Promise<string> {
  const provider = await getAIProvider();
  const prompt = `${EXTRACTION_INSTRUCTION}\n\nDocumento:\n"""\n${rawText}\n"""`;
  const { text } = await provider.generate({ prompt });
  const cleaned = text.trim();
  if (!cleaned) {
    throw new Error("Não foi possível extrair o Acceptance Criteria deste arquivo — confira se ele contém um bloco Gherkin.");
  }
  return cleaned;
}
