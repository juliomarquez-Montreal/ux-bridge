import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canAccessBridgeForPlanet } from "@/lib/nova/permissions";
import { BRIDGE_WITH_PLANET_INCLUDE } from "@/lib/bridges/include";
import { logActivity } from "@/lib/activity/logActivity";

// POST /api/bridges/:id/approve-wireframe -> botão "Aprovar Wireframe" no
// subheader do editor (Wireframe-1a). O PO já edita direto no canvas (mover/
// redimensionar/renomear — cada edição já grava seu próprio MemoryPattern em
// wireframe-edit), então este botão só fecha o ciclo desta fase: avança pra
// AGUARDANDO_APROVACAO_UX (o fluxo de avaliação do UX e envio ao Figma vem
// na Wireframe-2).
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  if (bridge.status !== "AGUARDANDO_APROVACAO_WIREFRAME_PO") {
    return NextResponse.json({ error: "Este Bridge não está aguardando aprovação do Wireframe." }, { status: 400 });
  }

  const updated = await db.bridge.update({
    where: { id: bridge.id },
    data: { status: "AGUARDANDO_APROVACAO_UX" },
    include: BRIDGE_WITH_PLANET_INCLUDE,
  });
  await logActivity({
    userId: user.id,
    action: "WIREFRAME_APPROVED_PO",
    entityType: "WIREFRAME",
    entityId: bridge.id,
    entityLabel: updated.planet.name,
    galaxyFromNodeId: bridge.planetContextNodeId,
  });
  return NextResponse.json({ bridge: updated });
}
