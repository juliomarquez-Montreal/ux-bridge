import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIGenerateInput, AIGenerateOutput, AIProvider } from "@/lib/ai/types";
import { AI_USAGE_ENABLED, logAIUsage } from "@/lib/ai/usage";

// "-latest" acompanha automaticamente o modelo flash mais recente do Gemini,
// evitando repetir o problema de versões antigas (ex: 1.5, 2.5) serem descontinuadas.
const DEFAULT_MODEL = "gemini-flash-latest";

function buildPrompt(input: AIGenerateInput): string {
  const parts: string[] = [];

  if (input.context !== undefined) {
    parts.push(`Contexto:\n${JSON.stringify(input.context)}`);
  }
  if (input.memoryPatterns?.length) {
    parts.push(`Padrões de memória conhecidos para este contexto:\n${JSON.stringify(input.memoryPatterns)}`);
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

      // Multimodal: texto + partes de imagem/PDF na mesma chamada (ex: o
      // wireframe de referência do Bridge-3a). Sem isso, uma imagem só
      // chegava como URL em texto dentro do `context` — o modelo nunca via
      // os pixels de verdade.
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: buildPrompt(input) },
      ];
      for (const image of input.images ?? []) {
        parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
      }

      const startedAt = Date.now();
      const result = await model.generateContent(parts);
      const durationMs = Date.now() - startedAt;

      if (AI_USAGE_ENABLED) {
        await logAIUsage({
          model,
          generateInput: input,
          durationMs,
          usage: result.response.usageMetadata as Parameters<typeof logAIUsage>[0]["usage"],
          imageCount: input.images?.length ?? 0,
        });
      }

      return { text: result.response.text(), raw: result.response };
    },
  };
}
