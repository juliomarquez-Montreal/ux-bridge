import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canManageProject } from "@/lib/projects/permissions";

interface Params {
  params: { id: string };
}

// POST /api/projetos/:id/sprints -> cria uma Sprint ({ name, startDate,
// endDate, notes? }) — formulário simples, sem simulador de cenários.
export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const permission = await canManageProject({ projectId: params.id, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const startDate = typeof body.startDate === "string" ? new Date(body.startDate) : null;
  const endDate = typeof body.endDate === "string" ? new Date(body.endDate) : null;
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;

  if (!name) return NextResponse.json({ error: "Nome da Sprint é obrigatório." }, { status: 400 });
  if (!startDate || Number.isNaN(startDate.getTime()) || !endDate || Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "Datas de início e fim são obrigatórias." }, { status: 400 });
  }
  if (endDate < startDate) {
    return NextResponse.json({ error: "A data de fim precisa ser depois da data de início." }, { status: 400 });
  }

  const sprint = await db.projectSprint.create({
    data: { projectId: params.id, name, startDate, endDate, notes },
  });
  return NextResponse.json({ sprint }, { status: 201 });
}
