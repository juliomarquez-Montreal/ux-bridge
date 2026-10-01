import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canManageProject } from "@/lib/projects/permissions";

interface Params {
  params: { id: string; memberId: string };
}

// DELETE /api/projetos/:id/members/:memberId -> remove um colaborador da
// equipe do Projeto.
export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const permission = await canManageProject({ projectId: params.id, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const member = await db.projectMember.findUnique({ where: { id: params.memberId } });
  if (!member || member.projectId !== params.id) {
    return NextResponse.json({ error: "Membro não encontrado neste Projeto." }, { status: 404 });
  }

  await db.projectMember.delete({ where: { id: params.memberId } });
  return NextResponse.json({ ok: true });
}
