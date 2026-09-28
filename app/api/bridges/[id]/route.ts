import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canAccessBridgeForPlanet } from "@/lib/nova/permissions";
import { BRIDGE_WITH_PLANET_INCLUDE } from "@/lib/bridges/include";

interface Params {
  params: { id: string };
}

// GET /api/bridges/:id -> detalhe de um Bridge (tela de revisão / resultado
// final), com Planeta/Estrela/Galáxia resolvidos.
export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridge = await db.bridge.findUnique({
    where: { id: params.id },
    include: BRIDGE_WITH_PLANET_INCLUDE,
  });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  return NextResponse.json({ bridge });
}
