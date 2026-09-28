import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canAccessBridgeForPlanet } from "@/lib/nova/permissions";
import { runBridgeGeneration } from "@/lib/bridges/generate";
import { BRIDGE_WITH_PLANET_INCLUDE } from "@/lib/bridges/include";

export const maxDuration = 60;

interface Params {
  params: { id: string };
}

// POST /api/bridges/:id/reject -> PO rejeita com um comentário ({ comment }).
// Incrementa attemptCount, guarda o comentário e dispara nova geração
// (a IA recebe o comentário no prompt, ver lib/bridges/generate.ts).
export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  if (bridge.status !== "AGUARDANDO_APROVACAO_PO") {
    return NextResponse.json({ error: "Só é possível rejeitar um Bridge que esteja aguardando aprovação do PO." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  if (!comment) return NextResponse.json({ error: "Explique o que precisa ser corrigido." }, { status: 400 });

  await db.bridge.update({
    where: { id: bridge.id },
    data: { lastRejectionComment: comment, attemptCount: { increment: 1 }, status: "GERANDO_BDD" },
  });

  await runBridgeGeneration(bridge.id);

  const updated = await db.bridge.findUnique({ where: { id: bridge.id }, include: BRIDGE_WITH_PLANET_INCLUDE });
  return NextResponse.json({ bridge: updated });
}
