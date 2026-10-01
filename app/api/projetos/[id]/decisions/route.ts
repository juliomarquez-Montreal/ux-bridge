import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canManageProject } from "@/lib/projects/permissions";

interface Params {
  params: { id: string };
}

// POST /api/projetos/:id/decisions -> registra uma Decisão (texto livre),
// com autor e data automáticos.
export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const permission = await canManageProject({ projectId: params.id, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Texto da decisão é obrigatório." }, { status: 400 });

  const decision = await db.projectDecision.create({ data: { projectId: params.id, text, authorId: user.id } });
  return NextResponse.json({ decision }, { status: 201 });
}
