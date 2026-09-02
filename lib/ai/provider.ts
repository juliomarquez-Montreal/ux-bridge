import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import type { AIProvider, AIProviderName } from "@/lib/ai/types";
import { createGeminiProvider } from "@/lib/ai/providers/gemini";
import { createOpenAIProvider } from "@/lib/ai/providers/openai";
import { createClaudeProvider } from "@/lib/ai/providers/claude";

const VALID_PROVIDERS: AIProviderName[] = ["gemini", "openai", "claude"];

function isValidProviderName(value: string): value is AIProviderName {
  return (VALID_PROVIDERS as string[]).includes(value);
}

function envKeyFor(name: AIProviderName): string | undefined {
  if (name === "gemini") return process.env.GEMINI_API_KEY;
  if (name === "openai") return process.env.OPENAI_API_KEY;
  return process.env.ANTHROPIC_API_KEY;
}

function buildProvider(name: AIProviderName, apiKey: string | undefined): AIProvider {
  if (!apiKey) {
    throw new Error(`Nenhuma chave de API disponível para o provider "${name}".`);
  }
  if (name === "gemini") return createGeminiProvider(apiKey);
  if (name === "openai") return createOpenAIProvider(apiKey);
  return createClaudeProvider(apiKey);
}

// Único ponto de acesso à camada de IA — todo o resto do sistema deve chamar
// SOMENTE esta função, nunca importar um provider específico diretamente.
//
// Prioridade de resolução:
// 1) EngineConfig no banco com enabled=true (chave descriptografada em runtime)
// 2) Fallback: AI_PROVIDER + <PROVIDER>_API_KEY do .env
export async function getAIProvider(): Promise<AIProvider> {
  const activeConfig = await db.engineConfig.findFirst({ where: { enabled: true } });

  if (activeConfig && isValidProviderName(activeConfig.provider)) {
    const apiKey = activeConfig.apiKeyEnc ? decrypt(activeConfig.apiKeyEnc) : envKeyFor(activeConfig.provider);
    return buildProvider(activeConfig.provider, apiKey);
  }

  const fallbackName = process.env.AI_PROVIDER ?? "gemini";
  if (!isValidProviderName(fallbackName)) {
    throw new Error(`AI_PROVIDER "${fallbackName}" inválido. Use: gemini | openai | claude.`);
  }

  return buildProvider(fallbackName, envKeyFor(fallbackName));
}
