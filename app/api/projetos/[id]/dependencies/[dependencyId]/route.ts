import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canManageProject } from "@/lib/projects/permissions";

interface Params {
  params: { id: string; dependencyId: string };
}

// DELETE /api/projetos/:id/dependencies/:dependencyId -> remove uma dependência.
export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const permission = await canManageProject({ projectId: params.id, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const dependency = await db.bridgeDependency.findUnique({ where: { id: params.dependencyId } });
  if (!dependency || dependency.projectId !== params.id) {
    return NextResponse.json({ error: "Dependência não encontrada neste Projeto." }, { status: 404 });
  }

  await db.bridgeDependency.delete({ where: { id: params.dependencyId } });
  return NextResponse.json({ ok: true });
}
