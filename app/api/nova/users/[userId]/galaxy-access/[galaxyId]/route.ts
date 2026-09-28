import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";

interface Params {
  params: { userId: string; galaxyId: string };
}

// DELETE /api/nova/users/:userId/galaxy-access/:galaxyId -> remove o vínculo.
// Só ADMIN. Se a Galáxia removida era a currentGalaxyId do usuário, limpa
// também — não faz sentido continuar "selecionada" uma Galáxia à qual ele
// não tem mais acesso.
export async function DELETE(_request: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json(
      { error: admin.status === 401 ? "Não autorizado." : "Só administradores podem gerenciar acesso a Galáxias." },
      { status: admin.status }
    );
  }

  const targetUser = await db.user.findUnique({ where: { id: params.userId } });
  if (!targetUser) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  await db.userGalaxyAccess.deleteMany({ where: { userId: params.userId, galaxyId: params.galaxyId } });

  if (targetUser.currentGalaxyId === params.galaxyId) {
    await db.user.update({ where: { id: targetUser.id }, data: { currentGalaxyId: null } });
  }

  return NextResponse.json({ ok: true });
}
