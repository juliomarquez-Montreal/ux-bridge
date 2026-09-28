import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { BRIDGE_WITH_PLANET_INCLUDE } from "@/lib/bridges/include";
import { canAccessBridgeForPlanet } from "@/lib/nova/permissions";

interface Params {
  params: { id: string };
}

// POST /api/bridges/:id/approve -> PO aprova o BDD/PBI gerado. Bridge-1 para
// por aqui (AGUARDANDO_WIREFRAME é estado final nesta fase — a geração de
// wireframe de verdade vem no Bridge-5).
export async function POST(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  if (bridge.status !== "AGUARDANDO_APROVACAO_PO") {
    return NextResponse.json({ error: "Só é possível aprovar um Bridge que esteja aguardando aprovação do PO." }, { status: 400 });
  }

  const updated = await db.bridge.update({
    where: { id: bridge.id },
    data: { status: "AGUARDANDO_WIREFRAME" },
    include: BRIDGE_WITH_PLANET_INCLUDE,
  });
  return NextResponse.json({ bridge: updated });
}
