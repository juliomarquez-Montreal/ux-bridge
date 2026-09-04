import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canManageGalaxy } from "@/lib/nova/permissions";

interface Params {
  params: { id: string };
}

// DELETE /api/nova/design-system/sources/:id -> remove a fonte e seus
// componentes (onDelete: Cascade no schema). Mesma permissão de
// editar/excluir Estrela/Planeta na Galáxia dona da fonte.
export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const source = await db.designSystemSource.findUnique({ where: { id: params.id } });
  if (!source) return NextResponse.json({ error: "Fonte não encontrada." }, { status: 404 });

  const permission = await canManageGalaxy({ galaxyId: source.galaxyId, user });
  if (!permission.allowed) {
    return NextResponse.json({ error: permission.reason }, { status: 403 });
  }

  await db.designSystemSource.delete({ where: { id: source.id } });
  return NextResponse.json({ ok: true });
}
