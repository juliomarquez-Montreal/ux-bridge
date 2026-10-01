import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canManageProject } from "@/lib/projects/permissions";

interface Params {
  params: { id: string; bridgeId: string };
}

// DELETE /api/projetos/:id/bridges/:bridgeId -> desvincula um Bridge deste
// Projeto (remove só o ProjectBridgeLink, nunca o Bridge em si).
export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const permission = await canManageProject({ projectId: params.id, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const link = await db.projectBridgeLink.findUnique({ where: { bridgeId: params.bridgeId } });
  if (!link || link.projectId !== params.id) {
    return NextResponse.json({ error: "Este Bridge não está vinculado a este Projeto." }, { status: 404 });
  }

  await db.projectBridgeLink.delete({ where: { bridgeId: params.bridgeId } });
  return NextResponse.json({ ok: true });
}
