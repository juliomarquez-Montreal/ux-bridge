import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canAccessBridgeForPlanet } from "@/lib/nova/permissions";
import { runBddGeneration, runWireframeGeneration } from "@/lib/bridges/generate";
import { BRIDGE_WITH_PLANET_INCLUDE } from "@/lib/bridges/include";

export const maxDuration = 60;

interface Params {
  params: { id: string };
}

// POST /api/bridges/:id/reject -> PO rejeita com um comentário ({ comment }).
// Qual etapa é rejeitada depende do status atual do Bridge:
// - AGUARDANDO_APROVACAO_BDD: incrementa attemptCount, guarda o comentário e
//   regenera o BDD/PBI (comentário incorporado ao próximo prompt).
// - AGUARDANDO_APROVACAO_WIREFRAME_PO: "Eu não gostei, gerar de novo do
//   zero" (Wireframe-1a) — como o PO já pode editar direto no canvas, isso é
//   só uma opção alternativa quando a correção manual não vale a pena;
//   incrementa wireframeAttemptCount, guarda o comentário e regenera o
//   wireframe do zero via IA.
export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  if (bridge.status !== "AGUARDANDO_APROVACAO_BDD" && bridge.status !== "AGUARDANDO_APROVACAO_WIREFRAME_PO") {
    return NextResponse.json({ error: "Este Bridge não está aguardando aprovação." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  if (!comment) return NextResponse.json({ error: "Explique o que precisa ser corrigido." }, { status: 400 });

  if (bridge.status === "AGUARDANDO_APROVACAO_BDD") {
    await db.bridge.update({
      where: { id: bridge.id },
      data: { lastRejectionComment: comment, attemptCount: { increment: 1 }, status: "GERANDO_BDD" },
    });
    await runBddGeneration(bridge.id);
  } else {
    await db.bridge.update({
      where: { id: bridge.id },
      data: { lastWireframeRejectionComment: comment, wireframeAttemptCount: { increment: 1 }, status: "GERANDO_WIREFRAME" },
    });
    await runWireframeGeneration(bridge.id);
  }

  const updated = await db.bridge.findUnique({ where: { id: bridge.id }, include: BRIDGE_WITH_PLANET_INCLUDE });
  return NextResponse.json({ bridge: updated });
}
