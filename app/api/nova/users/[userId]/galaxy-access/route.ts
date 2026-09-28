import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";

interface Params {
  params: { userId: string };
}

// POST /api/nova/users/:userId/galaxy-access -> vincula o usuário a uma
// Galáxia ({ galaxyId }). Só ADMIN. Fase N7: substitui o antigo
// User.contextNodeId (uma única Galáxia fixa) por N:N via UserGalaxyAccess.
export async function POST(request: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json(
      { error: admin.status === 401 ? "Não autorizado." : "Só administradores podem gerenciar acesso a Galáxias." },
      { status: admin.status }
    );
  }

  const targetUser = await db.user.findUnique({ where: { id: params.userId } });
  if (!targetUser) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const galaxyId = typeof body.galaxyId === "string" ? body.galaxyId : "";
  if (!galaxyId) return NextResponse.json({ error: "galaxyId é obrigatório." }, { status: 400 });

  const galaxy = await db.contextNode.findUnique({ where: { id: galaxyId } });
  if (!galaxy) return NextResponse.json({ error: "Galáxia não encontrada." }, { status: 404 });
  if (galaxy.type !== "GALAXIA") {
    return NextResponse.json({ error: "galaxyId precisa referenciar um nó do tipo Galáxia." }, { status: 400 });
  }

  const access = await db.userGalaxyAccess.upsert({
    where: { userId_galaxyId: { userId: targetUser.id, galaxyId } },
    create: { userId: targetUser.id, galaxyId },
    update: {},
  });

  return NextResponse.json({ access }, { status: 201 });
}
