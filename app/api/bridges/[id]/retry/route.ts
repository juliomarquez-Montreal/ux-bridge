import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canAccessBridgeForPlanet } from "@/lib/nova/permissions";
import { runBddGeneration, runSketchGeneration } from "@/lib/bridges/generate";
import { BRIDGE_WITH_PLANET_INCLUDE } from "@/lib/bridges/include";

export const maxDuration = 60;

interface Params {
  params: { id: string };
}

// POST /api/bridges/:id/retry -> tenta gerar de novo um Bridge que ficou em
// ERRO_GERACAO (falha da IA), sem comentário de correção — evita que o
// Bridge fique irrecuperável só porque a chamada à IA falhou uma vez.
// bddApprovedAt já preenchido indica que a falha aconteceu na etapa do
// Sketch (o BDD já tinha sido aprovado); senão a falha foi na etapa do BDD.
export async function POST(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  if (bridge.status !== "ERRO_GERACAO") {
    return NextResponse.json({ error: "Só é possível tentar novamente um Bridge com erro de geração." }, { status: 400 });
  }

  if (bridge.bddApprovedAt) {
    await runSketchGeneration(bridge.id);
  } else {
    await runBddGeneration(bridge.id);
  }

  const updated = await db.bridge.findUnique({ where: { id: bridge.id }, include: BRIDGE_WITH_PLANET_INCLUDE });
  return NextResponse.json({ bridge: updated });
}
