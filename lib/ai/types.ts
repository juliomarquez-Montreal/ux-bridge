// Contrato único que todo motor de IA (Gemini, OpenAI, Claude) precisa implementar.
// O resto do sistema depende só disso, nunca de um SDK específico.

export type AIProviderName = "gemini" | "openai" | "claude";

export interface AIGenerateInput {
  prompt: string;
  context?: unknown;
  memoryPatterns?: unknown[];
}

export interface AIGenerateOutput {
  text: string;
  raw?: unknown;
}

export interface AIProvider {
  name: AIProviderName;
  generate(input: AIGenerateInput): Promise<AIGenerateOutput>;
}
