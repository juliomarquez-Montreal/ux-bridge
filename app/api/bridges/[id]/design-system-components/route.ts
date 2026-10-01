import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canAccessBridgeForPlanet, getGalaxyAncestorId } from "@/lib/nova/permissions";

interface Params {
  params: { id: string };
}

// GET /api/bridges/:id/design-system-components -> componentes disponíveis
// pra arrastar pro canvas (ferramenta Componentes, Wireframe-1c): todos os
// DesignSystemComponent de toda DesignSystemSource vinculada à Galáxia do
// Bridge atual (via DesignSystemGalaxyLink). `linked` distingue "Galáxia sem
// nenhum Design System vinculado" (false) de "vinculado mas sem componentes
// sincronizados ainda" (true + components: []) — o editor mostra uma
// mensagem diferente em cada caso.
export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id }, select: { planetContextNodeId: true } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const galaxyId = await getGalaxyAncestorId(bridge.planetContextNodeId);
  if (!galaxyId) return NextResponse.json({ linked: false, components: [] });

  const links = await db.designSystemGalaxyLink.findMany({
    where: { galaxyId },
    include: { source: { include: { components: { orderBy: { name: "asc" } } } } },
  });
  if (links.length === 0) return NextResponse.json({ linked: false, components: [] });

  const components = links
    .flatMap((link) => link.source.components.map((c) => ({ id: c.id, name: c.name, thumbnailUrl: c.thumbnailUrl })))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ linked: true, components });
}
