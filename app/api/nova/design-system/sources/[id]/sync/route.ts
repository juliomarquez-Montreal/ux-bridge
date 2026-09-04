import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { FigmaApiError } from "@/lib/figma/client";
import { syncDesignSystemSource } from "@/lib/figma/sync";

interface Params {
  params: { id: string };
}

// Margem extra: mesmo com o upsert em lote (1 query), a busca no Figma de
// um arquivo grande pode levar alguns segundos.
export const maxDuration = 30;

// POST /api/nova/design-system/sources/:id/sync -> busca os componentes
// publicados do arquivo do Figma dessa fonte e faz upsert vinculado a ela.
// Catálogo global gerenciado por ADMIN. Nunca apaga componentes sozinho —
// só sinaliza quantos não vieram nesta rodada.
export async function POST(_request: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json(
      { error: admin.status === 401 ? "Não autorizado." : "Só administradores podem sincronizar Design Systems." },
      { status: admin.status }
    );
  }

  const source = await db.designSystemSource.findUnique({ where: { id: params.id } });
  if (!source) return NextResponse.json({ error: "Fonte não encontrada." }, { status: 404 });

  try {
    const result = await syncDesignSystemSource(source);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FigmaApiError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Falha inesperada ao consultar o Figma." }, { status: 502 });
  }
}
