import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt, formatMaskedKey } from "@/lib/crypto";
import { requireAdmin } from "@/lib/auth-helpers";
import type { AIProviderName } from "@/lib/ai/types";

const VALID_PROVIDERS: AIProviderName[] = ["gemini", "openai", "claude"];

// GET: lista os 3 engines com a chave sempre mascarada (nunca o valor completo).
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: "Não autorizado." }, { status: auth.status });
  }

  const rows = await db.engineConfig.findMany();
  const byProvider = new Map(rows.map((row) => [row.provider, row]));

  const engines = VALID_PROVIDERS.map((provider) => {
    const row = byProvider.get(provider);
    return {
      provider,
      enabled: row?.enabled ?? false,
      hasKey: Boolean(row?.apiKeyEnc),
      apiKeyMasked: row?.apiKeyLast4 ? formatMaskedKey(row.apiKeyLast4) : null,
      updatedAt: row?.updatedAt ?? null,
    };
  });

  return NextResponse.json({ engines });
}

interface UpdateEngineBody {
  provider: AIProviderName;
  apiKey?: string;
  enabled?: boolean;
}

// POST: salva a chave (criptografada) e/ou liga o engine. Ligar um engine
// desativa os outros dois automaticamente, dentro da mesma transação.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: "Não autorizado." }, { status: auth.status });
  }

  const body = (await request.json()) as Partial<UpdateEngineBody>;

  if (!body.provider || !VALID_PROVIDERS.includes(body.provider)) {
    return NextResponse.json({ error: "provider inválido. Use: gemini | openai | claude." }, { status: 400 });
  }

  const apiKeyEnc = body.apiKey ? encrypt(body.apiKey) : undefined;
  const apiKeyLast4 = body.apiKey ? body.apiKey.slice(-4) : undefined;

  await db.$transaction(async (tx) => {
    if (body.enabled === true) {
      await tx.engineConfig.updateMany({
        where: { provider: { not: body.provider } },
        data: { enabled: false },
      });
    }

    await tx.engineConfig.upsert({
      where: { provider: body.provider },
      create: {
        provider: body.provider!,
        enabled: body.enabled ?? false,
        apiKeyEnc,
        apiKeyLast4,
        updatedById: auth.user.id,
      },
      update: {
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
        ...(apiKeyEnc ? { apiKeyEnc, apiKeyLast4 } : {}),
        updatedById: auth.user.id,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
