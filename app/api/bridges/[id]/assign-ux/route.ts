import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canAccessBridgeForPlanet } from "@/lib/nova/permissions";
import { BRIDGE_WITH_PLANET_INCLUDE } from "@/lib/bridges/include";
import { notifyUsers } from "@/lib/notifications/notify";

// POST /api/bridges/:id/assign-ux -> botão "+" ao lado dos avatares de PO/UX
// no subheader do editor (Wireframe-1a). Body: { userId: string | null } —
// null desatribui.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" && body.userId.trim() ? body.userId.trim() : null;

  if (userId) {
    const target = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!target) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  const updated = await db.bridge.update({
    where: { id: bridge.id },
    data: { uxUserId: userId },
    include: BRIDGE_WITH_PLANET_INCLUDE,
  });
  if (userId && userId !== bridge.uxUserId) {
    await notifyUsers({
      userIds: [userId],
      actorId: user.id,
      type: "BRIDGE_UX_ASSIGNED",
      title: "Você foi atribuído a um Bridge",
      body: `${user.name ?? "Alguém"} atribuiu você como UX do Bridge de ${updated.planet.name}.`,
      linkUrl: `/bridges/${bridge.id}`,
    });
  }
  return NextResponse.json({ bridge: updated });
}
