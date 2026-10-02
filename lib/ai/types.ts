// Contrato único que todo motor de IA (Gemini, OpenAI, Claude) precisa implementar.
// O resto do sistema depende só disso, nunca de um SDK específico.

export type AIProviderName = "gemini" | "openai" | "claude";

// Parte de imagem/PDF pra uma chamada multimodal (texto + arquivo) — hoje só
// o provider gemini de fato envia isso pro modelo (ver
// lib/ai/providers/gemini.ts); os demais ignoram o campo com segurança.
export interface AIImagePart {
  mimeType: string;
  // Bytes do arquivo em base64 (sem o prefixo "data:...;base64,").
  data: string;
}

export interface AIGenerateInput {
  prompt: string;
  context?: unknown;
  memoryPatterns?: unknown[];
  images?: AIImagePart[];
  // Só pro diagnóstico de tokens (lib/ai/usage.ts, ligado por AI_USAGE_LOG=1):
  // rótulo da chamada e trechos nomeados do prompt pra medir o peso de cada um.
  usageLabel?: string;
  usageParts?: Record<string, string>;
}

export interface AIGenerateOutput {
  text: string;
  raw?: unknown;
}

export interface AIProvider {
  name: AIProviderName;
  generate(input: AIGenerateInput): Promise<AIGenerateOutput>;
}
