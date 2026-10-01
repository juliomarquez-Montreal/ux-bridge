import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canManageProject } from "@/lib/projects/permissions";

interface Params {
  params: { id: string; decisionId: string };
}

// DELETE /api/projetos/:id/decisions/:decisionId -> remove uma Decisão
// registrada por engano.
export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const permission = await canManageProject({ projectId: params.id, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const decision = await db.projectDecision.findUnique({ where: { id: params.decisionId } });
  if (!decision || decision.projectId !== params.id) {
    return NextResponse.json({ error: "Decisão não encontrada neste Projeto." }, { status: 404 });
  }

  await db.projectDecision.delete({ where: { id: params.decisionId } });
  return NextResponse.json({ ok: true });
}
