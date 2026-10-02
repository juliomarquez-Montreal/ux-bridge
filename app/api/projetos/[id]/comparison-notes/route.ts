import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canManageProject } from "@/lib/projects/permissions";

interface Params {
  params: { id: string };
}

// POST /api/projetos/:id/comparison-notes -> salva a anotação do PO sobre uma
// comparação de Bridge Specs ({ bridgeIds: string[] (>=2), note }).
export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const permission = await canManageProject({ projectId: params.id, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const bridgeIds: unknown = body.bridgeIds;
  if (!note) return NextResponse.json({ error: "Escreva a anotação antes de salvar." }, { status: 400 });
  if (!Array.isArray(bridgeIds) || bridgeIds.length < 2 || !bridgeIds.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "Selecione ao menos 2 Bridges para comparar." }, { status: 400 });
  }

  const linked = await db.projectBridgeLink.count({ where: { projectId: params.id, bridgeId: { in: bridgeIds as string[] } } });
  if (linked !== new Set(bridgeIds as string[]).size) {
    return NextResponse.json({ error: "Todos os Bridges comparados precisam estar vinculados a este Projeto." }, { status: 400 });
  }

  const created = await db.bridgeComparisonNote.create({
    data: { projectId: params.id, bridgeIds: Array.from(new Set(bridgeIds as string[])), note, authorId: user.id },
  });
  return NextResponse.json({ note: created }, { status: 201 });
}
