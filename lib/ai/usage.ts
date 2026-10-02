import { appendFileSync } from "fs";
import type { GenerativeModel } from "@google/generative-ai";
import type { AIGenerateInput } from "@/lib/ai/types";

// Diagnóstico de consumo de tokens (FIX5-4a). DESLIGADO por padrão: só roda
// quando AI_USAGE_LOG=1 no ambiente (ex: .env.local em desenvolvimento) —
// em produção não faz nada, não muda o comportamento nem adiciona chamadas.
// Quando ligado, cada chamada ao Gemini registra uma linha JSON com tokens de
// prompt/resposta/raciocínio (usageMetadata real da API), duração e o peso de
// cada parte do prompt (via countTokens). Vai pro console ("[AI_USAGE] …") e,
// se AI_USAGE_FILE estiver definido, também é anexada a esse arquivo (.jsonl).
export const AI_USAGE_ENABLED = process.env.AI_USAGE_LOG === "1";

interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  thoughtsTokenCount?: number;
  cachedContentTokenCount?: number;
}

async function tokensOf(model: GenerativeModel, text: string): Promise<number> {
  if (!text) return 0;
  try {
    return (await model.countTokens(text)).totalTokens;
  } catch {
    return -1;
  }
}

export async function logAIUsage(input: {
  model: GenerativeModel;
  generateInput: AIGenerateInput;
  durationMs: number;
  usage: UsageMetadata | undefined;
  imageCount: number;
}): Promise<void> {
  const { model, generateInput, durationMs, usage, imageCount } = input;
  try {
    // Pesos por parte do prompt (tokens). O que sobra do total (instrução fixa
    // e colagens) aparece como "outros".
    const parts: Record<string, number> = {};

    const context = generateInput.context as Record<string, unknown> | undefined;
    if (context && typeof context === "object") {
      for (const [key, value] of Object.entries(context)) {
        parts[`contexto.${key}`] = await tokensOf(model, JSON.stringify(value, null, 2));
      }
    } else if (context !== undefined) {
      parts["contexto"] = await tokensOf(model, JSON.stringify(context, null, 2));
    }
    if (generateInput.memoryPatterns?.length) {
      parts["memoryPatterns (parâmetro separado)"] = await tokensOf(model, JSON.stringify(generateInput.memoryPatterns, null, 2));
    }
    for (const [name, text] of Object.entries(generateInput.usageParts ?? {})) {
      parts[`prompt.${name}`] = await tokensOf(model, text);
    }
    parts["prompt (total do texto)"] = await tokensOf(model, generateInput.prompt);

    const record = {
      at: new Date().toISOString(),
      label: generateInput.usageLabel ?? "sem_label",
      durationMs,
      promptTokens: usage?.promptTokenCount ?? null,
      outputTokens: usage?.candidatesTokenCount ?? null,
      thoughtsTokens: usage?.thoughtsTokenCount ?? 0,
      totalTokens: usage?.totalTokenCount ?? null,
      cachedTokens: usage?.cachedContentTokenCount ?? 0,
      images: imageCount,
      parts,
    };
    const line = JSON.stringify(record);
    console.log(`[AI_USAGE] ${line}`);
    if (process.env.AI_USAGE_FILE) appendFileSync(process.env.AI_USAGE_FILE, `${line}\n`);
  } catch (error) {
    console.error("[AI_USAGE] falha ao registrar uso:", error);
  }
}
