import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canManageProject } from "@/lib/projects/permissions";

interface Params {
  params: { id: string; sprintId: string };
}

async function loadSprint(params: Params["params"]) {
  const sprint = await db.projectSprint.findUnique({ where: { id: params.sprintId } });
  if (!sprint || sprint.projectId !== params.id) return null;
  return sprint;
}

// PATCH /api/projetos/:id/sprints/:sprintId -> edita uma Sprint existente.
export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const permission = await canManageProject({ projectId: params.id, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const sprint = await loadSprint(params);
  if (!sprint) return NextResponse.json({ error: "Sprint não encontrada neste Projeto." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data: { name?: string; startDate?: Date; endDate?: Date; notes?: string | null } = {};

  if (typeof body.name === "string") {
    if (!body.name.trim()) return NextResponse.json({ error: "Nome da Sprint não pode ficar vazio." }, { status: 400 });
    data.name = body.name.trim();
  }
  if (typeof body.startDate === "string") {
    const d = new Date(body.startDate);
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Data de início inválida." }, { status: 400 });
    data.startDate = d;
  }
  if (typeof body.endDate === "string") {
    const d = new Date(body.endDate);
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Data de fim inválida." }, { status: 400 });
    data.endDate = d;
  }
  if (typeof body.notes === "string") {
    data.notes = body.notes.trim() || null;
  }

  const startDate = data.startDate ?? sprint.startDate;
  const endDate = data.endDate ?? sprint.endDate;
  if (endDate < startDate) {
    return NextResponse.json({ error: "A data de fim precisa ser depois da data de início." }, { status: 400 });
  }

  const updated = await db.projectSprint.update({ where: { id: params.sprintId }, data });
  return NextResponse.json({ sprint: updated });
}

// DELETE /api/projetos/:id/sprints/:sprintId -> remove uma Sprint.
export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const permission = await canManageProject({ projectId: params.id, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const sprint = await loadSprint(params);
  if (!sprint) return NextResponse.json({ error: "Sprint não encontrada neste Projeto." }, { status: 404 });

  await db.projectSprint.delete({ where: { id: params.sprintId } });
  return NextResponse.json({ ok: true });
}
