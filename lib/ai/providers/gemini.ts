import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIGenerateInput, AIGenerateOutput, AIProvider } from "@/lib/ai/types";

// "-latest" acompanha automaticamente o modelo flash mais recente do Gemini,
// evitando repetir o problema de versões antigas (ex: 1.5, 2.5) serem descontinuadas.
const DEFAULT_MODEL = "gemini-flash-latest";

function buildPrompt(input: AIGenerateInput): string {
  const parts: string[] = [];

  if (input.context !== undefined) {
    parts.push(`Contexto:\n${JSON.stringify(input.context, null, 2)}`);
  }
  if (input.memoryPatterns?.length) {
    parts.push(`Padrões de memória conhecidos para este contexto:\n${JSON.stringify(input.memoryPatterns, null, 2)}`);
  }
  parts.push(input.prompt);

  return parts.join("\n\n");
}

export function createGeminiProvider(apiKey: string): AIProvider {
  return {
    name: "gemini",
    async generate(input: AIGenerateInput): Promise<AIGenerateOutput> {
      const client = new GoogleGenerativeAI(apiKey);
      const model = client.getGenerativeModel({ model: DEFAULT_MODEL });

      const result = await model.generateContent(buildPrompt(input));

      return { text: result.response.text(), raw: result.response };
    },
  };
}
