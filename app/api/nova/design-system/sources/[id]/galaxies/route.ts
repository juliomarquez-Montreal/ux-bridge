import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canManageGalaxy } from "@/lib/nova/permissions";

interface Params {
  params: { id: string };
}

// POST /api/nova/design-system/sources/:id/galaxies -> vincula esta fonte a
// uma Galáxia ({ galaxyId }). Mesma permissão de criar/editar Estrela/
// Planeta naquela Galáxia (ADMIN em qualquer uma, usuário comum só na
// própria) — usado tanto pelo modal "Vincular Design System" da aba
// Universo quanto por "Vincular a Galáxias" da aba Design System.
export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const source = await db.designSystemSource.findUnique({ where: { id: params.id } });
  if (!source) return NextResponse.json({ error: "Fonte não encontrada." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const galaxyId = typeof body.galaxyId === "string" ? body.galaxyId : "";
  if (!galaxyId) return NextResponse.json({ error: "galaxyId é obrigatório." }, { status: 400 });

  const galaxy = await db.contextNode.findUnique({ where: { id: galaxyId } });
  if (!galaxy) return NextResponse.json({ error: "Galáxia não encontrada." }, { status: 404 });
  if (galaxy.type !== "GALAXIA") {
    return NextResponse.json({ error: "galaxyId precisa referenciar um nó do tipo Galáxia." }, { status: 400 });
  }

  const permission = await canManageGalaxy({ galaxyId, user });
  if (!permission.allowed) {
    return NextResponse.json({ error: permission.reason }, { status: 403 });
  }

  const link = await db.designSystemGalaxyLink.upsert({
    where: { sourceId_galaxyId: { sourceId: source.id, galaxyId } },
    create: { sourceId: source.id, galaxyId, linkedById: user.id },
    update: {},
  });

  return NextResponse.json({ link }, { status: 201 });
}
