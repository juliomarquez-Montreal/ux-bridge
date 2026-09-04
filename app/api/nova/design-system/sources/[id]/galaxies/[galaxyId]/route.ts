import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canManageGalaxy } from "@/lib/nova/permissions";
import { db } from "@/lib/db";

interface Params {
  params: { id: string; galaxyId: string };
}

// DELETE /api/nova/design-system/sources/:id/galaxies/:galaxyId -> remove o
// vínculo entre esta fonte e esta Galáxia (não apaga a fonte nem seus
// componentes — só deixa de "aparecer" pra essa Galáxia). Mesma permissão
// de vincular.
export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const permission = await canManageGalaxy({ galaxyId: params.galaxyId, user });
  if (!permission.allowed) {
    return NextResponse.json({ error: permission.reason }, { status: 403 });
  }

  await db.designSystemGalaxyLink.deleteMany({ where: { sourceId: params.id, galaxyId: params.galaxyId } });
  return NextResponse.json({ ok: true });
}
