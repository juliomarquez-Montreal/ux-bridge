import type { AIGenerateInput, AIGenerateOutput, AIProvider } from "@/lib/ai/types";

// TODO: implementar quando/se for ativado. Sem chave de API real por enquanto.
export function createClaudeProvider(_apiKey: string): AIProvider {
  return {
    name: "claude",
    async generate(_input: AIGenerateInput): Promise<AIGenerateOutput> {
      throw new Error("Provider Claude ainda não implementado.");
    },
  };
}
