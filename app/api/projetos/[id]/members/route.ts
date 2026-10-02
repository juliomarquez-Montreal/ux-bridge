import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canManageProject } from "@/lib/projects/permissions";
import { notifyUsers } from "@/lib/notifications/notify";

interface Params {
  params: { id: string };
}

const VALID_ROLES = ["PO", "UX"] as const;

// POST /api/projetos/:id/members -> adiciona um colaborador à equipe do
// Projeto ({ userId, role }). Um Projeto pode ter vários PO e vários UX
// (ver comentário no schema) — só bloqueia duplicar a MESMA pessoa no MESMO
// papel (@@unique([projectId, userId, role])).
export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const permission = await canManageProject({ projectId: params.id, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : "";
  const role = typeof body.role === "string" ? body.role : "";
  if (!userId) return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
  if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
    return NextResponse.json({ error: "role inválido. Use: PO | UX." }, { status: 400 });
  }

  const targetUser = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!targetUser) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  const existing = await db.projectMember.findUnique({
    where: { projectId_userId_role: { projectId: params.id, userId, role } },
  });
  if (existing) return NextResponse.json({ error: "Este usuário já está na equipe com este papel." }, { status: 409 });

  const member = await db.projectMember.create({ data: { projectId: params.id, userId, role } });
  const project = await db.project.findUnique({ where: { id: params.id }, select: { name: true, code: true } });
  await notifyUsers({
    userIds: [userId],
    actorId: user.id,
    type: "PROJECT_MEMBER_ADDED",
    title: "Você foi adicionado a um Projeto",
    body: `${user.name ?? "Alguém"} adicionou você como ${role} no Projeto "${project?.name ?? ""}"${project?.code ? ` (${project.code})` : ""}.`,
    linkUrl: `/projetos/${params.id}`,
  });
  return NextResponse.json({ member }, { status: 201 });
}
