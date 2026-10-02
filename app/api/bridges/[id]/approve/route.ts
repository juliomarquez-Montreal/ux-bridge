import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { BRIDGE_WITH_PLANET_INCLUDE } from "@/lib/bridges/include";
import { runWireframeGeneration } from "@/lib/bridges/generate";
import { canAccessBridgeForPlanet } from "@/lib/nova/permissions";
import { logActivity } from "@/lib/activity/logActivity";
import { getAdminIds, getGalaxyAccessUserIds, notifyUsers } from "@/lib/notifications/notify";

// A aprovação do BDD dispara a geração do Wireframe dentro da própria
// requisição (mesmo padrão síncrono do Bridge-1) — pode levar um tempo.
export const maxDuration = 60;

interface Params {
  params: { id: string };
}

// POST /api/bridges/:id/approve -> PO confirma o texto do BDD/PBI
// (AGUARDANDO_APROVACAO_BDD). Grava bddApprovedAt, cria o PlanetExample (par
// inicial/final) automaticamente e dispara a geração do Wireframe DIRETO
// (Wireframe-1a — não existe mais a etapa intermediária de Sketch),
// avançando para AGUARDANDO_APROVACAO_WIREFRAME_PO. A aprovação final do
// Wireframe acontece de dentro do próprio editor — ver
// app/api/bridges/[id]/approve-wireframe/route.ts.
export async function POST(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  if (bridge.status !== "AGUARDANDO_APROVACAO_BDD") {
    return NextResponse.json({ error: "Este Bridge não está aguardando aprovação do Bridge Spec." }, { status: 400 });
  }
  if (!bridge.generatedBddPbi) {
    return NextResponse.json({ error: "Este Bridge não tem um Bridge Spec gerado." }, { status: 400 });
  }

  await db.bridge.update({ where: { id: bridge.id }, data: { bddApprovedAt: new Date() } });

  // Fecha o ciclo de memória (item 9 do Bridge-3a): a primeira versão
  // gerada vira initialTextContent, a versão finalmente aprovada vira
  // finalTextContent — alimenta a Memória do Tipo de Planeta sem esforço
  // manual do usuário.
  await db.planetExample.create({
    data: {
      contextNodeId: bridge.planetContextNodeId,
      kind: "FINAL_BDD_PBI",
      initialTextContent: bridge.firstGeneratedBddPbi ?? bridge.generatedBddPbi,
      finalTextContent: bridge.generatedBddPbi,
      uploadedById: user.id,
    },
  });

  await runWireframeGeneration(bridge.id);

  const updated = await db.bridge.findUnique({ where: { id: bridge.id }, include: BRIDGE_WITH_PLANET_INCLUDE });
  await logActivity({
    userId: user.id,
    action: "BRIDGE_SPEC_APPROVED",
    entityType: "BRIDGE",
    entityId: bridge.id,
    entityLabel: updated?.planet.name ?? "Bridge",
    galaxyFromNodeId: bridge.planetContextNodeId,
  });
  // Quem espera a próxima etapa (aprovar o Wireframe): o PO e quem criou o Bridge.
  await notifyUsers({
    userIds: [bridge.poUserId, bridge.createdById],
    actorId: user.id,
    type: "BRIDGE_SPEC_APPROVED",
    title: "Bridge Spec (BS) aprovado",
    body: `${user.name ?? "Alguém"} aprovou o Bridge Spec de ${updated?.planet.name ?? "um Bridge"}. Próxima etapa: aprovação do Wireframe pelo PO.`,
    linkUrl: `/bridges/${bridge.id}`,
  });
  return NextResponse.json({ bridge: updated });
}
